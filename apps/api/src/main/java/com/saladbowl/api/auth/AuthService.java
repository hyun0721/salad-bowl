package com.saladbowl.api.auth;

import com.saladbowl.api.auth.AuthDtos.IssuedTokens;
import com.saladbowl.api.auth.AuthDtos.LoginRequest;
import com.saladbowl.api.auth.GoogleIdTokenVerifier.GoogleIdentity;
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
    private final GoogleIdTokenVerifier google;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtProvider jwt,
                       GoogleIdTokenVerifier google) {
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
    public IssuedTokens login(LoginRequest request) {
        User user = users.findByEmail(normalize(request.email()))
                .filter(u -> u.getPasswordHash() != null
                        && passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "invalid email or password"));
        return issue(user.getId());
    }

    /**
     * 구글 ID 토큰으로 로그인한다. 이미 연동된 계정이면 그대로, 같은 이메일의 기존 계정이 있으면
     * 구글이 이메일을 인증한 경우에만 연동하고, 없으면 새 계정을 만든다.
     */
    @Transactional
    public IssuedTokens loginWithGoogle(String idToken) {
        GoogleIdentity identity = google.verify(idToken);
        User user = users.findByGoogleSub(identity.sub()).orElseGet(() -> linkOrCreate(identity));
        return issue(user.getId());
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
