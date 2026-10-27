# Plan 13: 샐러드볼 로딩 모션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱 시작 화면과 3초 넘는 요청에서 글자 안내 대신 화면 가운데에 재료가 하나씩 담기는 샐러드볼 모션과 단계별 멘트를 보여준다.

**Architecture:**
- `common/SaladBowlLoader`: 그림·단계·멘트를 맡는다. 시간으로 단계를 올리고, CSS keyframes로 움직인다.
- `common/SaladBowlOverlay`: RAC 모달로 화면을 가리고 로더를 띄운다.
- `app/SlowServerOverlay`: 느린 요청 상태(`useSlowRequests`)를 덮개에 연결해 기존 `SlowServerNotice`를 대신한다.
- `RequireAuth`·`PublicOnly`: loading이면 가운데에 로더를 둔다.

**Tech Stack:** React 19, react-aria-components(`common/`에서만), CSS Modules, Vitest + Testing Library + MSW.

**스펙:** [2026-10-27-salad-bowl-loader-design.md](../specs/2026-10-27-salad-bowl-loader-design.md)

## Global Constraints

- **멘트** (글자 그대로)
  - "신선한 재료 찾는 중이에요"
  - "맛있게 섞는 중이에요"
  - "드레싱 넣는 중이에요"
  - "거의 다 됐어요, 조금만요"
- **단계 시작 시점:** 0초, 8초, 30초, 90초
- **보조 문구:** "오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요" (`slow`일 때만)
- **덮개**
  - 대화상자 이름: `aria-label="서버 준비 중"`
  - z-index 25. 모달(10)·시트(20)보다 위, 토스트(30)보다 아래다.
  - 바깥 클릭·Esc로 닫히지 않는다.
- **완료:** 남은 재료를 120ms 간격으로 담는다. 마지막 재료 뒤 350ms에 `onFinished`를 부른다. 움직임 줄이기면 0ms다.
- **의존성:** 새 의존성을 추가하지 않는다. `react-aria-components`는 `src/common/`에서만 import한다.
- **접근성:** 그림은 `aria-hidden`이다. 멘트와 보조 문구는 `role="status"` 안에 둔다.
- **검증:** `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 | 순서 |
|---|---|---|---|
| 1 `SaladBowlLoader` | Codex `gpt-6-luna` / medium (계획에 코드 전부 있음) | Claude sonnet | 먼저 |
| 2 덮개·시작 화면 연결 | Codex `gpt-6-luna` / medium | Claude sonnet | Task 1 뒤 |
| 최종 | — | Claude opus | 끝 |

---

### Task 1: `SaladBowlLoader`

**담당:** Codex `gpt-6-luna` / medium

**Files:**
- Create: `apps/web/src/common/SaladBowlLoader.tsx`
- Create: `apps/web/src/common/SaladBowlLoader.module.css`
- Test: `apps/web/src/common/SaladBowlLoader.test.tsx`

**Interfaces:**
- Produces: `export default function SaladBowlLoader(props: { slow?: boolean; done?: boolean; onFinished?: () => void })`
  - 루트는 `<div className={styles.loader}>`이다.
  - 담긴 재료 하나마다 `data-piece` 속성이 있는 `<g>`가 하나씩 있다. 드레싱 줄기는 세지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/src/common/SaladBowlLoader.test.tsx`

```tsx
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SaladBowlLoader from './SaladBowlLoader'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

const pieces = (container: HTMLElement) => container.querySelectorAll('[data-piece]').length

it('advances the message and fills the bowl over time', () => {
  const { container } = render(<SaladBowlLoader />)
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('신선한 재료 찾는 중이에요')
  expect(pieces(container)).toBe(1)
  act(() => { vi.advanceTimersByTime(8_000) })
  expect(status).toHaveTextContent('맛있게 섞는 중이에요')
  expect(pieces(container)).toBe(2)
  act(() => { vi.advanceTimersByTime(22_000) })
  expect(status).toHaveTextContent('드레싱 넣는 중이에요')
  expect(pieces(container)).toBe(3)
  act(() => { vi.advanceTimersByTime(60_000) })
  expect(status).toHaveTextContent('거의 다 됐어요, 조금만요')
  expect(pieces(container)).toBe(4)
})

it('hides the drawing and shows the wake-up hint only when slow', () => {
  const { container, rerender } = render(<SaladBowlLoader />)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByText('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요')).not.toBeInTheDocument()
  rerender(<SaladBowlLoader slow />)
  expect(screen.getByRole('status')).toHaveTextContent('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요')
})

it('fills the rest, keeps the message, then calls onFinished when done', () => {
  const onFinished = vi.fn()
  const { container, rerender } = render(<SaladBowlLoader onFinished={onFinished} />)
  rerender(<SaladBowlLoader done onFinished={onFinished} />)
  for (let step = 0; step < 3; step++) act(() => { vi.advanceTimersByTime(120) })
  expect(pieces(container)).toBe(4)
  expect(screen.getByRole('status')).toHaveTextContent('신선한 재료 찾는 중이에요')
  expect(onFinished).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(350) })
  expect(onFinished).toHaveBeenCalledOnce()
  // 완료 중에는 시간 단계가 더 오르지 않는다.
  act(() => { vi.advanceTimersByTime(8_000) })
  expect(screen.getByRole('status')).toHaveTextContent('신선한 재료 찾는 중이에요')
})

it('finishes at once with reduced motion', () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)', media: query,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
  })))
  const onFinished = vi.fn()
  render(<SaladBowlLoader done onFinished={onFinished} />)
  act(() => { vi.advanceTimersByTime(0) })
  expect(onFinished).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/SaladBowlLoader.test.tsx`
Expected: FAIL. `./SaladBowlLoader`를 찾지 못한다.

- [ ] **Step 3: 구현** — `apps/web/src/common/SaladBowlLoader.tsx`

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from './useMediaQuery'
import styles from './SaladBowlLoader.module.css'

const STAGES = [
  { at: 0, message: '신선한 재료 찾는 중이에요' },
  { at: 8_000, message: '맛있게 섞는 중이에요' },
  { at: 30_000, message: '드레싱 넣는 중이에요' },
  { at: 90_000, message: '거의 다 됐어요, 조금만요' },
]
const FILL_STEP_MS = 120
const SETTLE_MS = 350

// 로고(public/logo.svg)의 도형. 배열 순서가 그리는 순서(뒤→앞)이고, step이 담기는 순서다.
// 가운데 잎은 마지막에 담기지만 양옆 잎 뒤에 그려야 로고와 같은 모양이 된다.
const PIECES: { id: string; step: number; pour?: boolean; node: ReactNode }[] = [
  { id: 'center', step: 3, node: <path d="M256 252c-38-36-40-104 0-148 40 44 38 112 0 148z" fill="#2f6b4f" /> },
  { id: 'left', step: 0, node: <path d="M244 256c-52 4-100-34-108-92 58-4 102 34 108 92z" fill="#8fcaa8" /> },
  { id: 'right', step: 1, node: <path d="M268 256c52 4 100-34 108-92-58-4-102 34-108 92z" fill="#5fa57f" /> },
  { id: 'tomato', step: 2, node: <circle cx="330" cy="240" r="30" fill="#ef8a6f" /> },
  { id: 'dressing', step: 2, pour: true, node: <path d="M160 214q30-20 60 0t60 0t60 0t60 0" pathLength={1} fill="none" stroke="#f2c14e" strokeWidth="10" strokeLinecap="round" /> },
]
const LAST = STAGES.length - 1

type Props = { slow?: boolean; done?: boolean; onFinished?: () => void }

export default function SaladBowlLoader({ slow = false, done = false, onFinished }: Props) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [stage, setStage] = useState(0)
  // 완료 때 마저 담은 재료 수. 멘트는 시간 단계만 따른다(완료 중 멘트가 빠르게 바뀌지 않게).
  const [extra, setExtra] = useState(0)
  const filled = Math.min(LAST, stage + extra)

  useEffect(() => {
    if (done) return
    const timers = STAGES.slice(1).map(({ at }, index) => setTimeout(() => setStage((current) => Math.max(current, index + 1)), at))
    return () => timers.forEach(clearTimeout)
  }, [done])

  useEffect(() => {
    if (!done) return
    const timer = !reducedMotion && filled < LAST
      ? setTimeout(() => setExtra((current) => current + 1), FILL_STEP_MS)
      : setTimeout(() => onFinished?.(), reducedMotion ? 0 : SETTLE_MS)
    return () => clearTimeout(timer)
  }, [done, filled, reducedMotion, onFinished])

  const motion = done ? '' : stage === 1 ? styles.stir : stage === LAST ? styles.wait : ''
  return (
    <div className={styles.loader}>
      <svg viewBox="80 72 352 344" width="128" height="125" aria-hidden="true" className={styles.svg}>
        <g className={`${styles.scene} ${motion}`}>
          {/* 이미 담긴 재료가 다시 떨어지지 않도록 key는 재료 id로 고정한다. */}
          {PIECES.filter((piece) => piece.step <= filled).map((piece) => (
            <g key={piece.id} data-piece={piece.pour ? undefined : ''} className={piece.pour ? styles.pour : styles.drop}>{piece.node}</g>
          ))}
          <path d="M96 244h320c0 88-72 152-160 152S96 332 96 244z" fill="#ffffff" stroke="var(--line)" strokeWidth="6" />
          <rect x="200" y="384" width="112" height="24" rx="12" fill="#ffffff" stroke="var(--line)" strokeWidth="6" />
        </g>
      </svg>
      <div role="status" className={styles.text}>
        <p className={styles.message}>{STAGES[stage].message}</p>
        {slow && <p className={styles.hint}>오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요</p>}
      </div>
    </div>
  )
}
```

`apps/web/src/common/SaladBowlLoader.module.css`

```css
.loader { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); text-align: center; }
/* 재료가 viewBox 위에서 떨어져 들어오므로 잘리지 않게 한다. */
.svg { overflow: visible; }
.scene, .drop { transform-box: fill-box; }
.scene { transform-origin: 50% 100%; }
.drop { animation: drop 600ms cubic-bezier(0.3, 1.35, 0.5, 1) both; }
.pour path { stroke-dasharray: 1; animation: pour 700ms ease-out both; }
.stir { animation: stir 700ms ease-in-out; }
.wait { animation: stir 2400ms ease-in-out infinite; }
.text { display: flex; flex-direction: column; gap: var(--space-1); }
.message { margin: 0; font-weight: 600; color: var(--ink); }
.hint { margin: 0; font-size: 13px; color: var(--ink-muted); }
@keyframes drop { from { transform: translateY(-140px); opacity: 0; } 40% { opacity: 1; } to { transform: none; opacity: 1; } }
@keyframes pour { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes stir { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .drop, .pour path { animation: fade 150ms ease-out both; }
  .stir, .wait { animation: none; }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/common/SaladBowlLoader.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 전체 확인 후 커밋** (Codex는 커밋하지 못하므로 컨트롤러가 한다)

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`

```bash
git add apps/web/src/common/SaladBowlLoader.tsx apps/web/src/common/SaladBowlLoader.module.css apps/web/src/common/SaladBowlLoader.test.tsx
git commit -m "feat(web): salad bowl loader with timed stages"
```

---

### Task 2: 덮개와 시작 화면 연결

**담당:** Codex `gpt-6-luna` / medium (Task 1 뒤)

**Files:**
- Create: `apps/web/src/api/useSlowRequests.ts`
- Create: `apps/web/src/common/SaladBowlOverlay.tsx`
- Create: `apps/web/src/common/SaladBowlOverlay.module.css`
- Test: `apps/web/src/common/SaladBowlOverlay.test.tsx`
- Create: `apps/web/src/app/SlowServerOverlay.tsx`
- Test: `apps/web/src/app/SlowServerOverlay.test.tsx` (`SlowServerNotice.test.tsx`를 대신한다)
- Delete: `apps/web/src/app/SlowServerNotice.tsx`, `apps/web/src/app/SlowServerNotice.module.css`, `apps/web/src/app/SlowServerNotice.test.tsx`
- Modify: `apps/web/src/app/RequireAuth.tsx`, `apps/web/src/app/PublicOnly.tsx`, `apps/web/src/app/AppLayout.tsx` (import와 `<SlowServerNotice />` 한 줄씩), `apps/web/src/app/Gate.module.css` (`.loading`)
- Modify test: `apps/web/src/app/AppRoutes.test.tsx:166`

**Interfaces:**
- Consumes: Task 1의 `SaladBowlLoader({ slow, done, onFinished })`
- Produces: `useSlowRequests(): boolean`, `SaladBowlOverlay({ active: boolean })`, `SlowServerOverlay()`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/SaladBowlOverlay.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import SaladBowlOverlay from './SaladBowlOverlay'

it('shows nothing while inactive', () => {
  render(<SaladBowlOverlay active={false} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('opens a blocking dialog with the loader and closes after finishing', async () => {
  const { rerender } = render(<SaladBowlOverlay active />)
  const dialog = screen.getByRole('dialog', { name: '서버 준비 중' })
  expect(dialog).toHaveTextContent('신선한 재료 찾는 중이에요')
  expect(dialog).toHaveTextContent('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요')
  rerender(<SaladBowlOverlay active={false} />)
  // 남은 재료를 담는 동안은 열려 있다.
  expect(screen.getByRole('dialog', { name: '서버 준비 중' })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 2000 })
})
```

`apps/web/src/app/SlowServerOverlay.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiFetch } from '../api/client'
import { server } from '../test/server'
import SlowServerOverlay from './SlowServerOverlay'

describe('SlowServerOverlay', () => {
  it('shows nothing when nothing is slow', () => {
    render(<SlowServerOverlay />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens when mounted during a slow request and closes after it finishes', async () => {
    server.use(http.get('*/api/slow', async () => {
      await delay(3600)
      return HttpResponse.json({})
    }))
    const pending = apiFetch('/slow')
    await delay(3200)

    render(<SlowServerOverlay />)

    expect(screen.getByRole('dialog', { name: '서버 준비 중' })).toHaveTextContent('최대 4분쯤 걸려요')
    await pending
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 2000 })
  }, 15000)
})
```

`apps/web/src/app/AppRoutes.test.tsx` 166줄을 바꾼다. 시작 화면 로더의 보조 문구가 보이고 덮개는 겹치지 않아야 한다.

```tsx
    expect(await screen.findByText('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/SaladBowlOverlay.test.tsx src/app/SlowServerOverlay.test.tsx src/app/AppRoutes.test.tsx`
Expected: FAIL. 새 모듈이 없고, AppRoutes는 보조 문구를 찾지 못한다.

- [ ] **Step 3: 구현**

`apps/web/src/api/useSlowRequests.ts`

```ts
import { useSyncExternalStore } from 'react'
import { isSlow, onSlowRequests } from './client'

/** 지금 3초 넘게 걸리는 요청이 있는지. 마운트할 때 이미 느리면 바로 참이다. */
export function useSlowRequests(): boolean {
  return useSyncExternalStore(onSlowRequests, isSlow)
}
```

`apps/web/src/common/SaladBowlOverlay.tsx`

```tsx
import { useCallback, useState } from 'react'
import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import SaladBowlLoader from './SaladBowlLoader'
import styles from './SaladBowlOverlay.module.css'

/**
 * active인 동안 화면을 가리고 샐러드볼을 보여준다. 바깥 클릭·Esc로 닫히지 않는다.
 * active가 꺼지면 남은 재료를 마저 담은 뒤 닫는다. 그 사이 다시 켜지면 그대로 이어 간다.
 */
export default function SaladBowlOverlay({ active }: { active: boolean }) {
  const [open, setOpen] = useState(active)
  if (active && !open) setOpen(true)
  const close = useCallback(() => setOpen(false), [])
  return (
    <ModalOverlay isOpen={open} isDismissable={false} isKeyboardDismissDisabled className={styles.backdrop}>
      <Modal className={styles.card}>
        <Dialog aria-label="서버 준비 중" className={styles.dialog}>
          <SaladBowlLoader slow done={!active} onFinished={close} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
```

`apps/web/src/common/SaladBowlOverlay.module.css`

```css
/* 모달(10)·시트(20) 위, 토스트(30) 아래. 서버가 깨어나는 동안 저장 중 중복 클릭 같은 조작을 막는다. */
.backdrop { position: fixed; inset: 0; z-index: 25; display: flex; align-items: center; justify-content: center; padding: var(--space-4); background: var(--overlay); }
.card { width: min(320px, 100%); padding: var(--space-6) var(--space-5); background: var(--surface-000); border-radius: var(--radius-lg); box-shadow: 0 8px 32px var(--overlay); }
.dialog { outline: none; }
```

`apps/web/src/app/SlowServerOverlay.tsx`

```tsx
import { useSlowRequests } from '../api/useSlowRequests'
import SaladBowlOverlay from '../common/SaladBowlOverlay'

/** 요청이 3초를 넘으면 화면을 가리고 서버가 깨어나는 동안 기다리게 한다. */
export default function SlowServerOverlay() {
  return <SaladBowlOverlay active={useSlowRequests()} />
}
```

`apps/web/src/app/RequireAuth.tsx` 전체

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSlowRequests } from '../api/useSlowRequests'
import { useAuth } from '../auth/AuthProvider'
import SaladBowlLoader from '../common/SaladBowlLoader'
import styles from './Gate.module.css'
import ServerUnavailable from './ServerUnavailable'
import SlowServerOverlay from './SlowServerOverlay'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  const slow = useSlowRequests()
  // 시작 화면에는 볼이 이미 있으므로 덮개를 겹쳐 띄우지 않는다.
  if (status === 'loading') return <div className={styles.loading}><SaladBowlLoader slow={slow} /></div>
  if (status === 'unavailable') {
    return (
      <>
        <SlowServerOverlay />
        <ServerUnavailable />
      </>
    )
  }
  if (status === 'signedOut') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}
```

`apps/web/src/app/PublicOnly.tsx` 전체

```tsx
import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useSlowRequests } from '../api/useSlowRequests'
import { useAuth } from '../auth/AuthProvider'
import SaladBowlLoader from '../common/SaladBowlLoader'
import { safeNext } from '../common/safeNext'
import styles from './Gate.module.css'
import ServerUnavailable from './ServerUnavailable'
import SlowServerOverlay from './SlowServerOverlay'

// 로그인 화면용 가드. 세션 복원이 끝나기 전에는 로그인 폼을 보여주지 않는다(복원 응답이
// 방금 한 로그인을 덮어써 로그아웃시키는 경합을 막는다). 이미 로그인했다면 되돌아갈 곳으로 보낸다.
// 복원 중에는 가운데 샐러드볼을, 로그인 화면에서 요청이 느리면 덮개를 보여준다.
export default function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [params] = useSearchParams()
  const slow = useSlowRequests()
  if (status === 'signedIn') {
    return <Navigate to={safeNext(params.get('next'))} replace />
  }
  if (status === 'loading') return <div className={styles.loading}><SaladBowlLoader slow={slow} /></div>
  return (
    <>
      <SlowServerOverlay />
      {status === 'unavailable' && <ServerUnavailable />}
      {status === 'signedOut' && children}
    </>
  )
}
```

`apps/web/src/app/AppLayout.tsx`
- `import SlowServerNotice from './SlowServerNotice'`를 `import SlowServerOverlay from './SlowServerOverlay'`로 바꾼다.
- `<SlowServerNotice />`를 `<SlowServerOverlay />`로 바꾼다.

`apps/web/src/app/Gate.module.css`의 `.loading` 줄을 바꾼다.

```css
.loading { display: flex; align-items: center; justify-content: center; box-sizing: border-box; min-height: 100vh; min-height: 100dvh; padding: var(--space-6) var(--space-4); }
```

`SlowServerNotice.tsx`, `SlowServerNotice.module.css`, `SlowServerNotice.test.tsx`를 지운다. `grep -rn SlowServerNotice apps/web/src` 결과가 비어야 한다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/common/SaladBowlOverlay.test.tsx src/app/SlowServerOverlay.test.tsx src/app/AppRoutes.test.tsx`
Expected: PASS

- [ ] **Step 5: 전체 확인 후 커밋** (컨트롤러)

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`

```bash
git add -A apps/web/src
git commit -m "feat(web): salad bowl on the start screen and a blocking overlay for slow requests"
```

---

## 마무리 (컨트롤러)

- Playwright(시스템 Chrome)로 확인한다.
  - 임시 미리보기(커밋하지 않음): 데스크톱·모바일, 밝은·어두운 테마
  - 단계 1·2·3·4와 완료 장면을 찍는다.
  - 덮개가 시트 위에 오고 토스트 아래에 오는지 본다.
- Claude opus 최종 리뷰 후 PR을 올리고 Auto-fix를 켠다.
