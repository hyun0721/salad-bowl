package com.saladbowl.api.auth;

import com.saladbowl.api.auth.AuthDtos.IssuedTokens;
import com.saladbowl.api.auth.AuthDtos.LoginRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthSettingsTest {

    private static final Duration ACCESS = Duration.ofMinutes(15);
    private static final Duration REFRESH = Duration.ofDays(14);

    @Test
    void jwtSecretMustBeAtLeast32Bytes() {
        assertThatThrownBy(() -> new JwtProperties("short-secret", ACCESS, REFRESH))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 32 bytes");
        assertThatThrownBy(() -> new JwtProperties(null, ACCESS, REFRESH))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatCode(() -> new JwtProperties("x".repeat(32), ACCESS, REFRESH)).doesNotThrowAnyException();
    }

    @Test
    void sameSiteIsRequired() {
        assertThatThrownBy(() -> new RefreshCookieProperties("/api/auth", null, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("same-site");
    }

    @Test
    void sameSiteMustBeAKnownValue() {
        assertThatThrownBy(() -> new RefreshCookieProperties("/api/auth", "lax", true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Strict, Lax or None");
        assertThatCode(() -> new RefreshCookieProperties("/api/auth", "Lax", false)).doesNotThrowAnyException();
        assertThatCode(() -> new RefreshCookieProperties("/api/auth", "Strict", true)).doesNotThrowAnyException();
    }

    @Test
    void sameSiteNoneRequiresSecure() {
        assertThatThrownBy(() -> new RefreshCookieProperties("/api/auth", "None", false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("requires secure");
        assertThatCode(() -> new RefreshCookieProperties("/api/auth", "None", true)).doesNotThrowAnyException();
    }

    @Test
    void cookiePathMustBeAbsolute() {
        assertThatThrownBy(() -> new RefreshCookieProperties("api/auth", "Lax", true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("start with /");
    }

    /** 쿠키를 만드는 코드가 설정값을 쓰는지 확인한다. Spring context 없이 컨트롤러를 직접 만든다. */
    @Test
    void refreshCookieFollowsConfiguredValues() {
        AuthService authService = mock(AuthService.class);
        when(authService.login(any(), any())).thenReturn(new IssuedTokens("access", "refresh"));
        JwtProvider jwt = new JwtProvider(new JwtProperties("x".repeat(32), ACCESS, REFRESH));
        AuthController controller = new AuthController(
                authService, jwt, new RefreshCookieProperties("/custom/auth", "Strict", false));

        String login = controller.login(new LoginRequest("a@b.c", "pw"), new MockHttpServletRequest()).getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        ResponseEntity<Void> logout = controller.logout(null);
        String cleared = logout.getHeaders().getFirst(HttpHeaders.SET_COOKIE);

        assertThat(login).contains("refresh_token=refresh", "Path=/custom/auth", "SameSite=Strict", "HttpOnly")
                .contains("Max-Age=" + REFRESH.toSeconds())
                .doesNotContain("Secure");
        assertThat(cleared).contains("Path=/custom/auth", "SameSite=Strict", "Max-Age=0")
                .doesNotContain("Secure");
    }
}
