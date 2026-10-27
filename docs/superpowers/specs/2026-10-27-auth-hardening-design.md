# 인증 보강 설계 (Plan 06 남은 범위 중 인증)

- 작성일: 2026-10-27
- 상태: 승인됨 (2026-10-27, 사용자가 "모든 기기 로그아웃"과 "이메일 5회/15분 + IP 20회/15분"을 고름)
- 근거: [Plan 08 후속](../plans/2026-10-25-plan-08-followups.md) "남은 Plan 06 범위 — 인증"

## 1. 목표

이미 있는 인증 문제 네 가지를 고친다.
1. 프록시가 모든 `Origin`을 지워서 다른 사이트가 강제 로그아웃(CSRF)을 일으킬 수 있다.
2. 로그아웃해도 refresh 토큰이 서버에서 살아 있다. 탈취된 쿠키로 14일 동안 다시 들어올 수 있다.
3. 진행 중인 refresh가 로그아웃을 되돌릴 수 있다(경합).
4. 로그인 시도 횟수 제한이 없다.

## 2. 프록시 출처 검사

- **적용 대상**: `apps/web/proxy/forward.ts`에서 메서드가 GET·HEAD·OPTIONS가 아닌 요청
- **허용 조건(둘 중 하나)**
  - `Origin` 헤더가 `new URL(request.url).origin`과 정확히 같다.
  - `Origin`이 없고 `Sec-Fetch-Site`가 `same-origin`이다.
- **막을 때**: API를 부르지 않고 403 `{ code: 'FORBIDDEN_ORIGIN', message: 'cross-origin request is not allowed' }`을 돌려준다.
- **허용할 때**: 지금처럼 `Origin`을 지우고 넘긴다.
- 미리보기(`*.pages.dev`)·운영 주소 모두 자기 출처와 비교하므로 허용 목록이 필요 없다.
- `CF-Connecting-IP` 처리(4장 IP 판별용)
  - 프록시는 들어온 `X-Client-IP`를 지운다.
  - 그 대신 `request.headers.get('cf-connecting-ip')`가 있으면 `X-Client-IP`로 넣어 보낸다.
  - 브라우저가 보낸 `X-Client-IP`는 믿지 않는다는 뜻이다.
- 웹 `errorMessage`에 `FORBIDDEN_ORIGIN` 문구 "요청을 처리할 수 없습니다. 페이지를 새로고침해 주세요."를 더한다.

## 3. refresh 토큰 폐기 (모든 기기)

- **마이그레이션** `V5__add_user_token_version.sql`: `ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;`
- **발급**: refresh JWT에 클레임 `ver`(정수)를 넣는다. 액세스 토큰에는 넣지 않는다.
- **`/auth/refresh`**: 아래 중 하나면 401 `INVALID_TOKEN`이다.
  - 토큰에 `ver`가 없다(이 변경 전에 발급된 토큰). 배포하면 기존 세션은 한 번 로그아웃된다. 받아들인다.
  - `ver`가 DB `token_version`과 다르다.
- **`/auth/logout`**
  - refresh 쿠키를 읽어 서명·만료·타입이 유효하고 `ver`가 현재 값과 같으면, 그 사용자의 `token_version`을 1 올린다.
  - 쿠키가 없거나 무효면 아무것도 바꾸지 않는다.
  - 결과와 상관없이 쿠키를 지우고 204다(로그아웃은 언제나 성공).
- **한계**: 액세스 토큰(15분)은 그대로 둔다. 요청마다 DB를 조회하지 않으려는 것이다. 다른 기기는 길어야 15분 안에 refresh가 실패해 로그아웃된다.

## 4. refresh–로그아웃 경합

- **서버**: 로그아웃 전에 출발한 refresh 응답이 늦게 와서 쿠키를 새로 심어도, 그 토큰은 이전 `ver`라 다음 refresh에서 거절된다(3장).
- **클라이언트** `apps/web/src/api/client.ts`
  - 모듈 변수 `authEpoch`를 둔다.
  - `setAccessToken(null)`이 불리는 로그아웃 경로에서 1 올린다. 구체적으로는 `clearSession()` 같은 함수를 하나 두고 `AuthProvider.signOutLocally`가 부른다.
  - `refreshAccessToken`은 시작할 때 epoch를 기억한다. 응답이 왔을 때 epoch가 바뀌었으면 토큰을 저장하지 않고 `null`을 돌려준다.
  - 이때 `onAuthLost`는 다시 알리지 않는다(이미 로그아웃된 상태).
- `AuthProvider.logout`은 지금처럼 서버 로그아웃이 성공한 뒤 로컬 로그아웃을 한다.

## 5. 로그인 횟수 제한

- **기준**: 15분 고정 창(첫 실패 시각부터 15분).
  - 이메일(정규화 뒤) 기준 실패 5회
  - IP 기준 실패 20회
- **검사 순서**
  - 로그인 요청이 오면 먼저 두 카운터를 본다.
  - 어느 하나라도 한도에 닿았으면 비밀번호를 확인하지 않고 429 `TOO_MANY_ATTEMPTS`를 돌려준다. `Retry-After` 헤더는 남은 초다(올림).
- **실패하면**(`INVALID_CREDENTIALS`) 두 카운터를 올린다. 존재하지 않는 이메일도 같다.
- **성공하면** 그 이메일 카운터를 지운다. IP 카운터는 두어 한 IP의 여러 계정 대입을 막는다.
- **IP**: `X-Client-IP` 헤더(프록시가 넣음)가 있으면 쓰고, 없으면 `request.getRemoteAddr()`.
  - Render 주소를 직접 부르면 이 헤더를 위조할 수 있다. IP 제한만 우회되고 이메일 제한은 남는다. 받아들인다.
- **저장**: `LoginAttemptLimiter`(빈 하나)가 `ConcurrentHashMap<String, Window>`에 담는다. 시각은 주입한 `Clock`으로 잰다(테스트용).
  - 만료된 항목은 조회할 때 지운다. 항목 수 상한 10,000개를 넘으면 만료된 것부터 정리한다.
  - `shortcut: 서버 메모리·인스턴스 1대 기준이고 재시작하면 초기화된다. 인스턴스가 늘면 Redis 등 공유 저장소로 바꾼다.`
- **ErrorCode**: `TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS)`
- **웹 문구**: `errorMessage`에 `TOO_MANY_ATTEMPTS`를 더한다. "로그인 시도가 너무 많습니다. 15분쯤 뒤 다시 시도해 주세요."
- **회원가입**: 제한하지 않는다(범위 밖).

## 6. 검증

- **API** `./gradlew test`
  - refresh에 `ver` 있음, 버전 불일치 401, `ver` 없는 토큰 401
  - 로그아웃하면 같은 사용자의 다른 refresh 토큰도 401, 쿠키 없는/무효 쿠키 로그아웃 204(버전 그대로)
  - 이메일 5회 실패 뒤 6번째는 올바른 비밀번호여도 429 + `Retry-After`
  - 15분이 지나면 다시 허용(Clock 조작)
  - 성공하면 이메일 카운터 초기화
  - 서로 다른 이메일로 같은 IP 20회 실패 뒤 429
  - `X-Client-IP`로 IP를 구분
- **웹**
  - `forward.test.ts`: POST + 다른 Origin → 403·fetch 안 함, 같은 Origin → 통과·Origin 제거, Origin 없음 + `Sec-Fetch-Site: same-origin` → 통과, Origin 없음 + `cross-site`나 헤더 없음 → 403, GET은 Origin 무관 통과, 들어온 `X-Client-IP` 제거·`CF-Connecting-IP` 옮김
  - `client.test`: refresh 진행 중 로그아웃(`clearSession`) → 응답이 와도 토큰이 저장되지 않음
  - 로그인 화면: 429 응답이면 해당 문구
- **반론 리뷰**: 인증·쿠키·프록시가 바뀌므로 PR 전에 Codex `gpt-6-astra`(xhigh)가 반론 리뷰를 한 번 한다(codex-collab 템플릿 F).

## 7. 범위 밖

- 액세스 토큰 즉시 폐기, 기기별 세션 목록, refresh 토큰 회전(rotation)·재사용 탐지
- 회원가입·비밀번호 재설정 제한, 공유 저장소 기반 제한
- Plan 06의 데이터·초대 범위
