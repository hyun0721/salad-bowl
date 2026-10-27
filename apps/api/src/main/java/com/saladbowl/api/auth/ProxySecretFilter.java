package com.saladbowl.api.auth;

import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.common.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 프록시를 거치지 않고 API를 직접 부르는 요청을 막는다. 비밀이 비어 있으면(로컬·테스트) 검사하지 않는다.
 * 통과한 요청에만 X-Client-IP를 믿도록 표시를 남긴다.
 */
public class ProxySecretFilter extends OncePerRequestFilter {

    static final String HEADER = "X-Proxy-Secret";
    static final String TRUSTED_ATTRIBUTE = ProxySecretFilter.class.getName() + ".trusted";

    private final byte[] secret;
    private final ObjectMapper objectMapper;

    public ProxySecretFilter(String secret, ObjectMapper objectMapper) {
        this.secret = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean disabled = secret.length == 0;
        String given = request.getHeader(HEADER);
        // 상수 시간 비교: 응답 시간으로 비밀을 한 글자씩 알아내지 못하게 한다.
        boolean matches = given != null && MessageDigest.isEqual(secret, given.getBytes(StandardCharsets.UTF_8));
        if (!disabled && !matches && !isHealth(request)) {
            response.setStatus(ErrorCode.FORBIDDEN.status().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(), new ErrorResponse(ErrorCode.FORBIDDEN.name(), "access denied"));
            return;
        }
        request.setAttribute(TRUSTED_ATTRIBUTE, disabled || matches);
        chain.doFilter(request, response);
    }

    private static boolean isHealth(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator/health");
    }
}
