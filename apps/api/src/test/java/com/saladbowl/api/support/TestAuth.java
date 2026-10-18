package com.saladbowl.api.support;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 통합 테스트용: 회원가입 후 로그인해서 id와 access 토큰을 돌려준다. */
public final class TestAuth {

    public static final String PASSWORD = "password123";

    public record AuthedUser(long id, String email, String token) {

        public String bearer() {
            return "Bearer " + token;
        }
    }

    private TestAuth() {
    }

    public static AuthedUser signupAndLogin(MockMvc mvc, String email, String nickname) throws Exception {
        String signupBody = mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","nickname":"%s"}
                                """.formatted(email, PASSWORD, nickname)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(signupBody, "$.userId")).longValue();

        String loginBody = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(loginBody, "$.accessToken");
        return new AuthedUser(id, email, token);
    }
}
