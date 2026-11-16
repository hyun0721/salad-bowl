package com.saladbowl.api.tax;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.user.ServiceAdminGuard;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * /tax/admin/** 전체를 서비스 관리자에게만 연다. 컨트롤러 메서드마다 검사를 넣으면 새 엔드포인트에서
 * 빠질 수 있으므로 경로 한 곳에서 막는다. 비로그인은 이보다 앞선 Spring Security가 401로 끝낸다.
 */
@Component
public class TaxAdminInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    private final ServiceAdminGuard guard;

    public TaxAdminInterceptor(ServiceAdminGuard guard) {
        this.guard = guard;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/tax/admin/**");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(request.getUserPrincipal() instanceof Authentication auth)
                || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "authentication required");
        }
        guard.require(userId);
        return true;
    }
}
