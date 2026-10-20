package com.saladbowl.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

/** HS256 키는 256비트 이상이어야 한다. 짧은 비밀키는 기동할 때 실패시킨다. */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, Duration accessTtl, Duration refreshTtl) {

    static final int MIN_SECRET_BYTES = 32;

    public JwtProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalArgumentException("app.jwt.secret must be at least " + MIN_SECRET_BYTES + " bytes");
        }
    }
}
