# Plan 01 — Mono-repo 기반 + API 인증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mono-repo 골격과 로컬 Postgres를 갖추고, Spring Boot API에 회원가입·로그인·토큰 갱신(JWT)을 TDD로 구현한다.

**Architecture:** `apps/api`는 기능 단위 패키지(`auth`, `user`, `common`)로 나눈 Spring Boot 3 앱이다. 스키마는 Flyway로 관리한다. 인증은 stateless JWT(access 15분, refresh 14일)이며, refresh 토큰은 HttpOnly 쿠키로 전달한다. 통합 테스트는 Testcontainers Postgres로 돌린다.

**Tech Stack:** Java 21, Spring Boot 3.5.6, Gradle(Groovy DSL), Spring Security, Spring Data JPA, Flyway, PostgreSQL 16, jjwt 0.12.6, JUnit 5, Testcontainers, GitHub Actions

## 전체 로드맵 (이 문서는 Plan 01)

| Plan | 범위 | 결과물 |
|---|---|---|
| **01** | mono-repo, 로컬 DB, API 골격, 인증, API CI | 가입·로그인·갱신 API, 테스트 통과 |
| 02 | 그룹, 초대 URL, 6명 정원, 멤버 추방, 공개 설정(GroupShare), 권한 검사 | 그룹 API |
| 03 | `BanksaladParser`, `MergeService`, ImportBatch, 거래 조회·수정·수동 추가, AuditLog, 월간 요약 | import·거래 API |
| 04 | `apps/web` React + Vite + PWA, 전체 화면 | 웹앱 |
| 05 | Dockerfile, Render, Cloudflare Pages, Supabase, 배포 워크플로, 주간 ping | 운영 배포 |

## Global Constraints

- Java 21, Spring Boot 3.5.6, Gradle Groovy DSL, base package `com.saladbowl.api`
- DB는 PostgreSQL. JPA와 표준 SQL 위주로 작성하고 스키마는 Flyway로만 변경한다(`ddl-auto: validate`).
- 비밀번호는 BCrypt로 저장한다.
- 공통 에러 응답 형식: `{ "code": "...", "message": "..." }`
- CORS는 설정값 `app.cors.allowed-origins`의 도메인만 허용한다.
- 비밀값(JWT secret, DB 비밀번호)은 환경변수로 주입하고 커밋하지 않는다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

### Task 1: Mono-repo 골격과 로컬 Postgres

**Files:**
- Create: `.gitignore`, `README.md`, `docker-compose.yml`

**Interfaces:**
- Produces: 로컬 Postgres `localhost:5432`, DB `saladbowl`, user `saladbowl`, password `saladbowl`

- [ ] **Step 1: `.gitignore` 작성**

```gitignore
# OS / IDE
.DS_Store
.idea/
.vscode/
*.iml

# Java / Gradle
apps/api/build/
apps/api/.gradle/
apps/api/out/

# Node
node_modules/
apps/web/dist/

# Env
.env
.env.*
!.env.example
```

- [ ] **Step 2: `docker-compose.yml` 작성**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: saladbowl
      POSTGRES_USER: saladbowl
      POSTGRES_PASSWORD: saladbowl
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 3: `README.md` 작성**

````markdown
# Salad Bowl

뱅크샐러드 엑셀을 import해 그룹과 가계부를 공유하는 웹 서비스.

## 구조
- `apps/api` — Spring Boot API
- `apps/web` — React 웹앱 (Plan 04)
- `docs/superpowers` — 설계 문서와 구현 계획

## 로컬 실행
```bash
docker compose up -d
cd apps/api && ./gradlew bootRun
```
````

- [ ] **Step 4: Postgres 기동 확인**

Run: `docker compose up -d && docker compose exec postgres pg_isready -U saladbowl`
Expected: `accepting connections`

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md docker-compose.yml
git commit -m "chore: add mono-repo skeleton and local postgres"
```

---

### Task 2: Spring Boot 프로젝트 생성과 기동 확인

**Files:**
- Create: `apps/api/**` (Spring Initializr 생성물)
- Modify: `apps/api/build.gradle`
- Create: `apps/api/src/main/resources/application.yml` (생성된 `application.properties` 삭제)
- Create: `apps/api/src/main/resources/db/migration/V1__create_users.sql`
- Create: `apps/api/src/test/java/com/saladbowl/api/support/IntegrationTest.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/ApiApplicationTests.java`

**Interfaces:**
- Produces: `users` 테이블, `IntegrationTest` 추상 클래스(Testcontainers Postgres + MockMvc), 설정 키 `app.jwt.*`, `app.cors.allowed-origins`

- [ ] **Step 1: Spring Initializr로 생성**

```bash
mkdir -p apps && cd apps
curl -fsSL https://start.spring.io/starter.zip \
  -d type=gradle-project -d language=java -d javaVersion=21 \
  -d bootVersion=3.5.6 -d groupId=com.saladbowl -d artifactId=api \
  -d name=api -d packageName=com.saladbowl.api \
  -d dependencies=web,security,data-jpa,validation,flyway,postgresql,actuator,testcontainers \
  -o api.zip
unzip -q api.zip -d api && rm api.zip
rm api/src/main/resources/application.properties
cd ..
```

`bootVersion=3.5.6`이 거부되면 start.spring.io가 제시하는 3.5.x 최신 안정 버전으로 바꾸고, Global Constraints의 버전도 함께 고친다.

- [ ] **Step 2: `build.gradle`의 `dependencies`에 jjwt 추가**

```groovy
	implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
	runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
	runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'
	testImplementation 'org.springframework.security:spring-security-test'
```

- [ ] **Step 3: `application.yml` 작성**

```yaml
spring:
  application:
    name: salad-bowl-api
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/saladbowl}
    username: ${DB_USERNAME:saladbowl}
    password: ${DB_PASSWORD:saladbowl}
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true

app:
  jwt:
    secret: ${JWT_SECRET:local-dev-secret-change-me-local-dev-secret-change-me}
    access-ttl: PT15M
    refresh-ttl: P14D
  cors:
    allowed-origins: ${CORS_ALLOWED_ORIGINS:http://localhost:5173}

management:
  endpoints:
    web:
      exposure:
        include: health
```

- [ ] **Step 4: `V1__create_users.sql` 작성**

```sql
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    nickname      VARCHAR(50)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

- [ ] **Step 5: 통합 테스트 베이스 `IntegrationTest.java` 작성**

```java
package com.saladbowl.api.support;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
public abstract class IntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
}
```

- [ ] **Step 6: 생성된 `ApiApplicationTests.java`를 베이스 상속으로 교체**

```java
package com.saladbowl.api;

import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;

class ApiApplicationTests extends IntegrationTest {

    @Test
    void contextLoads() {
    }
}
```

Initializr가 `TestcontainersConfiguration.java`와 `TestApiApplication.java`를 생성했다면 삭제한다. 베이스 클래스와 중복된다.

- [ ] **Step 7: 테스트 실행 (Docker 필요)**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`. Flyway가 `V1`을 적용하고 컨텍스트가 뜬다.

- [ ] **Step 8: Commit**

```bash
git add apps/api
git commit -m "chore(api): scaffold Spring Boot app with flyway and testcontainers"
```

---

### Task 3: 공통 에러 응답

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/common/ErrorCode.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/common/ApiException.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/common/ErrorResponse.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/common/GlobalExceptionHandler.java`

**Interfaces:**
- Produces:
  - `enum ErrorCode { VALIDATION_FAILED(400), EMAIL_ALREADY_EXISTS(409), INVALID_CREDENTIALS(401), INVALID_TOKEN(401), UNAUTHORIZED(401), FORBIDDEN(403), NOT_FOUND(404) }`, `HttpStatus status()`
  - `new ApiException(ErrorCode code, String message)`, `ErrorCode code()`
  - `record ErrorResponse(String code, String message)`

이 Task의 동작은 Task 5의 통합 테스트(409, 400, 401 응답 본문)로 검증한다.

- [ ] **Step 1: `ErrorCode.java`**

```java
package com.saladbowl.api.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
```

- [ ] **Step 2: `ApiException.java`, `ErrorResponse.java`**

```java
package com.saladbowl.api.common;

public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }
}
```

```java
package com.saladbowl.api.common;

public record ErrorResponse(String code, String message) {
}
```

- [ ] **Step 3: `GlobalExceptionHandler.java`**

```java
package com.saladbowl.api.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        return ResponseEntity.status(e.code().status())
                .body(new ErrorResponse(e.code().name(), e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst()
                .orElse("invalid request");
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(ErrorCode.VALIDATION_FAILED.name(), message));
    }
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd apps/api && ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main/java/com/saladbowl/api/common
git commit -m "feat(api): add common error response handling"
```

---

### Task 4: JWT 발급·검증 (`JwtProvider`)

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/JwtProperties.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/JwtProvider.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/ApiApplication.java` (`@ConfigurationPropertiesScan` 추가)
- Test: `apps/api/src/test/java/com/saladbowl/api/auth/JwtProviderTest.java`

**Interfaces:**
- Consumes: `ApiException`, `ErrorCode.INVALID_TOKEN` (Task 3)
- Produces:
  - `record JwtProperties(String secret, Duration accessTtl, Duration refreshTtl)` (prefix `app.jwt`)
  - `enum JwtProvider.TokenType { ACCESS, REFRESH }`
  - `String JwtProvider.issue(long userId, TokenType type)`
  - `long JwtProvider.parseUserId(String token, TokenType expected)`: 서명 오류, 만료, 타입 불일치 시 `ApiException(INVALID_TOKEN)`
  - `Duration JwtProvider.refreshTtl()`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.saladbowl.api.auth;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtProviderTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret";

    private final JwtProvider provider = new JwtProvider(
            new JwtProperties(SECRET, Duration.ofMinutes(15), Duration.ofDays(14)));

    @Test
    void issuedAccessTokenParsesBackToUserId() {
        String token = provider.issue(42L, JwtProvider.TokenType.ACCESS);

        assertThat(provider.parseUserId(token, JwtProvider.TokenType.ACCESS)).isEqualTo(42L);
    }

    @Test
    void refreshTokenIsRejectedWhereAccessExpected() {
        String refresh = provider.issue(42L, JwtProvider.TokenType.REFRESH);

        assertThatThrownBy(() -> provider.parseUserId(refresh, JwtProvider.TokenType.ACCESS))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_TOKEN);
    }

    @Test
    void expiredTokenIsRejected() {
        JwtProvider expired = new JwtProvider(
                new JwtProperties(SECRET, Duration.ofSeconds(-1), Duration.ofDays(14)));
        String token = expired.issue(42L, JwtProvider.TokenType.ACCESS);

        assertThatThrownBy(() -> provider.parseUserId(token, JwtProvider.TokenType.ACCESS))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = provider.issue(42L, JwtProvider.TokenType.ACCESS) + "x";

        assertThatThrownBy(() -> provider.parseUserId(token, JwtProvider.TokenType.ACCESS))
                .isInstanceOf(ApiException.class);
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*JwtProviderTest'`
Expected: 컴파일 실패 (`JwtProvider`, `JwtProperties` 없음)

- [ ] **Step 3: `JwtProperties.java` 구현**

```java
package com.saladbowl.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, Duration accessTtl, Duration refreshTtl) {
}
```

- [ ] **Step 4: `JwtProvider.java` 구현**

```java
package com.saladbowl.api.auth;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtProvider {

    public enum TokenType { ACCESS, REFRESH }

    private static final String TYPE_CLAIM = "typ";

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtProvider(JwtProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String issue(long userId, TokenType type) {
        Duration ttl = type == TokenType.ACCESS ? properties.accessTtl() : properties.refreshTtl();
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .claim(TYPE_CLAIM, type.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public long parseUserId(String token, TokenType expected) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
            if (!expected.name().equals(claims.get(TYPE_CLAIM, String.class))) {
                throw new ApiException(ErrorCode.INVALID_TOKEN, "unexpected token type");
            }
            return Long.parseLong(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(ErrorCode.INVALID_TOKEN, "invalid token");
        }
    }

    public Duration refreshTtl() {
        return properties.refreshTtl();
    }
}
```

- [ ] **Step 5: `ApiApplication.java`에 `@ConfigurationPropertiesScan` 추가**

```java
package com.saladbowl.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiApplication.class, args);
    }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*JwtProviderTest'`
Expected: 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): add JWT provider with access/refresh token types"
```

---

### Task 5: 회원가입·로그인·토큰 갱신 API

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/user/User.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/user/UserRepository.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/AuthDtos.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/AuthService.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/AuthController.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/SecurityConfig.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/auth/AuthApiTest.java`

**Interfaces:**
- Consumes: `JwtProvider` (Task 4), `ApiException`, `ErrorCode` (Task 3), `IntegrationTest` (Task 2)
- Produces:
  - `POST /auth/signup` `{email, password(8~64자), nickname(1~50자)}` → `201 {userId}`
  - `POST /auth/login` `{email, password}` → `200 {accessToken}` + `Set-Cookie: refresh_token` (HttpOnly, Secure, SameSite=None, Path=/auth)
  - `POST /auth/refresh` (쿠키 `refresh_token`) → `200 {accessToken}` + 새 refresh 쿠키
  - `User` 엔티티: `Long getId()`, `String getEmail()`, `String getNickname()`
  - `UserRepository.findByEmail(String)`, `existsByEmail(String)`
  - `PasswordEncoder` 빈(BCrypt)
  - Task 6에서 `SecurityConfig.filterChain`에 JWT 필터와 CORS를 추가한다.

- [ ] **Step 1: 실패하는 통합 테스트 작성**

```java
package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    private void signup(String email) throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123","nickname":"tester"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").isNumber());
    }

    private MvcResult login(String email, String password) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andReturn();
    }

    @Test
    void signupThenLoginIssuesAccessTokenAndRefreshCookie() throws Exception {
        signup("a@test.com");

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"a@test.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().httpOnly("refresh_token", true));
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        signup("dup@test.com");

        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"dup@test.com","password":"password123","nickname":"x"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
    }

    @Test
    void shortPasswordReturns400() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"short@test.com","password":"short","nickname":"x"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void wrongPasswordReturns401() throws Exception {
        signup("b@test.com");

        MvcResult result = login("b@test.com", "wrong-password");

        org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus()).isEqualTo(401);
        org.assertj.core.api.Assertions.assertThat(result.getResponse().getContentAsString())
                .contains("INVALID_CREDENTIALS");
    }

    @Test
    void refreshCookieIssuesNewAccessToken() throws Exception {
        signup("c@test.com");
        Cookie refresh = login("c@test.com", "password123").getResponse().getCookie("refresh_token");

        mvc.perform(post("/auth/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(cookie().exists("refresh_token"));
    }

    @Test
    void refreshWithoutCookieReturns401() throws Exception {
        mvc.perform(post("/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*AuthApiTest'`
Expected: 컴파일 실패 또는 404/401 (컨트롤러 없음, Security 기본 설정이 모두 차단)

- [ ] **Step 3: `User.java`, `UserRepository.java`**

```java
package com.saladbowl.api.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String nickname;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected User() {
    }

    public User(String email, String passwordHash, String nickname) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.nickname = nickname;
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getNickname() { return nickname; }
}
```

```java
package com.saladbowl.api.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
```

- [ ] **Step 4: `AuthDtos.java`**

```java
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
```

- [ ] **Step 5: `AuthService.java`**

```java
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
```

- [ ] **Step 6: `AuthController.java`**

```java
package com.saladbowl.api.auth;

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

@RestController
@RequestMapping("/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "refresh_token";

    private final AuthService authService;
    private final JwtProvider jwt;

    public AuthController(AuthService authService, JwtProvider jwt) {
        this.authService = authService;
        this.jwt = jwt;
    }

    @PostMapping("/signup")
    public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new SignupResponse(authService.signup(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return withTokens(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        return withTokens(authService.refresh(refreshToken));
    }

    private ResponseEntity<TokenResponse> withTokens(IssuedTokens tokens) {
        // FE(Cloudflare Pages)와 API(Render)가 다른 도메인이라 SameSite=None + Secure가 필요하다.
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, tokens.refreshToken())
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .path("/auth")
                .maxAge(jwt.refreshTtl())
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new TokenResponse(tokens.accessToken()));
    }
}
```

- [ ] **Step 7: `SecurityConfig.java` (이 Task에서는 `/auth/**`, `/actuator/health`만 허용)**

```java
package com.saladbowl.api.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**", "/actuator/health").permitAll()
                        .anyRequest().authenticated());
        return http.build();
    }
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*AuthApiTest'`
Expected: 6 tests PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): add signup, login and refresh endpoints"
```

---

### Task 6: 보호된 API 인증 필터, `/me`, CORS

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/JwtAuthenticationFilter.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/CurrentUser.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/user/MeController.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/auth/SecurityConfig.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/user/MeApiTest.java`

**Interfaces:**
- Consumes: `JwtProvider.parseUserId(token, ACCESS)`, `UserRepository`, `ErrorResponse`
- Produces:
  - 인증된 요청의 principal은 `Long userId`다. 컨트롤러에서는 `@CurrentUser Long userId`로 받는다. Plan 02와 03의 모든 컨트롤러가 이 방식을 쓴다.
  - 인증 실패 응답: `401 {"code":"UNAUTHORIZED", ...}`
  - `GET /me` → `200 {userId, email, nickname}`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.saladbowl.api.user;

import com.jayway.jsonpath.JsonPath;
import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MeApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    private String accessTokenFor(String email) throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"%s","password":"password123","nickname":"me"}
                        """.formatted(email)));
        String body = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123"}
                                """.formatted(email)))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.accessToken");
    }

    @Test
    void meReturnsCurrentUserWithValidToken() throws Exception {
        String token = accessTokenFor("me@test.com");

        mvc.perform(get("/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("me@test.com"))
                .andExpect(jsonPath("$.nickname").value("me"));
    }

    @Test
    void meWithoutTokenReturns401() throws Exception {
        mvc.perform(get("/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void meWithInvalidTokenReturns401() throws Exception {
        mvc.perform(get("/me").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void corsPreflightAllowsConfiguredOrigin() throws Exception {
        mvc.perform(options("/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*MeApiTest'`
Expected: 컴파일 실패 (`MeController` 없음) 또는 401/403 불일치

- [ ] **Step 3: `CurrentUser.java`**

```java
package com.saladbowl.api.auth;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 인증된 사용자의 id(Long)를 컨트롤러 파라미터로 주입한다. */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@AuthenticationPrincipal
public @interface CurrentUser {
}
```

- [ ] **Step 4: `JwtAuthenticationFilter.java`**

```java
package com.saladbowl.api.auth;

import com.saladbowl.api.common.ApiException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final JwtProvider jwt;

    public JwtAuthenticationFilter(JwtProvider jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER)) {
            try {
                long userId = jwt.parseUserId(header.substring(BEARER.length()), JwtProvider.TokenType.ACCESS);
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(userId, null, List.of()));
            } catch (ApiException e) {
                // 토큰이 유효하지 않으면 인증 없이 진행한다. 보호된 경로는 entry point가 401을 반환한다.
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
```

- [ ] **Step 5: `SecurityConfig.java`를 필터, 401 entry point, CORS 포함 버전으로 교체**

```java
package com.saladbowl.api.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.common.ErrorResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
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
        config.setAllowedOrigins(Arrays.stream(allowedOrigins.split(",")).map(String::trim).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

- [ ] **Step 6: `MeController.java`**

```java
package com.saladbowl.api.user;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

    public record MeResponse(long userId, String email, String nickname) {
    }

    private final UserRepository users;

    public MeController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/me")
    public MeResponse me(@CurrentUser Long userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "user not found"));
        return new MeResponse(user.getId(), user.getEmail(), user.getNickname());
    }
}
```

- [ ] **Step 7: 전체 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test`
Expected: 모든 테스트 PASS (`ApiApplicationTests` 1, `JwtProviderTest` 4, `AuthApiTest` 6, `MeApiTest` 4)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): add JWT auth filter, /me endpoint and CORS"
```

---

### Task 7: API CI 워크플로

**Files:**
- Create: `.github/workflows/api-ci.yml`

**Interfaces:**
- Produces: `apps/api/**` 변경이 있는 push와 PR에서 `./gradlew test`를 실행하는 체크 `api-ci / test`. Plan 05의 배포 워크플로가 이 체크 뒤에 붙는다.

- [ ] **Step 1: 워크플로 작성**

```yaml
name: api-ci

on:
  push:
    branches: [main]
    paths: ["apps/api/**", ".github/workflows/api-ci.yml"]
  pull_request:
    paths: ["apps/api/**", ".github/workflows/api-ci.yml"]

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"
      - uses: gradle/actions/setup-gradle@v4
      - run: chmod +x gradlew && ./gradlew test
```

GitHub 호스티드 러너에는 Docker가 있어서 Testcontainers가 그대로 동작한다.

- [ ] **Step 2: YAML 문법 확인**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/api-ci.yml')); print('ok')"`
Expected: `ok` (PyYAML이 없으면 이 단계는 건너뛰고 push 후 Actions 탭에서 확인한다)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/api-ci.yml
git commit -m "ci: run API tests on changes under apps/api"
```

- [ ] **Step 4: push 후 확인 (사용자 승인 후)**

push는 사용자 승인을 받은 뒤에 한다. push 후 GitHub Actions에서 `api-ci / test`가 초록색인지 확인한다.
