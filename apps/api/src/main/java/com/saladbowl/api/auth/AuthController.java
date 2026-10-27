package com.saladbowl.api.auth;

import com.saladbowl.api.auth.AuthDtos.IssuedTokens;
import com.saladbowl.api.auth.AuthDtos.LoginRequest;
import com.saladbowl.api.auth.AuthDtos.SignupRequest;
import com.saladbowl.api.auth.AuthDtos.SignupResponse;
import com.saladbowl.api.auth.AuthDtos.TokenResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Locale;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "refresh_token";
    private static final Pattern IP_FORMAT = Pattern.compile("[0-9A-Fa-f:.]{1,45}");

    private final AuthService authService;
    private final JwtProvider jwt;
    private final RefreshCookieProperties cookieProperties;

    public AuthController(AuthService authService, JwtProvider jwt, RefreshCookieProperties cookieProperties) {
        this.authService = authService;
        this.jwt = jwt;
        this.cookieProperties = cookieProperties;
    }

    @PostMapping("/signup")
    public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new SignupResponse(authService.signup(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletRequest http) {
        return withTokens(authService.login(request, clientIp(http)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        // 쿠키는 로그인 때 한 번만 심고 14일 뒤 끝난다. 여기서 다시 심으면 늦게 도착한 응답이 새 세션 쿠키를
        // 덮어쓰고, 탈취된 토큰의 수명이 무한히 늘어난다.
        return ResponseEntity.ok(new TokenResponse(authService.refresh(refreshToken)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
    }

    // 프록시가 실제 클라이언트 IP를 X-Client-IP로 넣는다. 프록시 비밀이 맞은 요청에서만 믿고,
    // 형식이 IP가 아니면(길이·문자) 키 폭주를 막으려 remoteAddr를 쓴다.
    static String clientIp(HttpServletRequest http) {
        String header = http.getHeader("X-Client-IP");
        if (Boolean.TRUE.equals(http.getAttribute(ProxySecretFilter.TRUSTED_ATTRIBUTE)) && header != null) {
            String ip = header.trim();
            if (IP_FORMAT.matcher(ip).matches()) {
                return ip.toLowerCase(Locale.ROOT);
            }
        }
        return http.getRemoteAddr();
    }

    private ResponseEntity<TokenResponse> withTokens(IssuedTokens tokens) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(tokens.refreshToken(), jwt.refreshTtl()).toString())
                .body(new TokenResponse(tokens.accessToken()));
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(cookieProperties.secure())
                .sameSite(cookieProperties.sameSite())
                .path(cookieProperties.path())
                .maxAge(maxAge)
                .build();
    }
}
