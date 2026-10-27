package com.saladbowl.api.auth;

import com.saladbowl.api.auth.AuthDtos.IssuedTokens;
import com.saladbowl.api.auth.AuthDtos.LoginRequest;
import com.saladbowl.api.auth.AuthDtos.SignupRequest;
import com.saladbowl.api.auth.GoogleIdTokenVerifier.GoogleIdentity;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.common.TooManyAttemptsException;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwt;
    private final LoginAttemptLimiter limiter;
    private final GoogleIdTokenVerifier google;
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtProvider jwt,
                       LoginAttemptLimiter limiter, GoogleIdTokenVerifier google) {
        this.limiter = limiter;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwt = jwt;
        this.google = google;
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
        // 비밀번호(bcrypt)를 확인하기 전에 시도를 원자적으로 예약한다. 막힌 상태에서는 정답이어도 확인하지 않는다.
        // 없는 이메일도 똑같이 센다(응답으로 계정 존재 여부가 드러나지 않게 하기 위해서다).
        long retryAfter = limiter.tryAcquire(email, clientIp);
        if (retryAfter > 0) {
            throw new TooManyAttemptsException(retryAfter);
        }
        User found = users.findByEmail(email).orElse(null);
        // 없는 이메일이나 비밀번호가 없는(구글 전용) 계정도 더미 해시와 비교해 bcrypt 시간을 맞춘다
        // (응답 시간으로 계정 존재가 드러나지 않게).
        String hash = found != null ? found.getPasswordHash() : null;
        boolean matches = passwordEncoder.matches(request.password(), hash != null ? hash : dummyHash);
        if (hash == null || !matches) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "invalid email or password");
        }
        limiter.recordSuccess(email, clientIp);
        return issue(found);
    }

    /**
     * 구글 ID 토큰으로 로그인한다. 이미 연동된 계정이면 그대로, 같은 이메일의 기존 계정이 있으면
     * 구글이 이메일을 인증한 경우에만 연동하고, 없으면 새 계정을 만든다.
     */
    @Transactional
    public IssuedTokens loginWithGoogle(String idToken) {
        GoogleIdentity identity = google.verify(idToken);
        User user = users.findByGoogleSub(identity.sub()).orElseGet(() -> linkOrCreate(identity));
        return issue(user);
    }

    private User linkOrCreate(GoogleIdentity identity) {
        if (!identity.emailVerified()) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "google email is not verified");
        }
        String email = normalize(identity.email());
        User existing = users.findByEmail(email).orElse(null);
        if (existing != null) {
            existing.linkGoogle(identity.sub());
            return existing;
        }
        return users.save(User.fromGoogle(email, nicknameOf(identity, email), identity.sub()));
    }

    private static String nicknameOf(GoogleIdentity identity, String email) {
        String name = identity.name() == null || identity.name().isBlank()
                ? email.substring(0, email.indexOf('@')) : identity.name().trim();
        return name.length() > 50 ? name.substring(0, 50) : name;
    }

    @Transactional(readOnly = true)
    public String refresh(String refreshToken) {
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
        return jwt.issue(user.getId(), JwtProvider.TokenType.ACCESS);
    }

    /** 쿠키가 없거나 무효여도 실패하지 않는다. 유효한 현재 버전의 토큰일 때만 버전을 올린다. DB 오류는 그대로 올린다(500, 실패를 성공으로 꾸미지 않는다). */
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
