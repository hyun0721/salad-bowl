package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "app.security.proxy-secret=s3cret-value")
class ProxySecretTest extends IntegrationTest {

    @Autowired MockMvc mvc;

    @Test
    void missingOrWrongSecretIs403InErrorFormat() throws Exception {
        mvc.perform(post("/auth/refresh"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(post("/auth/refresh").header("X-Proxy-Secret", "nope"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/me/transactions"))
                .andExpect(status().isForbidden());
    }

    @Test
    void correctSecretPassesToNormalHandling() throws Exception {
        mvc.perform(post("/auth/refresh").header("X-Proxy-Secret", "s3cret-value"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void healthNeedsNoSecret() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void onlyTheExactHealthPathSkipsTheSecret() throws Exception {
        mvc.perform(get("/actuator/health/liveness")).andExpect(status().isForbidden());
        mvc.perform(get("/actuator/healthz")).andExpect(status().isForbidden());
    }

    @Test
    void clientIpHeaderIsOnlyTrustedWithSecretAndValidFormat() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("9.9.9.9");
        req.addHeader("X-Client-IP", " 1.2.3.4 ");
        assertThat(AuthController.clientIp(req)).isEqualTo("9.9.9.9");

        req.setAttribute(ProxySecretFilter.TRUSTED_ATTRIBUTE, true);
        assertThat(AuthController.clientIp(req)).isEqualTo("1.2.3.4");

        MockHttpServletRequest bad = new MockHttpServletRequest();
        bad.setRemoteAddr("9.9.9.9");
        bad.setAttribute(ProxySecretFilter.TRUSTED_ATTRIBUTE, true);
        bad.addHeader("X-Client-IP", "a".repeat(100));
        assertThat(AuthController.clientIp(bad)).isEqualTo("9.9.9.9");
    }
}
