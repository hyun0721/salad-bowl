package com.saladbowl.api.version;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class VersionApiTest extends IntegrationTest {
    @Autowired MockMvc mvc;

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/version")).andExpect(status().isUnauthorized());
    }

    @Test
    void returnsImmutableBuildMetadataWithoutCaching() throws Exception {
        String token = TestAuth.signupAndLogin(mvc, "version@example.test", "version").token();
        mvc.perform(get("/version").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.version").value("dev"))
                .andExpect(jsonPath("$.commit").value("unknown"));
    }
}
