package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(AuthHardeningTest.ClockConfig.class)
class AuthHardeningTest extends IntegrationTest {

    /** 15분 경과를 시험하려고 시각을 앞으로 돌릴 수 있는 Clock. */
    static class MovableClock extends Clock {
        private volatile Instant now = Instant.parse("2026-01-01T00:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        @Primary
        MovableClock movableClock() {
            return new MovableClock();
        }
    }

    @Autowired MockMvc mvc;
    @Autowired MovableClock clock;
    @Autowired JdbcTemplate jdbc;

    // 리미터 상태는 DB 정리와 무관하게 남으므로 테스트마다 이메일·IP를 새로 쓴다.
    private static String uniq() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private void signup(String email) throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123","nickname":"t"}
                                """.formatted(email)))
                .andExpect(status().isCreated());
    }

    private MvcResult login(String email, String password, String ip) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .header("X-Client-IP", ip)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andReturn();
    }

    private Cookie loginCookie(String email, String ip) throws Exception {
        MvcResult r = login(email, "password123", ip);
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        return r.getResponse().getCookie("refresh_token");
    }

    private int tokenVersion(String email) {
        return jdbc.queryForObject("SELECT token_version FROM users WHERE email = ?", Integer.class, email);
    }

    // ---- refresh 토큰 폐기 ----

    @Test
    void refreshTokenCarriesVerClaimAndMismatchIsRejected() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        Cookie old = loginCookie(email, "10.0.0.1");

        mvc.perform(post("/auth/refresh").cookie(old)).andExpect(status().isOk());

        jdbc.update("UPDATE users SET token_version = token_version + 1 WHERE email = ?", email);
        mvc.perform(post("/auth/refresh").cookie(old))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void refreshTokenWithoutVerIsRejected() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        long id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        // ver 없는 구 형식 토큰
        String legacy = new JwtProvider(new JwtProperties("test-secret-test-secret-test-secret-test-secret",
                Duration.ofMinutes(15), Duration.ofDays(14))).issue(id, JwtProvider.TokenType.REFRESH);

        mvc.perform(post("/auth/refresh").cookie(new Cookie("refresh_token", legacy)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void logoutRevokesOtherRefreshTokensOfSameUser() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        Cookie a = loginCookie(email, "10.0.0.2");
        Cookie b = loginCookie(email, "10.0.0.2");

        mvc.perform(post("/auth/logout").cookie(a)).andExpect(status().isNoContent());

        assertThat(tokenVersion(email)).isEqualTo(1);
        mvc.perform(post("/auth/refresh").cookie(b)).andExpect(status().isUnauthorized());
        mvc.perform(post("/auth/refresh").cookie(a)).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutWithoutOrInvalidCookieIs204AndKeepsVersion() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);

        mvc.perform(post("/auth/logout")).andExpect(status().isNoContent());
        mvc.perform(post("/auth/logout").cookie(new Cookie("refresh_token", "garbage")))
                .andExpect(status().isNoContent());
        mvc.perform(post("/auth/logout").cookie(new Cookie("refresh_token", "")))
                .andExpect(status().isNoContent());

        assertThat(tokenVersion(email)).isZero();
    }

    @Test
    void logoutWithStaleTokenDoesNotBumpVersionAgain() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        Cookie a = loginCookie(email, "10.0.0.3");

        mvc.perform(post("/auth/logout").cookie(a)).andExpect(status().isNoContent());
        mvc.perform(post("/auth/logout").cookie(a)).andExpect(status().isNoContent());

        assertThat(tokenVersion(email)).isEqualTo(1);
    }

    // ---- 로그인 횟수 제한 ----

    @Test
    void sixthAttemptByEmailIs429EvenWithCorrectPassword() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        for (int i = 0; i < 5; i++) {
            assertThat(login(email, "wrong-password", "10.1.0." + i).getResponse().getStatus()).isEqualTo(401);
        }

        MvcResult r = login(email, "password123", "10.1.0.99");

        assertThat(r.getResponse().getStatus()).isEqualTo(429);
        assertThat(r.getResponse().getContentAsString()).contains("TOO_MANY_ATTEMPTS");
        assertThat(r.getResponse().getHeader("Retry-After")).isEqualTo("900");
    }

    @Test
    void retryAfterIsRemainingSecondsRoundedUp() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        for (int i = 0; i < 5; i++) {
            login(email, "wrong-password", "10.2.0.1");
        }
        clock.advance(Duration.ofMillis(1500));

        MvcResult r = login(email, "password123", "10.2.0.2");

        assertThat(r.getResponse().getHeader("Retry-After")).isEqualTo("899");
    }

    @Test
    void allowedAgainAfterFifteenMinutes() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        for (int i = 0; i < 5; i++) {
            login(email, "wrong-password", "10.3.0.1");
        }
        assertThat(login(email, "password123", "10.3.0.1").getResponse().getStatus()).isEqualTo(429);

        clock.advance(Duration.ofMinutes(15));

        assertThat(login(email, "password123", "10.3.0.1").getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void successResetsEmailCounter() throws Exception {
        String email = uniq() + "@t.com";
        signup(email);
        for (int i = 0; i < 4; i++) {
            login(email, "wrong-password", "10.4.0.1");
        }
        assertThat(login(email, "password123", "10.4.0.1").getResponse().getStatus()).isEqualTo(200);

        for (int i = 0; i < 4; i++) {
            assertThat(login(email, "wrong-password", "10.4.0.1").getResponse().getStatus()).isEqualTo(401);
        }
        assertThat(login(email, "password123", "10.4.0.1").getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void unknownEmailCountsToo() throws Exception {
        String email = uniq() + "@nobody.com";
        for (int i = 0; i < 5; i++) {
            assertThat(login(email, "whatever123", "10.5.0." + i).getResponse().getStatus()).isEqualTo(401);
        }

        assertThat(login(email, "whatever123", "10.5.0.99").getResponse().getStatus()).isEqualTo(429);
    }

    @Test
    void twentyFailuresFromOneIpBlockEvenOtherEmails() throws Exception {
        String ip = "10.6." + (int) (Math.random() * 200) + ".7";
        for (int i = 0; i < 20; i++) {
            assertThat(login(uniq() + "@nobody.com", "whatever123", ip).getResponse().getStatus()).isEqualTo(401);
        }

        MvcResult r = login(uniq() + "@nobody.com", "whatever123", ip);

        assertThat(r.getResponse().getStatus()).isEqualTo(429);
        assertThat(r.getResponse().getHeader("Retry-After")).isNotNull();
    }

    @Test
    void clientIpHeaderSeparatesCounters() throws Exception {
        String ip = "10.7." + (int) (Math.random() * 200) + ".7";
        for (int i = 0; i < 20; i++) {
            login(uniq() + "@nobody.com", "whatever123", ip);
        }

        assertThat(login(uniq() + "@nobody.com", "whatever123", ip).getResponse().getStatus()).isEqualTo(429);
        assertThat(login(uniq() + "@nobody.com", "whatever123", "10.7.255.255").getResponse().getStatus())
                .isEqualTo(401);
    }
}
