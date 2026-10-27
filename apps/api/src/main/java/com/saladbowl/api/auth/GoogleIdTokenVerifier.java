package com.saladbowl.api.auth;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.util.List;

/** 구글 ID 토큰의 서명·발급자·대상(aud)·만료를 검증하고 계정 정보를 꺼낸다. */
@Component
public class GoogleIdTokenVerifier {

    public record GoogleIdentity(String sub, String email, boolean emailVerified, String name) {
    }

    private static final String JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final List<String> ISSUERS = List.of("https://accounts.google.com", "accounts.google.com");

    private final String clientId;
    private final NimbusJwtDecoder decoder;

    public GoogleIdTokenVerifier(@Value("${app.auth.google-client-id:}") String clientId) {
        this.clientId = clientId;
        this.decoder = NimbusJwtDecoder.withJwkSetUri(JWKS_URI).build();
        OAuth2TokenValidator<Jwt> issuer = token -> {
            String iss = token.getIssuer() == null ? null : token.getIssuer().toString();
            return iss != null && ISSUERS.contains(iss)
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(
                            new OAuth2Error("invalid_token", "bad issuer", null));
        };
        OAuth2TokenValidator<Jwt> audience = token -> token.getAudience().contains(clientId)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "bad audience", null));
        this.decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(), issuer, audience));
    }

    public boolean enabled() {
        return clientId != null && !clientId.isBlank();
    }

    public GoogleIdentity verify(String idToken) {
        if (!enabled()) {
            throw new ApiException(ErrorCode.GOOGLE_LOGIN_UNAVAILABLE, "google login is not configured");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException e) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "invalid google token");
        }
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "google token has no email");
        }
        return new GoogleIdentity(jwt.getSubject(), email,
                Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")), jwt.getClaimAsString("name"));
    }
}
