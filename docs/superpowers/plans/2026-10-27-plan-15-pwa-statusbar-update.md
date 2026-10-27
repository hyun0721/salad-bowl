# Plan 15: 홈 화면 앱 상태바와 새 버전 알림 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 가지를 고친다.
- iOS 홈 화면 앱에서 상태바 영역이 헤더와 다른 색으로 덮여 보이지 않게 한다.
- 새 버전이 배포되면 화면에 "새 버전이 있어요 · 새로고침" 알림을 띄운다.

**Architecture:**
- **상태바:** CSS와 meta만 바꾼다(`index.html`, `tokens.css`, `base.css`, `AppLayout.module.css`).
- **새 버전 알림:** vite-plugin-pwa를 prompt 방식으로 바꾼다.
  - `app/useAppUpdate.ts`가 `useRegisterSW`를 감싸 주기적으로 확인한다.
  - `app/UpdatePrompt.tsx`가 알림을 그린다.

**Tech Stack:** React 19, vite-plugin-pwa 2.0.0(`virtual:pwa-register/react`), workbox-window 7.4.1, CSS Modules, Vitest.

**스펙:** [2026-10-27-pwa-statusbar-update-design.md](../specs/2026-10-27-pwa-statusbar-update-design.md)

## Global Constraints

- **바꾸는 곳**
  - `apps/web`만 바꾼다.
  - 새 패키지를 설치하지 않는다. `workbox-window`는 이미 설치된 7.4.1을 `devDependencies`에 명시만 하고, `package-lock.json`도 맞춘다.
  - `react-aria-components`는 `src/common/`·테스트·`main.tsx`에서만 쓴다.
- **상태바 색 토큰 `--status-bar`:** 밝은 테마 `var(--brand)`, 어두운 테마 `var(--surface-000)`
- **meta:** `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- **문구:** "새 버전이 있어요", "새로고침", "나중에"
- **확인 주기:** 1시간(3_600_000ms), 그리고 `visibilitychange`로 다시 보일 때
- **검증:** `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 | 순서 |
|---|---|---|---|
| 1 상태바 | Codex `gpt-6-luna` / medium | Claude sonnet | 먼저 |
| 2 새 버전 알림 | Codex `gpt-6-sol` / medium | Claude sonnet | Task 1 뒤 |
| 최종 | — | Claude opus | 끝 |

---

### Task 1: 홈 화면 앱 상태바

**Files:**
- Modify: `apps/web/index.html`(theme-color meta 바로 뒤)
- Modify: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles/base.css`
- Modify: `apps/web/src/app/AppLayout.module.css:13`
- Test: `apps/web/src/styles/tokens.test.ts`(Plan 14에서 생긴 소스 검사 테스트에 이어 쓴다. 없으면 새로 만든다)

- [ ] **Step 1: 실패하는 테스트.** 소스 문자열 검사로 아래를 확인한다.
  - `index.html`에 `apple-mobile-web-app-status-bar-style`이 있고 값이 `black-translucent`다.
  - `tokens.css`의 밝은 블록에 `--status-bar: var(--brand)`가 있고, 어두운 블록 두 곳(`@media` 안, `[data-theme="dark"]`가 있으면 그곳도)에 `--status-bar: var(--surface-000)`이 있다.
  - `base.css`에 `padding-top: env(safe-area-inset-top` 과 `body::before`가 있다.
  - `AppLayout.module.css`에 `safe-area-inset-top`이 더는 없다.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**

`index.html`:

```html
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

`tokens.css`
- 밝은 `:root` 색 블록 끝(`--overlay` 뒤)에 `--status-bar: var(--brand);`를 둔다.
- 어두운 블록마다 `--status-bar: var(--surface-000);`를 둔다.

`base.css`: `body` 규칙에 `padding-top: env(safe-area-inset-top, 0px);`를 더하고, 그 뒤에 아래 규칙을 둔다.

```css
/* 홈 화면 앱(iOS standalone)은 상태바 뒤까지 그린다(black-translucent). 상태바 글자가 흰색이라 그 뒤를 칠하고,
   스크롤한 내용이 상태바 뒤로 비치지 않게 맨 위에 띠를 고정한다. 상태바가 없는 환경에서는 높이가 0이다. */
body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; z-index: 40; height: env(safe-area-inset-top, 0px); background: var(--status-bar); pointer-events: none; }
```

`AppLayout.module.css:13`: `padding-top: max(var(--space-3), env(safe-area-inset-top, 0px));`를 `padding-top: var(--space-3);`로 바꾼다.

- [ ] **Step 4: 통과 확인 후 전체 확인**
- [ ] **Step 5: 커밋(컨트롤러)** — `fix(web): paint behind the iOS home screen status bar`

---

### Task 2: 새 버전 알림

**Files:**
- Modify: `apps/web/vite.config.ts`(`registerType`, `injectRegister`, `test.alias`)
- Modify: `apps/web/package.json`, `apps/web/package-lock.json`(`workbox-window` devDependency 7.4.1)
- Create: `apps/web/src/vite-env.d.ts`(이미 있으면 줄만 더한다)
- Create: `apps/web/src/test/pwaRegisterStub.ts`
- Create: `apps/web/src/app/useAppUpdate.ts`
- Create: `apps/web/src/app/UpdatePrompt.tsx`, `apps/web/src/app/UpdatePrompt.module.css`
- Test: `apps/web/src/app/UpdatePrompt.test.tsx`, `apps/web/src/app/useAppUpdate.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- `useAppUpdate(): { needRefresh: boolean; update: () => void; dismiss: () => void }`
- `pwaRegisterStub.ts`가 내보내는 것
  - `useRegisterSW(options)`
  - 테스트용 `stubRegister` 객체: `{ needRefresh: boolean, updateServiceWorker: vi.fn, lastOptions }` — 테스트가 상태를 바꾸고 옵션의 `onRegisteredSW`를 직접 부를 수 있게 한다.

- [ ] **Step 1: 테스트용 stub과 실패하는 테스트**

`src/test/pwaRegisterStub.ts`:

```ts
import { useState } from 'react'
import { vi } from 'vitest'

type Options = { onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void }

/** 테스트에서 virtual:pwa-register/react 대신 쓴다(vite.config.ts test.alias). */
export const stubRegister = {
  needRefresh: false,
  updateServiceWorker: vi.fn(async () => {}),
  lastOptions: undefined as Options | undefined,
}

export function useRegisterSW(options: Options = {}) {
  stubRegister.lastOptions = options
  const needRefresh = useState(stubRegister.needRefresh)
  return { needRefresh, offlineReady: useState(false), updateServiceWorker: stubRegister.updateServiceWorker }
}
```

`vite.config.ts`의 `test`에 다음을 더한다.

```ts
    alias: { 'virtual:pwa-register/react': new URL('./src/test/pwaRegisterStub.ts', import.meta.url).pathname },
```

`UpdatePrompt.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { stubRegister } from '../test/pwaRegisterStub'
import UpdatePrompt from './UpdatePrompt'

afterEach(() => { stubRegister.needRefresh = false; stubRegister.updateServiceWorker.mockClear() })

it('shows nothing without a new version', () => {
  render(<UpdatePrompt />)
  expect(screen.queryByText('새 버전이 있어요')).not.toBeInTheDocument()
})

it('offers a reload when a new version is waiting', async () => {
  stubRegister.needRefresh = true
  render(<UpdatePrompt />)
  expect(screen.getByRole('status')).toHaveTextContent('새 버전이 있어요')
  await userEvent.click(screen.getByRole('button', { name: '새로고침' }))
  expect(stubRegister.updateServiceWorker).toHaveBeenCalledWith(true)
})

it('hides until the next version when dismissed', async () => {
  stubRegister.needRefresh = true
  render(<UpdatePrompt />)
  await userEvent.click(screen.getByRole('button', { name: '나중에' }))
  expect(screen.queryByText('새 버전이 있어요')).not.toBeInTheDocument()
})
```

`useAppUpdate.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stubRegister } from '../test/pwaRegisterStub'
import { useAppUpdate } from './useAppUpdate'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it('checks for a new version every hour and when the app becomes visible', () => {
  const { unmount } = renderHook(() => useAppUpdate())
  const update = vi.fn(async () => {})
  stubRegister.lastOptions?.onRegisteredSW?.('/sw.js', { update } as unknown as ServiceWorkerRegistration)
  vi.advanceTimersByTime(3_600_000)
  expect(update).toHaveBeenCalledTimes(1)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(update).toHaveBeenCalledTimes(2)
  unmount()
})
```

`userEvent`가 설치돼 있지 않으면 `fireEvent.click`을 쓴다. `package.json`을 보고 정한다.

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**

`vite.config.ts`의 `VitePWA` 옵션
- `registerType: 'prompt'`
- `injectRegister: false`
- 위쪽 주석에 "새 버전은 앱 안의 알림(UpdatePrompt)으로 사용자가 새로 고친다"를 더한다.

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
```

(`vite/client` 참조가 이미 다른 곳에 있으면 pwa 줄만 둔다. `tsconfig.app.json`의 `include`가 이 파일을 포함하는지 확인한다.)

`src/app/useAppUpdate.ts`:

```ts
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_MS = 60 * 60 * 1000

/**
 * 새 버전(대기 중인 서비스워커)이 있는지 알려준다. 1시간마다, 그리고 화면에 다시 돌아올 때 확인한다.
 * 홈 화면 앱은 오래 켜 두는 경우가 많아 열려 있는 동안에도 확인해야 한다.
 */
export function useAppUpdate() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => { void registration.update() }
      setInterval(check, CHECK_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })
  return {
    needRefresh,
    update: () => { void updateServiceWorker(true) },
    dismiss: () => setNeedRefresh(false),
  }
}
```

`shortcut:` 주석을 남긴다. 등록 콜백의 타이머와 리스너는 앱 수명 동안 하나뿐이라 해제하지 않는다. 등록이 여러 번 일어나면 해제를 넣는다.

`src/app/UpdatePrompt.tsx`:

```tsx
import ui from '../common/ui.module.css'
import styles from './UpdatePrompt.module.css'
import { useAppUpdate } from './useAppUpdate'

/** 새 버전이 감지될 때만 보인다. 작성 중인 입력을 잃지 않도록 사용자가 누를 때만 새로 고친다. */
export default function UpdatePrompt() {
  const { needRefresh, update, dismiss } = useAppUpdate()
  if (!needRefresh) return null
  return (
    <div role="status" className={styles.prompt}>
      <span className={styles.text}>새 버전이 있어요</span>
      <button type="button" className={ui.button} onClick={dismiss}>나중에</button>
      <button type="button" className={`${ui.button} ${ui.primary}`} onClick={update}>새로고침</button>
    </div>
  )
}
```

`src/app/UpdatePrompt.module.css`:

```css
/* 아래쪽은 탭 막대와 토스트가 쓰므로 위쪽 가운데에 띄운다. 토스트(30)와 같은 층이고 상태바 띠(40) 아래다. */
.prompt { position: fixed; top: calc(env(safe-area-inset-top, 0px) + var(--space-2)); left: 50%; translate: -50% 0; z-index: 30; display: flex; align-items: center; gap: var(--space-2); width: max-content; max-width: calc(100vw - 2 * var(--space-4)); padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-000); box-shadow: 0 4px 16px var(--overlay); }
.text { flex: 1; font-weight: 600; }
```

`App.tsx`: `<ToastRegion />` 바로 위에 `<UpdatePrompt />`를 둔다.

`package.json`의 `devDependencies`에 `"workbox-window": "7.4.1"`을 더한다. 알파벳 순서를 지키고 `npm install --package-lock-only --legacy-peer-deps`로 lock을 맞춘다. 네트워크가 없어 실패하면 보고서에 적고 lock은 손대지 않는다(컨트롤러가 한다).

- [ ] **Step 4: 통과 확인 후 전체 확인.** build 결과에 `registerSW.js`가 더 이상 없고, 번들에 workbox-window가 들어가는지(`dist/assets`) 보고서에 적는다.
- [ ] **Step 5: 커밋(컨트롤러)** — `feat(web): tell the user when a new version is ready`

---

## 마무리 (컨트롤러)

- Playwright로 확인한다.
  - 알림 카드 모양: stub으로 `needRefresh`를 켠 임시 미리보기. 데스크톱·모바일, 밝은·어두운 테마
  - 상태바 띠: `env()` 대체값을 강제로 준 임시 CSS
- 실기기(iOS 홈 화면 앱) 확인은 사용자가 한다. 확인 방법을 PR 본문에 적는다.
- Claude opus 최종 리뷰 후 PR을 올리고 Auto-fix를 켠다.
