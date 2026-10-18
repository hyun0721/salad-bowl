package com.saladbowl.api.auth;

import com.saladbowl.api.auth.AuthDtos.IssuedTokens;
import com.saladbowl.api.auth.AuthDtos.LoginRequest;
import com.saladbowl.api.auth.AuthDtos.SignupRequest;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwt;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtProvider jwt) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwt = jwt;
    }

    @Transactional
    public long signup(SignupRequest request) {
        String email = normalize(request.email());
        if (users.existsByEmail(email)) {
            throw new ApiException(ErrorCode.EMAIL_ALREADY_EXISTS, "email already registered");
        }
        User user = users.save(new User(email, passwordEncoder.encode(request.password()), request.nickname()));
        return user.getId();
    }

    @Transactional(readOnly = true)
    public IssuedTokens login(LoginRequest request) {
        User user = users.findByEmail(normalize(request.email()))
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "invalid email or password"));
        return issue(user.getId());
    }

    @Transactional(readOnly = true)
    public IssuedTokens refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "missing refresh token");
        }
        long userId = jwt.parseUserId(refreshToken, JwtProvider.TokenType.REFRESH);
        if (!users.existsById(userId)) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "user not found");
        }
        return issue(userId);
    }

    private IssuedTokens issue(long userId) {
        return new IssuedTokens(
                jwt.issue(userId, JwtProvider.TokenType.ACCESS),
                jwt.issue(userId, JwtProvider.TokenType.REFRESH));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
