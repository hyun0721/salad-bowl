package com.saladbowl.api.auth;

import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.common.ErrorResponse;
import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {

    // 로그인 제한의 15분 창을 테스트에서 조작할 수 있도록 Clock을 빈으로 둔다.
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    // Spring Security 체인(-100)보다 먼저 돌려 직접 호출을 인증 전에 막는다.
    @Bean
    public FilterRegistrationBean<ProxySecretFilter> proxySecretFilter(
            @Value("${app.security.proxy-secret:}") String secret, ObjectMapper objectMapper,
            org.springframework.core.env.Environment environment) {
        requireProxySecret(environment.matchesProfiles("prod"), secret);
        FilterRegistrationBean<ProxySecretFilter> bean =
                new FilterRegistrationBean<>(new ProxySecretFilter(secret, objectMapper));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }

    // 빈 값이면 검사가 꺼지므로, 운영에서는 빈 값·짧은 값으로 뜨지 않게 막는다(sync-config도 32자 이상을 확인한다).
    static void requireProxySecret(boolean prod, String secret) {
        if (prod && (secret == null || secret.trim().length() < 32)) {
            throw new IllegalStateException("PROXY_SECRET must be set to at least 32 characters in prod");
        }
    }

    @Bean
    public PasswordEncoder passwordEncoder(@Value("${app.security.bcrypt-strength:10}") int strength) {
        return new BCryptPasswordEncoder(strength);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtProvider jwt, ObjectMapper objectMapper)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Container ERROR dispatch (sendError -> /error) is anonymous; without this it would
                        // be rewritten to 401 and mask the real status of framework errors.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/auth/**", "/actuator/health").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e.authenticationEntryPoint((request, response, ex) -> {
                    response.setStatus(ErrorCode.UNAUTHORIZED.status().value());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    objectMapper.writeValue(response.getOutputStream(),
                            new ErrorResponse(ErrorCode.UNAUTHORIZED.name(), "authentication required"));
                }))
                .addFilterBefore(new JwtAuthenticationFilter(jwt), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") String allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
