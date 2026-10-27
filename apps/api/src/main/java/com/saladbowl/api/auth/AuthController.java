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

@RestController
@RequestMapping("/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "refresh_token";

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
        return withTokens(authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
    }

    // 웹 프록시가 실제 클라이언트 IP를 X-Client-IP로 넣는다. 직접 호출하면 위조할 수 있다.
    // shortcut: 위조되면 IP 제한만 우회되고 이메일 제한은 남는다, 프록시 전용 네트워크로 막을 수 있을 때 헤더를 신뢰 경계 안으로 좁힌다.
    private static String clientIp(HttpServletRequest http) {
        String header = http.getHeader("X-Client-IP");
        return header != null && !header.isBlank() ? header.trim() : http.getRemoteAddr();
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
