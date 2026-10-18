# Plan 04a — API 보완 + 웹앱 기반(인증·레이아웃) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API가 Cloudflare Pages 프록시(같은 출처) 구성에서 동작하도록 refresh 쿠키를 설정화하고 로그아웃과 월 커버리지 API를 추가한다. `apps/web`에 React 웹앱의 기반(디자인 토큰, API 클라이언트, 로그인·회원가입, 인증 가드, 사이드바 레이아웃, 그룹 선택, 콜드스타트 안내)을 만든다.

**Architecture:**
- **API**: refresh 쿠키 속성을 `app.auth.refresh-cookie.*` 설정으로 뺀다.
- **웹앱**:
  - 모든 API 호출은 `src/api/client.ts`의 `apiFetch` 하나를 거친다. access 토큰은 메모리에만 두고, 401이 오면 refresh를 한 번 시도한 뒤 재요청한다.
  - 인증 상태는 `AuthProvider`, 선택한 그룹은 `GroupProvider`(컨텍스트)가 갖는다. 서버 데이터는 TanStack Query로 가져온다.
  - 스타일은 디자인 시스템 토큰을 옮긴 CSS 변수와 CSS Modules로 만든다.

**Tech Stack:**
- API: Java 21, Spring Boot 4.1.1
- Web: Node 23, Vite(react-ts 템플릿), React, TypeScript, React Router(v7, `react-router` 패키지), TanStack Query v5
- Test: Vitest, React Testing Library, MSW v2

**전체 로드맵 (Plan 04)**

| Plan | 범위 |
|---|---|
| **04a** | 이 문서: API 보완(쿠키 설정화, 로그아웃, 커버리지, 업로드 파일 이름) + 웹앱 기반(스캐폴드, 토큰, API 클라이언트, 인증, 레이아웃, web CI) |
| 04b | 홈(월 커버리지 캘린더·업로드 대화상자), 업로드, 거래 목록·상세 패널·수동 추가 |
| 04c | 그룹 대시보드, 그룹 관리, 초대 수락, 그룹 없음 안내, PWA, Cloudflare Pages Functions 프록시 |

**선행 조건:** `main`에서 `feat/plan-04a-web-foundation` 브랜치를 딴다. 화면 설계 문서 PR(`docs/web-screen-design`)이 머지되어 있어야 한다.

## Global Constraints

- **API**: Java 21, Spring Boot 4.1.1, base package `com.saladbowl.api`
  - 공통 에러 응답 `{code, message}`. 새 에러 코드는 `ErrorCode`의 `CONFLICT` 바로 위에 추가한다.
  - 통합 테스트는 `support.IntegrationTest`를 상속한다. 새 Spring context를 만드는 설정(`@MockitoBean`, `@TestPropertySource`, 새 `@Import`)은 추가하지 않는다.
- **웹앱 위치**: `apps/web`. 패키지 매니저는 npm(`package-lock.json` 커밋)이다. 의존성 버전은 설치 시점의 최신 안정판을 쓰고, lock 파일에 고정한다.
- **API 주소**: 웹앱은 `import.meta.env.VITE_API_BASE_URL`(기본값 `/api`)만 본다. 코드에 API 호스트를 쓰지 않는다. 로컬 개발은 Vite dev server가 `/api/*`를 `http://localhost:8080/*`로 프록시한다(`/api` 접두어 제거). Pages Functions도 같은 규칙으로 동작한다(04c).
- **refresh 쿠키**: 기본값은 `Path=/api/auth`, `SameSite=Lax`, `Secure`, `HttpOnly`이고, 로컬 http 개발에서만 `REFRESH_COOKIE_SECURE=false`로 끈다.
- **토큰 보관**: access 토큰은 메모리에만 둔다(localStorage·sessionStorage 금지). refresh 토큰은 HttpOnly 쿠키다.
- **스타일**
  - 색·글자·간격·모서리는 `src/styles/tokens.css`의 CSS 변수만 쓴다. 디자인 시스템 "Salad Bowl" 값을 그대로 옮긴다.
  - 컴포넌트 스타일은 CSS Modules(`*.module.css`)로 쓴다. Tailwind는 쓰지 않는다.
- **문구**: 한국어, 합니다체. 이모지는 쓰지 않는다. 아이콘이 필요하면 인라인 SVG(`currentColor`, 장식용은 `aria-hidden="true"`)를 쓴다.
- **접근성**: 실제 `<button>`, `<a>`, `<label>`+`<input>`을 쓴다. 누르는 영역은 높이 40px 이상, 주요 버튼은 44px 이상으로 한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>`

---

### Task 1: refresh 쿠키 설정화와 로그아웃

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/auth/RefreshCookieProperties.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/auth/AuthController.java`
- Modify: `apps/api/src/main/resources/application.yml`
- Test: `apps/api/src/test/java/com/saladbowl/api/auth/RefreshCookieApiTest.java`

**Interfaces:**
- Consumes: 기존 `AuthController`(`/auth/signup`, `/auth/login`, `/auth/refresh`, `REFRESH_COOKIE = "refresh_token"`), `JwtProvider.refreshTtl()`, `SecurityConfig`(`/auth/**` permitAll)
- Produces:
  - `record RefreshCookieProperties(String path, String sameSite, boolean secure)`(prefix `app.auth.refresh-cookie`)
  - login/refresh 응답의 쿠키: `Path`=설정값, `SameSite`=설정값, `Secure`=설정값, `HttpOnly`
  - `POST /auth/logout` → `204`. 같은 이름·Path·SameSite·Secure에 `Max-Age=0`인 쿠키를 보낸다(인증 없이 호출 가능).

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RefreshCookieApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    private String loginSetCookie() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"cookie@test.com","password":"password123","nickname":"쿠키"}
                                """))
                .andExpect(status().isCreated());
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"cookie@test.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);
    }

    @Test
    void loginCookieUsesConfiguredAttributes() throws Exception {
        String setCookie = loginSetCookie();

        assertThat(setCookie).startsWith("refresh_token=")
                .contains("Path=/api/auth")
                .contains("SameSite=Lax")
                .contains("Secure")
                .contains("HttpOnly")
                .contains("Max-Age=1209600");
    }

    @Test
    void logoutClearsTheCookieWithSameAttributes() throws Exception {
        String setCookie = mvc.perform(post("/auth/logout"))
                .andExpect(status().isNoContent())
                .andReturn().getResponse().getHeader(HttpHeaders.SET_COOKIE);

        assertThat(setCookie).startsWith("refresh_token=")
                .contains("Max-Age=0")
                .contains("Path=/api/auth")
                .contains("SameSite=Lax")
                .contains("HttpOnly");
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*RefreshCookieApiTest'`
Expected: FAIL. 쿠키가 `Path=/auth`, `SameSite=None`이고, `/auth/logout`이 없다.

- [ ] **Step 3: `RefreshCookieProperties.java`**

```java
package com.saladbowl.api.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * refresh 토큰 쿠키 속성. 배포 구성(같은 출처 프록시 / 개인 도메인)에 따라 값만 바꾼다.
 * 브라우저가 보는 경로 기준이므로 Pages 프록시 구성에서는 /api/auth다.
 */
@ConfigurationProperties(prefix = "app.auth.refresh-cookie")
public record RefreshCookieProperties(String path, String sameSite, boolean secure) {
}
```

- [ ] **Step 4: `application.yml`의 `app:` 아래에 추가**

```yaml
  auth:
    refresh-cookie:
      path: ${REFRESH_COOKIE_PATH:/api/auth}
      same-site: ${REFRESH_COOKIE_SAME_SITE:Lax}
      secure: ${REFRESH_COOKIE_SECURE:true}
```

- [ ] **Step 5: `AuthController` 수정**

생성자에 `RefreshCookieProperties cookieProperties`를 추가하고(필드도 추가), import에 `java.time.Duration`을 추가한다. `withTokens`의 쿠키 생성 부분을 `refreshCookie(tokens.refreshToken(), jwt.refreshTtl())` 호출로 바꾸고, 아래 두 메서드를 추가한다. 기존의 "SameSite=None" 주석은 지운다.

```java
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
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
```

`withTokens`는 다음과 같다.

```java
    private ResponseEntity<TokenResponse> withTokens(IssuedTokens tokens) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(tokens.refreshToken(), jwt.refreshTtl()).toString())
                .body(new TokenResponse(tokens.accessToken()));
    }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*RefreshCookieApiTest'`
Expected: 2 tests PASS

- [ ] **Step 7: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS(152 + 2)

```bash
git add apps/api/src
git commit -m "feat(api): configurable refresh cookie and logout endpoint"
```

---

### Task 2: 월 커버리지 API와 업로드 파일 이름 정리

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/LedgerTransactionRepository.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionDtos.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionController.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/importer/ImportController.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/CoverageApiTest.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/importer/ImportApiTest.java` (테스트 추가)

**Interfaces:**
- Consumes: `LedgerTransaction`(`imported`, `manual`), `ImportBatch`/`ImportBatchRepository`, `TestAuth`, `TestLedger.data`
- Produces:
  - `GET /me/coverage?year=YYYY` → `200 [{"month":"2026-09","importedCount":168}, ...]`
    - 그 해에 import 거래가 있는 달만 월 순서로 돌려준다. 수동 거래는 세지 않는다.
    - `year`가 없거나 숫자가 아니면 `400 VALIDATION_FAILED`
  - `TransactionDtos.CoverageMonth(String month, long importedCount)`
  - `LedgerTransactionRepository.countImportedByMonth(Long ownerId, LocalDateTime from, LocalDateTime to)` → `List<Object[]>`(`[month(Number), count(Number)]`)
  - 업로드 파일 이름은 마지막 경로 조각만 저장한다(`C:\a\b\x.xlsx` → `x.xlsx`, `../x.xlsx` → `x.xlsx`). 255자를 넘으면 code point 단위로 자른다.

- [ ] **Step 1: 실패하는 `CoverageApiTest` 작성**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.importer.ImportBatch;
import com.saladbowl.api.importer.ImportBatchRepository;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestLedger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CoverageApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    private int seq = 0;

    private void imported(AuthedUser owner, long batchId, String dateTime) {
        String key = String.format("%064d", ++seq);
        transactions.save(LedgerTransaction.imported(owner.id(), batchId, key,
                TestLedger.data(TransactionType.EXPENSE, dateTime, "식비", "거래" + seq, -1000)));
    }

    @Test
    void coverageCountsImportedTransactionsPerMonthOfTheYear() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        long batchId = batches.save(new ImportBatch(me.id(), "a.xlsx")).getId();
        imported(me, batchId, "2026-01-05T10:00:00");
        imported(me, batchId, "2026-09-01T00:00:00");
        imported(me, batchId, "2026-09-30T23:59:59");
        imported(me, batchId, "2025-12-31T23:59:59");
        transactions.save(LedgerTransaction.manual(me.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-03-01T12:00:00", "식비", "수동", -500)));

        mvc.perform(get("/me/coverage").param("year", "2026").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].month").value("2026-01"))
                .andExpect(jsonPath("$[0].importedCount").value(1))
                .andExpect(jsonPath("$[1].month").value("2026-09"))
                .andExpect(jsonPath("$[1].importedCount").value(2));
    }

    @Test
    void coverageIsPerOwner() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@test.com", "남");
        long batchId = batches.save(new ImportBatch(other.id(), "b.xlsx")).getId();
        imported(other, batchId, "2026-09-01T00:00:00");

        mvc.perform(get("/me/coverage").param("year", "2026").header("Authorization", me.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void yearIsRequired() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");

        mvc.perform(get("/me/coverage").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/me/coverage").param("year", "abc").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: `ImportApiTest`에 파일 이름 테스트 추가**

기존 `ledger(String fileName)` 헬퍼와 `owner` 필드를 쓴다. `org.springframework.beans.factory.annotation.Autowired`가 이미 있으니 `ImportBatchRepository batches` 필드를 추가한다.

```java
    @Autowired
    ImportBatchRepository batches;

    @Test
    void storedFileNameKeepsOnlyTheLastPathSegment() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("C:\\Users\\me\\2026-09.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());
        mvc.perform(multipart("/imports").file(ledger("../../etc/2026-08.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());

        assertThat(batches.findAll()).extracting(ImportBatch::getFileName)
                .containsExactlyInAnyOrder("2026-09.xlsx", "2026-08.xlsx");
    }
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*CoverageApiTest' --tests '*ImportApiTest'`
Expected: `/me/coverage`가 없어 FAIL(404). 파일 이름 테스트는 경로가 그대로 저장되어 FAIL. MockMvc가 파일 이름을 바꿔 전달해서 이 테스트가 처음부터 통과하면, 그 사실을 리포트에 남긴다.

- [ ] **Step 4: `LedgerTransactionRepository`에 쿼리 추가**

```java
    /** 내 import 거래의 월별 건수(시작 포함, 끝 미포함 범위). 결과 행은 [월(1~12), 건수]. */
    @Query("""
            select extract(month from t.occurredAt), count(t)
            from LedgerTransaction t
            where t.ownerId = :ownerId
              and t.source = com.saladbowl.api.transaction.TransactionSource.IMPORT
              and t.occurredAt >= :from and t.occurredAt < :to
            group by extract(month from t.occurredAt)
            order by extract(month from t.occurredAt)
            """)
    List<Object[]> countImportedByMonth(@Param("ownerId") Long ownerId,
                                        @Param("from") LocalDateTime from,
                                        @Param("to") LocalDateTime to);
```

- [ ] **Step 5: DTO, 서비스, 컨트롤러**

`TransactionDtos`에 추가한다.

```java
    /** month는 yyyy-MM. import 거래가 있는 달만 돌려준다. */
    public record CoverageMonth(String month, long importedCount) {
    }
```

`TransactionService`에 추가한다(import: `com.saladbowl.api.transaction.TransactionDtos.CoverageMonth`).

```java
    @Transactional(readOnly = true)
    public List<CoverageMonth> coverage(long userId, int year) {
        LocalDateTime from = LocalDateTime.of(year, 1, 1, 0, 0);
        LocalDateTime to = from.plusYears(1);
        return transactions.countImportedByMonth(userId, from, to).stream()
                .map(row -> new CoverageMonth(
                        YearMonth.of(year, ((Number) row[0]).intValue()).toString(),
                        ((Number) row[1]).longValue()))
                .toList();
    }
```

`TransactionController`에 추가한다(import: `com.saladbowl.api.transaction.TransactionDtos.CoverageMonth`).

```java
    @GetMapping("/me/coverage")
    public List<CoverageMonth> coverage(@CurrentUser Long userId, @RequestParam int year) {
        return transactionService.coverage(userId, year);
    }
```

- [ ] **Step 6: `ImportController`의 파일 이름 처리**

`upload`에서 `storedName`을 만드는 줄을 `String storedName = storedFileName(fileName);`로 바꾸고, 클래스에 아래 메서드를 추가한다.

```java
    /** 클라이언트가 보낸 경로는 버리고 마지막 조각만 남긴다. 길면 code point 단위로 자른다. */
    static String storedFileName(String original) {
        String last = original.substring(Math.max(original.lastIndexOf('/'), original.lastIndexOf('\\')) + 1);
        if (last.codePointCount(0, last.length()) <= MAX_FILE_NAME) {
            return last;
        }
        return last.substring(0, last.offsetByCodePoints(0, MAX_FILE_NAME));
    }
```

`.xlsx` 확장자 검사는 기존처럼 `fileName`(원본 문자열)으로 한다. 원본이 `.xlsx`로 끝나면 마지막 조각도 `.xlsx`로 끝난다.

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*CoverageApiTest' --tests '*ImportApiTest'`
Expected: CoverageApiTest 3개, ImportApiTest 10개 PASS. Hibernate가 `extract(month from …)`를 거부하면 `month(t.occurredAt)`로 바꾸고, 바꾼 내용을 리포트에 남긴다.

- [ ] **Step 8: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/src
git commit -m "feat(api): add monthly import coverage and keep only upload file name"
```

---

### Task 3: 웹앱 스캐폴드, 디자인 토큰, web CI

**Files:**
- Create: `apps/web/**`(Vite react-ts 템플릿 생성물)
- Modify: `apps/web/vite.config.ts`, `apps/web/package.json`(scripts), `apps/web/index.html`(lang, title, font)
- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`
- Create: `apps/web/src/test/setup.ts`
- Replace: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`
- Delete: 템플릿 데모 파일(`src/App.css`, `src/index.css`, `src/assets/react.svg`, `public/vite.svg`)
- Test: `apps/web/src/App.test.tsx`
- Create: `.github/workflows/web-ci.yml`
- Modify: `.gitignore`(이미 `node_modules/`, `apps/web/dist/` 포함, 확인만)

**Interfaces:**
- Produces:
  - npm scripts: `dev`, `build`, `test`(`vitest run`), `typecheck`(`tsc -b --noEmit` 또는 템플릿의 tsc 구성에 맞는 명령)
  - Vite dev 프록시: `/api/*` → `http://localhost:8080/*`(접두어 제거)
  - CSS 변수(라이트·다크): `--surface-100 --surface-000 --ink --ink-muted --line --brand --brand-tint --on-brand --pending --pending-tint --danger`, `--space-2 --space-3 --space-4 --space-6 --space-8`, `--radius-sm --radius-md --radius-lg`, `--font-sans`
  - `App` 컴포넌트(Task 6에서 라우터로 교체), Vitest(jsdom) + `@testing-library/jest-dom` 설정

- [ ] **Step 1: Vite 프로젝트 생성과 의존성 설치**

```bash
cd apps
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install react-router @tanstack/react-query
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw
rm -f src/App.css src/index.css src/assets/react.svg public/vite.svg
```

설치된 주요 버전(react, react-router, @tanstack/react-query, vite, vitest, msw)을 리포트에 남긴다.

- [ ] **Step 2: `vite.config.ts`**

템플릿 파일을 아래로 바꾼다. `defineConfig`는 `vitest/config`에서 가져와 `test` 설정을 함께 둔다.

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 로컬 개발: 브라우저는 /api/* 를 호출하고, dev server가 API(8080)로 접두어를 떼고 전달한다.
// 배포(Cloudflare Pages Functions)도 같은 규칙이라 쿠키 Path(/api/auth)가 두 환경에서 같다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
```

템플릿의 `@vitejs/plugin-react` 패키지 이름이 다르면(예: `@vitejs/plugin-react-swc`) 그 이름을 쓴다.

- [ ] **Step 3: `package.json` scripts**

`scripts`에 다음을 둔다(템플릿의 `dev`, `build`, `preview`는 유지).

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b"
```

템플릿의 `lint` 스크립트(ESLint)는 그대로 둔다.

- [ ] **Step 4: `src/styles/tokens.css`**

디자인 시스템 "Salad Bowl"의 tokens.json 값이다.

```css
/* Salad Bowl design tokens — copied from the Claude Design System "Salad Bowl" (tokens.json). */
:root {
  color-scheme: light;
  --surface-100: #f4f4f0;
  --surface-000: #ffffff;
  --ink: #1e2420;
  --ink-muted: #555b56;
  --line: #dcdcd5;
  --brand: #2f6b4f;
  --brand-tint: #e6efe9;
  --on-brand: #ffffff;
  --pending: #8a5420;
  --pending-tint: #fff8ef;
  --danger: #9a3523;

  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 14px;

  --font-sans: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface-100: #151815;
    --surface-000: #1e221f;
    --ink: #eceeeb;
    --ink-muted: #a9afaa;
    --line: #353b36;
    --brand: #6fbf94;
    --brand-tint: #22352a;
    --on-brand: #0f1a13;
    --pending: #e3a560;
    --pending-tint: #3a2c1c;
    --danger: #f08c78;
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --surface-100: #151815;
  --surface-000: #1e221f;
  --ink: #eceeeb;
  --ink-muted: #a9afaa;
  --line: #353b36;
  --brand: #6fbf94;
  --brand-tint: #22352a;
  --on-brand: #0f1a13;
  --pending: #e3a560;
  --pending-tint: #3a2c1c;
  --danger: #f08c78;
}
```

- [ ] **Step 5: `src/styles/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--surface-100);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 24px;
}
h1 { margin: 0; font-size: 28px; line-height: 36px; font-weight: 700; }
h2 { margin: 0; font-size: 18px; line-height: 26px; font-weight: 700; }
a { color: var(--brand); }
button, input, select, textarea { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.num { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 6: `index.html`**

`<html lang="en">`을 `<html lang="ko">`로, `<title>`을 `Salad Bowl`로 바꾼다. 파비콘 `<link rel="icon" ...vite.svg>` 줄은 지운다. `<head>`에 폰트를 추가한다.

```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap">
```

- [ ] **Step 7: 실패하는 스모크 테스트와 테스트 설정**

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('shows the product name', () => {
    render(<App />)
    expect(screen.getByText('Salad Bowl')).toBeInTheDocument()
  })
})
```

Run: `cd apps/web && npm test`
Expected: FAIL. 템플릿 `App`에는 'Salad Bowl'이 없다.

- [ ] **Step 8: `src/App.tsx`, `src/main.tsx`**

```tsx
export default function App() {
  return <h1>Salad Bowl</h1>
}
```

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: 테스트·타입체크·빌드 확인**

Run: `cd apps/web && npm test && npm run typecheck && npm run build`
Expected: 1 test PASS, 타입 오류 없음, `dist/` 생성

- [ ] **Step 10: `.github/workflows/web-ci.yml`**

```yaml
name: web-ci

on:
  push:
    branches: [main]
    paths: ["apps/web/**", ".github/workflows/web-ci.yml"]
  pull_request:
    paths: ["apps/web/**", ".github/workflows/web-ci.yml"]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 11: Commit**

`.gitignore`에 `node_modules/`와 `apps/web/dist/`가 있는지 확인한다(Plan 01에서 추가됨).

```bash
git add apps/web .github/workflows/web-ci.yml
git commit -m "chore(web): scaffold React app with design tokens and web CI"
```

---

### Task 4: API 클라이언트 (`apiFetch`, 토큰 보관, 401 재시도, 콜드스타트 감지)

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/errors.ts`
- Create: `apps/web/src/test/server.ts`
- Modify: `apps/web/src/test/setup.ts`
- Test: `apps/web/src/api/client.test.ts`

**Interfaces:**
- Consumes: API 계약 — `POST /auth/refresh`(쿠키) → `{accessToken}`, 에러 `{code, message}`
- Produces:
  - `class ApiError extends Error { status: number; code: string }`
  - `apiFetch<T>(path: string, init?: RequestInit & { json?: unknown; auth?: boolean }): Promise<T>`
    - `path`는 `/me` 같은 API 경로다. 기본 `auth: true`면 `Authorization: Bearer <token>`을 붙인다.
    - `json`을 주면 `Content-Type: application/json`으로 보낸다. 204면 `undefined`를 돌려준다.
    - 401(그리고 `auth: true`)이면 refresh를 한 번 시도하고 재요청한다. refresh가 거절(401·403)되면 원래 `ApiError(401)`을 던진다. refresh가 일시적으로 실패하면(5xx, 네트워크) 그 오류를 던지고 토큰은 그대로 둔다.
  - `setAccessToken(token: string | null)`, `getAccessToken(): string | null`
  - `refreshAccessToken(): Promise<string | null>`: 동시에 여러 번 불러도 refresh 요청은 하나만 보낸다. 거절(401·403)이면 토큰을 지우고 `null`, 일시적 실패면 `ApiError`로 reject한다(토큰 유지).
  - `onAuthLost`는 로그인 중이던 세션이 거절될 때 refresh 한 번에 한 번만 알린다.
  - `onAuthLost(listener: () => void): () => void`: refresh가 실패해 로그아웃 상태가 됐을 때 알린다.
  - `onSlowRequests(listener: (slow: boolean) => void): () => void`: 요청 하나가 3초 넘게 걸리는 동안 true, 진행 중인 느린 요청이 모두 끝나면 false
  - `apiUrl(path: string): string`: `VITE_API_BASE_URL`(기본 `/api`) + path를 절대 URL로 바꾼다(테스트 환경의 fetch를 위해 `window.location.origin` 기준).
  - 테스트용 MSW 서버 `server`(`src/test/server.ts`)와 핸들러 URL 규칙 `*/api/...`

- [ ] **Step 1: MSW 테스트 서버**

`src/test/server.ts`:

```ts
import { setupServer } from 'msw/node'

export const server = setupServer()
```

`src/test/setup.ts`를 다음으로 바꾼다.

```ts
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/api/client.test.ts`:

```ts
import { http, HttpResponse, delay } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { apiFetch, getAccessToken, onAuthLost, onSlowRequests, setAccessToken } from './client'
import { ApiError } from './errors'

afterEach(() => {
  setAccessToken(null)
  vi.useRealTimers()
})

describe('apiFetch', () => {
  it('sends the bearer token and parses JSON', async () => {
    setAccessToken('t1')
    server.use(http.get('*/api/me', ({ request }) =>
      HttpResponse.json({ auth: request.headers.get('Authorization') })))

    await expect(apiFetch('/me')).resolves.toEqual({ auth: 'Bearer t1' })
  })

  it('sends JSON bodies and returns undefined for 204', async () => {
    let received: unknown
    server.use(http.post('*/api/things', async ({ request }) => {
      received = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))

    await expect(apiFetch('/things', { method: 'POST', json: { a: 1 } })).resolves.toBeUndefined()
    expect(received).toEqual({ a: 1 })
  })

  it('throws ApiError with the server code and message', async () => {
    server.use(http.get('*/api/groups/1', () =>
      HttpResponse.json({ code: 'NOT_FOUND', message: 'group not found' }, { status: 404 })))

    const error = await apiFetch('/groups/1').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'group not found' })
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    setAccessToken('old')
    let refreshCalls = 0
    server.use(
      http.get('*/api/me', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () => {
        refreshCalls++
        return HttpResponse.json({ accessToken: 'new' })
      }),
    )

    const [a, b] = await Promise.all([apiFetch('/me'), apiFetch('/me')])

    expect(a).toEqual({ ok: true })
    expect(b).toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('new')
  })

  it('clears the token and notifies when refresh fails', async () => {
    setAccessToken('old')
    const lost = vi.fn()
    const off = onAuthLost(lost)
    server.use(
      http.get('*/api/me', () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })),
    )

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 })
    expect(getAccessToken()).toBeNull()
    expect(lost).toHaveBeenCalledTimes(1)
    off()
  })

  it('keeps the session when refresh fails transiently', async () => {
    setAccessToken('old')
    const lost = vi.fn()
    const off = onAuthLost(lost)
    server.use(
      http.get('*/api/me', () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () => new HttpResponse('bad gateway', { status: 503 })),
    )

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 503 })
    expect(getAccessToken()).toBe('old')
    expect(lost).not.toHaveBeenCalled()
    off()
  })

  it('notifies auth loss once for concurrent requests', async () => {
    setAccessToken('old')
    const lost = vi.fn()
    const off = onAuthLost(lost)
    server.use(
      http.get('*/api/me', () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })),
    )

    await Promise.allSettled([apiFetch('/me'), apiFetch('/me')])

    expect(lost).toHaveBeenCalledTimes(1)
    off()
  })

  it('reports slow requests after 3 seconds', async () => {
    const states: boolean[] = []
    const off = onSlowRequests((slow) => states.push(slow))
    server.use(http.get('*/api/slow', async () => {
      await delay(3300)
      return HttpResponse.json({ ok: true })
    }))

    await apiFetch('/slow', { auth: false })

    expect(states).toEqual([true, false])
    off()
  }, 10000)
})
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/web && npm test -- src/api`
Expected: `./client`와 `./errors`가 없어 FAIL

- [ ] **Step 4: `src/api/errors.ts`**

```ts
/** API 오류. 서버 응답 {code, message}를 그대로 담는다. 네트워크 오류는 status 0, code NETWORK_ERROR. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
```

- [ ] **Step 5: `src/api/client.ts`**

```ts
import { ApiError } from './errors'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const SLOW_MS = 3000

let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null
const authLostListeners = new Set<() => void>()
const slowListeners = new Set<(slow: boolean) => void>()
let slowCount = 0

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function onAuthLost(listener: () => void): () => void {
  authLostListeners.add(listener)
  return () => authLostListeners.delete(listener)
}

export function onSlowRequests(listener: (slow: boolean) => void): () => void {
  slowListeners.add(listener)
  return () => slowListeners.delete(listener)
}

export function apiUrl(path: string): string {
  return new URL(BASE + path, window.location.origin).toString()
}

type ApiInit = RequestInit & { json?: unknown; auth?: boolean }

/**
 * refresh 쿠키로 새 access 토큰을 받는다. 동시에 불려도 요청은 하나만 보낸다.
 * - 서버가 거절(401·403)하면 토큰을 지우고 null을 돌려준다. 로그인 중이었다면 onAuthLost를 한 번 알린다.
 * - 일시적인 실패(5xx, 네트워크 오류, 잘못된 응답)는 ApiError로 reject한다. 이때 토큰은 그대로 둔다.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = rawFetch('/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          const hadSession = accessToken !== null
          setAccessToken(null)
          if (hadSession) authLostListeners.forEach((listener) => listener())
          return null
        }
        if (!res.ok) throw await toError(res)
        const body = (await res.json()) as { accessToken?: unknown }
        if (typeof body.accessToken !== 'string') {
          throw new ApiError(res.status, 'REQUEST_FAILED', '요청을 처리하지 못했습니다.')
        }
        setAccessToken(body.accessToken)
        return body.accessToken
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, auth = true, ...rest } = init
  const send = () => {
    const headers = new Headers(rest.headers)
    if (json !== undefined) headers.set('Content-Type', 'application/json')
    if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    return rawFetch(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body })
  }

  let res = await send()
  if (res.status === 401 && auth) {
    // 일시적인 refresh 실패는 여기서 그대로 throw된다(세션 유지).
    const token = await refreshAccessToken()
    if (!token) throw await toError(res)
    res = await send()
  }
  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** 요청 하나. 3초가 지나도 끝나지 않으면 느린 요청으로 세고, 끝나면 뺀다. */
async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  let slow = false
  const timer = setTimeout(() => {
    slow = true
    markSlow(1)
  }, SLOW_MS)
  try {
    return await fetch(apiUrl(path), { ...init, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다.')
  } finally {
    clearTimeout(timer)
    if (slow) markSlow(-1)
  }
}

function markSlow(delta: number) {
  const before = slowCount > 0
  slowCount += delta
  const after = slowCount > 0
  if (before !== after) slowListeners.forEach((listener) => listener(after))
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { code?: string; message?: string }
    return new ApiError(res.status, body.code ?? 'REQUEST_FAILED', body.message ?? '요청을 처리하지 못했습니다.')
  } catch {
    return new ApiError(res.status, 'REQUEST_FAILED', '요청을 처리하지 못했습니다.')
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd apps/web && npm test -- src/api`
Expected: 8 tests PASS

- [ ] **Step 7: 전체 확인 후 Commit**

Run: `cd apps/web && npm test && npm run typecheck`
Expected: 모두 PASS

```bash
git add apps/web/src
git commit -m "feat(web): add API client with token refresh and slow-request signal"
```

---

### Task 5: 인증 (`AuthProvider`, 로그인·회원가입 화면)

**Files:**
- Create: `apps/web/src/auth/AuthProvider.tsx`
- Create: `apps/web/src/auth/authApi.ts`
- Create: `apps/web/src/auth/LoginPage.tsx`, `apps/web/src/auth/LoginPage.module.css`
- Create: `apps/web/src/common/errorMessage.ts`
- Test: `apps/web/src/auth/LoginPage.test.tsx`, `apps/web/src/auth/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `setAccessToken`, `refreshAccessToken`, `onAuthLost`, `ApiError`(Task 4). API: `POST /auth/signup {email,password,nickname}` → `201 {userId}`, `POST /auth/login {email,password}` → `{accessToken}`, `POST /auth/logout` → 204, `GET /me` → `{userId,email,nickname}`
- Produces:
  - `type Me = { userId: number; email: string; nickname: string }`
  - `AuthProvider`: 처음 마운트할 때 refresh로 세션을 복원하고, 성공하면 `GET /me`를 가져온다. 일시적 실패는 1초 간격으로 2번 더 시도한다.
  - `useAuth(): { status: 'loading' | 'signedOut' | 'signedIn'; me: Me | null; login(email, password): Promise<void>; signup(email, password, nickname): Promise<void>; logout(): Promise<void> }`
    - `signup`은 가입한 뒤 바로 로그인한다.
  - `LoginPage`: 로그인/회원가입 탭. 성공하면 `?next=` 경로(없으면 `/`)로 이동한다.
  - `errorMessage(error: unknown): string`: `ApiError` 코드를 화면 문구로 바꾼다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/auth/AuthProvider.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { setAccessToken } from '../api/client'
import { server } from '../test/server'
import { AuthProvider, useAuth } from './AuthProvider'

function Status() {
  const { status, me } = useAuth()
  return <p>{status}:{me?.nickname ?? '-'}</p>
}

afterEach(() => setAccessToken(null))

describe('AuthProvider', () => {
  it('restores the session from the refresh cookie', async () => {
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json({ userId: 1, email: 'me@test.com', nickname: '나' })),
    )

    render(<AuthProvider><Status /></AuthProvider>)

    expect(screen.getByText('loading:-')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('signedIn:나')).toBeInTheDocument())
  })

  it('retries a transient refresh failure on startup', async () => {
    let calls = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        calls++
        return calls === 1
          ? new HttpResponse('waking up', { status: 503 })
          : HttpResponse.json({ accessToken: 'a1' })
      }),
      http.get('*/api/me', () => HttpResponse.json({ userId: 1, email: 'me@test.com', nickname: '나' })),
    )

    render(<AuthProvider><Status /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('signedIn:나')).toBeInTheDocument(), { timeout: 3000 })
    expect(calls).toBe(2)
  })

  it('is signed out when there is no refresh cookie', async () => {
    server.use(http.post('*/api/auth/refresh', () =>
      HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))

    render(<AuthProvider><Status /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('signedOut:-')).toBeInTheDocument())
  })
})
```

`src/auth/LoginPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { setAccessToken } from '../api/client'
import { server } from '../test/server'
import { AuthProvider } from './AuthProvider'
import LoginPage from './LoginPage'

function renderAt(path: string) {
  server.use(http.post('*/api/auth/refresh', () =>
    HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>홈 화면</p>} />
          <Route path="/invite/:token" element={<p>초대 화면</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const me = { userId: 1, email: 'me@test.com', nickname: '나' }

afterEach(() => setAccessToken(null))

describe('LoginPage', () => {
  it('logs in and goes home', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
    )
    renderAt('/login')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('홈 화면')).toBeInTheDocument()
  })

  it('returns to the next path after login', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
    )
    renderAt('/login?next=%2Finvite%2Fabc')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('초대 화면')).toBeInTheDocument()
  })

  it('shows a readable error for wrong credentials', async () => {
    server.use(http.post('*/api/auth/login', () =>
      HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'invalid email or password' }, { status: 401 })))
    renderAt('/login')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 맞지 않습니다.')
  })

  it('signs up then logs in', async () => {
    let signupBody: unknown
    server.use(
      http.post('*/api/auth/signup', async ({ request }) => {
        signupBody = await request.json()
        return HttpResponse.json({ userId: 1 }, { status: 201 })
      }),
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
    )
    renderAt('/login')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: '회원가입' }))
    await user.type(screen.getByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.type(screen.getByLabelText(/닉네임/), '나')
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }))

    expect(await screen.findByText('홈 화면')).toBeInTheDocument()
    await waitFor(() => expect(signupBody).toEqual({ email: 'me@test.com', password: 'password123', nickname: '나' }))
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npm test -- src/auth`
Expected: 모듈이 없어 FAIL

- [ ] **Step 3: `src/common/errorMessage.ts`**

```ts
import { ApiError } from '../api/errors'

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 맞지 않습니다.',
  EMAIL_ALREADY_EXISTS: '이미 가입된 이메일입니다.',
  VALIDATION_FAILED: '입력한 값을 다시 확인해 주세요.',
  NETWORK_ERROR: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  UNAUTHORIZED: '다시 로그인해 주세요.',
  FORBIDDEN: '이 작업을 할 권한이 없습니다.',
  NOT_FOUND: '찾을 수 없습니다.',
  INTERNAL_ERROR: '서버에서 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
}

/** API 오류 코드를 화면 문구로 바꾼다. 화면별 문구가 따로 있으면 overrides로 덮어쓴다. */
export function errorMessage(error: unknown, overrides: Record<string, string> = {}): string {
  if (error instanceof ApiError) {
    return overrides[error.code] ?? MESSAGES[error.code] ?? '요청을 처리하지 못했습니다.'
  }
  return '요청을 처리하지 못했습니다.'
}
```

- [ ] **Step 4: `src/auth/authApi.ts`**

```ts
import { apiFetch } from '../api/client'

export type Me = { userId: number; email: string; nickname: string }

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string }>('/auth/login', { method: 'POST', json: { email, password }, auth: false }),
  signup: (email: string, password: string, nickname: string) =>
    apiFetch<{ userId: number }>('/auth/signup', { method: 'POST', json: { email, password, nickname }, auth: false }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST', auth: false }),
  me: () => apiFetch<Me>('/me'),
}
```

- [ ] **Step 5: `src/auth/AuthProvider.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthLost, refreshAccessToken, setAccessToken } from '../api/client'
import { authApi, type Me } from './authApi'

type Status = 'loading' | 'signedOut' | 'signedIn'

type AuthValue = {
  status: Status
  me: Me | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, nickname: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const RESTORE_RETRIES = 2
const RESTORE_RETRY_MS = 1000

/** 시작할 때 세션 복원. 서버가 깨어나는 중(일시적 실패)이면 잠깐 기다렸다 다시 시도한다. */
async function restoreSession(): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await refreshAccessToken()
    } catch (error) {
      if (attempt >= RESTORE_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, RESTORE_RETRY_MS))
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMe] = useState<Me | null>(null)

  const signOutLocally = useCallback(() => {
    setAccessToken(null)
    setMe(null)
    setStatus('signedOut')
  }, [])

  useEffect(() => {
    let cancelled = false
    restoreSession()
      .then((token) => (token ? authApi.me() : null))
      .then((profile) => {
        if (cancelled) return
        setMe(profile)
        setStatus(profile ? 'signedIn' : 'signedOut')
      })
      .catch(() => {
        if (!cancelled) signOutLocally()
      })
    const off = onAuthLost(signOutLocally)
    return () => {
      cancelled = true
      off()
    }
  }, [signOutLocally])

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password)
    setAccessToken(accessToken)
    setMe(await authApi.me())
    setStatus('signedIn')
  }, [])

  const signup = useCallback(async (email: string, password: string, nickname: string) => {
    await authApi.signup(email, password, nickname)
    await login(email, password)
  }, [login])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      signOutLocally()
    }
  }, [signOutLocally])

  const value = useMemo(() => ({ status, me, login, signup, logout }), [status, me, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
```

- [ ] **Step 6: `src/auth/LoginPage.tsx`, `LoginPage.module.css`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../common/errorMessage'
import { useAuth } from './AuthProvider'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const next = params.get('next')
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(email, password, nickname)
      navigate(target, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.name}>Salad Bowl</span>
          <p className={styles.lead}>뱅크샐러드 가계부를 가족·친구와 함께 봅니다.</p>
        </div>
        <div role="tablist" aria-label="로그인 또는 회원가입" className={styles.tabs}>
          <button type="button" role="tab" aria-selected={mode === 'login'} className={styles.tab}
            onClick={() => setMode('login')}>로그인</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={styles.tab}
            onClick={() => setMode('signup')}>회원가입</button>
        </div>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span>이메일</span>
            <input type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>비밀번호{mode === 'signup' ? ' (8~64자)' : ''}</span>
            <input type="password" required minLength={mode === 'signup' ? 8 : undefined} maxLength={64}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          {mode === 'signup' && (
            <label className={styles.field}>
              <span>닉네임 (그룹에서 보이는 이름)</span>
              <input type="text" required maxLength={50} value={nickname}
                onChange={(e) => setNickname(e.target.value)} />
            </label>
          )}
          <button type="submit" className={styles.submit} disabled={busy}>
            {mode === 'login' ? '로그인' : '가입하고 시작하기'}
          </button>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
        <p className={styles.hint}>초대 링크로 들어왔다면 로그인 후 초대 화면으로 돌아갑니다.</p>
      </main>
    </div>
  )
}
```

```css
.page { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: var(--space-6) max(16px, env(safe-area-inset-left, 0px)); }
.card { width: 100%; max-width: 420px; background: var(--surface-000); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: var(--space-8); display: flex; flex-direction: column; gap: 20px; }
.brand { display: flex; flex-direction: column; gap: 6px; }
.name { font-size: 26px; line-height: 32px; font-weight: 700; }
.lead { margin: 0; color: var(--ink-muted); }
.tabs { display: flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
.tab { flex: 1; min-height: 44px; border: 0; background: var(--surface-000); cursor: pointer; }
.tab[aria-selected="true"] { background: var(--brand); color: var(--on-brand); font-weight: 700; }
.form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field > span { font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-muted); }
.field > input { min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); }
.submit { min-height: 48px; border: 0; border-radius: var(--radius-sm); background: var(--brand); color: var(--on-brand); font-weight: 700; cursor: pointer; }
.submit:disabled { opacity: 0.6; cursor: default; }
.error { margin: 0; color: var(--danger); font-size: 14px; }
.hint { margin: 0; font-size: 13px; color: var(--ink-muted); }
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/web && npm test -- src/auth`
Expected: AuthProvider 3개, LoginPage 4개 PASS

- [ ] **Step 8: 전체 확인 후 Commit**

Run: `cd apps/web && npm test && npm run typecheck`
Expected: 모두 PASS

```bash
git add apps/web/src
git commit -m "feat(web): add auth provider and login/signup page"
```

---

### Task 6: 라우팅, 인증 가드, 사이드바 레이아웃, 그룹 선택, 콜드스타트 안내

**Files:**
- Create: `apps/web/src/app/AppRoutes.tsx`
- Create: `apps/web/src/app/RequireAuth.tsx`
- Create: `apps/web/src/app/AppLayout.tsx`, `apps/web/src/app/AppLayout.module.css`
- Create: `apps/web/src/app/SlowServerNotice.tsx`
- Create: `apps/web/src/groups/GroupProvider.tsx`, `apps/web/src/groups/groupsApi.ts`
- Create: `apps/web/src/pages/PagePlaceholder.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/app/AppRoutes.test.tsx`

**Interfaces:**
- Consumes: `AuthProvider`/`useAuth`, `LoginPage`(Task 5), `apiFetch`, `onSlowRequests`(Task 4). API: `GET /groups` → `[{groupId, name, myRole, memberCount}]`
- Produces:
  - 라우트
    - `/login`: 공개
    - `/`, `/dashboard`, `/transactions`, `/upload`, `/groups`: `RequireAuth` + `AppLayout`
    - `/invite/:token`: `RequireAuth`, 레이아웃 없음
  - 이 Plan에서 각 메뉴 화면은 제목만 있는 `PagePlaceholder`로 둔다. 실제 화면은 04b, 04c에서 같은 경로의 컴포넌트로 바꾼다.
  - `RequireAuth`: 로그인 확인 중에는 "불러오는 중"을 보여준다. 로그아웃 상태면 `/login?next=<현재 경로>`로 보낸다.
  - `type GroupSummary = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; memberCount: number }`, `groupsApi.list(): Promise<GroupSummary[]>`
  - `GroupProvider` / `useGroups(): { groups: GroupSummary[]; selectedGroupId: number | null; selectGroup(id: number): void; isLoading: boolean }`
    - 선택한 그룹은 localStorage `saladbowl.selectedGroupId`에 기억한다(try/catch로 감싼다).
    - 기억한 그룹이 목록에 없으면 첫 그룹을 선택한다.
  - `AppLayout`
    - 사이드바: 홈, 그룹 대시보드, 거래 목록, 업로드, 그룹 관리(`NavLink`, 현재 메뉴에 `aria-current="page"`)
    - 상단 바: 그룹 선택(`<select aria-label="그룹">`, 그룹이 없으면 "그룹 없음" 안내 링크), 닉네임, 로그아웃 버튼
  - `SlowServerNotice`: 느린 요청이 진행 중이면 `role="status"`로 "서버를 깨우는 중입니다. 처음 접속하면 30초쯤 걸릴 수 있습니다."를 보여준다.
  - `App`: `QueryClientProvider` + `AuthProvider` + `BrowserRouter` + `AppRoutes`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/AppRoutes.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setAccessToken } from '../api/client'
import { AuthProvider } from '../auth/AuthProvider'
import { server } from '../test/server'
import AppRoutes from './AppRoutes'

const me = { userId: 1, email: 'me@test.com', nickname: '나' }

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

function signedIn(groups: unknown[]) {
  server.use(
    http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
    http.get('*/api/me', () => HttpResponse.json(me)),
    http.get('*/api/groups', () => HttpResponse.json(groups)),
  )
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})
afterEach(() => setAccessToken(null))

describe('AppRoutes', () => {
  it('sends signed-out visitors to login with the return path', async () => {
    server.use(http.post('*/api/auth/refresh', () =>
      HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))

    renderApp('/transactions')

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('shows the layout with the menu, nickname and first group selected', async () => {
    signedIn([
      { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 },
      { groupId: 20, name: '커플 가계부', myRole: 'MEMBER', memberCount: 2 },
    ])

    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
    expect(within(nav).getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: '거래 목록' })).toBeInTheDocument()
    expect(screen.getByText('나')).toBeInTheDocument()
    const select = await screen.findByRole('combobox', { name: '그룹' })
    expect(select).toHaveValue('10')
  })

  it('remembers the selected group', async () => {
    signedIn([
      { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 },
      { groupId: 20, name: '커플 가계부', myRole: 'MEMBER', memberCount: 2 },
    ])
    renderApp('/')
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByRole('combobox', { name: '그룹' }), '20')

    expect(window.localStorage.getItem('saladbowl.selectedGroupId')).toBe('20')
  })

  it('offers a link to group management when there is no group', async () => {
    signedIn([])

    renderApp('/')

    expect(await screen.findByRole('link', { name: '그룹 없음 · 만들기 또는 초대받기' })).toHaveAttribute('href', '/groups')
  })

  it('navigates between menu pages', async () => {
    signedIn([])
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('link', { name: '업로드' }))

    expect(await screen.findByRole('heading', { level: 1, name: '업로드' })).toBeInTheDocument()
  })

  it('logs out and returns to login', async () => {
    signedIn([])
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })
})
```

`src/App.test.tsx`를 다음으로 바꾼다(실제 `App`은 `BrowserRouter`를 쓴다).

```tsx
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './test/server'
import App from './App'

describe('App', () => {
  it('starts at the login page when signed out', async () => {
    server.use(http.post('*/api/auth/refresh', () =>
      HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))

    render(<App />)

    expect(await screen.findByText('Salad Bowl')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npm test`
Expected: `./AppRoutes` 등이 없어 FAIL

- [ ] **Step 3: `src/groups/groupsApi.ts`, `src/groups/GroupProvider.tsx`**

```ts
import { apiFetch } from '../api/client'

export type GroupSummary = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; memberCount: number }

export const groupsApi = {
  list: () => apiFetch<GroupSummary[]>('/groups'),
}
```

```tsx
import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { groupsApi, type GroupSummary } from './groupsApi'

const STORAGE_KEY = 'saladbowl.selectedGroupId'

function readStored(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function writeStored(id: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // 저장소를 못 쓰면 이번 세션 동안만 기억한다.
  }
}

type GroupsValue = {
  groups: GroupSummary[]
  selectedGroupId: number | null
  selectGroup: (id: number) => void
  isLoading: boolean
}

const GroupContext = createContext<GroupsValue | null>(null)

export function GroupProvider({ children }: { children: ReactNode }) {
  const query = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const [chosen, setChosen] = useState<number | null>(readStored)
  const groups = useMemo(() => query.data ?? [], [query.data])

  const selectedGroupId = groups.some((g) => g.groupId === chosen) ? chosen : (groups[0]?.groupId ?? null)

  const selectGroup = useCallback((id: number) => {
    setChosen(id)
    writeStored(id)
  }, [])

  const value = useMemo(
    () => ({ groups, selectedGroupId, selectGroup, isLoading: query.isLoading }),
    [groups, selectedGroupId, selectGroup, query.isLoading],
  )
  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export function useGroups(): GroupsValue {
  const value = useContext(GroupContext)
  if (!value) throw new Error('useGroups must be used inside GroupProvider')
  return value
}
```

- [ ] **Step 4: `RequireAuth.tsx`, `SlowServerNotice.tsx`, `PagePlaceholder.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <p role="status" style={{ padding: 'var(--space-8)' }}>불러오는 중입니다.</p>
  if (status === 'signedOut') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}
```

```tsx
import { useEffect, useState } from 'react'
import { onSlowRequests } from '../api/client'

export default function SlowServerNotice() {
  const [slow, setSlow] = useState(false)
  useEffect(() => onSlowRequests(setSlow), [])
  if (!slow) return null
  return (
    <p role="status" style={{
      margin: 0, padding: 'var(--space-3) var(--space-8)', background: 'var(--pending-tint)', color: 'var(--pending)',
    }}>
      서버를 깨우는 중입니다. 처음 접속하면 30초쯤 걸릴 수 있습니다.
    </p>
  )
}
```

`PagePlaceholder`는 04b·04c에서 실제 화면으로 바꿀 자리다. 제목과 한 줄 안내만 보여준다.

```tsx
export default function PagePlaceholder({ title }: { title: string }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h1>{title}</h1>
      <p style={{ margin: 0, color: 'var(--ink-muted)' }}>이 화면은 다음 단계에서 만듭니다.</p>
    </section>
  )
}
```

- [ ] **Step 5: `AppLayout.tsx`, `AppLayout.module.css`**

```tsx
import { NavLink, Outlet, Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useGroups } from '../groups/GroupProvider'
import SlowServerNotice from './SlowServerNotice'
import styles from './AppLayout.module.css'

const MENU = [
  { to: '/', label: '홈', end: true },
  { to: '/dashboard', label: '그룹 대시보드', end: false },
  { to: '/transactions', label: '거래 목록', end: false },
  { to: '/upload', label: '업로드', end: false },
  { to: '/groups', label: '그룹 관리', end: false },
]

export default function AppLayout() {
  const { me, logout } = useAuth()
  const { groups, selectedGroupId, selectGroup } = useGroups()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <nav aria-label="주 메뉴" className={styles.nav}>
        <span className={styles.logo}>Salad Bowl</span>
        {MENU.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.main}>
        <header className={styles.header}>
          {groups.length > 0 ? (
            <label className={styles.group}>
              <span>그룹</span>
              <select aria-label="그룹" value={selectedGroupId ?? ''}
                onChange={(e) => selectGroup(Number(e.target.value))}>
                {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.name}</option>)}
              </select>
            </label>
          ) : (
            <Link to="/groups">그룹 없음 · 만들기 또는 초대받기</Link>
          )}
          <div className={styles.user}>
            <span>{me?.nickname}</span>
            <button type="button" className={styles.logout} onClick={onLogout}>로그아웃</button>
          </div>
        </header>
        <SlowServerNotice />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

```css
.shell { min-height: 100%; display: flex; flex-wrap: wrap; }
.nav { flex: 1 1 220px; max-width: 260px; padding: var(--space-6) var(--space-4); background: var(--surface-000); border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; }
.logo { font-size: 20px; font-weight: 700; padding: 4px var(--space-3) 20px; }
.link { display: block; padding: var(--space-3); border-radius: var(--radius-sm); color: var(--ink); text-decoration: none; }
.link:hover { background: var(--surface-100); }
.active { background: var(--brand-tint); color: var(--brand); font-weight: 700; }
.main { flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; }
.header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-8); background: var(--surface-000); border-bottom: 1px solid var(--line); }
.group { display: flex; align-items: center; gap: var(--space-2); }
.group > span { font-size: 13px; color: var(--ink-muted); }
.group > select { min-height: 40px; padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); }
.user { display: flex; align-items: center; gap: var(--space-3); }
.logout { min-height: 40px; padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); cursor: pointer; }
.content { padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-6); }
@media (max-width: 720px) {
  .nav { max-width: none; border-right: 0; border-bottom: 1px solid var(--line); flex-direction: row; flex-wrap: wrap; }
  .logo { width: 100%; padding-bottom: var(--space-2); }
  .header, .content { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
}
```

- [ ] **Step 6: `AppRoutes.tsx`, `App.tsx`**

```tsx
import { Route, Routes } from 'react-router'
import LoginPage from '../auth/LoginPage'
import { GroupProvider } from '../groups/GroupProvider'
import PagePlaceholder from '../pages/PagePlaceholder'
import AppLayout from './AppLayout'
import RequireAuth from './RequireAuth'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<RequireAuth><PagePlaceholder title="그룹 초대" /></RequireAuth>} />
      <Route element={<RequireAuth><GroupProvider><AppLayout /></GroupProvider></RequireAuth>}>
        <Route index element={<PagePlaceholder title="내 가계부" />} />
        <Route path="dashboard" element={<PagePlaceholder title="그룹 대시보드" />} />
        <Route path="transactions" element={<PagePlaceholder title="거래 목록" />} />
        <Route path="upload" element={<PagePlaceholder title="업로드" />} />
        <Route path="groups" element={<PagePlaceholder title="그룹 관리" />} />
      </Route>
      <Route path="*" element={<PagePlaceholder title="페이지를 찾을 수 없습니다" />} />
    </Routes>
  )
}
```

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter } from 'react-router'
import AppRoutes from './app/AppRoutes'
import { AuthProvider } from './auth/AuthProvider'

export default function App() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }))
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/web && npm test`
Expected: 모두 PASS(App 1, client 8, auth 7, AppRoutes 6)

- [ ] **Step 8: 타입체크·빌드 후 Commit**

Run: `cd apps/web && npm run typecheck && npm run build`
Expected: 오류 없음

```bash
git add apps/web/src
git commit -m "feat(web): add routes, auth guard, sidebar layout, group selector and cold-start notice"
```

- [ ] **Step 9: 로컬 실행 확인 (수동)**

API와 웹앱을 함께 띄워 가입, 로그인, 새로 고침 후 세션 유지, 로그아웃을 확인한다. 로컬은 http라서 Secure 쿠키를 끈다.

```bash
docker compose up -d
cd apps/api && REFRESH_COOKIE_SECURE=false ./gradlew bootRun
cd apps/web && npm run dev
```

브라우저에서 `http://localhost:5173`을 열고 위 흐름을 확인한다. 결과는 리포트에 남긴다.
