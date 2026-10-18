# Plan 01 후속 과제

Plan 01 리뷰(Task별 리뷰와 최종 리뷰)에서 나왔지만 이후 계획으로 넘긴 항목이다. 각 계획을 작성할 때 해당 항목을 Task로 포함한다.

## Plan 02 (그룹)
- `GlobalExceptionHandler`의 catch-all(`Exception` → 500)이 Spring의 4xx 예외(`MissingServletRequestParameterException`, `ServletRequestBindingException`, `HttpMediaTypeNotAcceptableException`, `ResponseStatusException`, `AccessDeniedException`)까지 500으로 바꾼다. `@PathVariable`·`@RequestParam`·권한 검사를 추가하기 전에 `ResponseEntityExceptionHandler` 확장 등으로 4xx를 보존한다.
- unique 제약 위반(`DataIntegrityViolationException`)을 409로 매핑한다. 회원가입 중복 이메일 경쟁 조건도 여기에 포함된다.

## Plan 04 (웹앱)
- **교차 사이트 refresh 쿠키 (결정 필요)**: `*.pages.dev`와 `*.onrender.com`은 서로 다른 사이트다. 그래서 Safari/iOS(ITP)가 `refresh_token` 쿠키를 차단하고, 15분마다 로그아웃된다. 아래 중 하나를 고른다.
  - FE와 API를 같은 등록 도메인 아래에 둔다(예: `app.example.com`, `api.example.com`).
  - Cloudflare Pages에서 API를 프록시해 first-party로 만든다.
  - 어느 쪽이든 쿠키의 `path`·`SameSite`·`Secure`를 설정값으로 바꾸고, 쿠키 속성 테스트를 추가한다.
- `POST /auth/logout` 추가(동일 속성 + `Max-Age=0`). 필요하면 이후 `token_version`으로 토큰을 무효화한다.
- 비밀번호 UTF-8 72바이트 초과 검증(BCrypt 제한, 한글 64자는 약 192바이트).
- CORS 허용 헤더 재검토(현재 `Authorization`, `Content-Type`만 허용), 허용되지 않은 origin에 대한 테스트.
- 삭제된 사용자의 `/me` 응답이 404인 점을 FE 세션 처리와 함께 정리한다.

## Plan 05 (배포)
- `JWT_SECRET` 미설정 시 기동 실패(로컬 프로필에서만 기본값 허용). 32바이트 이상 랜덤 값을 쓰고 Base64 디코딩을 검토한다.
- 로그인 rate limit.
- `api-ci`에 `permissions: contents: read`와 `concurrency`를 추가한다. paths 필터가 걸려 있으므로 required check로 지정하면 안 된다.
- `ApiException`에 cause를 보존한다(로그·관측성).

## 언제든 (사소함)
- `docker-compose.yml` 포트를 `127.0.0.1:5432:5432`로 바인딩한다.
- `JwtProviderTest`의 만료·변조 케이스에서 `INVALID_TOKEN` 코드까지 검증한다.
- 사용하지 않는 Boot 4 test starter(actuator/data-jpa/flyway/validation-test)를 정리한다.
- 규칙: 상태를 변경하는 엔드포인트는 쿠키로 인증하지 않는다(CSRF 비활성 전제).
