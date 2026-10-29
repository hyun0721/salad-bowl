# Plan 16c 대시보드 주소·하위 메뉴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드를 `/dashboard/:level(/:view)` 주소로 나누고, 넓은 화면은 사이드바 하위 메뉴, 좁은 화면은 2줄 링크 메뉴로 이동하게 한다. 이번에는 대분류 두 화면만 새로 나누고, 소분류는 main의 `SubcategoryTrends` 카드를 임시로 보여준다.

**Architecture:** 라우트 하나(`dashboard/:level?/:view?`)가 `DashboardPage`를 그린다. 주소 판정은 순수 함수 `dashboardRedirect`가 하고, 맞지 않는 주소는 `<Navigate replace>`로 바꾼다. 월은 `?month=`에 둔다. 넓은 화면은 분포·추이 카드를 함께, 좁은 화면은 고른 카드만 보이고 나머지는 `hidden`으로 마운트를 유지해 상태(추이 칩·기간)를 지킨다.

**Tech Stack:** React 19, react-router 8.4 (`useParams`, `useSearchParams`, `Navigate`, `Link`, `NavLink`), TanStack Query 5, CSS Modules, Vitest + Testing Library + MSW.

**설계:** [메뉴 개편 설계](../specs/2026-10-29-menu-restructure-design.md) 3·6·8·9장.

## Global Constraints

- 웹과 모바일이 같은 주소를 쓴다. 폭 기준은 `useMediaQuery('(max-width: 820px)')`(`common/useMediaQuery`)이고 좁은 화면은 ≤820px다.
- 주소 표(설계 3장):
  - `/dashboard` → 넓은 화면 `/dashboard/major`, 좁은 화면 `/dashboard/major/share` (replace).
  - `/dashboard/:level` (`major`|`minor`) → 넓은 화면은 분포+추이, 좁은 화면은 `/dashboard/:level/share`로 replace.
  - `/dashboard/:level/:view` (`share`|`trend`) → 넓은 화면은 `/dashboard/:level`과 같은 화면이고 `:view` 카드로 스크롤, 좁은 화면은 그 화면 하나만.
  - 그 밖의 `level`·`view`는 `/dashboard`와 같이 처리한다. 바꿀 때 지금 `search`(`?month=`)를 유지한다.
- 월: `?month=YYYY-MM`. 없거나 형식이 틀리면 `defaultYearMonth(today)`. 월 선택을 바꾸면 `month`를 주소에 replace로 쓴다.
- 하위 메뉴 이동(대분류↔소분류, 분포↔추이)은 `replace`이고 지금 `search`를 붙인다.
- 포커스: `FocusHeadingOnRouteChange`는 경로 첫 마디(`/dashboard`, `/upload` …)가 바뀔 때만 제목으로 옮긴다. 하위 메뉴를 누르면 포커스가 그 링크에 남는다.
- 페이지 제목: 좁은 화면 `그룹 대시보드 · 대분류 분포`/`… · 대분류 추이`/`… · 소분류 분포`/`… · 소분류 추이`, 넓은 화면 `그룹 대시보드 · 대분류`/`… · 소분류`. `usePageTitle`이 ` · Salad Bowl`을 붙인다.
- 메뉴 문구: 사이드바 하위 항목 `대분류`(`/dashboard/major`), `소분류`(`/dashboard/minor`). 좁은 화면 `<nav aria-label="대시보드 메뉴">`, 그 안 `role="group"` 두 줄 `aria-label="분류"`([대분류 | 소분류]), `aria-label="보기"`([분포 | 추이]).
- 하단 탭은 5개 그대로, `children`을 무시한다.
- 소분류(임시): `/dashboard/minor`(모든 view)는 main의 `SubcategoryTrends` 카드를 그대로 보여준다. 16d에서 소분류 분포·추이로 바꾼다.
- 공통 영역(설계 6.1): 제목 `그룹 대시보드`, `MonthPicker`, 안내 문구, 수입·지출 버튼과 `MemberTotalsDialog`는 모든 하위 화면 위에 그대로 둔다.
- UI는 기존 토큰과 `src/common/` 부품을 우선한다. `react-aria-components`는 `src/common/` 밖에서 직접 쓰지 않는다.
- 최종 검증: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `apps/web/src/app/menu.ts` | `MenuItem.children` 추가, 대시보드에 대분류·소분류 |
| `apps/web/src/app/AppLayout.tsx` (+ `.module.css`) | 사이드바 하위 링크, 포커스는 첫 마디 변경 때만 |
| `apps/web/src/app/AppRoutes.tsx` | `dashboard/:level?/:view?` |
| `apps/web/src/common/format.ts` | `isYearMonth` 추가, `MonthPicker`·`CoverageSection`의 정규식 복사본을 이것으로 |
| `apps/web/src/dashboard/dashboardRoute.ts` (+ test) | `Level`, `View`, `dashboardRedirect`, `dashboardTitle` |
| `apps/web/src/dashboard/DashboardPage.tsx` (+ test) | 주소·월 연결, 화면 나누기, 스크롤 |
| `apps/web/src/dashboard/DashboardMenu.tsx` (+ `.module.css`, test) | 좁은 화면 2줄 링크 메뉴 |

---

### Task 1: 사이드바 하위 메뉴와 첫 마디 포커스

**담당:** Codex gpt-6-sol / medium

**Files:**
- Modify: `apps/web/src/app/menu.ts`
- Modify: `apps/web/src/app/AppLayout.tsx`, `apps/web/src/app/AppLayout.module.css`
- Test: `apps/web/src/app/AppRoutes.test.tsx`

**Interfaces:**
- Produces: `MenuItem` = `{ to: string; label: string; shortLabel: string; icon: IconName; end: boolean; children?: { to: string; label: string }[] }`. 대시보드 항목 `children: [{ to: '/dashboard/major', label: '대분류' }, { to: '/dashboard/minor', label: '소분류' }]`.

- [ ] **Step 1: 실패하는 테스트 쓰기** — `AppRoutes.test.tsx`의 넓은 화면 `describe('AppRoutes')`에 추가한다.

```tsx
it('shows dashboard sub-links under the dashboard menu', async () => {
  signedIn([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
  renderApp('/')
  const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
  expect(within(nav).getAllByRole('link').map((l) => l.textContent))
    .toEqual(['홈', '그룹 대시보드', '대분류', '소분류', '거래 목록', '업로드', '그룹 관리'])
  expect(within(nav).getByRole('link', { name: '대분류' })).toHaveAttribute('href', '/dashboard/major')
  expect(within(nav).getByRole('link', { name: '소분류' })).toHaveAttribute('href', '/dashboard/minor')
})
```

포커스 규칙은 기존 테스트 `moves focus to the new page heading after navigating`(넓은 화면)과 `moves focus to the new screen title after switching tabs`(좁은 화면)가 주 메뉴 이동 쪽을 지킨다. 첫 마디가 같은 이동에서 포커스가 링크에 남는 것은 라우트가 생긴 뒤 Task 3에서 시험한다.

- [ ] **Step 2: 실패 확인** — `cd apps/web && npx vitest run src/app/AppRoutes.test.tsx` → 하위 링크 테스트 FAIL(`대분류` 링크 없음).

- [ ] **Step 3: 구현**

`menu.ts`:
```ts
export type MenuItem = {
  to: string; label: string; shortLabel: string; icon: IconName; end: boolean
  // 사이드바에서만 들여 써서 그린다. 하단 탭은 무시한다.
  children?: { to: string; label: string }[]
}
// 대시보드 항목:
{ to: '/dashboard', label: '그룹 대시보드', shortLabel: '대시보드', icon: 'dashboard', end: false,
  children: [{ to: '/dashboard/major', label: '대분류' }, { to: '/dashboard/minor', label: '소분류' }] },
```

`AppLayout.tsx` 사이드바: 각 `item` 뒤에 `item.children`을 그린다. 대시보드 안에서 누를 때는 형제 이동이므로 `replace`와 지금 `search`를 쓴다.
```tsx
const location = useLocation()
const inDashboard = location.pathname.startsWith('/dashboard')
// MENU.map 안, 부모 NavLink 다음:
{item.children?.map((child) => (
  <NavLink key={child.to} to={inDashboard ? child.to + location.search : child.to} replace={inDashboard}
    className={({ isActive }) => `${styles.link} ${styles.subLink}${isActive ? ` ${styles.active}` : ''}`}>
    {child.label}
  </NavLink>
))}
```
`MENU.map`의 반환을 `<Fragment key={item.to}>`로 감싼다.

`AppLayout.module.css`: `.subLink { padding-left: calc(var(--space-3) + 20px + var(--space-2)); font-size: var(--text-sm); }` (부모 링크의 아이콘(`Icon` 기본 20px)과 간격만큼 들여 써서 글자를 맞춘다.)

`FocusHeadingOnRouteChange`: 비교를 경로 전체에서 첫 마디로 바꾼다. 제목이 아직 없으면(리다이렉트 중이라 `<Navigate>`만 그려진 경우) 기록을 바꾸지 않아 다음 경로 변화에서 다시 시도한다.
```tsx
const firstSegment = (pathname: string) => pathname.split('/')[1] ?? ''
// ...
const lastSegment = useRef(firstSegment(location.pathname))
useEffect(() => {
  // 주 메뉴가 바뀔 때만 새 화면 제목으로 포커스를 옮긴다(스크린리더가 바뀐 화면을 읽도록). 하위 메뉴 이동은 링크에 포커스를 남긴다.
  const segment = firstSegment(location.pathname)
  if (lastSegment.current === segment) return
  const heading = mainRef.current?.querySelector('h1')
  if (!heading) return // /dashboard → /dashboard/major 같은 리다이렉트 중에는 제목이 없다.
  lastSegment.current = segment
  heading.setAttribute('tabindex', '-1')
  heading.focus()
}, [location.pathname, mainRef])
```

- [ ] **Step 4: 통과 확인** — `npx vitest run src/app` → PASS. 기존 포커스 테스트 두 개(넓은·좁은)도 통과해야 한다.

- [ ] **Step 5: 커밋(컨트롤러)** — `feat(web): 사이드바에 대시보드 하위 메뉴 추가`

---

### Task 2: 대시보드 주소·월·화면 나누기

**담당:** Codex gpt-6-sol / medium

**Files:**
- Create: `apps/web/src/dashboard/dashboardRoute.ts`, `apps/web/src/dashboard/dashboardRoute.test.ts`
- Modify: `apps/web/src/dashboard/DashboardPage.tsx`, `apps/web/src/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/app/AppRoutes.tsx`
- Modify: `apps/web/src/common/format.ts`, `apps/web/src/common/MonthPicker.tsx`, `apps/web/src/imports/CoverageSection.tsx`

**Interfaces:**
- Consumes: Task 1의 `MENU` (변경 없음).
- Produces (`dashboardRoute.ts`):
  - `export type Level = 'major' | 'minor'`, `export type View = 'share' | 'trend'`
  - `export function dashboardRedirect(level: string | undefined, view: string | undefined, narrow: boolean): string | null` — 바꿀 경로(`search` 없이) 또는 `null`(그대로 그림).
  - `export function dashboardTitle(level: Level, view: View, narrow: boolean): string`
- Produces (`format.ts`): `export function isYearMonth(value: string | null | undefined): value is string`
- `DashboardPage`는 `{ today?: Date }` 그대로. 좁은 화면 메뉴 자리는 공통 영역 바로 아래(수입·지출 버튼과 "합칠 거래가 없습니다" 문구 다음, 카드 앞)다. Task 3이 `<DashboardMenu level view />`를 그 자리에 넣는다.

- [ ] **Step 1: 실패하는 테스트 쓰기**

`dashboardRoute.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { dashboardRedirect, dashboardTitle } from './dashboardRoute'

describe('dashboardRedirect', () => {
  it.each([
    // [level, view, narrow, expected]
    [undefined, undefined, false, '/dashboard/major'],
    [undefined, undefined, true, '/dashboard/major/share'],
    ['major', undefined, false, null],
    ['minor', undefined, true, '/dashboard/minor/share'],
    ['major', 'trend', false, null],
    ['minor', 'share', true, null],
    ['oops', undefined, false, '/dashboard/major'],
    ['major', 'oops', true, '/dashboard/major/share'],
    ['oops', 'trend', false, '/dashboard/major'],
  ] as const)('%s/%s narrow=%s → %s', (level, view, narrow, expected) => {
    expect(dashboardRedirect(level, view, narrow)).toBe(expected)
  })
})

describe('dashboardTitle', () => {
  it('names the sub-screen', () => {
    expect(dashboardTitle('major', 'share', true)).toBe('그룹 대시보드 · 대분류 분포')
    expect(dashboardTitle('minor', 'trend', true)).toBe('그룹 대시보드 · 소분류 추이')
    expect(dashboardTitle('major', 'trend', false)).toBe('그룹 대시보드 · 대분류')
    expect(dashboardTitle('minor', 'share', false)).toBe('그룹 대시보드 · 소분류')
  })
})
```

`DashboardPage.test.tsx`: 렌더를 라우트 안에서 하도록 바꾼다. 파일 위에 도우미를 두고 기존 테스트의 `renderPage(<DashboardPage today={today} />, { groups: [group] })`를 `renderDashboard()`로 바꾼다(기존 단언은 그대로 둔다). 기존 테스트는 넓은 화면 `/dashboard/major`에서 지금과 같은 카드(카테고리별 지출, 대분류별 추이)를 보아야 한다. `SubcategoryTrends`(`소분류 추이·분포`)는 이제 대분류 화면에 없다.

```tsx
import { Route, Routes, useLocation } from 'react-router'
import { mockViewport } from '../test/mockViewport'

function Where() {
  const { pathname, search } = useLocation()
  return <output aria-label="현재 주소">{pathname + search}</output>
}

function renderDashboard(path = '/dashboard/major') {
  return renderPage(
    <Routes>
      <Route path="/dashboard/:level?/:view?" element={<><DashboardPage today={today} /><Where /></>} />
    </Routes>,
    { groups: [group], path },
  )
}
```

새 테스트(넓은 화면, 기존 `describe` 안):
```tsx
it('redirects /dashboard to the major screen and keeps the month', async () => {
  server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json({ ...summary, month: '2026-08' })))
  renderDashboard('/dashboard?month=2026-08')
  await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major?month=2026-08'))
  expect(await screen.findByRole('region', { name: '카테고리별 지출' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '대분류별 추이' })).toBeInTheDocument()
  expect(document.title).toBe('그룹 대시보드 · 대분류 · Salad Bowl')
})

it('reads the month from the address and writes it back when the month changes', async () => {
  const months: string[] = []
  server.use(http.get('*/api/groups/10/summary', ({ request }) => {
    const month = new URL(request.url).searchParams.get('month')!
    months.push(month)
    return HttpResponse.json({ ...summary, month })
  }))
  const { user } = renderDashboard('/dashboard/major?month=2026-08')
  await screen.findByRole('button', { name: /^수입/ })
  expect(months).toEqual(['2026-08'])
  await user.click(screen.getByRole('button', { name: '이전 달' }))
  await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major?month=2026-07'))
})

it('falls back to last month for a malformed month', async () => {
  const months: string[] = []
  server.use(http.get('*/api/groups/10/summary', ({ request }) => {
    months.push(new URL(request.url).searchParams.get('month')!)
    return HttpResponse.json(summary)
  }))
  renderDashboard('/dashboard/major?month=2026-13')
  await screen.findByRole('button', { name: /^수입/ })
  expect(months).toEqual(['2026-10'])
})

it('shows the temporary subcategory card on the minor screen', async () => {
  server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
  renderDashboard('/dashboard/minor')
  expect(await screen.findByRole('region', { name: '소분류 추이·분포' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '카테고리별 지출' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^수입/ })).toBeInTheDocument()
})
```
(`<output>`의 역할은 `status`다. 이름은 `aria-label`로 찾는다. 업로드 테스트의 `주소 검색어` 탐침과 같은 방식이다.)

새 `describe('DashboardPage on a narrow screen')`(`beforeEach(() => { mockViewport(true) })`):
```tsx
it('redirects a level address to its share screen', async () => {
  server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
  renderDashboard('/dashboard/major?month=2026-10')
  await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major/share?month=2026-10'))
  expect(await screen.findByRole('region', { name: '카테고리별 지출' })).toBeVisible()
  expect(screen.queryByRole('region', { name: '대분류별 추이' })).not.toBeInTheDocument() // hidden이라 접근성 트리에 없다
  expect(document.title).toBe('그룹 대시보드 · 대분류 분포 · Salad Bowl')
})

it('shows only the trend card on the trend screen', async () => {
  server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
  renderDashboard('/dashboard/major/trend')
  expect(await screen.findByRole('region', { name: '대분류별 추이' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '카테고리별 지출' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^지출/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/dashboard` → `dashboardRoute` 모듈 없음, 주소 테스트 FAIL.

- [ ] **Step 3: 구현**

`format.ts`에 추가하고, `MonthPicker.tsx`·`CoverageSection.tsx`의 `const MONTH = …`를 지우고 `isYearMonth(x)`로 바꾼다(동작 같음).
```ts
export function isYearMonth(value: string | null | undefined): value is string {
  return value != null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}
```

`dashboardRoute.ts`:
```ts
export type Level = 'major' | 'minor'
export type View = 'share' | 'trend'

const LEVELS: readonly string[] = ['major', 'minor']
const VIEWS: readonly string[] = ['share', 'trend']
const LEVEL_LABEL: Record<Level, string> = { major: '대분류', minor: '소분류' }
const VIEW_LABEL: Record<View, string> = { share: '분포', trend: '추이' }

/** 설계 3장 주소 표. 그대로 그릴 주소면 null, 아니면 바꿀 경로(search 제외). */
export function dashboardRedirect(level: string | undefined, view: string | undefined, narrow: boolean): string | null {
  const validLevel = level !== undefined && LEVELS.includes(level)
  const validView = view === undefined || VIEWS.includes(view)
  if (!validLevel || !validView) return narrow ? '/dashboard/major/share' : '/dashboard/major'
  if (narrow && view === undefined) return `/dashboard/${level}/share`
  return null
}

export function dashboardTitle(level: Level, view: View, narrow: boolean): string {
  return narrow ? `그룹 대시보드 · ${LEVEL_LABEL[level]} ${VIEW_LABEL[view]}` : `그룹 대시보드 · ${LEVEL_LABEL[level]}`
}
```

`AppRoutes.tsx`: `<Route path="dashboard" …>`를 `<Route path="dashboard/:level?/:view?" element={<DashboardPage />} />`로 바꾼다.

`DashboardPage.tsx` (모든 훅은 조기 반환 전에 부른다):
```tsx
export default function DashboardPage({ today }: Props) {
  const params = useParams()
  const [search, setSearch] = useSearchParams()
  const { search: rawSearch } = useLocation()
  const narrow = useMediaQuery('(max-width: 820px)')
  const redirect = dashboardRedirect(params.level, params.view, narrow)
  const level = (params.level ?? 'major') as Level
  const view = (params.view ?? 'share') as View
  const requested = search.get('month')
  const month = isYearMonth(requested) ? requested : defaultYearMonth(today ?? new Date())
  usePageTitle(dashboardTitle(level, view, narrow))
  const { groups, selectedGroupId, isLoading, isError, retry } = useGroups()
  const summary = useQuery({ /* 지금과 같음, month만 위 값 */ })
  const groupName = …

  if (redirect) return <Navigate to={redirect + rawSearch} replace />
  // 이하 그룹 로딩·오류·없음 처리는 지금과 같다.
  // MonthPicker: onChange={(m) => setSearch((p) => { p.set('month', m); return p }, { replace: true })}
  // <SummaryView … level={level} view={params.view as View | undefined} narrow={narrow} />
}
```

`SummaryView`: 공통 영역(수입·지출, 빈 달 문구, `MemberTotalsDialog`)은 그대로 위에 두고, 카드 부분을 바꾼다. 좁은 화면에서는 고르지 않은 카드를 `hidden`으로 숨겨 마운트를 유지한다(추이의 칩·기간이 분포↔추이 이동에도 남도록).
```tsx
{/* Task 3: 좁은 화면 메뉴 자리 */}
{level === 'minor' ? (
  // shortcut: 16d 전까지 소분류는 main의 카드를 그대로 보여준다. 16d에서 소분류 분포·추이로 바꾼다.
  <SubcategoryTrends groupId={groupId} month={month} />
) : (
  <>
    <div id="dashboard-share" hidden={narrow && shownView !== 'share'}>
      {summary && <CategoryBreakdown key={`${groupId}:${month}`} groupId={groupId} month={month} summary={summary} />}
    </div>
    <div id="dashboard-trend" hidden={narrow && shownView !== 'trend'}>
      <CategoryTrend groupId={groupId} month={month} />
    </div>
  </>
)}
```
여기서 `shownView = view ?? 'share'`(좁은 화면은 리다이렉트로 늘 view가 있다).

넓은 화면에서 `view`가 주소에 있으면 그 카드로 스크롤한다:
```tsx
useEffect(() => {
  if (narrow || !view) return
  // jsdom에는 scrollIntoView가 없다.
  document.getElementById(`dashboard-${view}`)?.scrollIntoView?.({ block: 'start' })
}, [narrow, view, level])
```

- [ ] **Step 4: 통과 확인** — `npx vitest run src/dashboard src/app src/common src/imports` → PASS.

- [ ] **Step 5: 커밋(컨트롤러)** — `feat(web): 대시보드를 주소로 나누고 월을 주소에 두기`

---

### Task 3: 좁은 화면 대시보드 메뉴

**담당:** Codex gpt-6-sol / medium

**Files:**
- Create: `apps/web/src/dashboard/DashboardMenu.tsx`, `apps/web/src/dashboard/DashboardMenu.module.css`, `apps/web/src/dashboard/DashboardMenu.test.tsx`
- Modify: `apps/web/src/dashboard/DashboardPage.tsx` (메뉴 자리에 넣기, `narrow`일 때만)
- Test: `apps/web/src/dashboard/DashboardPage.test.tsx` (좁은 화면 describe에 이동·포커스 테스트)

**Interfaces:**
- Consumes: Task 2의 `Level`, `View` (`./dashboardRoute`).
- Produces: `export default function DashboardMenu({ level, view }: { level: Level; view: View })`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`DashboardMenu.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import DashboardMenu from './DashboardMenu'

describe('DashboardMenu', () => {
  it('links to sibling screens and keeps the search', () => {
    render(<MemoryRouter initialEntries={['/dashboard/major/trend?month=2026-08']}><DashboardMenu level="major" view="trend" /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: '대시보드 메뉴' })
    const levels = within(nav).getByRole('group', { name: '분류' })
    const views = within(nav).getByRole('group', { name: '보기' })
    expect(within(levels).getByRole('link', { name: '대분류' })).toHaveAttribute('aria-current', 'page')
    expect(within(levels).getByRole('link', { name: '소분류' })).toHaveAttribute('href', '/dashboard/minor/trend?month=2026-08')
    expect(within(views).getByRole('link', { name: '추이' })).toHaveAttribute('aria-current', 'page')
    expect(within(views).getByRole('link', { name: '분포' })).toHaveAttribute('href', '/dashboard/major/share?month=2026-08')
    expect(within(views).getByRole('link', { name: '분포' })).not.toHaveAttribute('aria-current')
  })
})
```

`DashboardPage.test.tsx` 좁은 화면 describe에 추가(`renderDashboard`와 `Where` 재사용). 이동이 replace인지는 `MemoryRouter` 기록 길이를 볼 수 없으므로, 뒤로 가기 대신 `useNavigationType()`이 `REPLACE`인지 탐침으로 본다:
```tsx
// Where 옆에 둔다
function NavType() { return <output aria-label="이동 방식">{useNavigationType()}</output> }
// renderDashboard의 element에 <NavType />도 넣는다.

it('switches sub-screens in place, keeps the month and leaves focus on the link', async () => {
  server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
  const { user } = renderDashboard('/dashboard/major/share?month=2026-10')
  const nav = await screen.findByRole('navigation', { name: '대시보드 메뉴' })
  const trend = within(nav).getByRole('link', { name: '추이' })
  await user.click(trend)
  await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major/trend?month=2026-10'))
  expect(screen.getByRole('status', { name: '이동 방식' })).toHaveTextContent('REPLACE')
  expect(within(screen.getByRole('navigation', { name: '대시보드 메뉴' })).getByRole('link', { name: '추이' })).toHaveFocus()
  expect(await screen.findByRole('region', { name: '대분류별 추이' })).toBeInTheDocument()
})
```

`AppRoutes.test.tsx` 좁은 화면 describe에 앱 전체 포커스 확인을 하나 더한다(Task 1의 첫 마디 규칙이 실제 라우트에서 동작하는지):
```tsx
it('keeps focus on the dashboard menu link when switching sub-screens', async () => {
  signedIn([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
  server.use(
    http.get('*/api/groups/10/summary', () => HttpResponse.json({ month: '2026-10', income: 0, expense: 0, byCategory: [], byMember: [] })),
    http.get('*/api/groups/10/summary/trend', () => HttpResponse.json({ months: [], categories: [] })),
    http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([])),
  )
  renderApp('/dashboard/major/share')
  const user = userEvent.setup()
  const menu = await screen.findByRole('navigation', { name: '대시보드 메뉴' })
  await user.click(within(menu).getByRole('link', { name: '소분류' }))
  await waitFor(() => expect(within(screen.getByRole('navigation', { name: '대시보드 메뉴' })).getByRole('link', { name: '소분류' })).toHaveFocus())
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus()
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/dashboard src/app` → `DashboardMenu` 없음 FAIL.

- [ ] **Step 3: 구현**

`DashboardMenu.tsx`:
```tsx
import { Link, useLocation } from 'react-router'
import type { Level, View } from './dashboardRoute'
import styles from './DashboardMenu.module.css'

const LEVELS: [Level, string][] = [['major', '대분류'], ['minor', '소분류']]
const VIEWS: [View, string][] = [['share', '분포'], ['trend', '추이']]

/** 좁은 화면의 대시보드 하위 메뉴. 화면을 바꾸는 이동이라 라디오가 아니라 링크이고, 형제 화면이므로 replace다. */
export default function DashboardMenu({ level, view }: { level: Level; view: View }) {
  const { search } = useLocation()
  const row = <T extends string>(label: string, items: [T, string][], current: T, to: (id: T) => string) => (
    <div role="group" aria-label={label} className={styles.group}>
      {items.map(([id, text]) => (
        <Link key={id} to={to(id) + search} replace aria-current={id === current ? 'page' : undefined} className={styles.link}>
          {text}
        </Link>
      ))}
    </div>
  )
  return (
    <nav aria-label="대시보드 메뉴" className={styles.menu}>
      {row('분류', LEVELS, level, (l) => `/dashboard/${l}/${view}`)}
      {row('보기', VIEWS, view, (v) => `/dashboard/${level}/${v}`)}
    </nav>
  )
}
```

`DashboardMenu.module.css` (`common/SegmentedControl.module.css`와 같은 생김새, 칸을 반씩 나눈다):
```css
.menu { display: grid; gap: var(--space-2); }
.group { display: flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
.link { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 var(--space-4); background: var(--surface-000); color: var(--ink); text-decoration: none; }
.link[aria-current='page'] { background: var(--brand); color: var(--on-brand); font-weight: 700; }
.link:focus-visible { outline: 2px solid var(--brand); outline-offset: -4px; }
```

`DashboardPage.tsx`의 Task 2 메뉴 자리: `{narrow && <DashboardMenu level={level} view={view ?? 'share'} />}`.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/dashboard src/app` → PASS. 그다음 `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`.

- [ ] **Step 5: 커밋(컨트롤러)** — `feat(web): 좁은 화면에 대시보드 하위 메뉴 추가`

---

## 마무리(컨트롤러)

- 실제 앱 검증: `/verify`로 넓은 폭·좁은 폭(375px)에서 `/dashboard` 리다이렉트, 하위 메뉴 이동(분포↔추이, 대분류↔소분류), 월 유지, 뒤로가기(대시보드에 들어오기 전 화면으로)를 확인한다.
- 미리보기: 바뀐 화면의 전·후 스크린숏을 결과와 함께 보낸다. "전" 화면은 Task 1 시작 전에 같은 검증 스택에서 찍어 둔다(별도 main 서버를 띄우지 않는다).
- `/maintain-verification-skill`로 `.claude/skills/verify/features/dashboard.md`·`navigation.md`를 새 주소와 메뉴에 맞게 고친다.
