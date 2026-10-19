# Plan 04a 후속 과제

Plan 04a(API 보완 + 웹앱 기반)의 Task별 리뷰와 최종 리뷰에서 나왔지만 이후 계획으로 넘긴 항목이다. 이전 후속 과제 문서([01](2026-10-18-plan-01-followups.md), [02](2026-10-18-plan-02-followups.md), [03](2026-10-18-plan-03-followups.md))와 함께 본다.

## Plan 04b (홈·업로드·거래 화면) — 첫 Task로 처리할 것
- **CI에 lint 추가**: web-ci에 `npm run lint`를 넣는다. 지금은 `rules-of-hooks` 같은 규칙이 CI에서 검사되지 않는다.
- **쿼리 재시도 규칙**: `App`의 `retry: 1`은 4xx(403 `REMOVED_FROM_GROUP`, 404, 400)까지 재시도한다. `ApiError` 4xx는 재시도하지 않는 판정 함수로 바꾼다.
- **로딩 판단 규칙**: 데이터가 아직 없음은 `isPending`으로 판단한다(`GroupProvider`에서 정한 규칙). 새 화면도 따른다.
- **쿼리 키**: 사용자 범위가 없다(`['groups']`). `ClearCacheOnSignOut`이 로그아웃 때 캐시를 비우므로 괜찮지만, QueryClient 밖에 데이터를 캐시하지 않는다.
- **오류 문구 매핑**: `errorMessage`에 화면별 코드를 추가한다(`INVALID_FILE_FORMAT`, `FILE_TOO_LARGE`, `CANNOT_DELETE_IMPORTED`, `INVALID_TOKEN`, `CONFLICT`, `REQUEST_FAILED`). 코드 타입을 union으로 만들어 누락이 보이게 한다.
- **연도·월 범위 검증**: `GET /me/coverage?year=`의 극단값이 500이 된다. 1..9999로 검증하고, `month` 파라미터도 같은 규칙으로 맞춘다.
- **세션 복원 실패 표시**: 복원 재시도(2회)가 끝나도 일시적 실패(5xx·네트워크)면 지금은 로그인 화면이 나온다. "서버에 연결하지 못했습니다 + 다시 시도" 상태로 바꾼다. `/me` 일시 실패도 같다.
- **접근성 규칙 정리**
  - 화면이 바뀔 때 `document.title`을 바꾸고 포커스를 이동한다.
  - `RequireAuth` 로딩 상태의 `role="status"` 두 개를 하나로 줄인다.
  - 헤더 "그룹 없음" 링크의 누르는 영역을 40px 이상으로 한다.
- **스타일 규칙 정리**
  - 글자 크기·간격 리터럴을 토큰(type scale)으로 옮긴다.
  - 작은 컴포넌트의 inline style을 CSS Modules로 옮긴다.
  - 레이아웃 breakpoint를 720px에서 약 820px로 바꾼다.
- **AbortError 구분**: 쿼리 signal을 연결할 때 `AbortError`를 `NETWORK_ERROR`로 표시하지 않는다.
- **테스트 보강**
  - 로그인 가드의 `next` 보존
  - `onAuthLost` 때 캐시 비우기
  - `GroupProvider`의 오프라인(`isPending`) 경우
  - signup 오류 매핑

## Plan 04c (그룹 화면·초대·PWA·Pages 프록시)
- **Node 버전 고정**: `.nvmrc`와 `engines`(`>=22.22`)를 둔다. Cloudflare Pages 빌드가 `.nvmrc`를 읽는다. 로컬 Node 23에서는 vitest 4가 EBADENGINE 경고를 내고 npm install에 `--legacy-peer-deps`가 필요하다.
- **프록시 응답 처리**
  - Pages·Render의 HTML 502·524는 지금 "요청을 처리하지 못했습니다"로 보인다. "서버를 사용할 수 없습니다"로 바꾼다.
  - Function 경로가 빗나가 SPA가 200 HTML을 돌려주면 `SyntaxError`가 난다. `ApiError`로 바꾼다.
  - refresh 200이 JSON이 아닐 때도 같은 처리를 한다.
- **로그인 탭 접근성**: `role="tab"`에 `tabpanel`과 화살표 키 처리가 없다. `aria-pressed` 버튼으로 바꾸는 것도 방법이다.
- **회원가입 부분 실패**: 가입은 성공했는데 이어지는 로그인이 실패하면 재시도할 때 `EMAIL_ALREADY_EXISTS`가 나온다. 로그인 탭으로 안내한다.

## Plan 05 (배포·운영)
- **refresh 토큰 폐기**
  - 로그아웃해도 refresh JWT는 14일간 유효하다(stateless). `token_version` 같은 서버 측 폐기를 넣는다.
  - 진행 중이던 refresh가 로그아웃을 되돌리는 경합이 있다. epoch 카운터나 대기로 막는다.
- **쿠키 설정 검증**: `SameSite` 값을 검증하고, `SameSite=None`과 `Secure=false` 조합을 막는다. 설정값이 실제로 반영되는지 테스트한다.
- **README**: 로컬 개발 방법(`REFRESH_COOKIE_SECURE=false`, `npm run dev`의 `/api` 프록시)을 적는다. 템플릿 README를 대체한다.

## 나중에 (사소함)
- `ApiException`이나 클라이언트 리스너 예외를 격리한다. 오래된 401 때문에 불필요한 refresh가 한 번 더 나간다.
- `credentials: 'include'`가 모든 요청에 붙는다. 같은 출처에서는 무해하고, B안에서는 필요하다.
- 업로드 파일 이름을 255자로 자를 때 `.xlsx`가 잘릴 수 있다. code point 자르기 단위 테스트가 없다.
- 테스트의 실제 3.3초 타이머(스위트가 약 10초 느려진다). 타입체크가 두 번 돈다. `@types/node`가 `^24`다.
- 로그아웃 실패 시 별도 재시도 버튼이 없다(로그아웃을 다시 누른다). 오류 경계는 경로가 바뀌어도 초기화되지 않는다.
