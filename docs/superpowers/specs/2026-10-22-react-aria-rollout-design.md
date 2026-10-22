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
| 0 | PR #12 머지 (Select, 업로드, 라이선스 고지, ko-KR 문구만 남기기) | 이미 열린 PR |
| 1 | 공용 폼 부품 + 폼 입력 교체 + 카테고리 자동완성(API 포함) | 계획 1개, PR 1개 |
| 2 | 오버레이·알림 + 탭·토글 | 계획 1개, PR 1개 |
| 3 | 목록·모바일 패널 + 화면 단위 지연 로딩 | 계획 1개, PR 1개 |

단계마다 따로 계획 문서(`docs/superpowers/plans/`)를 쓰고 따로 PR을 낸다. 뒤 단계는 앞 단계의 공용 부품을 쓰므로 순서대로 진행한다.

## 3. 단계 1 — 폼 입력

### 3.1 공용 부품

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

### 3.2 카테고리 자동완성

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

### 3.3 적용 화면

- `transactions/ManualTransactionForm.tsx`: 일시, 타입, 대분류, 소분류, 내용, 금액, 결제수단, 메모
- `transactions/TransactionPanel.tsx`: 대분류, 소분류, 메모, 숨기기
- `transactions/TransactionsPage.tsx`: 멤버 필터, 검색
- `groups/CreateGroupForm.tsx`, `groups/GroupSettings.tsx`(이름, 공개 스위치)
- `auth/LoginPage.tsx`: 이메일, 비밀번호, 닉네임
- `groups/InviteSection.tsx`의 읽기 전용 링크 칸은 `TextField isReadOnly`로 바꾼다

## 4. 단계 2 — 오버레이·알림, 탭·토글

| 지금 | 바꾼 뒤 |
|---|---|
| `common/Modal.tsx`(포커스 트랩과 Esc 처리를 직접 구현) | 공용 `Dialog`(RAC `ModalOverlay` + `Modal` + `Dialog`). 홈의 업로드 모달이 쓴다. `closeDisabled`(업로드 중 닫기 막기)는 `isDismissable`·`isKeyboardDismissDisabled`로 유지한다 |
| 그룹 나가기, 멤버 내보내기, 거래 삭제의 제자리 2단계 확인(포커스 이동을 직접 처리) | 공용 `ConfirmDialog`: 제목, 설명, 위험 버튼, 취소 버튼. 실행 중에는 버튼을 비활성으로 두고, 실패하면 대화상자 안에 `ui.alert`로 오류를 보여준다. 성공하면 닫는다 |
| "저장했습니다", "이름을 바꿨습니다", "링크를 복사했습니다" 인라인 성공 문구 | 공용 `Toast`(RAC `ToastRegion` + 큐). 화면 하단 중앙에 띄우고 4초 뒤 사라진다. 스크린리더가 읽는다. `AppLayout`에 영역을 하나 둔다 |
| 오류 문구 | **인라인 그대로 둔다.** 사라지는 알림으로 오류를 놓치지 않게 하기 위해서다 |
| 로그인/회원가입 탭(`role="tab"`과 방향키 처리 직접 구현) | 공용 `Tabs` |
| 거래 화면의 내 거래/그룹 거래 버튼 | 공용 `SegmentedControl`(RAC `ToggleButtonGroup`, `selectionMode="single"`, `disallowEmptySelection`). 그룹이 없으면 "그룹 거래"를 비활성으로 둔다 |

- 모바일 폭에서 `Dialog`와 `ConfirmDialog`는 하단 시트 모양(위쪽 모서리만 둥글게, `70dvh` 상한, 안전 영역 여백)으로 띄운다. Select와 달리 컬렉션을 담지 않으므로 RAC `Modal`을 그대로 쓸 수 있다.
- `common/Modal.tsx`와 화면마다 있는 "확인 단계 포커스 이동" 코드는 지운다.

## 5. 단계 3 — 목록, 모바일 패널, 지연 로딩

### 5.1 거래 목록

- 지금 목록은 `div`·`button` 격자이고 머리글은 `aria-hidden`이라, 스크린리더에서 열 이름을 알 수 없다.
- **넓은 폭**: 공용 `DataTable`(RAC `Table`).
  - 열: 일시, (그룹 보기일 때) 멤버, 카테고리, 내용, 결제수단, 금액
  - 방향키로 행을 이동하고, Enter나 클릭으로 상세를 연다(`onRowAction`). 선택된 행은 `--brand-tint` 배경으로 표시한다.
  - 일시·금액 열은 정렬할 수 있다(`sortDescriptor`, 브라우저에서 정렬). 기본값은 지금처럼 서버가 준 순서다.
  - "수정됨", "숨김" 배지는 그대로 둔다.
- **모바일 폭**: 같은 데이터를 RAC `GridList` 카드로 보여준다. 첫 줄은 내용과 금액, 둘째 줄은 일시·카테고리·멤버다.
- 대시보드 멤버별 표와 카테고리 `<meter>`는 그대로 둔다. 이미 구조가 맞고 작다.

### 5.2 거래 상세·추가 패널

- 넓은 폭은 지금처럼 오른쪽 `aside` 패널이다.
- 모바일 폭에서는 단계 2의 `Dialog`를 전체 높이 하단 시트로 띄워 같은 내용을 보여준다. `ManualTransactionForm`의 "열릴 때 제목으로 포커스" 코드는 지운다(Dialog가 포커스를 맡는다).

### 5.3 화면 단위 지연 로딩

- `app/AppRoutes.tsx`에서 로그인, 초대, 대시보드, 거래, 업로드, 그룹 화면을 `React.lazy`로 나눈다. 홈은 첫 화면이라 그대로 둔다.
- 불러오는 동안 `<Suspense>` fallback으로 `ui.status` 스타일의 "불러오는 중" 문구를 보여준다.
- PWA precache는 그대로다. 나뉜 청크도 `globPatterns`에 잡혀 미리 캐시된다.
- 성공 기준: Vite의 500 kB 청크 경고가 사라진다. 홈 첫 진입 JS의 gzip 크기를 측정해 기록한다(목표 수치는 측정 뒤 문서에 적는다).

## 6. 검증과 기록

- 단계마다 `apps/web`에서 typecheck, test, lint, build를 돌리고, `apps/api`를 바꾼 단계는 `./gradlew test`도 돌린다.
- 단계마다 미리보기 브라우저에서 1200px와 400px 폭으로 바뀐 화면을 확인한다.
- 단계마다 `docs/ui-library-poc.md`의 번들 크기 표에 한 줄씩 추가한다.
- 실기기 확인(iOS Safari, Android Chrome, Windows NVDA)은 단계 3 뒤에 한 번에 한다. 확인 항목은 단계 3 계획에 적는다.

## 7. 범위 밖

- 시각 디자인 변경과 디자인 시스템 artifact 갱신(공용 부품의 상태 표현은 단계 3 뒤에 artifact에 한 번에 반영할지 따로 정한다)
- MonthPicker(RAC에 월 단위 선택이 없음)와 홈 등록 현황 달력(12칸 그리드로 충분)
- 대시보드 표 정렬
- 모바일 하단 탭 등 모바일 전용 내비게이션(백로그의 "모바일 우선 PWA")
