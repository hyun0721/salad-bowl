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
    private static final String VER_CLAIM = "ver";

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtProvider(JwtProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    /** refresh 토큰 파싱 결과. ver가 없는(폐기 도입 전) 토큰은 ver가 null이다. */
    public record RefreshClaims(long userId, Integer ver) {
    }

    public String issue(long userId, TokenType type) {
        return issue(userId, type, null);
    }

    public String issueRefresh(long userId, int ver) {
        return issue(userId, TokenType.REFRESH, ver);
    }

    private String issue(long userId, TokenType type, Integer ver) {
        Duration ttl = type == TokenType.ACCESS ? properties.accessTtl() : properties.refreshTtl();
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .claim(TYPE_CLAIM, type.name())
                .claim(VER_CLAIM, ver)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public long parseUserId(String token, TokenType expected) {
        return Long.parseLong(parse(token, expected).getSubject());
    }

    public RefreshClaims parseRefresh(String token) {
        Claims claims = parse(token, TokenType.REFRESH);
        return new RefreshClaims(Long.parseLong(claims.getSubject()), claims.get(VER_CLAIM, Integer.class));
    }

    private Claims parse(String token, TokenType expected) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
            if (!expected.name().equals(claims.get(TYPE_CLAIM, String.class))) {
                throw new ApiException(ErrorCode.INVALID_TOKEN, "unexpected token type");
            }
            Long.parseLong(claims.getSubject());
            return claims;
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "invalid token");
        }
    }

    public Duration refreshTtl() {
        return properties.refreshTtl();
    }
}
