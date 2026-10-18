package com.saladbowl.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * refresh 토큰 쿠키 속성. 배포 구성(같은 출처 프록시 / 개인 도메인)에 따라 값만 바꾼다.
 * 브라우저가 보는 경로 기준이므로 Pages 프록시 구성에서는 /api/auth다.
 */
@ConfigurationProperties(prefix = "app.auth.refresh-cookie")
public record RefreshCookieProperties(String path, String sameSite, boolean secure) {
}
