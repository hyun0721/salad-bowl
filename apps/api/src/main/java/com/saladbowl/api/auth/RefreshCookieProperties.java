package com.saladbowl.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Set;

/**
 * refresh 토큰 쿠키 속성. 배포 구성(같은 출처 프록시 / 개인 도메인)에 따라 값만 바꾼다.
 * 브라우저가 보는 경로 기준이므로 Pages 프록시 구성에서는 /api/auth다.
 * 잘못된 조합(예: SameSite=None인데 Secure가 아님)은 브라우저가 쿠키를 버리므로 기동할 때 막는다.
 */
@ConfigurationProperties(prefix = "app.auth.refresh-cookie")
public record RefreshCookieProperties(String path, String sameSite, boolean secure) {

    private static final Set<String> SAME_SITE_VALUES = Set.of("Strict", "Lax", "None");

    public RefreshCookieProperties {
        if (path == null || !path.startsWith("/")) {
            throw new IllegalArgumentException("app.auth.refresh-cookie.path must start with /");
        }
        if (!SAME_SITE_VALUES.contains(sameSite)) {
            throw new IllegalArgumentException("app.auth.refresh-cookie.same-site must be Strict, Lax or None");
        }
        if ("None".equals(sameSite) && !secure) {
            throw new IllegalArgumentException("SameSite=None requires secure=true");
        }
    }
}
