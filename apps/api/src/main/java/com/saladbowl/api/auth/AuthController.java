package com.saladbowl.api.auth;

import com.saladbowl.api.auth.AuthDtos.GoogleLoginRequest;
import com.saladbowl.api.auth.AuthDtos.IssuedTokens;
import com.saladbowl.api.auth.AuthDtos.LoginRequest;
import com.saladbowl.api.auth.AuthDtos.SignupRequest;
import com.saladbowl.api.auth.AuthDtos.SignupResponse;
import com.saladbowl.api.auth.AuthDtos.TokenResponse;
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
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return withTokens(authService.login(request));
    }

    @PostMapping("/google")
    public ResponseEntity<TokenResponse> google(@Valid @RequestBody GoogleLoginRequest request) {
        return withTokens(authService.loginWithGoogle(request.idToken()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        return withTokens(authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
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
