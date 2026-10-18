package com.saladbowl.api.auth;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtProvider {

    public enum TokenType { ACCESS, REFRESH }

    private static final String TYPE_CLAIM = "typ";

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtProvider(JwtProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String issue(long userId, TokenType type) {
        Duration ttl = type == TokenType.ACCESS ? properties.accessTtl() : properties.refreshTtl();
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .claim(TYPE_CLAIM, type.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public long parseUserId(String token, TokenType expected) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
            if (!expected.name().equals(claims.get(TYPE_CLAIM, String.class))) {
                throw new ApiException(ErrorCode.INVALID_TOKEN, "unexpected token type");
            }
            return Long.parseLong(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "invalid token");
        }
    }

    public Duration refreshTtl() {
        return properties.refreshTtl();
    }
}
