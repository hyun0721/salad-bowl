# Plan 16e 대시보드 좁은 화면 2탭과 소분류 상세보기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좁은 화면 대시보드 메뉴를 [대분류 | 소분류] 두 탭으로 줄여 분포·추이 카드를 함께 보여주고, 대분류 거래 창에 X 닫기와 "소분류 보기" 차트 버튼을 단다.

**Architecture:** 주소 판정 `dashboardRedirect`에서 폭(`narrow`) 구분을 없애 두 폭이 같은 규칙을 쓴다. `DashboardMenu`는 분류 한 줄만 남긴다. 차트 버튼은 `CategoryTransactionsDialog`가 `useNavigate`로 `/dashboard/minor?month=&major=`에 push하고, 임시 소분류 카드 `SubcategoryTrends`는 `initialMajor`로 처음 고를 대분류를 받는다.

**Tech Stack:** React 19, react-router 8.4 (`useNavigate`, `Link`, `Navigate`), TanStack Query 5, CSS Modules, Vitest + Testing Library + MSW.

**설계:** [대시보드 좁은 화면 2탭 설계](../specs/2026-10-30-dashboard-two-tabs-design.md). 바뀌지 않은 규칙은 [메뉴 개편 설계](../specs/2026-10-29-menu-restructure-design.md)를 따른다.

## Global Constraints

- Task 1·2의 구현은 `apps/web`만 바꾼다. 마무리 단계의 검증 산출물·기능 지도·후속 기록은 컨트롤러가 쓴다. 폭 기준은 `useMediaQuery(NARROW)`(`(max-width: 820px)`)다.
- 주소 표(두 폭 공통):
  - `/dashboard` → `/dashboard/major` (replace). 지금 `search`를 유지한다.
  - `/dashboard/:level` (`major`|`minor`) → 분포 카드 + 추이 카드.
  - `/dashboard/:level/:view` (`share`|`trend`) → 같은 화면이고 `:view` 카드로 한 번 스크롤한다(들어올 때, 요약이 늦게 오면 도착할 때 한 번 더. 월을 바꾸면 다시 스크롤하지 않는다).
  - 그 밖의 `level`·`view` → `/dashboard/major` (replace, `search` 유지).
- 탭 제목: `그룹 대시보드 · 대분류` / `그룹 대시보드 · 소분류` (두 폭 공통). `usePageTitle`이 ` · Salad Bowl`을 붙인다.
- 좁은 화면 메뉴: `<nav aria-label="대시보드 메뉴">` 안에 `role="group" aria-label="분류"` 한 줄 [대분류 | 소분류]만. 링크는 `/dashboard/major`·`/dashboard/minor` + 지금 `search`, replace, 현재 링크 `aria-current="page"`. `보기` 줄은 없다.
- 대분류 거래 창 머리: [차트 아이콘 버튼 `aria-label="<대분류> 소분류 보기"`] [X 아이콘 버튼 `aria-label="닫기"`]. 멤버별 창은 X 닫기만. 글자는 보이지 않는다. 아이콘 버튼은 40×40px 이상.
- 차트 버튼: 창을 닫고 `/dashboard/minor?month=<지금 달>&major=<대분류>`로 **push**한다.
- `?major=`: 소분류 화면에서 처음 고를 대분류. 임시 카드는 자기 대분류 목록(최근 6개월 응답)에 그 이름이 없으면 지금처럼 선택 안내를 보인다. 화면에서 바꿔도 주소는 고치지 않는다.
- 공용 `Dialog`(`common/Dialog.tsx`)와 그것을 쓰는 다른 창의 닫기는 바꾸지 않는다.
- 최종 검증: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`. lint는 기존 `CoverageSection` 경고 1건 외에 새 경고가 없어야 한다.
- 구현은 Codex `write` 모드(codex-collab 3장, `apps/web`)로 하고, 커밋은 컨트롤러가 저장소 루트에서 한다.

---

### Task 1: 좁은 화면 메뉴를 두 탭으로

**Files:**
- Modify: `apps/web/src/dashboard/dashboardRoute.ts`
- Modify: `apps/web/src/dashboard/DashboardMenu.tsx`
- Modify: `apps/web/src/dashboard/DashboardPage.tsx`
- Test: `apps/web/src/dashboard/dashboardRoute.test.ts`, `apps/web/src/dashboard/DashboardMenu.test.tsx`, `apps/web/src/dashboard/DashboardPage.test.tsx`

**Interfaces:**
- Produces: `dashboardRedirect(level: string | undefined, view: string | undefined): string | null`, `dashboardTitle(level: Level): string`, `DashboardMenu({ level }: { level: Level })`. `Level`·`View` 타입은 그대로다.

- [ ] **Step 1: Write the failing tests**

`dashboardRoute.test.ts` 전체를 바꾼다.

```ts
import { describe, expect, it } from 'vitest'
import { dashboardRedirect, dashboardTitle } from './dashboardRoute'

describe('dashboardRedirect', () => {
  it.each([
    [undefined, undefined, '/dashboard/major'],
    ['major', undefined, null],
    ['minor', undefined, null],
    ['major', 'trend', null],
    ['minor', 'share', null],
    ['oops', undefined, '/dashboard/major'],
    ['major', 'oops', '/dashboard/major'],
    ['oops', 'trend', '/dashboard/major'],
  ] as const)('%s/%s → %s', (level, view, expected) => {
    expect(dashboardRedirect(level, view)).toBe(expected)
  })
})

describe('dashboardTitle', () => {
  it('names the level', () => {
    expect(dashboardTitle('major')).toBe('그룹 대시보드 · 대분류')
    expect(dashboardTitle('minor')).toBe('그룹 대시보드 · 소분류')
  })
})
```

`DashboardMenu.test.tsx`의 테스트를 바꾼다.

```tsx
describe('DashboardMenu', () => {
  it('links to the two levels and keeps the search', () => {
    render(<MemoryRouter initialEntries={['/dashboard/major/trend?month=2026-08']}><DashboardMenu level="major" /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: '대시보드 메뉴' })
    const levels = within(nav).getByRole('group', { name: '분류' })
    expect(within(nav).queryByRole('group', { name: '보기' })).not.toBeInTheDocument()
    expect(within(nav).getAllByRole('link')).toHaveLength(2)
    expect(within(levels).getByRole('link', { name: '대분류' })).toHaveAttribute('aria-current', 'page')
    expect(within(levels).getByRole('link', { name: '대분류' })).toHaveAttribute('href', '/dashboard/major?month=2026-08')
    expect(within(levels).getByRole('link', { name: '소분류' })).toHaveAttribute('href', '/dashboard/minor?month=2026-08')
    expect(within(levels).getByRole('link', { name: '소분류' })).not.toHaveAttribute('aria-current')
  })
})
```

`DashboardPage.test.tsx`의 `describe('DashboardPage on a narrow screen', …)` 블록 전체를 바꾼다.

```tsx
describe('DashboardPage on a narrow screen', () => {
  beforeEach(() => { mockViewport(true) })

  it('switches levels in place, keeps the month and leaves focus on the link', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    const { user } = renderDashboard('/dashboard/major?month=2026-10')
    const nav = await screen.findByRole('navigation', { name: '대시보드 메뉴' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['대분류', '소분류'])
    await user.click(within(nav).getByRole('link', { name: '소분류' }))
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/minor?month=2026-10'))
    expect(screen.getByRole('status', { name: '이동 방식' })).toHaveTextContent('REPLACE')
    expect(within(screen.getByRole('navigation', { name: '대시보드 메뉴' })).getByRole('link', { name: '소분류' })).toHaveFocus()
    expect(await screen.findByRole('region', { name: '소분류 추이·분포' })).toBeInTheDocument()
    expect(document.title).toBe('그룹 대시보드 · 소분류 · Salad Bowl')
  })

  it('redirects /dashboard to the major screen and shows both cards', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    renderDashboard('/dashboard?month=2026-10')
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major?month=2026-10'))
    expect(await screen.findByRole('region', { name: '카테고리별 지출' })).toBeVisible()
    expect(screen.getByRole('region', { name: '대분류별 추이' })).toBeVisible()
    expect(document.title).toBe('그룹 대시보드 · 대분류 · Salad Bowl')
  })

  it('redirects an unknown address to the major screen and keeps the search', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    renderDashboard('/dashboard/oops/trend?month=2026-10&major=x')
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major?month=2026-10&major=x'))
    expect(screen.getByRole('status', { name: '이동 방식' })).toHaveTextContent('REPLACE')
  })

  it('keeps an old view address and scrolls to that card', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    const scroll = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    try {
      renderDashboard('/dashboard/major/trend?month=2026-10')
      expect(await screen.findByRole('region', { name: '카테고리별 지출' })).toBeVisible()
      expect(screen.getByRole('region', { name: '대분류별 추이' })).toBeVisible()
      expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major/trend?month=2026-10')
      await waitFor(() => expect(scroll).toHaveBeenCalled())
      expect(scroll.mock.contexts.at(-1)).toBe(document.getElementById('dashboard-trend'))
    } finally {
      if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original)
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (`apps/web`): `npx vitest run src/dashboard/dashboardRoute.test.ts src/dashboard/DashboardMenu.test.tsx src/dashboard/DashboardPage.test.tsx`
Expected: FAIL. `dashboardRedirect(undefined, undefined)`가 아직 `narrow` 인자 없이 `/dashboard/major`를 주는 경우는 통과할 수 있지만, 좁은 화면 테스트(`/dashboard/major`가 `/share`로 바뀜, `보기` 줄 있음, 추이 카드 숨김)와 `DashboardMenu`의 링크 수가 실패한다.

- [ ] **Step 3: Implement**

`dashboardRoute.ts` 전체:

```ts
export type Level = 'major' | 'minor'
export type View = 'share' | 'trend'

const LEVELS: readonly string[] = ['major', 'minor']
const VIEWS: readonly string[] = ['share', 'trend']
const LEVEL_LABEL: Record<Level, string> = { major: '대분류', minor: '소분류' }

/** 2탭 설계 2장 주소 표(두 폭 공통). 그대로 그릴 주소면 null, 아니면 바꿀 경로(search 제외). */
export function dashboardRedirect(level: string | undefined, view: string | undefined): string | null {
  const validLevel = level !== undefined && LEVELS.includes(level)
  const validView = view === undefined || VIEWS.includes(view)
  return validLevel && validView ? null : '/dashboard/major'
}

export function dashboardTitle(level: Level): string {
  return `그룹 대시보드 · ${LEVEL_LABEL[level]}`
}
```

`DashboardMenu.tsx` 전체:

```tsx
import { Link, useLocation } from 'react-router'
import type { Level } from './dashboardRoute'
import styles from './DashboardMenu.module.css'

const LEVELS: [Level, string][] = [['major', '대분류'], ['minor', '소분류']]

/** 화면을 바꾸는 형제 링크이므로 replace로 이동한다. */
export default function DashboardMenu({ level }: { level: Level }) {
  const { search } = useLocation()
  return (
    <nav aria-label="대시보드 메뉴" className={styles.menu}>
      <div role="group" aria-label="분류" className={styles.group}>
        {LEVELS.map(([id, text]) => (
          <Link key={id} to={`/dashboard/${id}${search}`} replace aria-current={id === level ? 'page' : undefined} className={styles.link}>
            {text}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

`DashboardPage.tsx`:

- `DashboardPage`에서 `const view = …` 줄을 지우고, `dashboardRedirect(params.level, params.view)`, `usePageTitle(dashboardTitle(level))`로 바꾼다. import에서 `View`는 `SummaryView`가 계속 쓰므로 남긴다.
- `SummaryView`에서 `shownView`를 지우고 스크롤 효과를 이렇게 바꾼다.

```tsx
  useEffect(() => {
    if (!view) return
    const key = `${level}/${view}`
    if (scrolledWithSummary.current === key) return
    // shortcut: 소분류 임시 카드는 분포·추이가 한 카드라 대상이 없다. 16d에서 카드를 나눌 때 같은 id를 붙인다.
    const target = document.getElementById(`dashboard-${view}`)
    if (!target) return
    target.scrollIntoView?.({ block: 'start' })
    if (hasSummary) scrolledWithSummary.current = key
  }, [view, level, hasSummary])
```

- 메뉴와 카드 부분:

```tsx
      {narrow && <DashboardMenu level={level} />}
      {level === 'minor' ? (
        // shortcut: 16d 전까지 소분류는 main의 카드를 그대로 보여준다. 16d에서 소분류 분포·추이로 바꾼다.
        <SubcategoryTrends groupId={groupId} month={month} />
      ) : (
        <>
          <div id="dashboard-share">
            {summary && <CategoryBreakdown key={`${groupId}:${month}`} groupId={groupId} month={month} summary={summary} />}
          </div>
          <div id="dashboard-trend">
            <CategoryTrend groupId={groupId} month={month} />
          </div>
        </>
      )}
```

`narrow` prop은 메뉴에만 쓰인다. 나머지는 그대로 둔다.

- [ ] **Step 4: Run tests to verify they pass**

Run (`apps/web`): `npx vitest run src/dashboard src/app`
Expected: PASS. `AppRoutes.test.tsx`의 좁은 화면 테스트(`/dashboard/major/share`에서 `소분류`를 누르면 포커스 유지)도 통과해야 한다.

- [ ] **Step 5: Commit (컨트롤러, 저장소 루트에서)**

Codex 구현자는 커밋하지 않는다. 컨트롤러가 확인한 뒤 커밋한다(`Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>`).

```bash
git add apps/web/src/dashboard/dashboardRoute.ts apps/web/src/dashboard/dashboardRoute.test.ts \
  apps/web/src/dashboard/DashboardMenu.tsx apps/web/src/dashboard/DashboardMenu.test.tsx \
  apps/web/src/dashboard/DashboardPage.tsx apps/web/src/dashboard/DashboardPage.test.tsx
git commit -m "feat(web): 좁은 화면 대시보드 메뉴를 대분류·소분류 두 탭으로"
```

---

### Task 2: 창 머리 아이콘 버튼과 소분류 보기

**Files:**
- Modify: `apps/web/src/common/Icon.tsx` (아이콘 `chart` 추가)
- Modify: `apps/web/src/common/ui.module.css` (`.iconButton` 추가)
- Modify: `apps/web/src/dashboard/CategoryTransactionsDialog.tsx`
- Modify: `apps/web/src/dashboard/MemberTotalsDialog.tsx`
- Modify: `apps/web/src/dashboard/SubcategoryTrends.tsx`
- Modify: `apps/web/src/dashboard/DashboardPage.tsx`
- Test: `apps/web/src/dashboard/CategoryTransactionsDialog.test.tsx`, `apps/web/src/dashboard/SubcategoryTrends.test.tsx`, `apps/web/src/dashboard/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `DashboardPage`/`SummaryView` 구조.
- Produces: `SubcategoryTrends({ groupId, month, initialMajor }: { groupId: number; month: string; initialMajor?: string })`. 아이콘 이름 `'chart'`. CSS 클래스 `ui.iconButton`.

- [ ] **Step 1: Write the failing tests**

`CategoryTransactionsDialog.test.tsx`의 `describe` 안에 더한다(`renderPage`가 `MemoryRouter`를 준다).

```tsx
  it('shows icon buttons for the minor screen and closing', async () => {
    const onClose = vi.fn()
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])))
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={onClose} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    const minors = within(dialog).getByRole('button', { name: '식비 소분류 보기' })
    const close = within(dialog).getByRole('button', { name: '닫기' })
    expect(minors).toHaveTextContent('')
    expect(close).toHaveTextContent('')
    expect(minors.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(close.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(minors.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
```

`DashboardPage.test.tsx`의 `describe('DashboardPage', …)` 안에 더한다.

```tsx
  it('opens the minor screen for a category from its transactions dialog', async () => {
    server.use(
      http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)),
      http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([])),
      http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([
        { month: '2026-10', major: '교통', minor: '택시', expense: 5000 },
        { month: '2026-10', major: '식비', minor: '외식', expense: 30000 },
      ])),
    )
    const { user } = renderDashboard('/dashboard/major?month=2026-10')
    await user.click(await screen.findByRole('button', { name: '식비 80% ₩ 200,000' }))
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    await user.click(within(dialog).getByRole('button', { name: '식비 소분류 보기' }))

    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent(/^\/dashboard\/minor\?/))
    const url = new URL(screen.getByRole('status', { name: '현재 주소' }).textContent!, 'http://test')
    expect(url.searchParams.get('month')).toBe('2026-10')
    expect(url.searchParams.get('major')).toBe('식비')
    expect(screen.getByRole('status', { name: '이동 방식' })).toHaveTextContent('PUSH')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const section = await screen.findByRole('region', { name: '소분류 추이·분포' })
    expect(await within(section).findByRole('heading', { name: '식비 소분류 월별 추이' })).toBeInTheDocument()
  })

  it('shows member totals with an icon close button', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    const { user } = renderDashboard('/dashboard/major?month=2026-10')
    await user.click(await screen.findByRole('button', { name: '수입 ₩ 3,000,000' }))
    const dialog = await screen.findByRole('dialog', { name: '멤버별 수입' })
    const close = within(dialog).getByRole('button', { name: '닫기' })
    expect(close).toHaveTextContent('')
    expect(close.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    await user.click(close)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
```

`SubcategoryTrends.test.tsx`의 `describe` 안에 더한다.

```tsx
  it('starts from the major given by the address and falls back when it is missing', async () => {
    server.use(http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([
      { month: '2026-10', major: '식비', minor: '외식', expense: 30000 },
      { month: '2026-10', major: '교통', minor: '택시', expense: 50000 },
    ])))
    renderPage(<SubcategoryTrends groupId={10} month="2026-10" initialMajor="식비" />)
    const section = await screen.findByRole('region', { name: '소분류 추이·분포' })
    expect(await within(section).findByRole('heading', { name: '식비 소분류 월별 추이' })).toBeInTheDocument()
  })

  it('shows the selection hint when the address names an unknown major', async () => {
    server.use(http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([
      { month: '2026-10', major: '식비', minor: '외식', expense: 30000 },
    ])))
    renderPage(<SubcategoryTrends groupId={10} month="2026-10" initialMajor="없는분류" />)
    const section = await screen.findByRole('region', { name: '소분류 추이·분포' })
    expect(await within(section).findByText('대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.')).toBeInTheDocument()
  })
```

`SubcategoryTrends.test.tsx`가 `SubcategoryTrends`를 이미 import하는지 확인하고, 없으면 `import SubcategoryTrends from './SubcategoryTrends'`를 더한다. `CategoryTransactionsDialog.test.tsx`의 `vi` import도 확인한다(이미 있다).

- [ ] **Step 2: Run tests to verify they fail**

Run (`apps/web`): `npx vitest run src/dashboard`
Expected: FAIL. `식비 소분류 보기` 버튼이 없고, `닫기` 버튼에 글자가 있고, `initialMajor`를 무시한다.

- [ ] **Step 3: Implement**

`common/Icon.tsx`의 `ICONS`에 `x` 아래로 더한다. Lucide `chart-column` 경로다(lucide-static 1.61.0, 머리말 주석의 규칙대로 경로만 옮긴다).

```tsx
  chart: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
```

`common/ui.module.css`의 `.button:disabled` 줄 아래에 더한다.

```css
.iconButton { width: 40px; padding: 0; }
```

`CategoryTransactionsDialog.tsx`:

```tsx
import { useNavigate } from 'react-router'
import Icon from '../common/Icon'
```

컴포넌트 안(`total` 계산 아래):

```tsx
  const navigate = useNavigate()
  // 대분류에서 한 단계 들어가는 이동이라 push한다. 뒤로가기로 대분류 화면에 돌아온다.
  const showMinors = () => {
    onClose()
    navigate(`/dashboard/minor?${new URLSearchParams({ month, major: displayedCategory ?? '' })}`)
  }
```

`headerAction`:

```tsx
      closeOnOutsideClick wide headerAction={
        <div className={ui.row}>
          <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label={`${displayedCategory} 소분류 보기`} onClick={showMinors}>
            <Icon name="chart" />
          </button>
          <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label="닫기" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
      }>
```

`MemberTotalsDialog.tsx`: `import Icon from '../common/Icon'`을 더하고 `headerAction`을 바꾼다.

```tsx
      closeOnOutsideClick headerAction={
        <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label="닫기" onClick={onClose}>
          <Icon name="x" />
        </button>
      }>
```

`SubcategoryTrends.tsx`:

```tsx
export default function SubcategoryTrends({ groupId, month, initialMajor }: { groupId: number; month: string; initialMajor?: string }) {
  const [selected, setSelected] = useState(initialMajor ?? '')
```

`DashboardPage.tsx`: `SummaryView`에 `major?: string` prop을 더해 `SubcategoryTrends`에 넘긴다.

```tsx
      <SummaryView key={selectedGroupId} groupId={selectedGroupId} month={month} summary={summary.data}
        level={level} view={params.view as View | undefined} narrow={narrow} major={search.get('major') ?? undefined} />
```

```tsx
function SummaryView({ groupId, month, summary, level, view, narrow, major }: {
  groupId: number; month: string; summary?: MonthlySummary; level: Level; view?: View; narrow: boolean; major?: string
}) {
```

```tsx
        <SubcategoryTrends groupId={groupId} month={month} initialMajor={major} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run (`apps/web`): `npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 통과. lint는 기존 `CoverageSection` 경고 1건뿐이다. 기존 `닫기`를 누르는 테스트(`CategoryTransactionsDialog.test.tsx`, `DashboardPage.test.tsx`의 멤버별 창)도 `aria-label`로 그대로 통과해야 한다.

- [ ] **Step 5: Commit (컨트롤러, 저장소 루트에서)**

Codex 구현자는 커밋하지 않는다. 컨트롤러가 확인한 뒤 커밋한다(`Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>`).

```bash
git add apps/web/src/common/Icon.tsx apps/web/src/common/ui.module.css \
  apps/web/src/dashboard/CategoryTransactionsDialog.tsx apps/web/src/dashboard/CategoryTransactionsDialog.test.tsx \
  apps/web/src/dashboard/MemberTotalsDialog.tsx apps/web/src/dashboard/SubcategoryTrends.tsx \
  apps/web/src/dashboard/SubcategoryTrends.test.tsx apps/web/src/dashboard/DashboardPage.tsx \
  apps/web/src/dashboard/DashboardPage.test.tsx
git commit -m "feat(web): 대시보드 창에 X 닫기와 소분류 보기 아이콘 버튼"
```

---

## 마무리

- 브랜치 최종 리뷰: opus 최종 리뷰어와 `.claude/skills/codex-collab/codex-run.sh review main .superpowers/sdd/2026-10-30-plan-16e-dashboard-two-tabs/codex-final-review.md`를 함께 돌리고 수정은 한 번에 맡긴다.
- 실제 앱 검증(`/verify`): 좁은 폭(375)과 넓은 폭(1280)에서 확인한다.
  - `/dashboard` → `/dashboard/major`, 좁은 화면에 탭 두 개와 두 카드.
  - 탭 이동이 replace인지(`history.length` 그대로).
  - 식비 거래 창의 차트 버튼 → `/dashboard/minor?month=…&major=식비`, `history.length` +1, 임시 카드가 식비를 고른 상태. 뒤로가기 → `/dashboard/major?month=…`.
  - 멤버별 창의 X 닫기.
- 전후 스크린샷(좁은 폭 대시보드, 거래 창 머리)을 `.verify-artifacts/preview-16e/`에 남겨 사용자에게 보낸다.
- `/maintain-verification-skill`로 `.claude/skills/verify/features/dashboard.md`·`navigation.md`를 고친다.
- 후속 기록 `docs/superpowers/plans/2026-10-30-plan-16e-followups.md`에 확인한 것과 미룬 것을 적는다.
