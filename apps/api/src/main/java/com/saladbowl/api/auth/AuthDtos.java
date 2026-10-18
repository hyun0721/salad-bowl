package com.saladbowl.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SignupRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 64) String password,
            @NotBlank @Size(max = 50) String nickname) {
    }

    public record SignupResponse(long userId) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record TokenResponse(String accessToken) {
    }

    /** 서비스 내부 결과: access 토큰은 본문, refresh 토큰은 쿠키로 나간다. */
    public record IssuedTokens(String accessToken, String refreshToken) {
    }
}
