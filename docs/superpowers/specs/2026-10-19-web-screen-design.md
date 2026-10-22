# Salad Bowl 웹앱 화면 설계 (1차, PC)

- 작성일: 2026-10-19
- 상태: 승인됨 (화면 설계 단계 논의 결과)
- 관련 문서
  - [전체 설계](2026-10-18-salad-bowl-design.md)
  - [Plan 01 후속 과제](../plans/2026-10-18-plan-01-followups.md), [Plan 02 후속 과제](../plans/2026-10-18-plan-02-followups.md), [Plan 03 후속 과제](../plans/2026-10-18-plan-03-followups.md)
  - [잔여 작업](../../backlog.md)
- 디자인 산출물(Claude Design, 비공개 링크)
  - 와이어프레임: https://claude.ai/artifact/84LZscxHMrZak44LnopNji
  - 디자인 시스템: https://claude.ai/artifact/Tt3aUZgcQfCuBDokrr8Hj9

## 1. 범위

- **1차는 PC 우선**이다. 레이아웃은 좁은 화면에서 무너지지 않게(사이드바가 위로 쌓이고, 표는 가로 스크롤) 만들지만, 하단 탭 같은 모바일 전용 UX는 고도화 단계에서 한다.
- **디자인 도구**: 와이어프레임과 디자인 시스템은 Claude Design으로 관리한다. Figma는 쓰지 않는다.
- **아이콘**: `apps/web/src/common/Icon.tsx`의 `<Icon name="..." />` 하나로 쓴다. 이모지는 쓰지 않는다.
  - 규칙: 24px 그리드, 선 굵기 1.75px, 둥근 끝처리, 색은 `currentColor`. 기본 크기는 20px, 버튼 안에서는 18px, 강조 영역(업로드 끌어놓기)은 32px이다.
  - 기본 아이콘은 Lucide(ISC)의 SVG 경로를 옮겨 쓴다. 새 아이콘이 필요하면 같은 버전(`lucide-static` 1.61.0)에서 경로만 복사한다. 패키지는 설치하지 않는다.
  - 오픈소스에 없는 도메인 아이콘(`sheet-upload` 등)은 같은 규칙으로 직접 그린다.
  - 아이콘은 장식이다(`aria-hidden`). 이름은 버튼 글자나 `aria-label`이 맡는다.
  - 로고는 `apps/web/public/logo.svg`다. 바꾸면 `apps/web`에서 `npx --yes @vite-pwa/assets-generator@2.0.0`으로 favicon·PWA 아이콘을 다시 만든다(설정은 `pwa-assets.config.js`).

## 2. 메뉴와 화면

```
[상단 바] 그룹 선택(드롭다운) · 닉네임 · 로그아웃
[좌측 사이드바]
 ├─ 홈 (내 가계부)      로그인 후 첫 화면
 ├─ 그룹 대시보드
 ├─ 거래 목록
 ├─ 업로드
 └─ 그룹 관리
[별도 화면] 로그인 · 회원가입 · 초대 수락(/invite/:token) · 그룹 없음 안내
```

| 화면 | 내용 | 쓰는 API |
|---|---|---|
| **홈** | 연도별 **월 커버리지 캘린더**(1~12월, 등록됨·건수 / 미등록 / 예정), 이번 달 내 수입·지출, 최근 업로드, 등록된 월을 누르면 월 데이터 대화상자(다시 업로드·월 삭제) | `GET /me/coverage?year=`(신규), `GET /me/transactions?month=`, `GET /imports`, `DELETE /me/transactions?month=&includeManual=` |
| **그룹 대시보드** | 선택한 그룹의 월간 요약: 수입·지출, 카테고리별 지출, 멤버별 | `GET /groups/{id}/summary?month=` |
| **거래 목록** | [내 거래]/[그룹 거래] 전환, 월·멤버·검색 필터, 표. 행을 누르면 오른쪽 상세 패널, [+ 거래 추가] | `GET /me/transactions`, `GET /groups/{id}/transactions`, `POST /me/transactions`, `PATCH`/`DELETE /transactions/{id}`, `GET /transactions/{id}/audits` |
| **업로드** | 안내, 파일 선택(.xlsx, 5MB), 결과(전체·신규·갱신·변경 없음), 실패 메시지(행 번호), 업로드 이력 | `POST /imports`, `GET /imports` |
| **그룹 관리** | 내 그룹 목록·생성, 이름 변경(관리자), 내 공개 설정, 멤버 목록·추방(관리자), 초대 링크 만들기·복사(관리자), 차단 목록·해제(관리자), 그룹 나가기(멤버) | `/groups`, `/groups/{id}`, `/groups/{id}/invites`, `/groups/{id}/members/...`, `/groups/{id}/share`, `/groups/{id}/bans` |
| **로그인·회원가입** | 탭 전환. 초대 링크로 들어왔다면 로그인 후 초대 화면으로 돌아간다 | `/auth/signup`, `/auth/login` |
| **초대 수락** | 그룹 이름, 인원(n/6), 만료 일시, [그룹에 합류하기]. 상태: 이미 멤버, 만료(410), 정원 초과(409), 차단(403) | `GET /invites/{token}`, `POST /invites/{token}/accept` |
| **그룹 없음 안내** | 그룹 만들기 또는 초대 링크 받기 안내. 그룹이 없어도 홈·업로드·내 거래는 쓸 수 있다 | `GET /groups` |

## 3. 화면 규칙

- **월 커버리지 캘린더**
  - 그 달에 **import로 들어온 내 거래가 1건 이상** 있으면 등록됨이다. 업로드한 날짜가 아니라 거래 일자 기준이다.
  - 현재 달 이후는 "예정"으로 보여주고 누를 수 없다.
  - 미등록 월을 누르면 **업로드 대화상자**가 열린다. 업로드가 끝나면 결과를 보여주고 캘린더를 새로 고친다.
- **거래 상세 패널**
  - 카테고리·메모는 override로 고친다. 비우면 원본으로 돌아간다.
  - **숨김은 본인 거래에만** 보여준다. **삭제는 본인의 수동 거래에만** 보여준다(`ownerId == 나 && source == MANUAL`).
  - 수정할 수 없는 거래(`editable == false`)는 읽기 전용으로 보여준다.
  - `editable`은 보고 있는 그룹과 무관하다(다른 그룹의 관리자이면 true일 수 있다).
- **금액 표기**
  - 거래 금액은 부호를 붙인다(`-₩ 7,000`). 요약의 지출 합계는 양수로 보여준다.
  - `occurredAt`은 시간대가 없는 한국 시간이다. 그대로 보여준다.
- **오류**: API의 `{code, message}`를 화면 문구로 바꾼다. 업로드 오류는 서버 메시지(`row N: ...`)의 행 번호를 보여준다.
- **콜드스타트**: Render 무료 인스턴스가 깨어나는 동안(첫 요청이 수십 초) "서버를 깨우는 중" 상태를 보여준다.

## 4. 배포 구성: Cloudflare Pages가 API를 프록시한다 (A안)

- 브라우저는 `https://<pages 도메인>/api/*`만 호출한다. Pages Functions가 Render API로 전달한다.
- 같은 출처라서 CORS가 필요 없고, Safari·iOS의 교차 사이트 쿠키 차단을 피한다.
- **API 쪽에서 해야 할 것(Plan 04)**
  - refresh 쿠키의 `Path`, `SameSite`, `Secure`를 설정값으로 바꾼다. 지금은 `Path=/auth`라서 `/api/auth/...` 경로에서 쿠키가 전송되지 않는다.
  - A안 값: `Path=/api/auth`, `SameSite=Lax`, `Secure`(로컬 http 개발에서는 끈다)
  - `POST /auth/logout`(쿠키 삭제)을 추가한다.
- **FE 쪽**: API 주소는 `VITE_API_BASE_URL`(기본값 `/api`) 하나만 본다. 로컬 개발은 Vite dev server의 `/api` 프록시로 같은 구조를 만든다.
- **개인 도메인(B안)으로 옮길 때**: 설정값(쿠키 Path, `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`)과 DNS만 바꾼다. [잔여 작업](../../backlog.md) 참고.

## 5. 기술 선택 (스펙 6.3 보완)

- React + Vite + TypeScript, React Router, TanStack Query(서버 상태)
- **스타일은 Tailwind 대신 CSS 변수 + CSS Modules로 바꾼다.**
  - 디자인 시스템 토큰(`tokens.json`)을 그대로 CSS 변수로 쓰기 위해서다. 라이트·다크 테마도 같은 변수로 처리한다.
  - 의존성도 줄어든다.
- 테스트: Vitest + React Testing Library + MSW(API 모킹)
- PWA 설치(`vite-plugin-pwa`)는 1차에 넣되 오프라인 기능은 없다. 모바일 전용 UX는 고도화 단계로 넘긴다.

## 6. API 추가·변경 요약 (Plan 04에 포함)

| 변경 | 내용 |
|---|---|
| refresh 쿠키 설정화 | `app.auth.refresh-cookie.path`, `.same-site`, `.secure` |
| `POST /auth/logout` | 같은 속성에 `Max-Age=0`으로 쿠키를 지운다. 204를 돌려준다 |
| `GET /me/coverage?year=YYYY` | `[{month: "2026-09", importedCount: 168, manualCount: 12}]`. import 거래가 있는 달만 돌려준다 |
| `DELETE /me/transactions?month=YYYY-MM&includeManual=` | 내 그 달 거래 영구 삭제. 기본은 import만. `{deletedImported, deletedManual}` ([월 데이터 삭제 설계](2026-10-22-month-data-delete-design.md)) |
| 업로드 파일 이름 | 마지막 경로 조각만 저장한다(Plan 03 후속 과제) |
