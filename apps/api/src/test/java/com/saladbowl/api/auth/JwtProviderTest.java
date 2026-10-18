package com.saladbowl.api.auth;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtProviderTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret";

    private final JwtProvider provider = new JwtProvider(
            new JwtProperties(SECRET, Duration.ofMinutes(15), Duration.ofDays(14)));

    @Test
    void issuedAccessTokenParsesBackToUserId() {
        String token = provider.issue(42L, JwtProvider.TokenType.ACCESS);

        assertThat(provider.parseUserId(token, JwtProvider.TokenType.ACCESS)).isEqualTo(42L);
    }

    @Test
    void refreshTokenIsRejectedWhereAccessExpected() {
        String refresh = provider.issue(42L, JwtProvider.TokenType.REFRESH);

        assertThatThrownBy(() -> provider.parseUserId(refresh, JwtProvider.TokenType.ACCESS))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_TOKEN);
    }

    @Test
    void expiredTokenIsRejected() {
        JwtProvider expired = new JwtProvider(
                new JwtProperties(SECRET, Duration.ofSeconds(-1), Duration.ofDays(14)));
        String token = expired.issue(42L, JwtProvider.TokenType.ACCESS);

        assertThatThrownBy(() -> provider.parseUserId(token, JwtProvider.TokenType.ACCESS))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = provider.issue(42L, JwtProvider.TokenType.ACCESS) + "x";

        assertThatThrownBy(() -> provider.parseUserId(token, JwtProvider.TokenType.ACCESS))
                .isInstanceOf(ApiException.class);
    }
}
