# Plan 09: 대시보드 대분류 지출 도넛차트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 그룹 대시보드의 "카테고리별 지출"을 직접 그린 SVG 도넛차트와 대분류·금액·비율 목록으로 바꾸고, 조각이나 목록 행을 누르면 그 대분류의 그 달 거래를 모달(좁은 화면은 시트)로 보여준다.

**Architecture:** API는 `SummaryService`의 "요약에 들어가는 거래" 선별을 한 메서드로 뽑아 요약과 새 엔드포인트 `GET /groups/{id}/summary/transactions`가 함께 쓴다. 웹은 의존성 없이 `common/DonutChart`(순수 SVG)를 만들고, 대시보드의 `CategoryBreakdown`이 도넛·목록·모달을 묶는다. 접근 가능한 컨트롤은 목록 행이고 도넛은 시각·포인터용이다(`aria-hidden`).

**Tech Stack:** React 19, react-aria-components 1.22.1, TanStack Query, Vitest + Testing Library + MSW, Spring Boot(Java 21) + JUnit(MockMvc)

**출처:** [대시보드 도넛 설계](../specs/2026-10-25-dashboard-category-donut-design.md) (승인됨). 이 문서의 값(팔레트, 접근 이름, 쿼리 키, 엔드포인트)은 설계가 정한 것이다.

## Global Constraints

- 새 npm·Gradle 의존성을 넣지 않는다. 차트 라이브러리는 쓰지 않는다.
- `react-aria-components`는 `apps/web/src/common/`, 테스트, `main.tsx`에서만 import한다. `DonutChart`는 RAC 없이 SVG만 쓴다. 모달은 `common/Dialog`의 `DialogFrame`을 쓴다.
- 모바일 폭 기준은 `(max-width: 820px)`, 터치 영역은 44px 이상이다. 테스트는 `test/mockViewport.ts`의 `mockViewport(true)`로 좁은 화면을 흉내 낸다.
- jsdom 한계: RAC `Sheet`는 닫힘을 끝내지 못한다. 시트 경로는 열림까지만 테스트한다.
- 기존 접근 이름을 지킨다: `region` "카테고리별 지출", "지출이 없습니다." 문구(기존 테스트가 쓴다).
- 금액 표기는 `common/format.ts`의 `formatWon`(`₩ 120,000`, 공백 있음)을 쓴다. 설계의 "식비 32% ₩120,000"은 형태 예시이고 접근 이름은 `식비 32% ₩ 120,000`이다.
- 시각 디자인은 `tokens.css` 기준이다. 차트 색 토큰 `--chart-1`~`--chart-8`만 새로 더한다. 브랜드색(`--brand`)은 차트에 쓰지 않는다.
- 주석은 한국어로, "왜"만 짧게 쓴다. 계획·리뷰 문서는 한국어다.
- 웹 Task 끝에 `apps/web`에서 `npm run typecheck && npm test && npm run lint`(lint 경고 0건). API Task는 `apps/api`에서 `./gradlew test`.
- 검사 명령은 각 앱 폴더에서, `git add`/`git commit`은 저장소 루트에서 실행한다. Codex 구현 Task는 컨트롤러가 테스트를 다시 돌린 뒤 `Co-Authored-By: Codex (<모델>) <noreply@openai.com>`로 커밋한다. 커밋 메시지 끝에 세션 줄(`Claude-Session: …`)을 붙인다.
- 임시 미리보기(`preview.html`, `src/preview.tsx`)는 커밋하지 않는다.

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 | 동시 진행 |
|---|---|---|---|
| 1 API: 필터 공용화, 미분류, 새 엔드포인트 | Claude sonnet (`apps/api`) | Codex `gpt-6-sol` / high | Task 2와 동시 |
| 2 `DonutChart` + 차트 색 토큰 | Codex `gpt-6-astra` / medium (공용 부품) | Claude sonnet | Task 1과 동시 |
| 3 대시보드 연결: API 클라이언트, `CategoryBreakdown`, 모달 | Codex `gpt-6-sol` / medium | Claude sonnet | Task 2 끝난 뒤. Task 1·2 리뷰와 겹침 |
| 4 브라우저 확인, 번들 기록, 후속 문서 | 컨트롤러 + Codex `gpt-6-luna` / low (문서) | — | — |
| 최종 브랜치 리뷰 | — | Claude opus 한 번 | — |

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/api/.../transaction/SummaryService.java`, `SummaryController.java` | 선별 공용화, "미분류", `categoryTransactions()`, 새 GET |
| `apps/api/src/test/.../transaction/SummaryApiTest.java` | 미분류, 새 엔드포인트 합계 일치·제외 규칙·권한 |
| `apps/web/src/styles/tokens.css` | `--chart-1`~`--chart-8` (세 곳) |
| `apps/web/src/common/DonutChart.tsx` + `.module.css` + `.test.tsx` | 순수 SVG 도넛, 호 계산, 무늬 |
| `apps/web/src/dashboard/dashboardApi.ts` | `categoryTransactions()` |
| `apps/web/src/dashboard/CategoryBreakdown.tsx` + `.module.css` + `.test.tsx` | 도넛 + 목록 + 모달 열기 |
| `apps/web/src/dashboard/CategoryTransactionsDialog.tsx` + `.test.tsx` | 모달/시트와 거래 표·카드 |
| `apps/web/src/dashboard/DashboardPage.tsx` + `.module.css` + `.test.tsx` | `<meter>` 목록을 `CategoryBreakdown`으로 교체 |
| `docs/ui-library-poc.md`, `docs/superpowers/plans/2026-10-25-plan-09-followups.md`(새로) | 번들 기록, 후속 과제 |

---

### Task 1: API — 요약 거래 선별 공용화, 미분류, 새 엔드포인트

**담당:** Claude sonnet (`apps/api`)

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryController.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/SummaryApiTest.java`

**Interfaces:**
- Produces: `GET /groups/{groupId}/summary/transactions?month=YYYY-MM&category=<대분류>` → `TransactionView[]`. 모양은 `GET /groups/{id}/transactions`와 같고(`TransactionViews.toViews`, `editable` 계산 재사용), 정렬은 `occurredAt desc, id desc`.
- Produces: 요약의 `byCategory[].category`에서 대분류가 비었거나 공백뿐이면 `"미분류"`.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`SummaryApiTest`, 기존 `save` 헬퍼 재사용)
  - 새 엔드포인트가 `식비` 거래만 돌려준다: 같은 달 EXPENSE `식비` 두 건과 환불(양수 금액 EXPENSE) 한 건, 다른 대분류 한 건, 다른 달 한 건, 이체, 숨긴 거래, 공개를 끈 멤버의 거래, 외화 거래를 넣는다.
  - 응답 `amount` 합계를 부호 반전한 값이 `/summary`의 같은 `byCategory[].expense`와 같다.
  - override 대분류(`setCategoryMajorOverride`)가 반영된다: override 후 이름으로 요청하면 그 거래가 나오고 원래 이름으로는 나오지 않는다.
  - 대분류가 빈 거래(`""`)와 공백만 있는 거래는 요약에서 `"미분류"` 하나로 합쳐지고, `category=미분류`로 요청하면 그 거래들이 나온다.
  - 그룹 멤버가 아니면 거절한다(`monthly()`와 같은 권한 오류 상태 코드를 쓴다 — 기존 테스트에서 확인).
  - 한글·`/`가 든 대분류(`교통/차량`)를 쿼리 파라미터로 요청할 수 있다.
  - 존재하지 않는 대분류는 빈 배열이다.
- [ ] **Step 2: 실패를 확인한다** — `cd apps/api && ./gradlew test --tests '*SummaryApiTest'`
- [ ] **Step 3: 구현한다**
  - `SummaryService`에 private 메서드를 뽑는다: 그룹·월 → `owners`와 선별된 거래(공개한 멤버, `findVisibleBetween`, KRW만, 이체 제외). `monthly()`가 이를 쓰도록 바꾼다(동작은 그대로).
  - `static String majorLabel(LedgerTransaction tx)`: `displayCategory().major()`가 `null`/공백이면 `"미분류"`, 아니면 그대로(앞뒤 공백 제거는 하지 않는다 — 요약이 원래 하지 않았다).
  - `monthly()`의 대분류 집계가 `majorLabel`을 쓴다.
  - `categoryTransactions(groupId, userId, month, category)`: 선별된 거래 중 `type == EXPENSE`이고 `majorLabel(tx).equals(category)`인 것을 `views.toViews(...)`로 변환한다. `TransactionService.groupTransactions`와 같은 `editable` 계산을 쓴다(`access.canEditOwnedBy`). `TransactionViews` 주입이 필요하면 생성자에 더한다.
  - `SummaryController`에 `@GetMapping("/groups/{groupId}/summary/transactions")`를 더한다(`@RequestParam YearMonth month`, `@RequestParam String category`).
- [ ] **Step 4: 통과를 확인한다** — `./gradlew test` 전체(다른 테스트가 깨지지 않는지)
- [ ] **Step 5: 보고** — 바꾼 파일, 테스트 출력. 커밋은 컨트롤러가 한다(Claude 구현자는 직접 커밋해도 된다: `feat(api): list category transactions for the monthly summary`).

---

### Task 2: `DonutChart`와 차트 색 토큰

**담당:** Codex `gpt-6-astra` / medium

**Files:**
- Modify: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/common/DonutChart.tsx`, `DonutChart.module.css`, `DonutChart.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type DonutSlice = { id: string; label: string; value: number } // value > 0만 넘어온다
  type Props = {
    slices: DonutSlice[]
    centerLabel: string          // 예: "총지출"
    centerValue: string          // 예: "₩ 250,000"
    activeId: string | null      // 강조할 조각(목록 행의 호버·초점과 연결)
    onActiveChange: (id: string | null) => void
    onSelect: (id: string) => void
    className?: string
  }
  export default function DonutChart(props: Props): JSX.Element
  export function sliceStyle(index: number): { slot: number; pattern: 'solid' | 'diag45' | 'diag135' } // 순수 함수
  ```
- Produces: CSS 변수 `--chart-1`~`--chart-8`.

**구현 규칙 (설계 6.2~6.4):**
- `svg`는 `aria-hidden="true"`. 조각은 초점을 받지 않는다(`tabIndex` 없음). 조각 `path`를 누르면 `onSelect(id)`, 호버하면 `onActiveChange(id)`/`null`. 가운데에 `centerLabel`/`centerValue`를 `text`로 그린다.
- 호 경로는 직접 계산한다(12시 방향에서 시계 방향, 순서는 `slices` 그대로). 조각이 하나면 두 반원으로 그린다. 조각 사이는 카드 배경색(`var(--surface-000)`) 2px 선으로 띄운다.
- 색: `index % 8`번째 슬롯. 8~15번째는 같은 색 위에 45° 빗금(`<pattern>`), 16~23번째는 135° 빗금, 24번째 이후는 마지막 스타일을 되풀이한다. 빗금은 같은 색의 어두운 선이 아니라 카드 배경색 선으로 긋는다(어느 모드에서도 보인다). 패턴 `id`는 `useId`로 만들어 같은 페이지의 다른 차트와 겹치지 않게 한다.
- 강조 조각(`activeId`)은 `--ink` 2px 윤곽선. 애니메이션은 쓰지 않는다.
- 토큰 값(`tokens.css`의 세 곳 — `:root`, `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, `:root[data-theme="dark"]` — 에 같은 방식으로 넣는다):

  | 토큰 | 라이트 | 다크 |
  |---|---|---|
  | `--chart-1` | `#2a78d6` | `#3987e5` |
  | `--chart-2` | `#eb6834` | `#d95926` |
  | `--chart-3` | `#1baf7a` | `#199e70` |
  | `--chart-4` | `#eda100` | `#c98500` |
  | `--chart-5` | `#e87ba4` | `#d55181` |
  | `--chart-6` | `#008300` | `#008300` |
  | `--chart-7` | `#6250d6` | `#9085e9` |
  | `--chart-8` | `#e34948` | `#e66767` |

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`DonutChart.test.tsx`)
  - 조각 수만큼 `path`가 그려지고, 한 조각이면 `path`가 하나(원형)다.
  - `svg`에 `aria-hidden="true"`가 있고 조각이 초점을 받지 않는다(`tabindex` 없음).
  - 조각 클릭 → `onSelect`가 그 `id`로 호출된다. 호버 → `onActiveChange(id)`, 벗어남 → `onActiveChange(null)`.
  - 가운데 문구가 보인다.
  - `sliceStyle`: 0→slot 1/solid, 7→slot 8/solid, 8→slot 1/diag45, 15→slot 8/diag45, 16→slot 1/diag135, 30→마지막 스타일(diag135, slot `30 % 8 + 1`).
  - `activeId`인 조각에 강조 클래스가 붙는다.
- [ ] **Step 2: 실패를 확인한다** — `cd apps/web && npx vitest run src/common/DonutChart.test.tsx`
- [ ] **Step 3: 구현한다** (위 규칙)
- [ ] **Step 4: 색을 검증한다** — 새 토큰 값으로 두 모드 모두 돌린다. 하드 게이트가 모두 PASS여야 하고, 라이트의 대비 WARN만 허용한다(목록으로 보완).
  ```bash
  V=/tmp/claude-0/bundled-skills/2.1.310/d6979944636db50ccd7b87c5ebc75c15/dataviz/scripts/validate_palette.js
  node $V "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4,#008300,#6250d6,#e34948" --mode light --surface "#ffffff"
  node $V "#3987e5,#d95926,#199e70,#c98500,#d55181,#008300,#9085e9,#e66767" --mode dark --surface "#1e221f"
  ```
  (경로가 없으면 이 값들은 설계 문서 6.3에서 이미 같은 명령으로 검증된 것이므로, 토큰 값이 위 표와 문자 그대로 같은지 대조한다.)
- [ ] **Step 5: 통과를 확인한다** — `npm run typecheck && npm test && npm run lint && npm run build`
- [ ] **Step 6: 보고** — 바꾼 파일, RED/GREEN 출력. 커밋은 컨트롤러가 한다(`feat(web): add DonutChart and chart color tokens`).

---

### Task 3: 대시보드 연결 — API 클라이언트, `CategoryBreakdown`, 모달

**담당:** Codex `gpt-6-sol` / medium (Task 2가 끝난 뒤 시작)

**Files:**
- Modify: `apps/web/src/dashboard/dashboardApi.ts`, `DashboardPage.tsx`, `DashboardPage.module.css`, `DashboardPage.test.tsx`
- Create: `apps/web/src/dashboard/CategoryBreakdown.tsx`, `CategoryBreakdown.module.css`, `CategoryBreakdown.test.tsx`
- Create: `apps/web/src/dashboard/CategoryTransactionsDialog.tsx`, `CategoryTransactionsDialog.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `GET /groups/{id}/summary/transactions`, Task 2의 `DonutChart`.
- Produces:
  ```ts
  // dashboardApi.ts
  categoryTransactions: (groupId: number, month: string, category: string) =>
    apiFetch<TransactionView[]>(`/groups/${groupId}/summary/transactions?${new URLSearchParams({ month, category })}`)
  // CategoryBreakdown.tsx
  type Props = { groupId: number; month: string; summary: MonthlySummary }
  // CategoryTransactionsDialog.tsx
  type Props = { groupId: number; month: string; category: string | null; onClose: () => void }
  ```

**동작 (설계 6.1·6.2·6.4·6.5):**
- `CategoryBreakdown`: `<section aria-labelledby="category-title" className={ui.card}>`와 제목 "카테고리별 지출"(기존 그대로).
  - `summary.byCategory`에서 `expense > 0`만 남긴다. 하나도 없으면 "지출이 없습니다."만 보인다.
  - 비율 = `expense / 남긴 항목 합계`, `Math.round(비율×100)`. 0%로 반올림되면 "1% 미만".
  - 도넛 가운데는 `centerLabel="총지출"`, `centerValue=formatWon(summary.expense)`.
  - 목록 `ul`: 행마다 `button`(44px 이상). 접근 이름 `` `${category} ${pct} ${formatWon(expense)}` `` (예: `식비 32% ₩ 120,000`). 보이는 글자는 이름·금액·비율이고 색 표지(작은 사각형)는 도넛과 같은 색·무늬다(`aria-hidden`).
  - 행 호버·초점 → `activeId` 갱신(도넛 강조), 도넛 조각 호버 → 같은 `activeId`.
  - 행 클릭이나 조각 클릭 → 선택 대분류 상태 설정 → `CategoryTransactionsDialog` 열림.
  - 선택 상태는 `month`나 `groupId`가 바뀌면 지운다(키로 리셋).
- `CategoryTransactionsDialog`: `category === null`이면 닫힘. `DialogFrame`(`isOpen`, `title=category`, 닫기 버튼 `headerAction`, `closeOnOutsideClick`). `useQuery(['summary-transactions', groupId, month, category])`, `enabled: category !== null`.
  - 본문 첫 줄 `N건 · 합계 ₩ X` (합계 = 금액 합의 부호 반전, 환불 포함).
  - 넓은 화면 `DataTable` 열: 일시, 멤버, 소분류, 내용(`isRowHeader`), 결제수단, 금액(`formatSignedWon`, `align: 'end'`). 정렬 없음. `onRowAction`은 빈 함수.
  - 좁은 화면 `CardList`(첫 줄 내용·금액, 둘째 줄 일시·소분류·멤버). `useMediaQuery(NARROW)`로 고른다(`TransactionList`와 같은 방식).
  - 불러오는 중 "불러오는 중입니다.", 실패 `role="alert"` "거래를 불러오지 못했습니다." + "다시 시도", 빈 목록 "거래가 없습니다."
- `DashboardPage`: `<ul className={styles.bars}>` 블록을 `<CategoryBreakdown groupId={selectedGroupId} month={month} summary={summary.data} />`로 바꾼다. `SummaryView`가 `groupId`/`month`를 받게 한다. 쓰지 않게 된 `.bars`, `.bar`, `.barLabel`, `.meter` CSS를 지운다. 레이아웃 CSS는 `CategoryBreakdown.module.css`로 옮긴다(도넛 옆에 목록, 820px 이하는 아래).
- 월을 바꾸면 모달이 닫힌다(선택 상태 리셋으로 처리).

- [ ] **Step 1: 실패하는 테스트를 쓴다**
  - `CategoryBreakdown.test.tsx`: 목록 행이 `식비 80% ₩ 200,000` 같은 접근 이름을 갖는다. 지출 0 이하 대분류는 목록에 없다. 1% 미만 표기. 하나도 없으면 "지출이 없습니다.". 도넛 `svg`가 `aria-hidden`이다. 행 클릭 시 해당 대분류 제목의 다이얼로그가 열리고 MSW가 `category`/`month` 쿼리를 받는다. 행 호버 시 해당 조각이 강조된다.
  - `CategoryTransactionsDialog.test.tsx`: 넓은 화면에서 표(`grid`)와 합계 줄 `N건 · 합계 ₩ X`. 환불이 섞인 응답의 합계가 맞다(예: -10000, -20000, +3000 → 27,000). 좁은 화면(`mockViewport(true)`)은 카드 목록이 열림까지 확인된다. 실패 → 다시 시도. 빈 목록. 닫기 버튼이 `onClose`를 부른다.
  - `DashboardPage.test.tsx`: 기존 "카테고리별 지출" region 안의 `식비`와 `₩ 200,000` 단언은 새 목록에서도 통과해야 한다(필요하면 행 이름 쿼리로 바꾼다). `meter` 단언이 있으면 지운다.
- [ ] **Step 2: 실패를 확인한다** — `npx vitest run src/dashboard`
- [ ] **Step 3: 구현한다**
- [ ] **Step 4: 통과를 확인한다** — `npm run typecheck && npm test && npm run lint && npm run build`. 빌드 출력에서 홈 첫 진입 청크 크기가 변하지 않았는지 본다.
- [ ] **Step 5: 보고** — 바꾼 파일, RED/GREEN 출력, 빌드 청크 크기. 커밋은 컨트롤러가 한다(`feat(web): show category spending as a donut with a transactions dialog`).

---

### Task 4: 브라우저 확인, 번들 기록, 후속 문서

**담당:** 컨트롤러(브라우저 확인), Codex `gpt-6-luna` / low(문서 기계 작업)

- [ ] **Step 1: 미리보기** — 커밋하지 않는 `apps/web/preview.html`·`src/preview.tsx`에서 `fetch`를 가짜로 바꿔 `DashboardPage`를 띄운다. 대분류 3개, 12개(무늬 확인), 1개, 0개(지출 없음), 환불 우세 1개 포함 데이터를 바꿔 본다.
  - 1200px: 도넛과 목록이 나란히, 행 클릭 → 가운데 모달에 표. 라이트·다크 모두.
  - 400px: 도넛 아래 목록, 행 클릭 → 시트. 브라우저 패널이 숨겨져 시트가 닫히지 않으면 사용자에게 패널을 띄워 달라고 한다.
  - Tab으로 행을 옮겨 Enter로 열고, 닫으면 행으로 포커스가 돌아오는지.
- [ ] **Step 2: 번들 기록** — `apps/web`에서 `npm run build`. 홈 첫 진입 JS(엔트리 + `index.html` modulepreload)의 gzip 합계가 182.00 kB 그대로인지, 대시보드 청크 증가분이 얼마인지를 `docs/ui-library-poc.md` 표에 한 줄 더한다.
- [ ] **Step 3: 후속 문서** — `docs/superpowers/plans/2026-10-25-plan-09-followups.md`를 새로 쓴다: 실행 중 바뀐 결정, 실기기 확인 목록(스크린리더로 목록 행 이름 읽기, iOS 시트, 라이트·다크 대비 눈으로 확인), 리뷰에서 넘긴 항목, 범위 밖이었던 것(툴팁, 대분류별 고정 색, 거래 정렬·상세).
- [ ] **Step 4: 커밋** — `docs: record donut chart bundle size and plan 09 follow-ups`

---

### 최종

- [ ] Claude opus가 `main...HEAD` 전체를 한 번 리뷰한다(`subagent-driven-development` 최종 리뷰어).
- [ ] 전체 검사: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`, `apps/api`에서 `./gradlew test`.
- [ ] push, PR(PR 템플릿이 있으면 구조를 따른다), PR 활동 구독(Auto-fix).
