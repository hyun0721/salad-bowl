# Plan 14: 3순위 다듬기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다음 작은 문제들을 한 브랜치에서 정리한다.
- 빌드 경고
- 접근성 이름
- RAC 경고
- 디자인 토큰(간격·글자·비활성 버튼)
- 홈 달력 줄바꿈과 도넛 여백
- 로딩 덮개의 사소한 결함

**Architecture:** 웹만 바뀐다. 각 Task는 서로 다른 파일 묶음을 건드린다. B(Task 3)만 CSS 파일을 넓게 고친다. 그래서 C(Task 4)는 Task 3 뒤에 둔다.

**Tech Stack:** React 19, react-aria-components(`common/`에서만), CSS Modules, Vite 8(rolldown), Vitest + Testing Library + MSW, Playwright(시스템 Chrome, 확인용).

**스펙:** [2026-10-27-polish-small-items-design.md](../specs/2026-10-27-polish-small-items-design.md)

## Global Constraints

- **바꾸는 곳**
  - `apps/web`만 바꾼다. 새 의존성을 추가하지 않는다.
  - `react-aria-components`는 `src/common/`·테스트·`main.tsx`에서만 import한다.
- **간격 토큰:** `--space-1: 4px`를 새로 둔다.
  - 4px → `var(--space-1)`
  - 6px·10px → `var(--space-2)`
  - 14px → `var(--space-3)`
  - 2px와 `0px`는 그대로 둔다.
- **글자 토큰**: line-height는 바꾸지 않는다.

| 토큰 | 값 | 옮기는 값 |
|---|---|---|
| `--text-xs` | 12px | 12 |
| `--text-sm` | 13px | 13, 14 |
| `--text-base` | 15px | 15 |
| `--text-md` | 18px | 18 |
| `--text-lg` | 20px | 20 |
| `--text-xl` | 24px | 22, 24 |
| `--text-2xl` | 28px | 26, 28 |

- **비활성 버튼**
  - 일반: `background: var(--surface-100); color: var(--ink-muted); border-color: var(--line); opacity: 1; cursor: not-allowed;`
  - 브랜드: `background: var(--line); color: var(--ink-muted);`
- **MonthPicker 버튼 이름**
  - label이 `'월'`이면 "이전 달"·"다음 달"이다.
  - 아니면 `` `${label} 이전 달` ``·`` `${label} 다음 달` ``이다.
- **도넛 높이 기본값:** 좁은 화면 200, 넓은 화면 240. 조각당 +12, 상한 380은 그대로다.
- **로딩 덮개**
  - 앱 전역에 한 번만 둔다.
  - `active = slow && status !== 'loading'`이다.
  - 대화상자 이름은 `aria-label="서버 준비 중"`이고, 설명은 `aria-describedby`로 로더의 status 영역에 잇는다.
- **검증:** `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 | 순서 |
|---|---|---|---|
| 1 빠른 수정(빌드·MonthPicker·연도 아이콘) | Codex `gpt-6-luna` / medium | Claude sonnet | 먼저 |
| 2 모바일 대시보드 RAC 경고 | Claude sonnet (원인 찾기가 필요) | Codex `gpt-6-sol` / high | Task 1 뒤 |
| 3 디자인 토큰·비활성 버튼 | Codex `gpt-6-sol` / medium | Claude sonnet | Task 2 뒤 |
| 4 달력 줄바꿈·도넛 여백 | Codex `gpt-6-luna` / medium | Claude sonnet | Task 3 뒤 |
| 5 로딩 덮개 정리 | Codex `gpt-6-sol` / medium | Claude sonnet | Task 4 뒤 |
| 최종 | — | Claude opus | 끝 |

- 컨트롤러는 Task 3 전후와 Task 4 뒤에 Playwright 스크린샷을 찍는다. 화면별 전후 비교와 도넛 조각 3·6·10개를 본다.

---

### Task 1: 빠른 수정

**담당:** Codex `gpt-6-luna` / medium

**Files:**
- Modify: `apps/web/vite.config.ts:48-52`
- Modify: `apps/web/src/common/MonthPicker.tsx`
- Test: `apps/web/src/common/MonthPicker.test.tsx`
- Modify: `apps/web/src/home/HomePage.tsx:41,43`
- Test: `apps/web/src/home/HomePage.test.tsx`

**Interfaces:** 외부 인터페이스는 바뀌지 않는다(`MonthPicker` props 동일).

- [ ] **Step 1: 실패하는 테스트**

`MonthPicker.test.tsx`에 추가한다.

```tsx
it('names the step buttons after a custom label', () => {
  render(<MonthPicker label="시작 월" month="2026-10" onChange={() => {}} />)
  expect(screen.getByRole('button', { name: '시작 월 이전 달' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '시작 월 다음 달' })).toBeInTheDocument()
})

it('keeps the plain names with the default label', () => {
  render(<MonthPicker month="2026-10" onChange={() => {}} />)
  expect(screen.getByRole('button', { name: '이전 달' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '다음 달' })).toBeInTheDocument()
})
```

`HomePage.test.tsx`에 추가한다. 기존 테스트의 렌더 도우미와 핸들러를 그대로 쓴다.

```tsx
it('draws the year buttons as icons', async () => {
  // 기존 테스트와 같은 방식으로 HomePage를 렌더한다.
  const prev = await screen.findByRole('button', { name: '이전 연도' })
  expect(prev.querySelector('svg')).not.toBeNull()
  expect(prev).not.toHaveTextContent('‹')
  expect(screen.getByRole('button', { name: '다음 연도' }).querySelector('svg')).not.toBeNull()
})
```

`CategoryTrend.test.tsx`나 다른 테스트가 "이전 달"·"다음 달"을 label과 함께 찾고 있으면, 새 이름으로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/MonthPicker.test.tsx src/home/HomePage.test.tsx`
Expected: 새 테스트 3개 FAIL

- [ ] **Step 3: 구현**

`MonthPicker.tsx`: 컴포넌트 안에서 이름을 만든다.

```tsx
  const prefix = label === '월' ? '' : `${label} `
```

두 버튼의 `aria-label`을 `` `${prefix}이전 달` ``, `` `${prefix}다음 달` ``로 바꾼다.

`HomePage.tsx`: `‹`를 `<Icon name="chevron-left" size={18} />`로, `›`를 `<Icon name="chevron-right" size={18} />`로 바꾼다. `import Icon from '../common/Icon'`을 추가한다.

`vite.config.ts`: `advancedChunks`를 `codeSplitting`으로 바꾼다. 안의 `groups` 배열은 그대로 둔다.

```ts
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'zrender', test: /node_modules[\\/]zrender[\\/]/ }, { name: 'echarts', test: /node_modules[\\/]echarts[\\/]/ }],
        },
      },
    },
```

타입 오류가 나면 rolldown 타입 정의(`node_modules/rolldown`)에서 `codeSplitting`의 정확한 모양을 확인해 맞춘다. 계획과 다르게 고쳤으면 보고서에 적는다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/common/MonthPicker.test.tsx src/home/HomePage.test.tsx src/dashboard/CategoryTrend.test.tsx`
Expected: PASS

Run: `cd apps/web && npm run build 2>&1 | grep -iE "deprecated|zrender-|echarts-"`
Expected: `deprecated` 줄이 없다. `zrender-*.js`·`echarts-*.js` 청크 줄은 있다.

- [ ] **Step 5: 전체 확인 후 커밋(컨트롤러)**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Commit: `fix(web): build warning, month picker names, year icons`

---

### Task 2: 모바일 대시보드 RAC "Dialog 제목" 경고

**담당:** Claude sonnet

**Files:**
- 원인에 따라 다르다. 대개 `apps/web/src/common/` 안의 RAC 감싸개(`Select`·`Dialog`·`BottomSheet` 등) 하나다.
- Test: 그 컴포넌트의 테스트 파일

- [ ] **Step 1: 재현 테스트**
  - `mockViewport(true)`로 모바일 폭을 만든다.
  - 대시보드(`DashboardPage`)나 의심 컴포넌트를 렌더한다. 기존 대시보드 테스트의 렌더 방식을 쓴다.
  - `vi.spyOn(console, 'warn')`과 `console.error`로 경고 문구를 잡는다.
  - 경고를 내는 상호작용(월 선택, 그룹 선택, 시트 열기 등)을 찾아 테스트에 넣는다.
  - 테스트는 "경고가 불리지 않는다"를 확인한다.
- [ ] **Step 2: 실패 확인** — 테스트가 RAC 경고 때문에 실패하는지 본다. 재현이 안 되면 추측해서 고치지 않는다. 확인한 화면과 상호작용을 보고서에 적고 BLOCKED로 멈춘다.
- [ ] **Step 3: 고치기**
  - RAC `Dialog`에 `Heading slot="title"`이 없으면 `aria-label`을 준다. 화면에 보이는 제목이 있으면 `aria-labelledby`로 잇는다.
  - 같은 감싸개를 쓰는 다른 곳도 함께 고쳐지는지 `grep`으로 확인한다.
- [ ] **Step 4: 통과 확인 후 전체 확인**
- [ ] **Step 5: 커밋** — `fix(web): give the mobile sheet dialog a title`

---

### Task 3: 디자인 토큰과 비활성 버튼

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/src/styles/tokens.css`(밝은·어두운 블록 모두 확인. 간격·글자 토큰은 테마와 무관하므로 `:root`에 한 번만 둔다)
- Modify: `apps/web/src/styles/base.css`
- Modify: `font-size`나 위 표의 px 간격 리터럴이 있는 `apps/web/src/**/*.module.css` 전부
  - 찾는 명령: `grep -rnE "font-size: [0-9]+px|(gap|padding|margin)[a-z-]*:[^;]*\b(4|6|10|14)px" apps/web/src`
- Modify: `apps/web/src/common/ui.module.css`(`.button:disabled`, `.primary:disabled`)
- Modify: `apps/web/src/auth/LoginPage.module.css`(`.submit:disabled`)
- Modify: `apps/web/src/imports/UploadForm.module.css`(`.clear:disabled`)

**Interfaces:** 토큰 이름은 Global Constraints 표와 같다.

- [ ] **Step 1: 토큰 추가** — `tokens.css`의 간격 블록 맨 앞에 `--space-1: 4px;`를 둔다. 간격 블록 뒤에 글자 토큰 7개를 둔다.
- [ ] **Step 2: 리터럴 치환**
  - Global Constraints 표대로 바꾼다.
  - 축약형(`padding: 4px var(--space-3)`)에서는 해당 값만 바꾼다.
  - `font-size: 13px; line-height: 18px`처럼 line-height가 같이 있어도 line-height는 그대로 둔다.
  - SVG 속성이나 TSX의 숫자(`size={18}`)는 건드리지 않는다.
- [ ] **Step 3: 비활성 버튼** — Global Constraints의 값으로 바꾼다.
  - `ui.module.css`에는 `.button:disabled`를 두고, 그 뒤에 `.primary:disabled`를 둔다. 뒤에 두어야 브랜드 버튼에 덮어써진다.
  - `LoginPage .submit:disabled`는 브랜드 값을 쓴다.
  - `UploadForm .clear:disabled`는 배경이 투명한 버튼이라 `color: var(--ink-muted); opacity: 1; cursor: not-allowed;`만 쓴다.
- [ ] **Step 4: 남은 리터럴 확인**
  - Run: `grep -rnE "font-size: [0-9]+px" apps/web/src` → 빈 결과
  - Run: `grep -rnE "(gap|padding|margin)[a-z-]*:[^;]*\b(4|6|10|14)px" apps/web/src` → 빈 결과
  - `tokens.css` 자체는 제외한다.
- [ ] **Step 5: 전체 확인**
  - `npm run typecheck && npm test && npm run lint && npm run build`
  - CSS만 바뀌므로 테스트 결과는 그대로여야 한다.
- [ ] **Step 6: 커밋(컨트롤러, 스크린샷 비교 뒤)** — `style(web): spacing and type tokens, clearer disabled buttons`

---

### Task 4: 홈 달력 줄바꿈·도넛 여백

**담당:** Codex `gpt-6-luna` / medium

**Files:**
- Modify: `apps/web/src/home/CoverageCalendar.tsx`, `apps/web/src/home/CoverageCalendar.module.css`
- Test: `apps/web/src/home/HomePage.test.tsx`(달력은 HomePage 테스트에서 렌더된다)
- Modify: `apps/web/src/common/DonutChart.tsx:28-31`
- Test: `apps/web/src/common/DonutChart.test.tsx`(`donutHeight` 기대값)

- [ ] **Step 1: 실패하는 테스트**
  - `DonutChart.test.tsx`의 `donutHeight` 기대값을 새 기준(좁은 화면 200, 넓은 화면 240, 조각당 +12, 상한 380)으로 바꾼다.
  - 높이를 쓰는 렌더 테스트(`toHaveStyle({ height: '260px' })` 등)도 240으로 바꾼다.
  - `HomePage.test.tsx`에 추가한다.

```tsx
it('splits the missing-month text so the upload hint can hide in narrow cells', async () => {
  // 기존 테스트처럼 미등록 월이 있는 상태로 렌더한다.
  const cell = await screen.findByRole('button', { name: /미등록, 업로드하기/ })
  expect(cell).toHaveTextContent('미등록 · 업로드하기')
  expect(within(cell).getByText('· 업로드하기')).toBeInTheDocument()
})
```

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**

`CoverageCalendar.tsx`의 미등록 칸을 바꾼다.

```tsx
                <span className={styles.state}>미등록<span className={styles.uploadHint}> · 업로드하기</span></span>
```

이때 `getByText('· 업로드하기')`가 맞도록 공백 처리를 확인한다. 앞 공백 때문에 맞지 않으면 테스트를 `getByText(/업로드하기/)`로 바꾸고 보고서에 적는다.

`CoverageCalendar.module.css`에 추가한다.

```css
/* 좁은 칸에서 "미등록 · 업로드하기"가 어색하게 끊기므로 업로드 안내를 숨긴다(버튼 이름에는 남아 있다). */
.cell { container-type: inline-size; }
@container (max-width: 120px) { .uploadHint { display: none; } }
```

`.cell`에 이미 다른 속성이 있으면 같은 규칙 안에 `container-type`만 더한다.

`DonutChart.tsx`:

```ts
  const base = compact ? 200 : 240
```

- [ ] **Step 4: 통과 확인 후 전체 확인**
- [ ] **Step 5: 커밋(컨트롤러, 도넛 3·6·10개 스크린샷 뒤)** — `style(web): hide the upload hint in narrow calendar cells, trim donut height`

---

### Task 5: 로딩 덮개 정리

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/src/common/SaladBowlLoader.tsx`, `apps/web/src/common/SaladBowlLoader.test.tsx`
- Modify: `apps/web/src/common/SaladBowlOverlay.tsx`, `apps/web/src/common/SaladBowlOverlay.test.tsx`
- Modify: `apps/web/src/app/SlowServerOverlay.tsx`, `apps/web/src/app/SlowServerOverlay.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app/RequireAuth.tsx`, `apps/web/src/app/PublicOnly.tsx`, `apps/web/src/app/AppLayout.tsx`(`SlowServerOverlay` 제거)
- Test: `apps/web/src/app/AppRoutes.test.tsx`(PublicOnly loading)

**Interfaces:**
- `SaladBowlLoader` props에 `statusId?: string`를 더한다. status 영역의 `id`로 쓴다.
- `SlowServerOverlay()`는 `useAuth()`를 쓰므로 `AuthProvider` 안에서만 렌더한다.

- [ ] **Step 1: 실패하는 테스트**

`SaladBowlLoader.test.tsx`에 추가한다.

```tsx
it('lines the message up with the bowl when reactivated while finishing', () => {
  const onFinished = vi.fn()
  const { container, rerender } = render(<SaladBowlLoader onFinished={onFinished} />)
  rerender(<SaladBowlLoader done onFinished={onFinished} />)
  for (let step = 0; step < 2; step++) act(() => { vi.advanceTimersByTime(120) })
  expect(pieces(container)).toBe(3)
  rerender(<SaladBowlLoader onFinished={onFinished} />)
  expect(pieces(container)).toBe(3)
  expect(screen.getByRole('status')).toHaveTextContent('드레싱 넣는 중이에요')
  act(() => { vi.advanceTimersByTime(1_000) })
  expect(onFinished).not.toHaveBeenCalled()
})

it('uses the given id for the status region', () => {
  render(<SaladBowlLoader statusId="loader-status" />)
  expect(screen.getByRole('status')).toHaveAttribute('id', 'loader-status')
})
```

`SaladBowlOverlay.test.tsx`의 "opens a blocking dialog" 테스트에 추가한다.

```tsx
  expect(dialog).toHaveAccessibleDescription(/신선한 재료 찾는 중이에요/)
```

`SlowServerOverlay.test.tsx` 위쪽에서 `useAuth`를 가짜로 바꾼다. 기존 두 테스트는 `status = 'signedIn'`으로 둔다.

```tsx
let status = 'signedIn'
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status }) }))
```

그리고 다음 테스트를 추가한다.

```tsx
  it('stays closed while the session is still being restored', async () => {
    status = 'loading'
    server.use(http.get('*/api/slow', async () => {
      await delay(3600)
      return HttpResponse.json({})
    }))
    const pending = apiFetch('/slow')
    await delay(3200)
    render(<SlowServerOverlay />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await pending
    status = 'signedIn'
  }, 15000)
```

`AppRoutes.test.tsx`에 추가한다. 기존 slow refresh 테스트와 같은 핸들러를 쓰되 `/login`에서 시작한다.

```tsx
  it('shows the salad bowl on the login route while the session is restored', async () => {
    server.use(
      http.post('*/api/auth/refresh', async () => {
        await delay(300)
        return HttpResponse.json({ code: 'INVALID_TOKEN', message: 'no session' }, { status: 401 })
      }),
    )
    renderApp('/login')
    expect(await screen.findByText('신선한 재료 찾는 중이에요')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '로그인' }, { timeout: 3000 })).toBeInTheDocument()
  })
```

응답 형식이나 버튼 이름은 이 파일의 기존 로그아웃 상태 테스트를 보고 맞춘다.

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**

`SaladBowlLoader.tsx`
- props에 `statusId`를 더한다.
- `filled`를 계산한 바로 뒤에 다음을 넣는다.

```tsx
  if (!done && extra > 0) {
    // 닫히는 중 다시 켜지면 담긴 볼은 그대로 두고 멘트를 볼에 맞춘다.
    setStage(filled)
    setExtra(0)
  }
```

- status 영역을 `<div role="status" id={statusId} className={styles.text}>`로 바꾼다.

`SaladBowlOverlay.tsx`

```tsx
  const statusId = useId()
  ...
        <Dialog aria-label="서버 준비 중" aria-describedby={statusId} className={styles.dialog}>
          <SaladBowlLoader slow statusId={statusId} done={!active} onFinished={close} />
```

`SlowServerOverlay.tsx`

```tsx
import { useSlowRequests } from '../api/useSlowRequests'
import { useAuth } from '../auth/AuthProvider'
import SaladBowlOverlay from '../common/SaladBowlOverlay'

/**
 * 요청이 3초를 넘으면 화면을 가리고 서버가 깨어나는 동안 기다리게 한다. 앱 전역에 한 번만 둔다.
 * 화면이 바뀌어도 언마운트되지 않아 완료 모션을 끝까지 보여준다.
 * 세션 복원 중에는 시작 화면에 볼이 이미 있으므로 띄우지 않는다.
 */
export default function SlowServerOverlay() {
  const slow = useSlowRequests()
  const { status } = useAuth()
  return <SaladBowlOverlay active={slow && status !== 'loading'} />
}
```

`App.tsx`: `<ToastRegion />` 바로 위에 `<SlowServerOverlay />`를 둔다(`AuthProvider` 안).

`RequireAuth.tsx`
- `SlowServerOverlay` import와 사용을 뺀다.
- unavailable 분기는 `return <ServerUnavailable />`가 된다.

`PublicOnly.tsx`
- `SlowServerOverlay`를 뺀다.
- 마지막 return은 `<>{status === 'unavailable' && <ServerUnavailable />}{status === 'signedOut' && children}</>`이 된다.

`AppLayout.tsx`: `SlowServerOverlay` import와 `<SlowServerOverlay />`를 뺀다.

`grep -rn "<SlowServerOverlay" apps/web/src` 결과가 `App.tsx`와 테스트뿐이어야 한다.

- [ ] **Step 4: 통과 확인 후 전체 확인**
- [ ] **Step 5: 커밋(컨트롤러)** — `fix(web): one global loading overlay, reactivation and screen reader fixes`

---

## 마무리 (컨트롤러)

- Playwright로 다음을 확인한다.
  - B 전후 스크린샷: 홈·대시보드·업로드·로그인. 데스크톱·모바일, 밝은·어두운 테마
  - C: 달력 좁은 폭, 도넛 조각 3·6·10개
  - D: 덮개가 열린 채 화면 이동
- `docs/superpowers/plans/2026-10-27-plan-13-followups.md`에서 처리한 항목에 표시한다.
- Plan 10·11 followups에서도 이번에 처리한 항목(도넛 여백, MonthPicker 이름)에 표시한다.
- Claude opus 최종 리뷰 후 PR을 올리고 Auto-fix를 켠다.
