# Plan 19 화면 제목·추가 버튼·수입/지출 표기 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다섯 주 화면의 제목 줄·추가 버튼·수입/지출 카드를 공용 부품 두 개로 통일하고, 대시보드의 월 선택·수입/지출을 탭 위 공통 영역으로 올린다.

**Architecture:** `common/PageHeader`(h1 + 선택 동작, 고정 높이)와 `common/TotalsCards`(수입·지출 버튼 카드)를 만들고, 화면 제목 문자열은 `app/menu.ts`의 `menuLabel`로 메뉴에서 가져온다. 대시보드는 `DashboardPage`가 제목 → 월 → 합계 → 탭 메뉴 → 탭 내용 순으로 그리고 월은 두 탭 공통이다.

**Tech Stack:** React 19, React Router, CSS Modules, react-aria-components, Vitest + Testing Library + MSW.

**설계:** [화면 제목·추가 버튼·수입/지출 표기 통일 설계](../specs/2026-10-30-design-consistency-design.md)

## Global Constraints

- `apps/web`와 `.claude/skills/verify/` 문서만 바꾼다. 브랜치 `claude/design-consistency`(main `6af8e9d` 위).
- 화면 제목 = 메뉴 label: `홈` / `그룹 대시보드` / `거래 목록` / `업로드` / `그룹 관리`. 화면 코드에 제목 문자열을 다시 쓰지 않고 `menuLabel(to)`를 쓴다.
- 추가 버튼: 보이는 글자 `추가`, `<Icon name="plus" />`(기본 크기), `ui.button ui.primary`. 접근 이름 `거래 추가` / `그룹 추가`.
- 수입/지출 금액은 `formatWon`(`₩ 3,000,000`). 카드 접근 이름 `수입 ₩ 3,000,000` / `지출 ₩ 250,000`. `(원)` 표기 없음.
- 색은 `--amount-income` / `--amount-expense`, 간격·높이는 `--space-*`, `--control-height` 토큰만 쓴다.
- 고정 위치(`position: fixed/sticky`) 요소를 새로 만들지 않는다. 안전 영역 여백은 `AppLayout`의 기존 규칙을 그대로 받는다.
- 좁은 화면(≤820px) 터치 대상 높이 44px 이상.
- 바꾸지 않는 것: 업로드·그룹 화면 내부 카드 배치, 색 토큰 값, API, 초대 화면 제목, 창 제목 `새 그룹 만들기`, `NoGroupNotice`의 `그룹 만들기` 링크.
- 최종 검증: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`. lint는 기존 경고 외 새 경고 없음.
- 커밋은 컨트롤러가 한다. Codex 구현이면 `Co-Authored-By: Codex (<모델>) <noreply@openai.com>`.

## 담당 (codex-collab 3장)

| Task | 구현 | 리뷰 |
|---|---|---|
| 1 공용 부품 | Codex `gpt-6-astra` / `medium` (`write`) | Claude sonnet |
| 2 제목 줄·추가 버튼 적용 | Codex `gpt-6-sol` / `medium` (`write`) | Claude sonnet |
| 3 대시보드·홈 합계 | Codex `gpt-6-sol` / `medium` (`write`) | Claude sonnet |
| 브랜치 최종 리뷰 | — | Claude opus 한 번 |

Task는 순서대로 한다(2·3이 1의 부품을 쓰고, 3이 2의 대시보드 제목 줄 위에 얹는다).

---

### Task 1: `PageHeader`, `TotalsCards`, `menuLabel`

**Files:**
- Create: `apps/web/src/common/PageHeader.tsx`, `apps/web/src/common/PageHeader.module.css`
- Create: `apps/web/src/common/TotalsCards.tsx`, `apps/web/src/common/TotalsCards.module.css`
- Modify: `apps/web/src/app/menu.ts`
- Test: `apps/web/src/common/PageHeader.test.tsx`, `apps/web/src/common/TotalsCards.test.tsx`

**Interfaces:**
- Produces:
  - `PageHeader({ title, action }: { title: string; action?: ReactNode }): JSX.Element` — default export.
  - `TotalsCards({ income, expense, onSelect, opensDialog }: { income: number; expense: number; onSelect: (kind: TotalKind) => void; opensDialog?: boolean }): JSX.Element` — default export.
  - `type TotalKind = 'income' | 'expense'` — `common/TotalsCards.tsx`에서 named export.
  - `menuLabel(to: string): string` — `app/menu.ts`에서 named export. `MENU`에 없는 `to`면 throw.

- [ ] **Step 1: 실패하는 테스트**

`apps/web/src/common/PageHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { menuLabel } from '../app/menu'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  it('renders the page heading and an optional action in one row', () => {
    render(<PageHeader title="거래 목록" action={<button type="button">추가</button>} />)
    const heading = screen.getByRole('heading', { level: 1, name: '거래 목록' })
    const action = screen.getByRole('button', { name: '추가' })
    expect(heading.parentElement).toBe(action.parentElement)
  })

  it('renders only the heading without an action', () => {
    render(<PageHeader title="홈" />)
    expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('menuLabel', () => {
  it('returns the sidebar label for a menu path', () => {
    expect(menuLabel('/')).toBe('홈')
    expect(menuLabel('/dashboard')).toBe('그룹 대시보드')
    expect(menuLabel('/upload')).toBe('업로드')
  })

  it('throws for a path outside the menu', () => {
    expect(() => menuLabel('/nope')).toThrow()
  })
})
```

`apps/web/src/common/TotalsCards.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TotalsCards from './TotalsCards'

describe('TotalsCards', () => {
  it('shows income and expense in won and reports which one was pressed', async () => {
    const onSelect = vi.fn()
    render(<TotalsCards income={3000000} expense={250000} onSelect={onSelect} />)
    const income = screen.getByRole('button', { name: '수입 ₩ 3,000,000' })
    expect(income).toHaveTextContent('₩ 3,000,000')
    expect(income).not.toHaveTextContent('(원)')
    expect(income).not.toHaveAttribute('aria-haspopup')
    await userEvent.click(screen.getByRole('button', { name: '지출 ₩ 250,000' }))
    expect(onSelect).toHaveBeenCalledWith('expense')
  })

  it('marks the cards as dialog openers when asked', () => {
    render(<TotalsCards income={0} expense={0} onSelect={() => {}} opensDialog />)
    expect(screen.getByRole('button', { name: '수입 ₩ 0' })).toHaveAttribute('aria-haspopup', 'dialog')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/PageHeader.test.tsx src/common/TotalsCards.test.tsx`
Expected: FAIL — `./PageHeader`, `./TotalsCards` 모듈과 `menuLabel` export가 없다.

- [ ] **Step 3: 구현**

`apps/web/src/app/menu.ts` 끝에 더한다:

```ts
/** 화면 제목은 메뉴 이름과 같게 둔다. */
export function menuLabel(to: string): string {
  const item = MENU.find((m) => m.to === to)
  if (!item) throw new Error(`메뉴에 없는 경로: ${to}`)
  return item.label
}
```

`apps/web/src/common/PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

type Props = { title: string; action?: ReactNode }

/** 주 화면 제목 줄. 동작 버튼이 없어도 높이가 같아 화면마다 제목이 같은 자리에 놓인다. */
export default function PageHeader({ title, action }: Props) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {action}
    </div>
  )
}
```

`apps/web/src/common/PageHeader.module.css`:

```css
.header { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: var(--control-height); }
.title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.header > :not(.title) { flex: none; }
```

`apps/web/src/common/TotalsCards.tsx` (대시보드의 `.totals/.total*` 규칙을 옮긴다):

```tsx
import { formatWon } from './format'
import ui from './ui.module.css'
import styles from './TotalsCards.module.css'

export type TotalKind = 'income' | 'expense'

const KINDS: [TotalKind, string][] = [['income', '수입'], ['expense', '지출']]

type Props = { income: number; expense: number; onSelect: (kind: TotalKind) => void; opensDialog?: boolean }

export default function TotalsCards({ income, expense, onSelect, opensDialog }: Props) {
  const amounts: Record<TotalKind, number> = { income, expense }
  return (
    <div className={styles.totals}>
      {KINDS.map(([kind, label]) => (
        <button key={kind} type="button" aria-haspopup={opensDialog ? 'dialog' : undefined}
          aria-label={`${label} ${formatWon(amounts[kind])}`}
          className={`${ui.card} ${styles.total}`} onClick={() => onSelect(kind)}>
          <span className={styles.label}>{label}</span>
          <span className={`${styles.value} ${styles[kind]}`}>{formatWon(amounts[kind])}</span>
        </button>
      ))}
    </div>
  )
}
```

`apps/web/src/common/TotalsCards.module.css`:

```css
/* 아주 좁은 폭에서는 큰 금액이 카드를 넘지 않게 한 줄에 하나씩 둔다. */
.totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-3); }
.total { align-items: flex-start; gap: var(--space-1); min-height: var(--control-height); font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
.total:hover { background: var(--surface-100); }
.total:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.label { font-size: var(--text-sm); font-weight: 500; color: var(--ink-muted); }
.value { font-size: var(--text-xl); font-weight: 700; font-variant-numeric: tabular-nums; }
.income { color: var(--amount-income); }
.expense { color: var(--amount-expense); }
@media (max-width: 820px) { .value { font-size: clamp(var(--text-md), 4vw, var(--text-lg)); white-space: nowrap; } }
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/common/PageHeader.test.tsx src/common/TotalsCards.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: 전체 검증 후 커밋(컨트롤러)**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`

```bash
git add apps/web/src/common/PageHeader.* apps/web/src/common/TotalsCards.* apps/web/src/app/menu.ts
git commit -m "feat(web): 공용 제목 줄과 수입·지출 카드 부품 추가"
```

---

### Task 2: 다섯 화면에 제목 줄과 추가 버튼 적용

**Files:**
- Modify: `apps/web/src/home/HomePage.tsx`
- Modify: `apps/web/src/imports/UploadPage.tsx`
- Modify: `apps/web/src/transactions/TransactionsPage.tsx`
- Modify: `apps/web/src/groups/GroupsPage.tsx`, `apps/web/src/groups/GroupsPage.module.css`
- Modify: `apps/web/src/dashboard/DashboardPage.tsx`, `apps/web/src/dashboard/dashboardRoute.ts`
- Test: `apps/web/src/home/HomePage.test.tsx`, `apps/web/src/imports/UploadPage.test.tsx`, `apps/web/src/groups/GroupsPage.test.tsx`, `apps/web/src/dashboard/DashboardPage.test.tsx`, `apps/web/src/app/AppRoutes.test.tsx`, `apps/web/src/transactions/TransactionsPage.test.tsx`(바뀌는 단언이 있을 때만)
- Docs: `.claude/skills/verify/SKILL.md`, `.claude/skills/verify/features/home.md`, `.claude/skills/verify/features/upload.md`

**Interfaces:**
- Consumes: `PageHeader`, `menuLabel` (Task 1).
- Produces: 대시보드의 보이는 h1 `그룹 대시보드`(Task 3이 그 아래에 월·합계를 놓는다). `dashboardTitle(level)`은 `` `${menuLabel('/dashboard')} · ${LEVEL_LABEL[level]}` ``.

- [ ] **Step 1: 실패하는 테스트로 바꾼다**

`HomePage.test.tsx` 첫 테스트의 탭 제목 단언과 새 제목 단언:

```tsx
    expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(document.title).toBe('홈 · Salad Bowl')
```

`UploadPage.test.tsx` 마지막 테스트(`월별 등록 현황` 순서 확인) 안에 더한다:

```tsx
    expect(screen.getByRole('heading', { level: 1, name: '업로드' })).toBeInTheDocument()
```

`GroupsPage.test.tsx`: `name: '그룹 만들기'` 버튼 클릭을 `name: '그룹 추가'`로 바꾸고, 그 앞에 제목 줄 안 위치를 단언한다:

```tsx
    const add = screen.getByRole('button', { name: '그룹 추가' })
    expect(add).toHaveTextContent(/^추가$/)
    expect(add.parentElement).toBe(screen.getByRole('heading', { level: 1, name: '그룹 관리' }).parentElement)
    await user.click(add)
```

빈 상태 문구를 확인하는 단언이 있으면 `위의 추가 버튼으로`로 바꾼다.

`DashboardPage.test.tsx` — `toHaveClass('visuallyHidden')` 단언(현재 84행)을 바꾼다:

```tsx
    expect(screen.getByRole('heading', { level: 1, name: '그룹 대시보드' })).not.toHaveClass('visuallyHidden')
```

`AppRoutes.test.tsx`: `name: '내 가계부'` 모두 `name: '홈'`으로, `name: '뱅크샐러드 엑셀 업로드'`를 `name: '업로드'`로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/home src/imports/UploadPage.test.tsx src/groups/GroupsPage.test.tsx src/dashboard/DashboardPage.test.tsx src/app/AppRoutes.test.tsx`
Expected: FAIL — 제목이 `내 가계부`·`뱅크샐러드 엑셀 업로드`이고, `그룹 추가` 버튼이 없고, 대시보드 h1이 숨김이다.

- [ ] **Step 3: 구현**

`HomePage.tsx`:

```tsx
import { menuLabel } from '../app/menu'
import PageHeader from '../common/PageHeader'
// ...
  const title = menuLabel('/')
  usePageTitle(title)
// ...
      <PageHeader title={title} />
```

(`<h1>내 가계부</h1>`를 지운다.)

`UploadPage.tsx`: 같은 방식으로 `menuLabel('/upload')`를 `usePageTitle`과 `<PageHeader title={title} />`에 쓰고 `<h1>뱅크샐러드 엑셀 업로드</h1>`를 지운다.

`TransactionsPage.tsx`: 제목 줄을 바꾼다. `usePageTitle('거래 목록')`이 있으면 `menuLabel('/transactions')`로 바꾼다.

```tsx
      <PageHeader title={menuLabel('/transactions')} action={
        <button type="button" className={`${ui.button} ${ui.primary}`} aria-label="거래 추가"
          onClick={() => { setAdding(true); setSelectedId(null) }}><Icon name="plus" />추가</button>
      } />
```

`GroupsPage.tsx`: `<h1>그룹 관리</h1>`와 `<div className={styles.actions}>…</div>`를 지우고:

```tsx
  const title = menuLabel('/groups')
  usePageTitle(title)
// ...
      <PageHeader title={title} action={
        <button type="button" className={`${ui.button} ${ui.primary}`} aria-label="그룹 추가"
          onClick={() => setCreating(true)}><Icon name="plus" />추가</button>
      } />
```

빈 상태 문구: `아직 속한 그룹이 없습니다. 위의 추가 버튼으로 새로 만들거나, 받은 초대 링크를 열어 합류합니다.`
`GroupsPage.module.css`에서 `.actions` 규칙을 지운다.

`dashboardRoute.ts`:

```ts
import { menuLabel } from '../app/menu'
// ...
export function dashboardTitle(level: Level): string {
  return `${menuLabel('/dashboard')} · ${LEVEL_LABEL[level]}`
}
```

`DashboardPage.tsx`: 두 곳의 `<h1 className={styles.visuallyHidden}>그룹 대시보드</h1>`를 `<PageHeader title={menuLabel('/dashboard')} />`로 바꾸고, `DashboardPage.module.css`의 `.visuallyHidden`을 다른 곳이 쓰지 않으면 지운다(`grep -rn visuallyHidden src/dashboard`로 확인).

문서: `SKILL.md`의 `` heading `내 가계부` ``를 `` heading `홈` ``으로, `features/home.md`의 `` heading `내 가계부` ``를 `` heading `홈` ``으로, `features/upload.md`의 `` heading `뱅크샐러드 엑셀 업로드` ``를 `` heading `업로드` ``로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/home src/imports src/groups src/dashboard src/app src/transactions`
Expected: PASS

- [ ] **Step 5: 전체 검증 후 커밋(컨트롤러)**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`

```bash
git add apps/web/src .claude/skills/verify
git commit -m "feat(web): 주 화면 제목을 메뉴 이름으로 맞추고 추가 버튼 위치 통일"
```

---

### Task 3: 대시보드 공통 영역과 홈 수입/지출 카드

**Files:**
- Modify: `apps/web/src/dashboard/DashboardPage.tsx`, `apps/web/src/dashboard/DashboardPage.module.css`, `apps/web/src/dashboard/MemberTotalsDialog.tsx`
- Modify: `apps/web/src/home/HomePage.tsx`, `apps/web/src/home/HomePage.module.css`
- Test: `apps/web/src/dashboard/DashboardPage.test.tsx`, `apps/web/src/home/HomePage.test.tsx`
- Docs: `.claude/skills/verify/features/dashboard.md`, `.claude/skills/verify/features/home.md`, `.claude/skills/verify/features/transactions.md`

**Interfaces:**
- Consumes: `TotalsCards`, `TotalKind`(Task 1), 대시보드 `PageHeader`(Task 2).
- Produces: 없음(마지막 Task).

- [ ] **Step 1: 실패하는 테스트로 바꾼다**

`DashboardPage.test.tsx`:

1. 접근 이름을 모두 바꾼다: `'수입 3,000,000원'` → `'수입 ₩ 3,000,000'`, `'지출 250,000원'` → `'지출 ₩ 250,000'`(파일 전체 치환).
2. `'shows the selected group summary for this month'`의 `(원)` 단언 두 줄을 바꾼다:

```tsx
    expect(income).toHaveTextContent('₩ 3,000,000')
    expect(income).not.toHaveTextContent('(원)')
```

3. `'puts the month picker below the classification tabs and before the totals'`를 바꾼다:

```tsx
  it('puts the title, month picker and totals above the classification tabs', async () => {
    mockViewport(true)
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    renderDashboard('/dashboard/major?month=2026-08')
    const income = await screen.findByRole('button', { name: '수입 ₩ 3,000,000' })
    const heading = screen.getByRole('heading', { level: 1, name: '그룹 대시보드' })
    const month = screen.getByLabelText('월')
    const menu = screen.getByRole('navigation', { name: '대시보드 메뉴' })
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(heading, month)).toBe(true)
    expect(follows(month, income)).toBe(true)
    expect(follows(income, menu)).toBe(true)
    expect(screen.queryByText(/공개를 켠 멤버의 원화 거래/)).not.toBeInTheDocument()
  })
```

4. `'uses the latest six months for subcategories without a month picker (narrow: %s)'`를 바꾼다:

```tsx
  it.each([false, true])('applies the address month and month picker to subcategories (narrow: %s)', async (narrow) => {
    mockViewport(narrow)
    const months: string[] = []
    const summaryMonths: string[] = []
    server.use(
      http.get('*/api/groups/10/summary', ({ request }) => {
        summaryMonths.push(new URL(request.url).searchParams.get('month')!)
        return HttpResponse.json(summary)
      }),
      http.get('*/api/groups/10/summary/subcategories', ({ request }) => {
        months.push(new URL(request.url).searchParams.get('month')!)
        return HttpResponse.json([])
      }),
    )
    const { user } = renderDashboard('/dashboard/minor?month=2026-03')
    await screen.findByText('최근 6개월에 공개된 지출이 없습니다.')
    expect(months).toEqual(['2026-03'])
    expect(summaryMonths).toEqual(['2026-03'])
    expect(screen.getByText('2026년 3월까지 최근 6개월 · 지출에서 환불을 차감합니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/minor?month=2026-02'))
    expect(await screen.findByText('2026년 2월까지 최근 6개월 · 지출에서 환불을 차감합니다.')).toBeInTheDocument()
  })
```

5. 탭을 바꿔도 합계가 위에 남는지 확인하는 테스트를 더한다:

```tsx
  it('keeps the totals above the tabs when switching to the minor tab', async () => {
    mockViewport(true)
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    const { user } = renderDashboard('/dashboard/major?month=2026-10')
    const income = await screen.findByRole('button', { name: '수입 ₩ 3,000,000' })
    await user.click(within(screen.getByRole('navigation', { name: '대시보드 메뉴' })).getByRole('link', { name: '소분류' }))
    await screen.findByRole('region', { name: '소분류 추이·분포' })
    expect(screen.getByRole('button', { name: '수입 ₩ 3,000,000' })).toBe(income)
  })
```

`HomePage.test.tsx` — `'summarizes last month …'` 테스트 끝에 더하고, 이동을 확인하는 테스트를 더한다:

```tsx
    expect(within(summary).getByRole('button', { name: '수입 ₩ 3,000,000' })).toBeInTheDocument()
    expect(within(summary).getByRole('button', { name: '지출 ₩ 12,000' })).toBeInTheDocument()
    expect(within(summary).queryByRole('link', { name: '내 거래 보기' })).not.toBeInTheDocument()
```

```tsx
  it('opens my transactions from the summary cards', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
    )
    const { user } = renderPage(
      <Routes>
        <Route path="/" element={<HomePage today={today} />} />
        <Route path="/transactions" element={<p>거래 목록 화면</p>} />
      </Routes>,
    )
    await user.click(await screen.findByRole('button', { name: '지출 ₩ 0' }))
    expect(await screen.findByText('거래 목록 화면')).toBeInTheDocument()
  })
```

(`import { Route, Routes } from 'react-router'`를 더한다. `'retries the summary on its own'`의 `findByText('수입')`은 그대로 통과해야 한다.)

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/dashboard/DashboardPage.test.tsx src/home/HomePage.test.tsx`
Expected: FAIL — 접근 이름이 `수입 3,000,000원`이고, 월 선택이 탭 메뉴 아래이며, 소분류가 `2026-10`을 쓰고, 홈 카드가 버튼이 아니다.

- [ ] **Step 3: 구현**

`MemberTotalsDialog.tsx`: `export type TotalKind = …` 정의를 지우고 `import type { TotalKind } from '../common/TotalsCards'`로 바꾼다.

`DashboardPage.tsx`:

- 월: `const month = isYearMonth(requested) ? requested : fallbackMonth` (`level === 'major' &&` 제거).
- `kind` 상태와 합계·빈 문구·`MemberTotalsDialog`를 `SummaryView`에서 `DashboardPage`로 올린다. 그룹이 있는 경우의 반환을 이 순서로 그린다:

```tsx
  return (
    <>
      <PageHeader title={menuLabel('/dashboard')} />
      <MonthPicker month={month} onChange={(m) => setSearch((p) => { p.set('month', m); return p }, { replace: true })} />
      {summary.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {summary.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>요약을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void summary.refetch()}>다시 시도</button>
        </div>
      )}
      {summary.data && <>
        <TotalsCards income={summary.data.income} expense={summary.data.expense} onSelect={setKind} opensDialog />
        {summary.data.income === 0 && summary.data.expense === 0 && <p className={ui.status}>이 달에 합칠 거래가 없습니다.</p>}
        <MemberTotalsDialog kind={kind} summary={summary.data} onClose={() => setKind(null)} />
      </>}
      {narrow && <DashboardMenu level={level} />}
      <SummaryView key={selectedGroupId} groupId={selectedGroupId} month={month} summary={summary.data}
        level={level} view={params.view as View | undefined} major={search.get('major') ?? undefined} />
    </>
  )
```

  `const [kind, setKind] = useState<TotalKind | null>(null)`는 조기 반환(`redirect`, 로딩) 앞, 다른 훅과 함께 선언한다. `SummaryView`에서는 `kind`, `empty`, 합계 버튼, `MemberTotalsDialog`를 지우고 스크롤 효과와 탭 내용만 남긴다. `useState`·`TotalKind` import가 안 쓰이면 정리한다.
- `DashboardPage.module.css`에서 `.totals`, `.total`, `.total:hover`, `.total:focus-visible`, `.income`, `.expense`, `.totalLabel`, `.totalValue`, `.totalUnit`, 그리고 `.totalValue` 미디어 쿼리 줄을 지운다. `.table*`는 `MemberTotalsDialog`가 쓰므로 남긴다. 파일 첫 줄 주석(“아주 좁은 폭에서는…”)은 `TotalsCards.module.css`로 옮겨졌으므로 지운다.

`HomePage.tsx`:

```tsx
import { useNavigate } from 'react-router'
import TotalsCards from '../common/TotalsCards'
// ...
  const navigate = useNavigate()
// ...
          {totals && <TotalsCards income={totals.income} expense={totals.expense} onSelect={() => navigate('/transactions')} />}
```

  `<dl className={styles.totals}>…</dl>`와 `<Link to="/transactions">내 거래 보기</Link>`를 지운다. 거래 목록의 기본 달이 홈과 같은 지난달(`defaultYearMonth`)이라 주소에 달을 넘기지 않는다. `HomePage.module.css`에서 `.totals` 관련 네 줄을 지운다. `Link`는 `업로드하기`가 계속 쓴다.

문서:
- `features/dashboard.md`: 3행 설명에 순서 “heading → month picker → 수입·지출 → (narrow) 대시보드 메뉴 → sub-screen”과 “the month applies to both 대분류 and 소분류”를 적는다. `dash-minor`에 소분류가 `?month=`까지 최근 6개월을 쓴다고 적는다.
- `features/home.md`: `home-summary`와 **Summary** 줄의 `` link `내 거래 보기` ``를 “the 수입·지출 cards (`수입 ₩ …`), which open `/transactions`”로 바꾼다.
- `features/transactions.md`: 15행 `` click the link `내 거래 보기` ``를 `` click the card `수입 ₩ …` ``로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/dashboard src/home`
Expected: PASS

- [ ] **Step 5: 전체 검증 후 커밋(컨트롤러)**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`

```bash
git add apps/web/src .claude/skills/verify
git commit -m "feat(web): 대시보드 월·수입지출을 탭 위 공통 영역으로 올리고 홈 합계 카드 통일"
```

---

### 마무리(컨트롤러)

- [ ] verify 스택에서 375×812와 데스크톱으로 홈·대시보드(대분류·소분류)·거래 목록·업로드·그룹 관리를 캡처해 `.verify-artifacts/design-consistency-<yyyymmdd-hhmm>/`에 이전(설계 2장 캡처)과 함께 둔다. 볼 것: 제목이 같은 위치·크기, 추가 버튼 위치, 375px에서 금액이 카드를 넘지 않음, 거래 목록이 여전히 화면 높이에 맞음(페이지 스크롤 없음).
- [ ] 브랜치 최종 리뷰(Claude opus 한 번).
- [ ] PR: `feat(web): 화면 제목·추가 버튼·수입/지출 표기 통일`, 본문 `무엇 / 확인 / 리뷰 / 참고`, 이전·이후 캡처 첨부.
