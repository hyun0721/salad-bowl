# Plan 11: 대시보드 대분류별 추이(꺾은선) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 그룹 대시보드에 대분류별 월 지출 꺾은선 카드를 더한다. 기간은 전월 비교, 3·6·12개월, 직접 지정(최대 12개월)에서 고른다. 처음에는 상위 5개 대분류를 켜고, 칩으로 켜고 끈다.

**Architecture:**
- API: `SummaryService`의 요약 선별(`summaryTransactions`, `majorLabel`)을 재사용하는 `trend(from, to)`와 `GET /groups/{id}/summary/trend`를 더한다.
- 웹: `common/echarts.ts`에 `LineChart`·`GridComponent`를 등록한다. 공용 `common/LineChart`(옵션 순수 함수 + `EChart` 래퍼)를 만든다.
- 대시보드: `CategoryTrend` 카드가 기간·칩·표로 보기를 묶는다.

**Tech Stack:** Spring Boot(Java 21)·JUnit MockMvc, React 19, ECharts 6.1.0(`echarts/core`), TanStack Query, Vitest + MSW, Playwright(브라우저 확인, 저장소 밖)

**출처:** [대분류별 추이 설계](../specs/2026-10-27-category-trend-design.md) (승인됨). 각 Task의 정확한 값은 설계의 해당 장을 따른다.

## Global Constraints

- 새 의존성 없음. `echarts`는 `common/echarts.ts`에서만 import한다. 등록에 더하는 모듈은 `LineChart`, `GridComponent` 두 개뿐이다.
- `react-aria-components`는 `apps/web/src/common/`, 테스트, `main.tsx`에서만 import한다.
- 차트 컨테이너는 `aria-hidden="true"`이고, 같은 정보를 표(표로 보기)로 제공한다. 칩은 `button`·`aria-pressed`이고 높이 44px 이상이다.
- 색은 토큰(`--chart-1`~`8`, `--surface-000`, `--ink`, `--ink-muted`, `--line`, `--font-sans`)을 `useChartTheme`으로 읽는다. 색 값을 코드에 직접 쓰지 않는다.
- 금액은 `common/format.ts`의 `formatWon`을 쓴다(`₩ 120,000`). 툴팁의 대분류 이름은 HTML 이스케이프한다(사용자 입력).
- 모바일 기준은 `(max-width: 820px)`(`NARROW`)다. 페이지에 가로 스크롤이 생기지 않아야 한다.
- 쿼리 키는 `['summary', groupId, 'trend', from, to]`다.
- 주석은 한국어로 "왜"만 짧게 쓴다. 문서는 한국어다.
- 검사:
  - 웹 Task: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`(lint 경고 0)
  - API Task: `apps/api`에서 `./gradlew test`
- 커밋:
  - Codex 구현은 컨트롤러가 검사를 다시 돌린 뒤 `Co-Authored-By: Codex (<모델>) <noreply@openai.com>`로 커밋한다.
  - 커밋 끝에 `Claude-Session: https://claude.ai/code/session_01PFyKnfubKKjUuhAtfZjgJ5`를 붙인다.
- 임시 미리보기(`mock.html`, `src/mock.tsx`)와 Playwright 스크립트는 커밋하지 않는다.

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 | 동시 진행 |
|---|---|---|---|
| 1 API `trend` | Claude sonnet (`apps/api`) | Codex `gpt-6-sol` / high | Task 2와 동시 |
| 2 `common/LineChart` + 등록 | Codex `gpt-6-astra` / medium (공용 부품) | Claude sonnet | Task 1과 동시 |
| 3 `CategoryTrend` 카드 | Codex `gpt-6-sol` / medium (화면) | Claude sonnet | Task 2 뒤 |
| 4 브라우저·번들·후속 문서 | 컨트롤러 | — | — |
| 최종 | — | Claude opus 한 번 | — |

---

### Task 1: API — 기간별 대분류 지출

**담당:** Claude sonnet

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java`, `SummaryController.java`, `SummaryDtos.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/SummaryApiTest.java`

**Interfaces (Produces):**
- `GET /groups/{groupId}/summary/trend?from=YYYY-MM&to=YYYY-MM` → `CategoryTrend { List<String> months; List<CategoryTrendSeries> categories }`
- `CategoryTrendSeries { String category; List<BigDecimal> expenses; BigDecimal total }`
- 응답 모양·정렬·검증은 설계 3장과 같다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (기존 `save` 헬퍼 재사용)
  - 3개월 데이터(가운데 달은 거래 없음)에서 아래를 확인한다.
    - `months` 3개
    - 각 대분류 `expenses[i]`가 그 달 `/summary`의 `byCategory` 값과 같다(환불 포함)
    - 빈 달은 0
  - 아래가 빠진다: 이체, 숨김, 외화, 공개 끈 멤버.
  - override 대분류와 "미분류"가 요약과 같은 키로 나온다.
  - 정렬은 `total` 내림차순, 같으면 이름순이다.
  - 400: `from > to`, 13개월(`2025-10`~`2026-10`), `from` 없음, `month=2026-13` 형식.
  - 404: 외부인.
- [ ] **Step 2: 실패 확인** — `cd apps/api && ./gradlew test --tests '*SummaryApiTest'`
- [ ] **Step 3: 구현한다.**
  - `summaryTransactions`를 기간용으로 일반화한다(월 하나 = 기간 1개월). `monthly()` 동작은 바꾸지 않는다.
  - `YearMonth.from(tx.occurredAt)`로 월별 버킷에 더한다(지출 타입만, 금액 부호 반전).
  - 검증 실패는 `new ApiException(ErrorCode.VALIDATION_FAILED, …)`이다.
- [ ] **Step 4: 통과 확인** — `./gradlew test` 전체
- [ ] **Step 5: 커밋** — `feat(api): add a monthly category trend to the summary`

---

### Task 2: `common/LineChart`와 ECharts 등록

**담당:** Codex `gpt-6-astra` / medium

**Files:**
- Modify: `apps/web/src/common/echarts.ts`(`LineChart`, `GridComponent` 추가)
- Create: `apps/web/src/common/LineChart.tsx`, `LineChart.test.tsx`

**Interfaces:**
- Consumes: `EChart`, `ChartOption`, `useChartTheme`, `ChartTheme`(Plan 10), `formatWon`
- Produces:
```ts
export type LineSeries = { id: string; label: string; values: number[] }
export function lineStyleFor(index: number): { slot: number; dash: 'solid' | 'dashed' | 'dotted' } // 0~7 solid, 8~15 dashed, 16~ dotted
export function monthLabels(months: string[]): string[] // "5월", 1월이거나 해를 넘는 기간의 첫 월은 "2026.1"
export function compactWon(value: number): string // 1만 이상 "30만"(소수점 없이 반올림), 미만 "9,500"
export function buildLineOption(series: LineSeries[], months: string[], opts: { theme: ChartTheme; compact: boolean }): ChartOption
type Props = { series: LineSeries[]; months: string[]; compact?: boolean; className?: string }
export default function LineChart(props: Props): JSX.Element // 높이 300, compact 240
```
- 옵션 규칙은 설계 6장 `buildLineOption` 항목이다(축, 툴팁 `trigger: 'axis'`, 값 큰 순서·HTML 이스케이프, `emphasis.focus: 'series'`, grid, 토큰 색).
- 색은 `theme.chart[lineStyleFor(i).slot - 1]`, 선 모양은 `lineStyle.type`이다.
- 툴팁 머리글은 "2026년 10월"이다.
- 컴포넌트는 `useChartTheme`, `useMemo`(series·months·compact·theme)로 옵션을 만든다.

- [ ] **Step 1: 실패하는 테스트**
  - `monthLabels(['2025-11','2025-12','2026-01'])` → `['2025.11','12월','2026.1']`
  - `monthLabels(['2026-05','2026-06'])` → `['5월','6월']`
  - `compactWon`: 300000 → "30만", 9500 → "9,500", 0 → "0"
  - `lineStyleFor`: 0 solid slot1, 8 dashed slot1, 16 dotted slot1, 23 dotted slot8
  - `buildLineOption`: 시리즈 수·이름·값, 9번째 `lineStyle.type === 'dashed'`, `tooltip.trigger === 'axis'`
  - 툴팁 formatter: params 3개를 값 큰 순서로 정렬하고, 이름 `<b>`를 `&lt;b&gt;`로 이스케이프한다.
  - 컴포넌트: Plan 10과 같은 가짜 `./echarts` 인스턴스로 확인한다. `setOption`이 불리고, 컨테이너가 `aria-hidden`이고, 같은 props로 rerender하면 `setOption`이 다시 불리지 않는다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/common/LineChart.test.tsx`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 웹 전체 검사
- [ ] **Step 5: 보고**(커밋은 컨트롤러): `feat(web): add a shared ECharts line chart`

---

### Task 3: `CategoryTrend` 카드

**담당:** Codex `gpt-6-sol` / medium (Task 2 뒤)

**Files:**
- Modify: `apps/web/src/dashboard/dashboardApi.ts`, `DashboardPage.tsx`, `DashboardPage.test.tsx`
- Create: `apps/web/src/dashboard/trendRange.ts`(+ `.test.ts`), `CategoryTrend.tsx`(+ `.test.tsx`, `.module.css`)
- Modify(필요하면): `apps/web/src/common/MonthPicker.tsx`(접근 이름 `label` prop)

**Interfaces:**
- Consumes:
  - Task 1의 API 응답 `{ months: string[]; categories: { category: string; expenses: number[]; total: number }[] }`
  - Task 2의 `LineChart`, `lineStyleFor`
  - 기존 `SegmentedControl`, `MonthPicker`, `useMediaQuery(NARROW)`, `formatWon`
- Produces:
```ts
// dashboardApi.ts
export type CategoryTrend = { months: string[]; categories: { category: string; expenses: number[]; total: number }[] }
trend: (groupId: number, from: string, to: string) => apiFetch<CategoryTrend>(`/groups/${groupId}/summary/trend?${new URLSearchParams({ from, to })}`)
// trendRange.ts
export type RangePreset = 'prev' | '3' | '6' | '12' | 'custom'
export function addMonths(month: string, n: number): string
export function presetRange(preset: Exclude<RangePreset, 'custom'>, month: string): { from: string; to: string }
export function rangeError(from: string, to: string): string | null // 역순 또는 12개월 초과면 설계 5장 문구
// CategoryTrend.tsx
type Props = { groupId: number; month: string }
```
- 동작은 설계 5~8장이다.
  - 기본 `6`이다.
  - 선택 상태는 `null`이면 상위 5개다.
  - 기간 합계 0 이하 대분류는 칩·선이 없다.
  - 하나도 켜지지 않으면 안내 문구를 보인다.
  - 표로 보기와 상태 문구가 있다.
- `DashboardPage`: `SummaryView`의 `.columns` 아래에 `<CategoryTrend key={groupId} groupId month />`를 둔다. 그룹이 바뀌면 선택이 초기화된다. 대시보드 월이 바뀌어도 칩 선택은 유지한다(key에 month를 넣지 않는다).
- 칩 CSS: `min-height: 44px`. 색 표지는 `lineStyleFor`의 슬롯 색과 선 모양(solid·dashed·dotted 테두리)이다.

- [ ] **Step 1: 실패하는 테스트**
  - `trendRange.test.ts`
    - `presetRange('6','2026-03')` → `{from:'2025-10',to:'2026-03'}`
    - `prev` → 2개월
    - `addMonths('2026-01',-1)` → `'2025-12'`
    - `rangeError`: 역순, 13개월이면 문구, 12개월이면 null
  - `CategoryTrend.test.tsx`(MSW)
    - 기본 요청의 `from`/`to`가 6개월이다.
    - 응답 대분류 7개 중 상위 5개 칩만 `aria-pressed="true"`다.
    - 칩을 누르면 토글된다.
    - "12개월"을 누르면 새 요청이 간다.
    - "직접 지정"에서 시작 > 끝이면 alert이 뜨고 요청하지 않는다.
    - "표로 보기"를 열면 월 행과 켜진 대분류 열이 `formatWon`으로 보인다.
    - 빈 결과 문구, 실패 + 다시 시도
    - 합계 0 이하 대분류는 칩이 없다.
  - `DashboardPage.test.tsx`: "대분류별 추이" 제목의 region이 보인다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/dashboard`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 웹 전체 검사(빌드 출력의 대시보드 청크 크기를 보고에 적는다)
- [ ] **Step 5: 보고**(커밋은 컨트롤러): `feat(web): show monthly category trends on the dashboard`

---

### Task 4: 브라우저 확인, 번들, 후속 문서 (컨트롤러)

- [ ] 임시 `mock.html`·`src/mock.tsx`로 대시보드를 띄운다. 가짜 API에 `summary/trend` 응답(대분류 12개, 빈 달 포함, 해 넘김 기간)을 넣는다.
- [ ] Playwright(시스템 Chrome)로 1200·375px, 라이트·다크를 본다.
  - 툴팁 호버, 칩 토글, 12개월·직접 지정 전환, 표로 보기
  - 기준: 가로 스크롤 0, 콘솔 경고 0
  - 스크린샷을 사용자에게 보낸다.
- [ ] `npm run build`: 홈 첫 진입 gzip이 main과 같은지 본다. 대시보드 청크 증가분을 `docs/ui-library-poc.md`에 한 줄 적는다.
- [ ] `docs/superpowers/plans/2026-10-27-plan-11-followups.md`: 바뀐 결정, 측정, 실기기 확인 목록, 넘긴 항목, 다음 과제(비교군을 도넛에 반영, 대분류별 고정 색)
- [ ] 커밋: `docs: record trend chart bundle size and plan 11 follow-ups`

### 최종
- [ ] Claude opus가 `origin/main...HEAD`를 한 번 리뷰한다.
- [ ] 전체 검사: 웹 4종, `./gradlew test`
- [ ] push, PR, Auto-fix
