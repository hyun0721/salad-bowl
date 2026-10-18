package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RefreshCookieApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    private String loginSetCookie() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"cookie@test.com","password":"password123","nickname":"쿠키"}
                                """))
                .andExpect(status().isCreated());
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"cookie@test.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);
    }

    @Test
    void loginCookieUsesConfiguredAttributes() throws Exception {
        String setCookie = loginSetCookie();

        assertThat(setCookie).startsWith("refresh_token=")
                .contains("Path=/api/auth")
                .contains("SameSite=Lax")
                .contains("Secure")
                .contains("HttpOnly")
                .contains("Max-Age=1209600");
    }

    @Test
    void logoutClearsTheCookieWithSameAttributes() throws Exception {
        String setCookie = mvc.perform(post("/auth/logout"))
                .andExpect(status().isNoContent())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);

        assertThat(setCookie).startsWith("refresh_token=")
                .contains("Max-Age=0")
                .contains("Path=/api/auth")
                .contains("SameSite=Lax")
                .contains("HttpOnly");
    }
}
