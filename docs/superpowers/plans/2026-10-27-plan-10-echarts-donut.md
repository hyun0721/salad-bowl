# Plan 10: 대시보드 도넛을 ECharts로 교체 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `common/DonutChart`의 직접 SVG 구현을 ECharts로 바꾼다. 바깥 라벨 겹침·지시선 교차·좁은 폭 잘림을 없애고, 앞으로 넣을 꺾은선이 같은 래퍼를 쓰게 한다.

**Architecture:** 파일 세 개로 나눈다.
- `common/echarts.ts`: 필요한 ECharts 모듈만 등록한다.
- `common/chartTheme.ts`: CSS 토큰 색을 읽는다.
- `common/EChart.tsx`: 공용 래퍼. 생성·크기·테마·정리를 맡는다.

`DonutChart`는 옵션을 만드는 순수 함수 `buildDonutOption`과, 그 옵션을 `EChart`에 넘기는 컴포넌트로 바뀐다. props는 지금과 같아서 `CategoryBreakdown`은 거의 그대로다.

**Tech Stack:** React 19, ECharts 6.1.0(`echarts/core`, SVG 렌더러), Vitest + Testing Library, Playwright(브라우저 확인, 저장소 밖)

**출처:** [ECharts 도넛 설계](../specs/2026-10-27-echarts-donut-design.md) (승인됨). 수치(반지름, 글자 크기, 버전)는 설계를 따른다.

## Global Constraints

- **의존성**
  - 새 의존성은 `echarts@6.1.0` 하나다(정확한 버전, `^` 없음). `echarts-for-react` 등 다른 차트 패키지는 넣지 않는다.
  - `echarts`는 `common/echarts.ts`에서만 import한다. 다른 파일은 `common/echarts.ts`를 쓴다.
  - 등록할 모듈은 `PieChart`, `TooltipComponent`, `GraphicComponent`, `LabelLayout`, `SVGRenderer` 다섯 개뿐이다.
- **React Aria 규칙**: `react-aria-components`는 `apps/web/src/common/`, 테스트, `main.tsx`에서만 import한다. 차트 파일은 RAC를 쓰지 않는다.
- **접근성**
  - 차트 컨테이너는 `aria-hidden="true"`다.
  - 목록 행 `button`과 접근 이름(`식비 32% ₩ 120,000`)은 그대로 둔다. ECharts `aria` 모듈은 쓰지 않는다.
- **색**
  - 색은 `tokens.css` 토큰을 `getComputedStyle`로 읽어 쓴다: `--chart-1`~`--chart-8`, `--surface-000`, `--ink`, `--ink-muted`, `--line`, `--font-sans`.
  - 색 값을 코드에 직접 쓰지 않는다.
- **모양**
  - 라벨은 두 줄이다: 이름(넓은 화면 13px, 좁은 화면 12px)과 비율(11px, `--ink-muted`). 이름이 넘치면 `…`로 줄이고, 비율은 줄이지 않는다.
  - 9~16번째 조각은 45° 빗금, 17번째부터는 135° 빗금이다. `sliceStyle` 규칙 그대로다.
- **모바일**: 기준은 `(max-width: 820px)`(`common/useMediaQuery`의 `NARROW`)이고, 터치 영역은 44px 이상이다.
- **동작 줄이기**: `prefers-reduced-motion: reduce`이면 ECharts 애니메이션을 끈다.
- **주석·문서**: 주석은 한국어로 "왜"만 짧게 쓴다. 계획·리뷰 문서는 한국어다.
- **검사**
  - 웹 Task 끝에 `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`를 돌린다. lint 경고는 0건이어야 한다.
  - 검사 명령은 앱 폴더에서, `git add`/`git commit`은 저장소 루트에서 실행한다.
- **커밋**
  - Codex 구현 Task는 컨트롤러가 테스트를 다시 돌린 뒤 `Co-Authored-By: Codex (<모델>) <noreply@openai.com>`로 커밋한다.
  - 커밋 메시지 끝에 `Claude-Session: https://claude.ai/code/session_01PFyKnfubKKjUuhAtfZjgJ5`를 붙인다.
- **임시 파일**: 미리보기·Playwright 스크립트(`mock.html`, `src/mock.tsx` 등)는 커밋하지 않는다.

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 |
|---|---|---|
| 0 의존성 설치 | 컨트롤러(Codex 샌드박스는 npm 설치 불가) | — |
| 1 `echarts.ts`·`chartTheme.ts`·`EChart.tsx` | Codex `gpt-6-astra` / medium (공용 부품) | Claude sonnet |
| 2 `DonutChart` 교체 | Codex `gpt-6-astra` / medium (공용 부품) | Claude sonnet |
| 3 브라우저 확인, 번들 기록, 후속 문서 | 컨트롤러(Playwright) + Codex `gpt-6-luna` / low(문서) | — |
| 최종 | — | Claude opus 한 번 |

Task 1 → 2는 순서대로 한다(2가 1의 래퍼를 쓴다).

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/web/package.json`, `package-lock.json` | `echarts@6.1.0` |
| `apps/web/src/common/echarts.ts` | 모듈 등록, `echarts` 다시 내보내기 |
| `apps/web/src/common/chartTheme.ts` (+ `.test.ts`) | `readChartTheme`, `useChartTheme` |
| `apps/web/src/common/EChart.tsx` (+ `.test.tsx`, `.module.css`) | 공용 래퍼 |
| `apps/web/src/common/DonutChart.tsx` (+ `.test.tsx`, `.module.css`) | `buildDonutOption`, `donutHeight`, `sliceStyle`, 컴포넌트 |
| `apps/web/src/dashboard/CategoryBreakdown.tsx`, `.module.css` | 높이·레이아웃 조정(props 그대로) |
| `docs/ui-library-poc.md`, `docs/superpowers/plans/2026-10-27-plan-10-followups.md` | 번들 기록, 후속 과제 |

---

### Task 0: 의존성 설치 (컨트롤러)

- [ ] `apps/web`에서 `npm install --save-exact echarts@6.1.0`
- [ ] `package.json`에 `"echarts": "6.1.0"`이 들어갔는지 확인한다.
- [ ] `npm run build`가 통과하는지 확인한다(아직 import가 없으니 번들은 그대로).
- [ ] 커밋: `chore(web): add echarts 6.1.0`

---

### Task 1: ECharts 공용 래퍼

**담당:** Codex `gpt-6-astra` / medium

**Files:**
- Create: `apps/web/src/common/echarts.ts`
- Create: `apps/web/src/common/chartTheme.ts`, `chartTheme.test.ts`
- Create: `apps/web/src/common/EChart.tsx`, `EChart.module.css`, `EChart.test.tsx`

**Interfaces (Produces):**
```ts
// echarts.ts
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, GraphicComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'
echarts.use([PieChart, TooltipComponent, GraphicComponent, LabelLayout, SVGRenderer])
export { echarts }
export type { EChartsCoreOption as ChartOption, ECharts as ChartInstance } from 'echarts/core'

// chartTheme.ts
export type ChartTheme = { chart: string[] /* 8개 */; surface: string; ink: string; inkMuted: string; line: string; font: string }
export function readChartTheme(root?: HTMLElement): ChartTheme
export function useChartTheme(): ChartTheme  // prefers-color-scheme 변경, <html data-theme> 변경 때 다시 읽는다

// EChart.tsx
type Handler = (params: { name?: string; dataIndex?: number }) => void
type Props = { option: ChartOption; onEvents?: Record<string, Handler>; height: number; className?: string }
export const EChart: React.ForwardRefExoticComponent<Props & React.RefAttributes<ChartInstance | null>>
```

**동작 규칙:**
- 마운트 때 `echarts.init(div, null, { renderer: 'svg' })`를 부른다. 언마운트 때 `dispose()`를 부른다.
- `option`이 바뀌면 `setOption(option, { notMerge: true })`를 부른다.
- `prefers-reduced-motion: reduce`이면 `{ ...option, animation: false }`로 넘긴다.
- `onEvents`는 `chart.on(name, handler)`로 연결한다. props가 바뀌면 이전 핸들러를 `off`하고 다시 연결한다.
- `ResizeObserver`로 컨테이너 크기가 바뀌면 `resize()`를 부른다. jsdom처럼 `ResizeObserver`가 없으면 건너뛴다.
- 컨테이너는 `<div aria-hidden="true" style={{ height }}>`이고 폭은 100%다.
- `readChartTheme`은 `getComputedStyle(root ?? document.documentElement).getPropertyValue('--chart-1')` 등을 `trim()`해서 돌려준다.
- `useChartTheme`은 `matchMedia('(prefers-color-scheme: dark)')`의 `change`와 `MutationObserver`(`document.documentElement`의 `data-theme` 속성)에 반응해 다시 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**
  - `chartTheme.test.ts`
    - `document.documentElement.style.setProperty('--chart-1', '#123456')` 뒤 `readChartTheme().chart[0] === '#123456'`
    - `useChartTheme`을 `renderHook`으로 띄운다. `--chart-1`을 바꾸고 `document.documentElement.setAttribute('data-theme', 'dark')` 하면 새 값을 돌려준다(`waitFor`).
  - `EChart.test.tsx`: `vi.mock('./echarts', …)`로 가짜 `init`을 둔다. 가짜 인스턴스는 `setOption`·`on`·`off`·`resize`·`dispose`가 `vi.fn()`이다.
    - 렌더 → `init`이 `{ renderer: 'svg' }`로 불린다.
    - `setOption`이 옵션과 `{ notMerge: true }`로 불린다.
    - `rerender`로 옵션을 바꾸면 `setOption`이 다시 불린다.
    - `unmount` → `dispose`
    - `onEvents={{ click }}` → `on('click', …)`이 불리고, 가짜 핸들러를 실행하면 `click`이 불린다.
    - `matchMedia`가 `(prefers-reduced-motion: reduce)`에 `matches: true`를 돌려주게 하면, `setOption` 첫 인자에 `animation: false`가 들어간다.
    - 컨테이너에 `aria-hidden="true"`가 있고, 높이 style이 `height` prop 값이다.
- [ ] **Step 2: 실패를 확인한다** — `cd apps/web && npx vitest run src/common/chartTheme.test.ts src/common/EChart.test.tsx`
- [ ] **Step 3: 구현한다**(위 규칙)
- [ ] **Step 4: 통과를 확인한다** — `npm run typecheck && npm test && npm run lint && npm run build`
- [ ] **Step 5: 보고** — 커밋은 컨트롤러가 한다(`feat(web): add a shared ECharts wrapper`).

---

### Task 2: `DonutChart`를 ECharts로 교체

**담당:** Codex `gpt-6-astra` / medium

**Files:**
- Modify (사실상 다시 쓰기): `apps/web/src/common/DonutChart.tsx`, `DonutChart.module.css`, `DonutChart.test.tsx`
- Modify: `apps/web/src/dashboard/CategoryBreakdown.tsx`(필요하면), `CategoryBreakdown.module.css`

**Interfaces:**
- Consumes: Task 1의 `EChart`, `ChartOption`, `ChartInstance`, `useChartTheme`, `ChartTheme`
- Produces (공개 API는 지금과 같다):
```ts
export type DonutSlice = { id: string; label: string; value: number; detail?: string }
export function sliceStyle(index: number): { slot: number; pattern: 'solid' | 'diag45' | 'diag135' } // 지금 규칙 그대로
export function donutHeight(count: number, compact: boolean): number
export function buildDonutOption(slices: DonutSlice[], opts: { centerLabel: string; centerValue: string; compact: boolean; theme: ChartTheme }): ChartOption
type Props = { slices: DonutSlice[]; centerLabel: string; centerValue: string; activeId: string | null;
  onActiveChange: (id: string | null) => void; onSelect: (id: string) => void; compact?: boolean; className?: string }
export default function DonutChart(props: Props): JSX.Element
```

**옵션 규칙(설계 4장):**
- `series[0]`
  - 기본: `type: 'pie'`, `radius`(넓은 화면 `['34%','52%']`, 좁은 화면 `['30%','46%']`), `center: ['50%','50%']`, `avoidLabelOverlap: true`
  - `data`: `slices.map((s, i) => ({ name: s.id, value: s.value, label: { formatter: '{name|<label>}\n{pct|<detail>}' } }))`
  - `label`: `alignTo: 'labelLine'`, `bleedMargin: 4`
  - `label.rich.name`: `fontSize` 13·12(compact), `color: theme.ink`, `width` 84·56, `overflow: 'truncate'`
  - `label.rich.pct`: `fontSize: 11`, `color: theme.inkMuted`
  - `labelLine`: `length: 8`, `length2: 6`, `maxSurfaceAngle: 80`, `lineStyle.color: theme.inkMuted`
  - `itemStyle`: `borderColor: theme.surface`, `borderWidth: 2`
  - `emphasis`: `scale: true`, `scaleSize: 6`, `focus: 'self'`, 라벨 이름 굵게
- 각 데이터의 `itemStyle.color`는 `theme.chart[sliceStyle(i).slot - 1]`이다. `pattern !== 'solid'`이면 `itemStyle.decal`을 둔다.
  - `symbol: 'rect'`, `dashArrayX: [1, 0]`, `dashArrayY: [2, 4]`
  - `rotation`: `diag45`은 `Math.PI / 4`, `diag135`는 `-Math.PI / 4`
  - `color: theme.surface`
- 이름 표시에 쓰는 글자는 `label`이다. `label`의 `{`·`}`·`|`는 rich 문법과 충돌하지 않게 이스케이프하거나 제거한다. 테스트로 확인한다.
- `tooltip`: `trigger: 'item'`. `formatter`는 "이름<br/>₩ 금액 · detail"이다. 금액은 `formatWon`을 쓰고, 이름은 HTML 이스케이프한다.
- `graphic`: 가운데에 텍스트 두 개를 둔다.
  - `centerLabel`: `--ink-muted`, 13px(compact 10px)
  - `centerValue`: `--ink`, 굵게, 18px(compact 12px)
  - `left: 'center'`, `top: 'middle'`, 위아래로 약간 띄운다.
- `donutHeight(count, compact)`: 기본값은 넓은 화면 280, 좁은 화면 240이다.
  - `count > 6`이면 한쪽에 라벨이 몰려도 두 줄 라벨(약 30px)이 겹치지 않게 늘린다: `Math.min(base + (count - 6) * 22, 460)`.
  - 계수는 Task 3 브라우저 확인에서 조정할 수 있다.

**컴포넌트 규칙:**
- `theme = useChartTheme()`
- `option = useMemo(() => buildDonutOption(...), [slices, centerLabel, centerValue, compact, theme])`
- `<EChart ref={chartRef} option={option} height={donutHeight(slices.length, compact)} onEvents={{ click, mouseover, mouseout }} />`
  - `click` → `onSelect(params.name)`
  - `mouseover` → `onActiveChange(params.name)`
  - `mouseout` → `onActiveChange(null)`
- `activeId`가 바뀌면 `useEffect`에서 처리한다.
  - 이전 값이 있으면 `chartRef.current?.dispatchAction({ type: 'downplay', seriesIndex: 0, name: prev })`
  - 새 값이 있으면 `{ type: 'highlight', seriesIndex: 0, name: activeId }`
- Plan 09의 직접 배치 코드를 지운다: `GEOMETRY`, `layoutLabels`, `textWidth`, 호 계산, `<pattern>`, 관련 CSS.

**CategoryBreakdown:** props는 그대로다. 차트가 카드 폭을 꽉 채우도록 `.chart`를 정리한다. `max-content` 대신 넓은 화면 두 열은 `minmax(320px, 440px) minmax(0, 1fr)`로 둔다. container query 기준(760px)은 유지한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`DonutChart.test.tsx`, 기존 Plan 09 배치 테스트는 지운다)
  - `buildDonutOption`
    - 조각 3개 → `series[0].data` 길이 3, `name`이 id, 값이 같다.
    - 라벨 formatter에 `label`과 `detail`이 두 줄로 들어간다.
    - `compact: true` → rich `name.width`가 56, `fontSize`가 12다.
    - 9번째(index 8) 조각에 `decal.rotation === Math.PI / 4`, 17번째에 `-Math.PI / 4`, 1번째에 decal이 없다.
    - `itemStyle.color`가 `theme.chart[0]` 등 토큰 값이다.
    - 조각 1개도 옵션이 만들어진다.
    - 이름에 `{a|b}`가 있어도 rich 문법이 깨지지 않는다.
  - `donutHeight`: `(3,false)=280`, `(3,true)=240`, `(12,false)>280`, `(40,false)=460`
  - `sliceStyle`: 기존 단언 유지(0, 7, 8, 15, 16, 30)
  - 컴포넌트: Task 1과 같은 가짜 `./echarts` 인스턴스를 쓴다.
    - 등록된 `click` 핸들러를 `{ name: '식비' }`로 부르면 `onSelect('식비')`
    - `mouseover`/`mouseout` → `onActiveChange('식비')`/`(null)`
    - `rerender`로 `activeId`를 `'식비'` → `'쇼핑'`으로 바꾸면 `dispatchAction`이 `downplay 식비`, `highlight 쇼핑` 순으로 불린다.
    - 컨테이너가 `aria-hidden="true"`다.
  - `CategoryBreakdown.test.tsx`·`DashboardPage.test.tsx`: 기존 테스트가 그대로 통과해야 한다. 차트 내부를 보던 단언(`path.slice`, `data-active` 등)이 있으면, 목록 행·`aria-hidden` 컨테이너 기준으로 바꾼다.
- [ ] **Step 2: 실패를 확인한다** — `npx vitest run src/common/DonutChart.test.tsx src/dashboard`
- [ ] **Step 3: 구현한다**
- [ ] **Step 4: 통과를 확인한다** — `npm run typecheck && npm test && npm run lint && npm run build`. 빌드 출력에서 홈 첫 진입 청크가 바뀌지 않았는지, `DashboardPage` 청크 크기를 보고에 적는다.
- [ ] **Step 5: 보고** — 커밋은 컨트롤러가 한다(`feat(web): render the category donut with ECharts`).

---

### Task 3: 브라우저 확인, 번들 기록, 후속 문서

**담당:** 컨트롤러(Playwright), Codex `gpt-6-luna` / low(문서)

- [ ] **Step 1: 미리보기**
  - 커밋하지 않는 `apps/web/mock.html`·`src/mock.tsx`로 앱 전체를 띄운다. API는 가짜 fetch로 바꾼다.
  - 대시보드 요약 데이터를 쿼리로 바꿀 수 있게 한다: 꼬리형, 밀집형, 고르게 12개, 3개, 1개.
- [ ] **Step 2: 겹침 측정**: 저장소 밖 Playwright 스크립트(`playwright-core`, `channel: 'chrome'`)로 잰다.
  - 조합: 1200·375·320px × 데이터 5종 × 라이트·다크
  - 실제 좌표로 잴 것:
    - 라벨 글자끼리 겹침
    - 지시선이 다른 라벨을 지나는지
    - 지시선끼리 교차
    - 카드 밖으로 잘림
    - 가로 스크롤
    - 최소 라벨 글자 크기
    - 비율 텍스트가 `…`로 잘렸는지
  - 기준: 겹침·교차·잘림·가로 스크롤 0, 비율 잘림 0, 글자 11px 이상.
  - 기준을 못 넘으면 `donutHeight` 계수, 반지름, 라벨 폭을 조정한다. 조정은 Task 2 구현자에게 수정 라운드로 맡긴다.
- [ ] **Step 3: 상호작용**: 아래를 스크린샷으로 남긴다(사용자에게 보낸다).
  - 조각 호버(커짐·흐림·툴팁)
  - 목록 행 호버 → 조각 강조
  - 조각 클릭 → 거래 모달
  - 다크 모드 색
- [ ] **Step 4: 번들**
  - `npm run build`. 홈 첫 진입 JS의 gzip 합계가 main과 같은지 확인한다. 엔트리와 `index.html` `modulepreload`를 합산하고, main 빌드와 비교한다.
  - `DashboardPage` 청크 증가분을 `docs/ui-library-poc.md` 표에 한 줄 더한다.
  - `dist/third-party-licenses.md`에 `echarts`(Apache-2.0)가 있는지 확인한다.
- [ ] **Step 5: 후속 문서** `docs/superpowers/plans/2026-10-27-plan-10-followups.md`(Codex luna): 아래 네 가지를 적는다.
  - 실행 중 바뀐 결정
  - 측정 결과 표
  - 다음 과제: 꺾은선 차트(`LineChart` 등록 한 줄 + 축 툴팁), 비교군 선택("고른 것끼리 비율 vs 전체 대비" 결정 필요), 실기기 확인
  - 리뷰에서 넘긴 항목
- [ ] **Step 6: 커밋** — `docs: record echarts bundle size and plan 10 follow-ups`

---

### 최종

- [ ] Claude opus가 `origin/main...HEAD` 전체를 한 번 리뷰한다.
- [ ] 전체 검사: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`
- [ ] push, PR, Auto-fix
