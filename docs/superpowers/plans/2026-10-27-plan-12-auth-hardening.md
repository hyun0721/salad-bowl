# Plan 12: 인증 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증 문제 네 가지를 고친다.
- 강제 로그아웃 CSRF
- 로그아웃 뒤에도 살아 있는 refresh 토큰
- refresh–로그아웃 경합
- 로그인 횟수 제한 없음

**Architecture:** 고치는 위치는 세 곳이다.
- **프록시**: 상태를 바꾸는 요청의 출처를 확인하고, 클라이언트 IP를 `X-Client-IP`로 넘긴다.
- **API**: `users.token_version`과 refresh JWT의 `ver`로 로그아웃 때 모든 refresh 토큰을 폐기한다. 메모리 기반 `LoginAttemptLimiter`로 실패 횟수를 제한한다.
- **웹 클라이언트**: 로그아웃 세대(`authEpoch`)로 늦게 도착한 refresh 결과를 버린다.

**Tech Stack:** Spring Boot(Java 21)·Flyway·JUnit MockMvc, Cloudflare Pages Functions(TypeScript), React 19, Vitest

**출처:** [인증 보강 설계](../specs/2026-10-27-auth-hardening-design.md) (승인됨). 정확한 값과 문구는 설계의 해당 장을 따른다.

## Global Constraints

- **의존성**: 새로 넣지 않는다.
- **오류 코드·문구**
  - 오류 코드: `FORBIDDEN_ORIGIN`(403, 프록시), `TOO_MANY_ATTEMPTS`(429, API)
  - 웹 문구(`errorMessage`):
    - `FORBIDDEN_ORIGIN`: "요청을 처리할 수 없습니다. 페이지를 새로고침해 주세요."
    - `TOO_MANY_ATTEMPTS`: "로그인 시도가 너무 많습니다. 15분쯤 뒤 다시 시도해 주세요."
- **로그인 제한 값**: 15분 고정 창, 이메일 5회, IP 20회, `Retry-After`는 남은 초를 올림
- **토큰**
  - refresh 토큰에만 클레임 `ver`를 넣는다. 액세스 토큰은 바꾸지 않는다(TTL 15분 그대로).
  - 로그아웃은 언제나 204다.
- **주석**: 한국어로 "왜"만 쓴다. 알려진 한계는 `shortcut: <한계>, <언제 바꿀지>` 형식으로 쓴다.
- **검사**
  - API Task: `apps/api`에서 `./gradlew test`
  - 웹 Task: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`
- **커밋**
  - Codex 구현은 컨트롤러가 검사를 다시 돌린 뒤 Codex 서명으로 커밋한다.
  - 커밋 끝에 `Claude-Session: https://claude.ai/code/session_01PFyKnfubKKjUuhAtfZjgJ5`를 붙인다.

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 | 동시 진행 |
|---|---|---|---|
| 1 API: token_version·로그아웃 폐기·로그인 제한 | Claude sonnet | Codex `gpt-6-sol` / high | Task 2와 동시 |
| 2 웹: 프록시 출처 검사·IP 전달, 클라이언트 epoch, 문구 | Codex `gpt-6-sol` / medium | Claude sonnet | Task 1과 동시 |
| 반론 리뷰(PR 직전) | — | Codex `gpt-6-astra` / xhigh(템플릿 F) | — |
| 최종 | — | Claude opus 한 번 | — |

---

### Task 1: API — refresh 토큰 폐기와 로그인 횟수 제한

**담당:** Claude sonnet

**Files:**
- Create: `apps/api/src/main/resources/db/migration/V5__add_user_token_version.sql`, `apps/api/src/main/java/com/saladbowl/api/auth/LoginAttemptLimiter.java`
- Modify: `user/User.java`(`tokenVersion` 필드·증가 메서드), `auth/JwtProvider.java`(refresh에 `ver`, 파싱 결과에 `ver`), `auth/AuthService.java`(refresh 검사, `logout(refreshToken)`, 로그인 제한 연동), `auth/AuthController.java`(logout이 쿠키를 읽어 서비스에 넘김, 로그인에 클라이언트 IP 전달, 429 `Retry-After`), `common/ErrorCode.java`(`TOO_MANY_ATTEMPTS`), 필요하면 `common/GlobalExceptionHandler.java`(429 응답에 `Retry-After` 헤더)
- Test: `apps/api/src/test/java/com/saladbowl/api/auth/` 아래 기존 인증 테스트에 더하거나 새 `AuthHardeningTest`

**동작:** 설계 3장·5장 그대로다. `LoginAttemptLimiter`는 `Clock`을 생성자로 받는 빈이다(기본 `Clock.systemUTC()` 빈이 없으면 설정에서 제공). 테스트는 고정·이동 가능한 Clock으로 15분 경과를 시험한다.

- [ ] **Step 1: 실패하는 테스트**(설계 6장 API 목록 전부)
- [ ] **Step 2: 실패 확인** — `cd apps/api && ./gradlew test --tests '*Auth*'`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 전체 통과** — `./gradlew test`
- [ ] **Step 5: 커밋**(apps/api만 스테이징) — `feat(api): revoke refresh tokens on logout and limit login attempts`

---

### Task 2: 웹 — 프록시 출처 검사, IP 전달, 로그아웃 뒤 refresh 무시

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/proxy/forward.ts`, `apps/web/proxy/forward.test.ts`
- Modify: `apps/web/src/api/client.ts`(+ 테스트 파일이 있으면 그곳, 없으면 `client.test.ts` 새로), `apps/web/src/auth/AuthProvider.tsx`(`signOutLocally`가 `clearSession()`을 부름)
- Modify: `apps/web/src/common/errorMessage.ts`(+ 테스트), 로그인 화면 테스트(429 문구)

**Interfaces (Produces):**
```ts
// client.ts
export function clearSession(): void // 액세스 토큰을 지우고 authEpoch를 1 올린다. 이후 도착하는 진행 중 refresh 결과는 버려진다.
```

**동작:** 설계 2장·4장 그대로다.
- **출처 검사 위치**: 본문 크기 검사보다 먼저 한다. 막힌 요청의 본문은 읽지 않는다.
- **`X-Client-IP`**: 들어온 값은 항상 지운다. `cf-connecting-ip`가 있을 때만 그 값을 넣는다.
- **`clearSession`**: 지금 로그아웃 경로가 `setAccessToken(null)`을 직접 부르는 곳(`AuthProvider.signOutLocally`, `onAuthLost` 처리 등)을 확인한다. 로그아웃 의미인 곳만 `clearSession`으로 바꾼다.
- **refresh 실패 처리**: 서버가 refresh를 거절(401·403)해서 토큰을 지우는 기존 동작은 그대로 둔다.

- [ ] **Step 1: 실패하는 테스트**(설계 6장 웹 목록)
- [ ] **Step 2: 실패 확인** — `cd apps/web && npx vitest run proxy src/api src/auth src/common/errorMessage`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 전체 통과** — 웹 4종 검사
- [ ] **Step 5: 보고**(커밋은 컨트롤러) — `fix(web): check request origin in the proxy and ignore refreshes after logout`

---

### 마무리
- [ ] Codex `gpt-6-astra` / xhigh 반론 리뷰(템플릿 F): `origin/main...HEAD`의 인증·쿠키·프록시 변경. 공격 경로:
  - 출처 우회
  - 토큰 재사용
  - 경합
  - 제한 우회, 메모리 고갈
  - 로그아웃 실패 시 상태
- [ ] Claude opus 최종 리뷰 한 번
- [ ] 전체 검사(웹 4종 + `./gradlew test`)
- [ ] `docs/superpowers/plans/2026-10-27-plan-12-followups.md`: 바뀐 결정, 넘긴 항목, 배포 주의(기존 세션 한 번 로그아웃, 프록시와 API를 함께 배포)
- [ ] push, PR, Auto-fix
