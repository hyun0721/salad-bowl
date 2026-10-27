package com.saladbowl.api.auth;

import com.saladbowl.api.auth.AuthDtos.IssuedTokens;
import com.saladbowl.api.auth.AuthDtos.LoginRequest;
import com.saladbowl.api.auth.AuthDtos.SignupRequest;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.common.TooManyAttemptsException;
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
    private final LoginAttemptLimiter limiter;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtProvider jwt,
                       LoginAttemptLimiter limiter) {
        this.limiter = limiter;
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
    public IssuedTokens login(LoginRequest request, String clientIp) {
        String email = normalize(request.email());
        // 비밀번호(bcrypt)를 확인하기 전에 제한부터 본다. 막힌 상태에서는 정답이어도 확인하지 않는다.
        long retryAfter = limiter.retryAfterSeconds(email, clientIp);
        if (retryAfter > 0) {
            throw new TooManyAttemptsException(retryAfter);
        }
        User user = users.findByEmail(email)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElse(null);
        if (user == null) {
            // 없는 이메일도 똑같이 센다. 응답으로 계정 존재 여부가 드러나지 않게 하기 위해서다.
            limiter.recordFailure(email, clientIp);
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "invalid email or password");
        }
        limiter.clearEmail(email);
        return issue(user);
    }

    @Transactional(readOnly = true)
    public IssuedTokens refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "missing refresh token");
        }
        JwtProvider.RefreshClaims claims = jwt.parseRefresh(refreshToken);
        User user = users.findById(claims.userId())
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_TOKEN, "user not found"));
        // ver가 없으면(폐기 도입 전 토큰) 또는 로그아웃으로 버전이 올랐으면 거절한다.
        if (claims.ver() == null || claims.ver() != user.getTokenVersion()) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "revoked refresh token");
        }
        return issue(user);
    }

    /** 어떤 입력이든 예외 없이 끝난다(로그아웃은 언제나 성공). 유효한 현재 버전의 토큰일 때만 버전을 올린다. */
    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        try {
            JwtProvider.RefreshClaims claims = jwt.parseRefresh(refreshToken);
            if (claims.ver() != null) {
                // 조건부 UPDATE라 동시 로그아웃이 겹쳐도 한 번만 올라간다.
                users.bumpTokenVersion(claims.userId(), claims.ver());
            }
        } catch (ApiException ignored) {
            // 무효한 토큰이면 바꿀 것이 없다.
        }
    }

    private IssuedTokens issue(User user) {
        return new IssuedTokens(
                jwt.issue(user.getId(), JwtProvider.TokenType.ACCESS),
                jwt.issueRefresh(user.getId(), user.getTokenVersion()));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
