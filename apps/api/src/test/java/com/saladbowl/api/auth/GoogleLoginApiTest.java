package com.saladbowl.api.auth;

import com.saladbowl.api.auth.GoogleIdTokenVerifier.GoogleIdentity;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GoogleLoginApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate jdbc;
    @MockitoBean
    GoogleIdTokenVerifier verifier;

    private void googleLogin(String token, int expectedStatus) throws Exception {
        mvc.perform(post("/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":\"%s\"}".formatted(token)))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    void newGoogleUserIsCreatedAndGetsTokens() throws Exception {
        when(verifier.verify("t")).thenReturn(new GoogleIdentity("sub-1", "New@Test.com", true, "새 사용자"));

        mvc.perform(post("/auth/google").contentType(MediaType.APPLICATION_JSON).content("{\"idToken\":\"t\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(cookie().httpOnly("refresh_token", true));

        assertEquals("새 사용자", jdbc.queryForObject(
                "select nickname from users where email = 'new@test.com'", String.class));
    }

    @Test
    void repeatedGoogleLoginReusesSameUser() throws Exception {
        when(verifier.verify("t")).thenReturn(new GoogleIdentity("sub-1", "a@test.com", true, "A"));
        googleLogin("t", 200);
        googleLogin("t", 200);
        assertEquals(1, jdbc.queryForObject("select count(*) from users", Integer.class));
    }

    @Test
    void linksExistingPasswordAccountWhenEmailVerified() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"a@test.com\",\"password\":\"password123\",\"nickname\":\"orig\"}"));
        when(verifier.verify("t")).thenReturn(new GoogleIdentity("sub-1", "a@test.com", true, "Other"));

        googleLogin("t", 200);

        assertEquals(1, jdbc.queryForObject("select count(*) from users", Integer.class));
        assertEquals("sub-1", jdbc.queryForObject("select google_sub from users", String.class));
        assertEquals("orig", jdbc.queryForObject("select nickname from users", String.class));
    }

    @Test
    void doesNotLinkWhenGoogleEmailUnverified() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"a@test.com\",\"password\":\"password123\",\"nickname\":\"orig\"}"));
        when(verifier.verify("t")).thenReturn(new GoogleIdentity("sub-1", "a@test.com", false, "x"));

        googleLogin("t", 401);
    }

    @Test
    void googleOnlyUserCannotLoginWithPassword() throws Exception {
        when(verifier.verify("t")).thenReturn(new GoogleIdentity("sub-1", "a@test.com", true, "A"));
        googleLogin("t", 200);

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"a@test.com\",\"password\":\"password123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenIsRejected() throws Exception {
        when(verifier.verify("bad")).thenThrow(new ApiException(ErrorCode.INVALID_TOKEN, "invalid"));
        googleLogin("bad", 401);
    }
}
