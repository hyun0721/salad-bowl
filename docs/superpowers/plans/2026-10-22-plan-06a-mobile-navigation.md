# Plan 06a: 모바일 내비게이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 820px 이하 화면에서 왼쪽 사이드바 대신 하단 탭 바를 보여주고, 상단 바를 한 줄로 줄이고, 닉네임과 로그아웃은 계정 시트로 옮긴다.

**Architecture:** 폭 판단은 기존 `useMediaQuery('(max-width: 820px)')`로 하고, `AppLayout`이 폭에 따라 사이드바나 하단 탭 바 중 하나만 렌더한다. CSS로만 숨기면 jsdom 테스트에서 링크가 두 벌 잡히기 때문이다. 탭은 react-router `NavLink`로 만들고, 시트와 표시선 애니메이션은 RAC(`Sheet`, `SelectionIndicator`)를 `common/` 래퍼로 감싸서 쓴다.

**Tech Stack:** React 19, react-router 8, react-aria-components 1.22.1, CSS Modules, Vitest + Testing Library + MSW

**Spec:** `docs/superpowers/specs/2026-10-22-react-aria-rollout-design.md` 3장

## Global Constraints

- 시각 디자인은 바꾸지 않는다. 색·간격·radius는 `apps/web/src/styles/tokens.css`의 변수만 쓴다. 예외: 4px 이하의 장식 치수(시트 손잡이, 탭 표시선의 두께·radius, 아이콘과 글자 사이 2px)와 터치 영역 높이(44px, 56px)는 숫자로 쓴다.
- `react-aria-components`는 `apps/web/src/common/`에서만 import한다. 화면·앱 코드는 `common/`의 래퍼만 쓴다.
- 모바일 폭 기준은 `(max-width: 820px)`이다. 폭 판단은 `common/useMediaQuery.ts`의 `useMediaQuery`를 쓴다.
- 새 npm 패키지를 설치하지 않는다.
- 하단 탭 항목의 터치 영역은 높이 56px(48px 이상), 탭 바 아래에는 `env(safe-area-inset-bottom)` 여백을 둔다.
- 하단 탭은 `<nav aria-label="주 메뉴">` 안의 링크다. `role="tablist"`를 쓰지 않는다. 현재 화면 링크에만 `aria-current="page"`가 있다(`NavLink`가 넣는다).
- 탭 이름: 홈, 대시보드, 거래, 업로드, 그룹. 사이드바 이름(홈, 그룹 대시보드, 거래 목록, 업로드, 그룹 관리)은 바꾸지 않는다.
- 애니메이션은 `prefers-reduced-motion: reduce`이면 끈다.
- 주석은 한국어로, 주변 코드처럼 "왜"만 짧게 쓴다.
- 각 Task 끝에 `apps/web`에서 `npm run typecheck && npm test && npm run lint`가 통과해야 한다. Task 3과 Task 4 끝에는 `npm run build`도 돌린다.
- 검사 명령은 `apps/web`에서, `git add`/`git commit`은 **저장소 루트에서** 실행한다(커밋 블록의 경로는 루트 기준이다).

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/web/src/test/mockViewport.ts` (새로) | 테스트에서 `matchMedia`를 모킹해 모바일 폭/넓은 폭을 정한다 |
| `apps/web/src/test/setup.ts` (수정) | 테스트마다 전역 스텁 정리, jsdom에 없는 `scrollTo` 보충 |
| `apps/web/src/common/BottomSheet.tsx` + `.module.css` + `.test.tsx` (새로) | RAC `Sheet` 래퍼. 아이콘 버튼을 누르면 하단 시트가 열린다. 단계 2·3에서도 쓴다 |
| `apps/web/src/common/SelectionIndicator.tsx` (새로) | RAC `SharedElementTransition` + `SelectionIndicator` 래퍼 |
| `apps/web/src/common/Icon.tsx` (수정) | `user` 아이콘 추가 |
| `apps/web/src/app/menu.ts` (새로) | 메뉴 목록(사이드바와 하단 탭이 같이 쓴다) |
| `apps/web/src/app/BottomTabBar.tsx` + `.module.css` + `.test.tsx` (새로) | 하단 탭 바 |
| `apps/web/src/app/AccountSheet.tsx` (새로) | 계정 시트 내용(닉네임, 로그아웃, 로그아웃 실패 문구) |
| `apps/web/src/app/AppLayout.tsx` + `.module.css` (수정) | 폭에 따라 사이드바/하단 탭, 상단 바 분기 |
| `apps/web/src/common/Select.module.css` (수정) | 트리거가 좁은 폭에서 줄어들게 |
| `apps/web/src/app/AppRoutes.test.tsx` (수정) | 모바일 폭 시나리오 추가 |
| `apps/web/index.html` (수정) | `viewport-fit=cover` |
| `docs/ui-library-poc.md` (수정) | 번들 크기 한 줄 추가 |

---

### Task 1: 테스트 도우미와 BottomSheet

**Files:**
- Create: `apps/web/src/test/mockViewport.ts`
- Modify: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/common/BottomSheet.tsx`, `apps/web/src/common/BottomSheet.module.css`
- Test: `apps/web/src/common/BottomSheet.test.tsx`
- Modify: `apps/web/src/common/Icon.tsx` (`user` 아이콘)

**Interfaces:**
- Consumes: `Icon`, `IconName` (`common/Icon.tsx`)
- Produces:
  - `mockViewport(narrow: boolean): { set(next: boolean): void }` — `test/mockViewport.ts`의 named export
  - `BottomSheet` default export, props `{ title: string; triggerLabel: string; triggerIcon: IconName; triggerClassName?: string; children: (opts: { close: () => void }) => ReactNode }`
  - `IconName`에 `'user'` 추가

- [ ] **Step 1: `user` 아이콘 추가**

`apps/web/src/common/Icon.tsx`의 `ICONS`에 Lucide `user` 경로를 넣는다(파일 상단 주석 규칙 그대로, `users` 바로 다음):

```tsx
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
```

- [ ] **Step 2: 테스트 도우미 작성**

`apps/web/src/test/mockViewport.ts`:

```ts
import { vi } from 'vitest'

/**
 * jsdom에는 matchMedia가 없어 useMediaQuery가 늘 넓은 폭으로 본다.
 * 모바일 폭을 시험할 때 부르고, set으로 폭이 바뀐 것처럼 알린다. 정리는 setup.ts가 한다.
 */
export function mockViewport(narrow: boolean) {
  let current = narrow
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query === '(max-width: 820px)' && current },
    media: query,
    addEventListener: (_type: string, listener: () => void) => { listeners.add(listener) },
    removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener) },
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })))
  return {
    set(next: boolean) {
      current = next
      listeners.forEach((listener) => listener())
    },
  }
}
```

`apps/web/src/test/setup.ts`:
- import 줄을 `import { afterAll, afterEach, beforeAll, vi } from 'vitest'`로 바꾼다.
- `afterEach` 안의 `cleanup()` 다음 줄에 `vi.unstubAllGlobals()`를 넣는다.
- `beforeAll` 줄 위에 다음을 넣는다. RAC `Sheet`는 마운트할 때 `IntersectionObserver`·`matchMedia`를 만들고 `scrollTo` 뒤 `scrollend`를 기다리며(`node_modules/react-aria-components/dist/private/Sheet.mjs` 130·220·745줄 근처), `SelectionIndicator`는 `getAnimations()`를 부른다(`SharedElementTransition.mjs` 41~61줄). jsdom에는 넷 다 없다.

```ts
// jsdom에 없는 브라우저 API를 RAC Sheet·SelectionIndicator가 쓸 수 있을 만큼만 채운다(테스트 전용).
// 기본은 넓은 폭이다. 모바일 폭은 test/mockViewport.ts로 바꾼다(vi.stubGlobal이라 테스트마다 원래대로 돌아온다).
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  })
}
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  } as unknown as typeof IntersectionObserver
}
if (!Element.prototype.scrollTo) {
  // 스크롤이 바로 끝난 것처럼 scrollend를 보낸다. RAC Sheet가 열림·닫힘 완료를 이 이벤트로 안다.
  Element.prototype.scrollTo = function scrollTo(this: Element) {
    setTimeout(() => this.dispatchEvent(new Event('scrollend')), 0)
  }
}
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
```

이 보충만으로 Step 3 테스트(열기, 내용 안 버튼으로 닫기, Esc로 닫기)를 통과시킬 수 없으면, RAC 내부 동작을 더 흉내 내지 말고 보고서에 `NEEDS_CONTEXT`와 막힌 지점(어느 줄에서 무엇을 기다리는지)을 쓰고 멈춘다. 컨트롤러가 테스트 범위(예: 닫기는 브라우저 확인으로 넘기기)를 정한다.

- [ ] **Step 3: BottomSheet 실패 테스트 작성**

`apps/web/src/common/BottomSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import BottomSheet from './BottomSheet'

function renderSheet() {
  const user = userEvent.setup()
  render(
    <BottomSheet title="계정" triggerLabel="계정" triggerIcon="user">
      {({ close }) => (
        <>
          <p>나</p>
          <button type="button" onClick={close}>닫기</button>
        </>
      )}
    </BottomSheet>,
  )
  return user
}

describe('BottomSheet', () => {
  it('opens a titled dialog from an icon button and closes it from its content', async () => {
    const user = renderSheet()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '계정' }))

    const dialog = await screen.findByRole('dialog', { name: '계정' })
    expect(dialog).toHaveTextContent('나')
    await user.click(screen.getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes with Escape and returns focus to the trigger', async () => {
    const user = renderSheet()
    const trigger = screen.getByRole('button', { name: '계정' })
    await user.click(trigger)
    await screen.findByRole('dialog', { name: '계정' })

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
})
```

- [ ] **Step 4: 실패 확인**

Run (in `apps/web`): `npx vitest run src/common/BottomSheet.test.tsx`
Expected: FAIL — `Failed to resolve import "./BottomSheet"`

- [ ] **Step 5: BottomSheet 구현**

먼저 `node_modules/react-aria-components/dist/types/src/Sheet.d.ts`와 `Dialog.d.ts`에서 `SheetTrigger`, `SheetOverlay`, `SheetBackdrop`, `Sheet`, `SheetContent`의 props와, `SheetContent`(= `DialogProps`)의 `children`이 `({ close }) => ReactNode`를 받는지 확인한다. 아래 코드와 다르면 타입 정의를 따르고 보고서에 적는다.

`apps/web/src/common/BottomSheet.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Button, Heading, Sheet, SheetBackdrop, SheetContent, SheetOverlay, SheetTrigger } from 'react-aria-components'
import Icon, { type IconName } from './Icon'
import styles from './BottomSheet.module.css'

type Props = {
  title: string
  triggerLabel: string
  triggerIcon: IconName
  triggerClassName?: string
  children: (opts: { close: () => void }) => ReactNode
}

/** 아이콘 버튼으로 여는 하단 시트. 아래로 쓸거나 Esc·바깥을 누르면 닫힌다. */
export default function BottomSheet({ title, triggerLabel, triggerIcon, triggerClassName, children }: Props) {
  return (
    <SheetTrigger>
      <Button aria-label={triggerLabel} className={triggerClassName ?? styles.trigger}>
        <Icon name={triggerIcon} />
      </Button>
      <SheetOverlay className={styles.overlay}>
        <SheetBackdrop className={styles.backdrop} />
        <Sheet className={styles.sheet}>
          <SheetContent className={styles.content}>
            {({ close }) => (
              <>
                <span className={styles.handle} aria-hidden="true" />
                <Heading slot="title" className={styles.title}>{title}</Heading>
                {children({ close })}
              </>
            )}
          </SheetContent>
        </Sheet>
      </SheetOverlay>
    </SheetTrigger>
  )
}
```

`apps/web/src/common/BottomSheet.module.css`:

```css
.trigger { flex: none; display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); color: var(--ink); cursor: pointer; }
.trigger[data-focus-visible] { outline: 2px solid var(--brand); outline-offset: 2px; }
.overlay { z-index: 20; }
.backdrop { background: var(--overlay); }
.sheet { background: var(--surface-000); border-radius: var(--radius-lg) var(--radius-lg) 0 0; max-height: 70vh; max-height: 70dvh; padding-bottom: env(safe-area-inset-bottom); }
.content { display: flex; flex-direction: column; gap: var(--space-3); padding: 0 max(var(--space-4), env(safe-area-inset-left, 0px)) var(--space-4); outline: none; }
.handle { align-self: center; width: 36px; height: 4px; margin: var(--space-2) 0; border-radius: 2px; background: var(--line); }
.title { margin: 0; font-size: 18px; }
```

RAC가 시트 위치를 인라인 스타일과 스크롤로 직접 잡으므로, 위치(`position`, `top`, `bottom`, `transform`)는 CSS로 덮어쓰지 않는다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/common/BottomSheet.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`
Expected: 모두 통과

```bash
git add apps/web/src/test apps/web/src/common/BottomSheet.tsx apps/web/src/common/BottomSheet.module.css apps/web/src/common/BottomSheet.test.tsx apps/web/src/common/Icon.tsx
git commit -m "feat(web): BottomSheet wrapper around React Aria Sheet"
```

---

### Task 2: 메뉴 목록 분리와 하단 탭 바

**Files:**
- Create: `apps/web/src/app/menu.ts`
- Create: `apps/web/src/common/SelectionIndicator.tsx`
- Create: `apps/web/src/app/BottomTabBar.tsx`, `apps/web/src/app/BottomTabBar.module.css`
- Test: `apps/web/src/app/BottomTabBar.test.tsx`
- Modify: `apps/web/src/app/AppLayout.tsx:10-16` (MENU를 `menu.ts`에서 가져오기)

**Interfaces:**
- Consumes: `Icon`, `IconName`
- Produces:
  - `MENU: MenuItem[]`, `type MenuItem = { to: string; label: string; shortLabel: string; icon: IconName; end: boolean }` — `app/menu.ts`
  - `IndicatorGroup` (props `{ children: ReactNode }`), `Indicator` (props `{ isSelected: boolean; className?: string }`) — `common/SelectionIndicator.tsx`의 named export
  - `BottomTabBar` default export, props 없음

- [ ] **Step 1: 메뉴 목록 분리**

`apps/web/src/app/menu.ts`:

```ts
import type { IconName } from '../common/Icon'

export type MenuItem = { to: string; label: string; shortLabel: string; icon: IconName; end: boolean }

// 사이드바는 label, 좁은 화면의 하단 탭은 shortLabel을 쓴다.
export const MENU: MenuItem[] = [
  { to: '/', label: '홈', shortLabel: '홈', icon: 'home', end: true },
  { to: '/dashboard', label: '그룹 대시보드', shortLabel: '대시보드', icon: 'dashboard', end: false },
  { to: '/transactions', label: '거래 목록', shortLabel: '거래', icon: 'receipt', end: false },
  { to: '/upload', label: '업로드', shortLabel: '업로드', icon: 'sheet-upload', end: false },
  { to: '/groups', label: '그룹 관리', shortLabel: '그룹', icon: 'users', end: false },
]
```

`apps/web/src/app/AppLayout.tsx`에서 `const MENU ...` 블록(10-16줄)을 지우고 `import { MENU } from './menu'`를 넣는다. `IconName` import가 쓰이지 않게 되면 `import Icon from '../common/Icon'`으로 줄인다.

Run: `npx vitest run src/app` → 기존 테스트가 그대로 통과해야 한다.

- [ ] **Step 2: 하단 탭 바 실패 테스트 작성**

`apps/web/src/app/BottomTabBar.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import BottomTabBar from './BottomTabBar'

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>,
  )
  return screen.getByRole('navigation', { name: '주 메뉴' })
}

describe('BottomTabBar', () => {
  it('shows five short-named links', () => {
    const nav = renderAt('/')
    const names = within(nav).getAllByRole('link').map((link) => link.textContent)
    expect(names).toEqual(['홈', '대시보드', '거래', '업로드', '그룹'])
  })

  it('marks only the current screen', () => {
    const nav = renderAt('/transactions')
    expect(within(nav).getByRole('link', { name: '거래' })).toHaveAttribute('aria-current', 'page')
    for (const name of ['홈', '대시보드', '업로드', '그룹']) {
      expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('moves the current mark and the indicator to the tab the user picks', async () => {
    const user = userEvent.setup()
    const nav = renderAt('/')
    const indicatorOwners = () => within(nav).getAllByRole('link')
      .filter((link) => link.querySelector('[data-indicator]'))
      .map((link) => link.textContent)
    expect(indicatorOwners()).toEqual(['홈'])

    await user.click(within(nav).getByRole('link', { name: '업로드' }))

    expect(within(nav).getByRole('link', { name: '업로드' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current')
    expect(indicatorOwners()).toEqual(['업로드'])
  })

  it('keeps home current only on the home path', () => {
    const nav = renderAt('/groups')
    expect(within(nav).getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('link', { name: '그룹' })).toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/app/BottomTabBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./BottomTabBar"`

- [ ] **Step 4: 표시선 래퍼 구현**

먼저 `node_modules/react-aria-components/dist/types/src/SelectionIndicator.d.ts`와 `SharedElementTransition.d.ts`에서 `SharedElementTransition`이 DOM 요소를 만드는지(만들면 nav의 grid 배치가 깨진다)와 `SelectionIndicator`의 `isSelected` prop을 확인한다. 아래와 다르면 타입을 따르고 보고서에 적는다.

`apps/web/src/common/SelectionIndicator.tsx`:

```tsx
import type { ReactNode } from 'react'
import { SelectionIndicator, SharedElementTransition } from 'react-aria-components'

/** 이 안의 Indicator들 중 선택된 것으로 표시선이 미끄러져 옮겨 간다. */
export function IndicatorGroup({ children }: { children: ReactNode }) {
  return <SharedElementTransition>{children}</SharedElementTransition>
}

// data-indicator는 테스트가 표시선 위치를 찾는 표식이다.
export function Indicator({ isSelected, className }: { isSelected: boolean; className?: string }) {
  return <SelectionIndicator isSelected={isSelected} className={className} data-indicator="" />
}
```

- [ ] **Step 5: 하단 탭 바 구현**

`apps/web/src/app/BottomTabBar.tsx`:

```tsx
import { NavLink } from 'react-router'
import Icon from '../common/Icon'
import { Indicator, IndicatorGroup } from '../common/SelectionIndicator'
import { MENU } from './menu'
import styles from './BottomTabBar.module.css'

/** 좁은 화면의 주 메뉴. 화면 이동 링크이므로 탭(tablist)이 아니라 nav 안의 링크다. */
export default function BottomTabBar() {
  return (
    <nav aria-label="주 메뉴" className={styles.bar}>
      <IndicatorGroup>
        {MENU.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}>
            {({ isActive }) => (
              <>
                <Indicator isSelected={isActive} className={styles.indicator} />
                <Icon name={item.icon} size={22} />
                <span>{item.shortLabel}</span>
              </>
            )}
          </NavLink>
        ))}
      </IndicatorGroup>
    </nav>
  )
}
```

`apps/web/src/app/BottomTabBar.module.css`:

```css
.bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); background: var(--surface-000); border-top: 1px solid var(--line); }
.tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 56px; color: var(--ink-muted); font-size: 12px; line-height: 16px; text-decoration: none; }
.active { color: var(--brand); font-weight: 700; }
.tab:focus-visible { outline: 2px solid var(--brand); outline-offset: -4px; }
.indicator { position: absolute; top: 0; left: 25%; right: 25%; height: 3px; border-radius: 0 0 3px 3px; background: var(--brand); transition: translate 200ms ease-out, width 200ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  .indicator { transition: none; }
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/app/BottomTabBar.test.tsx`
Expected: PASS (4 tests)

`SelectionIndicator`가 선택되지 않은 링크에서도 요소를 남기면(`isSelected=false`인데 DOM에 있음) 테스트의 `indicatorOwners`가 다섯 개를 돌려준다. 그때는 `Indicator`가 `isSelected`일 때만 렌더하도록 바꾸지 말고, 먼저 RAC 소스에서 숨김 방식(`data-*` 속성 등)을 확인해 테스트 조건을 그 속성으로 바꾸고 보고서에 적는다. 실제 미끄러지는 애니메이션과 reduced-motion은 jsdom에서 확인할 수 없으므로 Task 4의 브라우저 확인 항목이다.

- [ ] **Step 7: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`
Expected: 모두 통과

```bash
git add apps/web/src/app/menu.ts apps/web/src/app/BottomTabBar.tsx apps/web/src/app/BottomTabBar.module.css apps/web/src/app/BottomTabBar.test.tsx apps/web/src/common/SelectionIndicator.tsx apps/web/src/app/AppLayout.tsx
git commit -m "feat(web): bottom tab bar for narrow screens"
```

---

### Task 3: AppLayout 모바일 분기와 계정 시트

**Files:**
- Create: `apps/web/src/app/AccountSheet.tsx`
- Modify: `apps/web/src/app/AppLayout.tsx`, `apps/web/src/app/AppLayout.module.css`
- Modify: `apps/web/src/common/Select.module.css` (좁은 상단 바에서 줄어들 수 있게)
- Modify: `apps/web/index.html:5`
- Test: `apps/web/src/app/AppRoutes.test.tsx` (새 `describe` 추가)

**Interfaces:**
- Consumes: `BottomSheet`, `mockViewport` (Task 1), `MENU`, `BottomTabBar` (Task 2), `useMediaQuery` (`common/useMediaQuery.ts`)
- Produces: `AccountSheet` default export, props `{ nickname: string; onLogout: () => void; logoutFailed: boolean }`

- [ ] **Step 1: 모바일 폭 실패 테스트 작성**

`apps/web/src/app/AppRoutes.test.tsx` 맨 위 import에 `import { mockViewport } from '../test/mockViewport'`를 더하고, 파일 끝에 다음 `describe`를 추가한다(`renderApp`, `signedIn`은 같은 파일의 기존 함수다):

```tsx
describe('AppRoutes on a narrow screen', () => {
  beforeEach(() => { mockViewport(true) })

  it('shows the bottom tab bar instead of the sidebar', async () => {
    signedIn([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
    renderApp('/')

    const navs = await screen.findAllByRole('navigation', { name: '주 메뉴' })
    expect(navs).toHaveLength(1)
    const names = within(navs[0]).getAllByRole('link').map((link) => link.textContent)
    expect(names).toEqual(['홈', '대시보드', '거래', '업로드', '그룹'])
    expect(within(navs[0]).getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page')
    // 닉네임과 로그아웃은 상단 바에 없고 계정 시트 안에 있다.
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계정' })).toBeInTheDocument()
  })

  it('moves focus to the new screen title after switching tabs', async () => {
    signedIn([])
    renderApp('/')
    const user = userEvent.setup()

    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
    await user.click(within(nav).getByRole('link', { name: '그룹' }))

    expect(await screen.findByRole('heading', { level: 1, name: '그룹 관리' })).toHaveFocus()
  })

  it('signs out from the account sheet', async () => {
    signedIn([])
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '계정' }))
    const sheet = await screen.findByRole('dialog', { name: '계정' })
    expect(sheet).toHaveTextContent('나')
    await user.click(within(sheet).getByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('keeps the sheet open with an alert when logout fails', async () => {
    signedIn([])
    server.use(http.post('*/api/auth/logout', () =>
      HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 })))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '계정' }))
    const sheet = await screen.findByRole('dialog', { name: '계정' })
    await user.click(within(sheet).getByRole('button', { name: '로그아웃' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })
})
```

기존 로그아웃 실패 테스트(135줄 근처)가 쓰는 실패 응답 형태와 다르면 그 테스트의 응답을 그대로 쓴다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/AppRoutes.test.tsx`
Expected: 새 테스트 중 링크 이름·계정 버튼을 보는 3개는 FAIL(링크 이름이 사이드바 이름, `계정` 버튼 없음), 제목 포커스 테스트는 사이드바 링크 '그룹 관리'가 없어 FAIL. 기존 테스트는 PASS

- [ ] **Step 3: 계정 시트 구현**

`apps/web/src/app/AccountSheet.tsx`:

```tsx
import BottomSheet from '../common/BottomSheet'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'

type Props = { nickname: string; onLogout: () => void; logoutFailed: boolean }

/** 좁은 화면에서 닉네임과 로그아웃을 담는다. 실패 문구도 시트 안에 보여야 시트에 가려지지 않는다. */
export default function AccountSheet({ nickname, onLogout, logoutFailed }: Props) {
  return (
    <BottomSheet title="계정" triggerLabel="계정" triggerIcon="user">
      {() => (
        <>
          <p>{nickname}</p>
          <button type="button" className={ui.button} onClick={onLogout}>
            <Icon name="log-out" size={18} />로그아웃
          </button>
          {logoutFailed && <p role="alert" className={ui.alert}>로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
        </>
      )}
    </BottomSheet>
  )
}
```

- [ ] **Step 4: AppLayout 분기 구현**

`apps/web/src/app/AppLayout.tsx`:
- import 추가: `import { useMediaQuery } from '../common/useMediaQuery'`, `import AccountSheet from './AccountSheet'`, `import BottomTabBar from './BottomTabBar'`
- 컴포넌트 첫 줄 근처에 `const narrow = useMediaQuery('(max-width: 820px)')`
- 반환하는 JSX를 다음으로 바꾼다. 그룹 영역(`isLoading ? … : …`)은 지금 코드를 그대로 `groupArea` 변수로 옮겨 두 곳에서 쓴다.

```tsx
  const groupArea = isLoading ? (
    <span className={styles.groupState}>그룹 불러오는 중</span>
  ) : isError ? (
    <span className={styles.groupState}>
      그룹을 불러오지 못했습니다{' '}
      <button type="button" className={styles.logout} onClick={retry}>다시 시도</button>
    </span>
  ) : groups.length > 0 ? (
    <Select label="그룹" items={groups.map((g) => ({ id: g.groupId, label: g.name }))}
      selectedKey={selectedGroupId} onSelectionChange={(key) => { if (key != null) selectGroup(Number(key)) }} />
  ) : (
    <Link to="/groups" className={styles.noGroup}>그룹 없음 · 만들기 또는 초대받기</Link>
  )

  return (
    <div className={styles.shell}>
      {!narrow && (
        <nav aria-label="주 메뉴" className={styles.nav}>
          <span className={styles.logo}><img src="/logo.svg" alt="" width="28" height="28" />Salad Bowl</span>
          {MENU.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
              <Icon name={item.icon} />{item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <div className={styles.main}>
        <header className={styles.header}>
          {narrow && <img src="/logo.svg" alt="Salad Bowl" width="28" height="28" className={styles.headerLogo} />}
          {narrow ? <div className={styles.groupSlot}>{groupArea}</div> : groupArea}
          {narrow ? (
            <AccountSheet nickname={me?.nickname ?? ''} onLogout={onLogout} logoutFailed={logoutError} />
          ) : (
            <div className={styles.user}>
              <span>{me?.nickname}</span>
              <button type="button" className={styles.logout} onClick={onLogout}><Icon name="log-out" size={18} />로그아웃</button>
            </div>
          )}
        </header>
        {logoutError && !narrow && (
          <p role="alert" className={styles.logoutError}>로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        )}
        <SlowServerNotice />
        <main ref={mainRef} className={narrow ? `${styles.content} ${styles.withTabBar}` : styles.content}>
          <Outlet />
        </main>
      </div>
      {narrow && <BottomTabBar />}
    </div>
  )
```

`apps/web/src/app/AppLayout.module.css`:
- `@media (max-width: 820px)` 블록에서 `.nav`와 `.logo` 규칙 두 줄을 지운다(좁은 화면에서는 사이드바를 렌더하지 않는다). `.header, .content` 규칙은 남긴다.
- 같은 블록에 다음을 더한다:

```css
  .header { flex-wrap: nowrap; padding-top: max(var(--space-3), env(safe-area-inset-top, 0px)); padding-bottom: var(--space-3); }
```

- 파일 끝에 다음을 더한다:

```css
.headerLogo { flex: none; }
/* 좁은 상단 바에서 그룹 영역이 남는 폭을 다 쓰고, 넘치면 그룹 이름을 말줄임한다. */
.groupSlot { flex: 1; min-width: 0; display: flex; }
/* 하단 탭 바(56px)와 안전 영역만큼 본문 끝을 띄워 마지막 내용이 가려지지 않게 한다. */
.withTabBar { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + var(--space-8)); }
```

`apps/web/src/common/Select.module.css`도 고친다. 지금 `.trigger`는 `max-width: 240px`만 있어서 내용보다 작게 줄지 않는다.
- `.select` 규칙 끝에 `max-width: 100%;`를 더한다.
- `.trigger` 규칙에 `min-width: 0; flex: 0 1 auto;`를 더한다(`max-width: 240px`는 그대로).

계정 버튼은 `BottomSheet`의 `.trigger`에 `flex: none`이 있어서 줄지 않는다(Task 1).

- [ ] **Step 5: viewport-fit**

`apps/web/index.html` 5줄을 다음으로 바꾼다:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/app`
Expected: 새 4개 포함 모두 PASS

- [ ] **Step 7: 전체 확인, 빌드, 기록**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 통과. 번들 크기 기록은 Task 4 마지막에 한다(브라우저 확인에서 고친 코드까지 반영하기 위해).

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src/app apps/web/src/common/Select.module.css apps/web/index.html
git commit -m "feat(web): bottom tabs and account sheet on narrow screens"
```

---

### Task 4: 브라우저 확인과 기록 (컨트롤러가 직접)

확인 중 문제가 나오면 해당 Task 구현자에게 수정을 맡기고, 고친 뒤 이 Task의 Step 5부터 다시 한다.

- [ ] **Step 1: 임시 미리보기 페이지** (커밋하지 않는다)

API 없이 로그인한 레이아웃을 보려고 `fetch`를 가짜 응답으로 바꾼 페이지를 만든다. 실제 `AppLayout`과 `GroupProvider`를 그대로 쓰고, 화면 다섯 개는 긴 더미 본문이다.

`apps/web/preview.html`:

```html
<!doctype html>
<html lang="ko"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" /><title>Preview</title></head>
<body><div id="root"></div><script type="module" src="/src/preview.tsx"></script></body></html>
```

`apps/web/src/preview.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from 'react-aria-components'
import { BrowserRouter, Route, Routes } from 'react-router'
import './styles/tokens.css'
import './styles/base.css'
import AppLayout from './app/AppLayout'
import { AuthProvider } from './auth/AuthProvider'
import { GroupProvider } from './groups/GroupProvider'

// ?groups=normal|long|none|error 로 그룹 영역 상태를 바꾼다.
const mode = new URLSearchParams(location.search).get('groups') ?? 'normal'
const groups = mode === 'long'
  ? [{ groupId: 1, name: '대학 동기 제주도 여행 경비 정산 모임', myRole: 'ADMIN', memberCount: 6 }]
  : mode === 'none' ? [] : [{ groupId: 1, name: '우리집', myRole: 'ADMIN', memberCount: 3 }, { groupId: 2, name: '커플 가계부', myRole: 'MEMBER', memberCount: 2 }]
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
window.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.endsWith('/auth/refresh')) return json({ accessToken: 'preview' })
  if (url.endsWith('/me')) return json({ userId: 1, email: 'me@test.com', nickname: '미리보기' })
  if (url.endsWith('/groups')) return mode === 'error' ? json({ code: 'X', message: 'x' }, 500) : json(groups)
  return json([])
}

function Dummy({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      {Array.from({ length: 40 }, (_, i) => <p key={i}>{title} 본문 {i + 1}줄</p>)}
      <p>마지막 줄 — 탭 바에 가리지 않아야 한다</p>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <I18nProvider locale="ko-KR">
      <AuthProvider>
        <BrowserRouter basename="/preview.html">
          <GroupProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Dummy title="홈" />} />
                <Route path="dashboard" element={<Dummy title="그룹 대시보드" />} />
                <Route path="transactions" element={<Dummy title="거래 목록" />} />
                <Route path="upload" element={<Dummy title="업로드" />} />
                <Route path="groups" element={<Dummy title="그룹 관리" />} />
              </Route>
            </Routes>
          </GroupProvider>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>,
)
```

`AuthProvider`·`GroupProvider`의 실제 export 이름과 props가 다르면 `src/test/renderPage.tsx`를 따라 맞춘다. 탭 링크가 `/preview.html`을 벗어나면 `basename`이 먹지 않은 것이니, 그때는 `MemoryRouter`로 바꾼다.

`.claude/launch.json`에 `npm --prefix apps/web run dev`(포트 5173) 설정을 두고 미리보기로 `http://localhost:5173/preview.html`을 연다.

- [ ] **Step 2: 좁은 폭(400×800) 확인**

`?groups=normal`, `long`, `none`, `error` 각각:
- 상단 바가 한 줄이다(로고, 그룹 영역, 계정 버튼). `long`에서 그룹 이름이 말줄임되고 계정 버튼이 밀려나지 않는다.
- 하단 탭 다섯 개가 한 줄이고 현재 탭은 브랜드 색과 표시선이다.

`normal`에서:
- 탭을 차례로 누르면 표시선이 미끄러져 옮겨 가고, 새 화면 제목으로 포커스가 간다.
- 본문을 끝까지 내리면 "마지막 줄"이 탭 바 위에 보인다.
- 계정 버튼을 누르면 시트가 아래에서 올라오고 "미리보기"와 로그아웃이 보인다. Esc, 바깥 누르기, 아래로 끌기로 닫힌다.
- 브라우저 에뮬레이션으로 `prefers-reduced-motion: reduce`를 켜면(가능할 때) 표시선이 애니메이션 없이 옮겨 간다. 에뮬레이션할 수 없으면 확인하지 못한 것으로 기록한다.

- [ ] **Step 3: 넓은 폭(1200×800) 확인**

사이드바와 기존 상단 바(그룹 선택, 닉네임, 로그아웃 버튼)가 그대로이고 하단 탭이 없다.

- [ ] **Step 4: 임시 파일 정리**

`apps/web/preview.html`, `apps/web/src/preview.tsx`, `.claude/launch.json`(이 Task에서 만든 경우)을 지우고 미리보기 서버를 멈춘다. `git status`에 남은 것이 없어야 한다.

- [ ] **Step 5: 최종 검증과 번들 기록**

Run (in `apps/web`): `npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 통과. build 출력의 `dist/assets/index-*.js`와 `index-*.css` 크기를 읽는다.

`docs/ui-library-poc.md`의 번들 표 마지막 줄 다음에 한 줄을 더한다(숫자는 위 build 출력값으로 바꾼다):

```markdown
| + 모바일 내비게이션(Plan 06a: Sheet, SelectionIndicator) | 000.00 kB | **000.00 kB** | 0.00 kB |
```

저장소 루트에서:

```bash
git add docs/ui-library-poc.md
git commit -m "docs: record bundle size after mobile navigation"
```
