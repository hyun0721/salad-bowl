# React Aria 컴포넌트 전면 적용 설계

- 작성일: 2026-10-22
- 상태: 승인됨 (브레인스토밍 결과)
- 관련 문서
  - [웹 화면 설계](2026-10-19-web-screen-design.md)
  - [React Aria PoC 기록](../../ui-library-poc.md) (PR #12)
  - [잔여 작업](../../backlog.md)

## 1. 목표와 원칙

- PR #12에서 그룹 셀렉트와 업로드 칸에 적용한 `react-aria-components`(이하 RAC)를 앱의 나머지 입력·오버레이·탭·목록에 적용한다.
- **시각 디자인은 바꾸지 않는다.** 색·간격·radius는 `styles/tokens.css` 그대로 쓰고, 동작·접근성·상태 표현(포커스, 오류, 비활성, 선택)만 통일한다.
- **RAC는 `apps/web/src/common/`에서만 import한다.** 화면 코드는 공용 래퍼만 쓴다. 라이브러리 교체나 업그레이드의 영향 범위를 `common/`으로 묶기 위해서다.
- 공용 래퍼는 래퍼마다 `*.module.css`와 `*.test.tsx`를 둔다. 화면 테스트는 요소를 찾는 방법만 바꾸고 시나리오는 유지한다.
- 반응형 기준은 기존과 같은 820px이다. 이하를 모바일 폭이라 부른다.

## 2. 단계

| 단계 | 내용 | 결과물 |
|---|---|---|
| 0 | PR #12 (Select, 업로드, 라이선스 고지, ko-KR 문구만 남기기) | 머지됨 (2026-10-22) |
| 0.5 | 모바일 내비게이션: 하단 탭 바, 계정 시트, `viewport-fit=cover` | 계획 1개, PR 1개 |
| 1 | 공용 폼 부품 + 폼 입력 교체 + 카테고리 자동완성(API 포함) | 계획 1개, PR 1개 |
| 2 | 오버레이·알림 + 탭·토글 | 계획 1개, PR 1개 |
| 3 | 목록·모바일 패널 + 화면 단위 지연 로딩 | 계획 1개, PR 1개 |

단계마다 따로 계획 문서(`docs/superpowers/plans/`)를 쓰고 따로 PR을 낸다. 뒤 단계는 앞 단계의 공용 부품을 쓰므로 순서대로 진행한다.

## 3. 단계 0.5 — 모바일 내비게이션

모든 화면의 뼈대를 바꾸므로 단계 1보다 먼저 한다. 그래야 뒤 단계의 모바일 확인이 최종 레이아웃 위에서 이뤄진다.

### 3.1 부품 선택

- RAC와 다른 헤드리스 라이브러리 모두 "하단 탭 바" 전용 컴포넌트는 없다. Base UI·Radix의 NavigationMenu는 데스크톱 드롭다운용이다.
- 하단 탭은 `<nav>` 안의 링크 목록이고, 현재 화면은 `aria-current="page"`다. `role="tablist"`는 쓰지 않는다(화면 이동이지 탭 패널 전환이 아니다).
- 탭 항목은 지금처럼 react-router `NavLink`로 만든다. RAC에서는 다음을 쓴다.
  - `SelectionIndicator`: 현재 탭 표시선을 탭 사이로 옮기는 애니메이션. `prefers-reduced-motion`이면 애니메이션 없이 바로 옮긴다.
  - `Sheet` + `SheetTrigger`(1.22.1 정식 export): 계정 시트. 아래로 쓸어 닫기를 지원한다.
- `NavigationTree`는 계층 메뉴용이라 쓰지 않는다. 지금 메뉴는 한 단계다.

### 3.2 레이아웃

- **모바일 폭(820px 이하)**
  - 왼쪽 사이드바를 숨기고 **하단 탭 바**를 화면 아래에 고정한다.
  - 탭은 홈, 대시보드, 거래, 업로드, 그룹 다섯 개다. 아이콘 위, 짧은 이름 아래로 놓는다. 이름은 "그룹 대시보드"를 "대시보드"로, "거래 목록"을 "거래"로, "그룹 관리"를 "그룹"으로 줄인다. 접근 이름은 짧은 이름을 그대로 쓴다.
  - 항목 터치 영역은 48px 이상이다. 탭 바 아래에 `env(safe-area-inset-bottom)` 여백을 둔다.
  - 현재 탭은 `--brand` 색과 표시선으로 보여준다.
  - 상단 바는 한 줄로 줄인다: 로고(아이콘만), 그룹 `Select`, 계정 버튼(아이콘 + 접근 이름 "계정").
  - 계정 버튼을 누르면 하단 `Sheet`가 열린다. 시트에는 닉네임과 로그아웃 버튼이 있다. 로그아웃이 실패하면 지금처럼 오류 문구를 보여준다.
  - `main` 아래쪽에 탭 바 높이만큼 여백을 둬서 본문 끝이 가려지지 않게 한다.
- **넓은 폭**: 사이드바와 상단 바를 그대로 둔다.
- `index.html` viewport에 `viewport-fit=cover`를 넣는다. 지금은 없어서 `env(safe-area-inset-*)`가 0이다(PR #12 리뷰에서 남은 항목).
- 화면 전환 시 새 화면 제목으로 포커스를 옮기는 기존 동작은 그대로 둔다.
- 메뉴가 6개 이상으로 늘면 다섯 번째 탭을 "더보기"로 바꾸고, 나머지 메뉴를 `Sheet`에 담는다. 지금은 만들지 않는다.

### 3.3 테스트

- 모바일 폭(matchMedia 모킹)에서 `navigation "주 메뉴"` 안에 링크 다섯 개가 있고, 현재 화면 링크에만 `aria-current="page"`가 있는지 확인한다.
- 계정 버튼을 누르면 시트가 열리고, 시트에서 로그아웃할 수 있는지 확인한다.
- 넓은 폭의 기존 테스트는 그대로 통과해야 한다.

## 4. 단계 1 — 폼 입력

### 4.1 공용 부품

| 부품 | 쓰는 곳 | 동작 |
|---|---|---|
| `Select` (PR #12) | 거래 화면 멤버 필터, 수동 추가의 타입 | 그대로 재사용한다 |
| `ResponsiveOverlay` | `Select`, `DateTimePicker` | `Select.tsx`에 있는 팝오버/하단 시트 분기와 "열린 동안 모양 고정" 로직을 분리한 것. 모바일 폭은 하단 고정 Popover(시트), 그 밖은 트리거 아래 Popover |
| `TextField`, `TextArea` | 대분류·소분류(자동완성 실패 시), 내용, 결제수단, 메모, 그룹 이름, 로그인 입력 | 보이는 라벨, 설명(`Text slot="description"`), 오류(`FieldError`) 자리를 같은 모양으로 둔다 |
| `NumberField` | 금액 | `ko-KR` 쉼표 형식, 정수(`maximumFractionDigits: 0`), `minValue={1}`, 입력칸 뒤에 "원" 표시. 모바일 숫자 키패드 |
| `DateTimePicker` | 수동 추가의 일시 | RAC `DatePicker` `granularity="minute"`, `hourCycle={24}`, 달력 버튼. 값은 `CalendarDateTime`이고, API에는 지금과 같은 `YYYY-MM-DDTHH:mm` 문자열로 바꿔 보낸다 |
| `SearchField` | 거래 검색 | × 지우기 버튼, Esc로 지우기 |
| `Checkbox` | "그룹 화면에서 숨기기" | 저장 버튼을 눌러야 반영되므로 체크박스 |
| `Switch` | "내 거래를 이 그룹에 공개" | 누르는 즉시 저장되므로 스위치. 저장 중에는 비활성 |
| `ComboBox` | 대분류, 소분류 | 후보 목록이 있는 입력칸. 목록에 없는 값도 입력할 수 있다(`allowsCustomValue`). 모바일 폭에서도 입력칸 바로 아래 Popover를 쓴다(하단 시트는 화면 키보드에 가려지므로) |

- **검증**: 브라우저 기본 검증(`required`, `maxLength`, `validationBehavior="native"`)을 그대로 쓰고, 오류 문구만 `FieldError`로 입력칸 아래에 보여준다. 서버 오류는 지금처럼 폼 아래 `ui.alert`로 둔다.
- **새 의존성**: `@internationalized/date`. RAC가 이미 내부에서 쓰므로 번들 증가는 작다.

### 4.2 카테고리 자동완성

- **API** `GET /api/me/categories`
  - 대상: 로그인한 사용자 본인의 거래 중 삭제되지 않은 것. 그룹 거래는 포함하지 않는다(수동 추가와 수정은 본인 거래에만 하므로).
  - 값: 화면에 보이는 실제 값이다. 덮어쓴 값(`*_override`)이 있으면 그 값을 쓴다.
  - 응답: `[{ "major": "식비", "count": 42, "minors": [{ "minor": "카페", "count": 12 }] }]`. `count` 내림차순, 같으면 이름순으로 정렬한다. 소분류가 빈 값이면 `minors`에 넣지 않는다.
  - 새 테이블이나 마이그레이션은 없다. 조회 쿼리 하나와 컨트롤러 메서드 하나로 끝난다.
  - 테스트: 본인 거래만 나오는지, override가 반영되는지, 삭제된 거래가 빠지는지, 정렬 순서가 맞는지.
- **웹**
  - `categoriesApi.ts`와 TanStack Query 훅. 거래를 추가·수정·업로드한 뒤 무효화한다(`useUpload`와 거래 변경 훅의 `invalidateQueries`에 `['categories']` 추가).
  - 대분류 `ComboBox`, 소분류 `ComboBox`. 소분류 후보는 입력된 대분류와 정확히 같은 항목의 `minors`만 보여준다.
  - 목록을 불러오지 못하거나 아직 로딩 중이면 후보 없이 일반 입력칸처럼 동작한다. 오류 문구는 띄우지 않는다.
- **담당**: `apps/api` 변경은 Claude 구현자가 맡고 Codex가 리뷰한다(Codex 샌드박스에서 Docker·Gradle 불가). `apps/web` 변경은 Codex가 구현하고 Claude가 리뷰한다.

### 4.3 적용 화면

- `transactions/ManualTransactionForm.tsx`: 일시, 타입, 대분류, 소분류, 내용, 금액, 결제수단, 메모
- `transactions/TransactionPanel.tsx`: 대분류, 소분류, 메모, 숨기기
- `transactions/TransactionsPage.tsx`: 멤버 필터, 검색
- `groups/CreateGroupForm.tsx`, `groups/GroupSettings.tsx`(이름, 공개 스위치)
- `auth/LoginPage.tsx`: 이메일, 비밀번호, 닉네임
- `groups/InviteSection.tsx`의 읽기 전용 링크 칸은 `TextField isReadOnly`로 바꾼다

## 5. 단계 2 — 오버레이·알림, 탭·토글

| 지금 | 바꾼 뒤 |
|---|---|
| `common/Modal.tsx`(포커스 트랩과 Esc 처리를 직접 구현) | 공용 `Dialog`(RAC `ModalOverlay` + `Modal` + `Dialog`). 홈의 업로드 모달이 쓴다. `closeDisabled`(업로드 중 닫기 막기)는 `isDismissable`·`isKeyboardDismissDisabled`로 유지한다 |
| 그룹 나가기, 멤버 내보내기, 거래 삭제의 제자리 2단계 확인(포커스 이동을 직접 처리) | 공용 `ConfirmDialog`: 제목, 설명, 위험 버튼, 취소 버튼. 실행 중에는 버튼을 비활성으로 두고, 실패하면 대화상자 안에 `ui.alert`로 오류를 보여준다. 성공하면 닫는다 |
| "저장했습니다", "이름을 바꿨습니다", "링크를 복사했습니다" 인라인 성공 문구 | 공용 `Toast`(RAC `ToastRegion` + 큐). 화면 하단 중앙에 띄우고 4초 뒤 사라진다. 스크린리더가 읽는다. `AppLayout`에 영역을 하나 둔다 |
| 오류 문구 | **인라인 그대로 둔다.** 사라지는 알림으로 오류를 놓치지 않게 하기 위해서다 |
| 로그인/회원가입 탭(`role="tab"`과 방향키 처리 직접 구현) | 공용 `Tabs` |
| 거래 화면의 내 거래/그룹 거래 버튼 | 공용 `SegmentedControl`(RAC `ToggleButtonGroup`, `selectionMode="single"`, `disallowEmptySelection`). 그룹이 없으면 "그룹 거래"를 비활성으로 둔다 |

- 모바일 폭에서 `Dialog`와 `ConfirmDialog`는 RAC `Sheet`(하단, 쓸어 닫기)로 띄운다. 위쪽 모서리만 둥글게, `70dvh` 상한, 안전 영역 여백을 둔다. 단 업로드 중(`closeDisabled`)에는 쓸어 닫기도 막는다. Select는 컬렉션 문제 때문에 PR #12의 하단 고정 Popover를 그대로 쓴다.
- `common/Modal.tsx`와 화면마다 있는 "확인 단계 포커스 이동" 코드는 지운다.

## 6. 단계 3 — 목록, 모바일 패널, 지연 로딩

### 6.1 거래 목록

- 지금 목록은 `div`·`button` 격자이고 머리글은 `aria-hidden`이라, 스크린리더에서 열 이름을 알 수 없다.
- **넓은 폭**: 공용 `DataTable`(RAC `Table`).
  - 열: 일시, (그룹 보기일 때) 멤버, 카테고리, 내용, 결제수단, 금액
  - 방향키로 행을 이동하고, Enter나 클릭으로 상세를 연다(`onRowAction`). 선택된 행은 `--brand-tint` 배경으로 표시한다.
  - 일시·금액 열은 정렬할 수 있다(`sortDescriptor`, 브라우저에서 정렬). 기본값은 지금처럼 서버가 준 순서다.
  - "수정됨", "숨김" 배지는 그대로 둔다.
- **모바일 폭**: 같은 데이터를 RAC `GridList` 카드로 보여준다. 첫 줄은 내용과 금액, 둘째 줄은 일시·카테고리·멤버다.
- 대시보드 멤버별 표와 카테고리 `<meter>`는 그대로 둔다. 이미 구조가 맞고 작다.
  - **2026-10-25 변경**: 카테고리 `<meter>` 목록은 도넛차트와 대분류·금액·비율 목록으로 바뀐다. [대시보드 도넛 설계](2026-10-25-dashboard-category-donut-design.md)가 이 결정을 번복한다. 멤버별 표는 그대로다.

### 6.2 거래 상세·추가 패널

- 넓은 폭은 지금처럼 오른쪽 `aside` 패널이다.
- 모바일 폭에서는 RAC `Sheet`를 전체 높이로 띄워 같은 내용을 보여준다. `ManualTransactionForm`의 "열릴 때 제목으로 포커스" 코드는 지운다(Dialog가 포커스를 맡는다).

### 6.3 화면 단위 지연 로딩

- `app/AppRoutes.tsx`에서 로그인, 초대, 대시보드, 거래, 업로드, 그룹 화면을 `React.lazy`로 나눈다. 홈은 첫 화면이라 그대로 둔다.
- 불러오는 동안 `<Suspense>` fallback으로 `ui.status` 스타일의 "불러오는 중" 문구를 보여준다.
- PWA precache는 그대로다. 나뉜 청크도 `globPatterns`에 잡혀 미리 캐시된다.
- 성공 기준: Vite의 500 kB 청크 경고가 사라진다. 홈 첫 진입 JS의 gzip 크기를 측정해 기록한다(목표 수치는 측정 뒤 문서에 적는다).

## 7. 검증과 기록

- 단계마다 `apps/web`에서 typecheck, test, lint, build를 돌리고, `apps/api`를 바꾼 단계는 `./gradlew test`도 돌린다.
- 단계마다 미리보기 브라우저에서 1200px와 400px 폭으로 바뀐 화면을 확인한다.
- 단계마다 `docs/ui-library-poc.md`의 번들 크기 표에 한 줄씩 추가한다.
- 실기기 확인(iOS Safari, Android Chrome, Windows NVDA)은 단계 3 뒤에 한 번에 한다. 확인 항목은 단계 3 계획에 적는다.

## 8. 범위 밖

- 시각 디자인 변경과 디자인 시스템 artifact 갱신(공용 부품의 상태 표현은 단계 3 뒤에 artifact에 한 번에 반영할지 따로 정한다)
- MonthPicker(RAC에 월 단위 선택이 없음)와 홈 등록 현황 달력(12칸 그리드로 충분)
- 대시보드 표 정렬 (2026-10-25 도넛 설계의 모달 거래 표도 정렬하지 않는다)
- 모바일 전용 제스처(당겨서 새로고침 등)와 오프라인 기능
