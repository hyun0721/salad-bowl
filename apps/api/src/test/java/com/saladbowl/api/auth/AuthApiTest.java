package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    private void signup(String email) throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123","nickname":"tester"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").isNumber());
    }

    private MvcResult login(String email, String password) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andReturn();
    }

    @Test
    void signupThenLoginIssuesAccessTokenAndRefreshCookie() throws Exception {
        signup("a@test.com");

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"a@test.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().httpOnly("refresh_token", true));
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        signup("dup@test.com");

        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"dup@test.com","password":"password123","nickname":"x"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
    }

    @Test
    void shortPasswordReturns400() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"short@test.com","password":"short","nickname":"x"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void tooLongEmailReturns400() throws Exception {
        String email = "a".repeat(250) + "@test.com";

        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123","nickname":"x"}
                                """.formatted(email)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void wrongPasswordReturns401() throws Exception {
        signup("b@test.com");

        MvcResult result = login("b@test.com", "wrong-password");

        org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus()).isEqualTo(401);
        org.assertj.core.api.Assertions.assertThat(result.getResponse().getContentAsString())
                .contains("INVALID_CREDENTIALS");
    }

    @Test
    void refreshCookieIssuesNewAccessToken() throws Exception {
        signup("c@test.com");
        Cookie refresh = login("c@test.com", "password123").getResponse().getCookie("refresh_token");

        mvc.perform(post("/auth/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(cookie().exists("refresh_token"));
    }

    @Test
    void refreshWithoutCookieReturns401() throws Exception {
        mvc.perform(post("/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }
}
