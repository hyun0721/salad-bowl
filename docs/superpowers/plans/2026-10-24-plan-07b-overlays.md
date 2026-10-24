# Plan 07b: 대화상자·알림·탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직접 만든 Modal·제자리 확인 버튼·인라인 성공 문구·로그인 탭·범위 버튼을 React Aria 기반 공용 부품(Dialog, ConfirmDialog, Toast, Tabs, SegmentedControl)으로 바꾼다.

**Architecture:** `common/Dialog.tsx`가 넓은 화면은 가운데 모달(RAC `ModalOverlay`+`Modal`), 820px 이하는 하단 시트(RAC `SheetOverlay`+`Sheet`)를 띄우는 `DialogFrame`을 갖고, 지금 `Modal`과 같은 사용법의 `Dialog`와 트리거가 붙은 `ConfirmDialog`가 이것을 쓴다. 성공 알림은 모듈 하나에 둔 큐(`toast(message)`)와 앱 루트의 `ToastRegion`으로 띄운다. 오류는 지금처럼 인라인으로 둔다.

**Tech Stack:** React 19, react-aria-components 1.22.1(Toast는 `UNSTABLE_` API), CSS Modules, Vitest + Testing Library + MSW

**Spec:** `docs/superpowers/specs/2026-10-22-react-aria-rollout-design.md` 5장(단계 2). [Plan 06a 후속](2026-10-22-plan-06a-followups.md)·[Plan 07a 후속](2026-10-24-plan-07a-followups.md)의 "단계 2에 더할 것"도 넣는다.

## Global Constraints

- 시각 디자인은 바꾸지 않는다. 색·간격·radius는 `apps/web/src/styles/tokens.css`의 변수만 쓴다. 예외: 4px 이하 장식 치수, 터치 영역과 아이콘 버튼 크기(36·40·44·48px), 글자 크기.
- `react-aria-components`는 `apps/web/src/common/`, 테스트, `main.tsx`에서만 import한다. Toast의 `UNSTABLE_` API는 `common/Toast.tsx` 한 파일에서만 쓴다(1.22.1에서 아직 불안정 API라 바뀌면 이 파일만 고친다).
- 모바일 폭 기준은 `(max-width: 820px)`이고 `common/useMediaQuery.ts`의 `useMediaQuery`로 판단한다. 모바일 폭의 대화상자와 확인 대화상자는 하단 시트다. 모바일 폭의 버튼 터치 영역은 44px 이상이다.
- 버튼·라벨 문구는 지금 그대로 쓴다("닫기", "취소", "나가기 확인", "`<닉네임>` 내보내기 확인", "삭제 확인", "저장했습니다." 등). 테스트가 이 이름으로 찾는다.
- 오류 문구는 Toast로 옮기지 않는다. 인라인 `role="alert"` 그대로다.
- 새 npm 패키지를 설치하지 않는다.
- 주석은 한국어로, "왜"만 짧게 쓴다.
- jsdom 한계(Plan 06a): RAC `Sheet`는 jsdom에서 닫힌 뒤 DOM이 남는다. 시트 경로는 `aria-expanded`·열림까지만 테스트하고, 실제 닫힘·포커스 복귀는 Task 6 브라우저 확인에서 본다. 넓은 화면(테스트 기본값) 경로는 RAC `Modal`이라 jsdom에서 닫힘·포커스 복귀까지 테스트한다.
- 각 Task 끝에 `apps/web`에서 `npm run typecheck && npm test && npm run lint`(lint 경고 0건). 마지막 코드 Task와 Task 6은 `npm run build`도 돌린다.
- 검사 명령은 `apps/web`에서, `git add`/`git commit`은 저장소 루트에서 실행한다.

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/web/src/common/Overlay.module.css` (새로) | 팝오버·하단 시트·모달 공통 모양. `Select.module.css`의 `.popover`·`.sheet`·`.dialog`·`.title`을 옮긴다 |
| `apps/web/src/common/ResponsiveOverlay.tsx`, `Select.module.css` (수정) | 오버레이 스타일을 `Overlay.module.css`에서 가져온다 |
| `apps/web/src/common/Dialog.tsx` + `Dialog.test.tsx` (새로) | `DialogFrame`(모달/시트), `Dialog`(기존 Modal과 같은 사용법) |
| `apps/web/src/common/Modal.tsx`, `Modal.module.css`, `Modal.test.tsx` (삭제) | `Dialog`로 대체 |
| `apps/web/src/common/ConfirmDialog.tsx` + `.test.tsx` (새로) | 트리거 버튼 + 확인 대화상자 |
| `apps/web/src/common/Toast.tsx` + `.test.tsx` (새로) | `toast(message)`, `ToastRegion` |
| `apps/web/src/common/Tabs.tsx` + `.module.css` + `.test.tsx` (새로) | 탭 |
| `apps/web/src/common/SegmentedControl.tsx` + `.module.css` + `.test.tsx` (새로) | 하나만 고르는 버튼 묶음 |
| `home/HomePage.tsx`, `home/MonthDataDialog.tsx`, `groups/GroupsPage.tsx` (수정) | `Modal` → `Dialog` |
| `groups/GroupSettings.tsx`, `groups/MemberList.tsx`, `transactions/TransactionPanel.tsx` (수정) | 제자리 확인 → `ConfirmDialog` |
| `transactions/TransactionPanel.tsx`, `groups/GroupSettings.tsx`, `groups/InviteSection.tsx` (수정) | 성공 문구 → `toast` |
| `App.tsx`, `test/renderPage.tsx` (수정) | `ToastRegion` 배치 |
| `common/BottomSheet.tsx`, `app/AccountSheet.tsx`, `app/AppLayout.tsx` (수정) | 계정 시트를 열 때 지난 로그아웃 실패 문구를 지운다 |

범위 밖: 넓은 화면 Select 팝오버의 `role=dialog`([Plan 07a 후속](2026-10-24-plan-07a-followups.md))는 RAC 모달 Popover의 기본 동작이라 이번에도 바꾸지 않는다. 바꾸려면 `isNonModal`과 바깥 누르기 닫기를 직접 만들어야 하고, 이득(안내 한 마디)보다 위험(바깥 누르기 회귀)이 크다.
| `auth/LoginPage.tsx` + `.module.css`, `transactions/TransactionsPage.tsx` + `.module.css` (수정) | 탭, 범위 전환 |

---

### Task 1: Overlay CSS 분리와 Dialog

**Files:**
- Create: `apps/web/src/common/Overlay.module.css`, `apps/web/src/common/Dialog.tsx`, `apps/web/src/common/Dialog.test.tsx`
- Modify: `apps/web/src/common/ResponsiveOverlay.tsx`, `apps/web/src/common/Select.module.css`
- Modify: `apps/web/src/home/HomePage.tsx`, `apps/web/src/home/MonthDataDialog.tsx`, `apps/web/src/groups/GroupsPage.tsx`
- Delete: `apps/web/src/common/Modal.tsx`, `Modal.module.css`, `Modal.test.tsx`

**Interfaces:**
- Produces:
  - `DialogFrame` (named export of `Dialog.tsx`): props `{ isOpen: boolean; onOpenChange: (open: boolean) => void; title: string; isDismissable?: boolean; headerAction?: ReactNode; children: (opts: { close: () => void }) => ReactNode }`. `headerAction`은 제목 오른쪽에 그린다. 넓은 화면은 가운데 모달, 모바일 폭은 하단 시트. 제목(`Heading slot="title"`)을 그린다.
  - `Dialog` (default export of `Dialog.tsx`): props `{ title: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }` — 지금 `Modal`과 같다. 마운트되면 열려 있고, 닫기 요청(닫기 버튼·Esc·바깥 누르기)마다 `onClose`를 부른다. `closeDisabled`면 셋 다 막는다.
  - `Overlay.module.css` 클래스: `popover`, `sheet`, `dialog`, `title`(기존 Select의 것), `backdrop`, `modal`, `modalSheet`, `header`, `content`

- [ ] **Step 1: 오버레이 CSS 옮기기**

`Select.module.css`에서 `.popover`, `.sheet`, `.dialog`, `.title` 규칙과 시트 애니메이션(`@keyframes`, `[data-entering]`/`[data-exiting]` 규칙, 그에 딸린 `prefers-reduced-motion` 규칙)을 그대로 `apps/web/src/common/Overlay.module.css`로 옮긴다. `ResponsiveOverlay.tsx`의 `import styles from './Select.module.css'`를 `import styles from './Overlay.module.css'`로 바꾼다. `Select.tsx`가 옮긴 클래스를 직접 쓰지 않는지 확인한다(쓰면 `Overlay.module.css`에서 가져온다).

Run (in `apps/web`): `npx vitest run src/common` → 모두 PASS(동작 변화 없음)

- [ ] **Step 2: 실패하는 테스트 작성**

`apps/web/src/common/Dialog.test.tsx` (기존 `Modal.test.tsx`의 시나리오를 옮기고 바깥 누르기를 더한다):

```tsx
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Dialog from './Dialog'

describe('Dialog', () => {
  it('is a labelled modal dialog that closes with Escape or the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Dialog title="9월 데이터 업로드" onClose={onClose}><p>내용</p></Dialog>)

    const dialog = screen.getByRole('dialog', { name: '9월 데이터 업로드' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('returns focus to the opener when closed', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>열기</button>
          {open && <Dialog title="제목" onClose={() => setOpen(false)}><button type="button">안쪽</button></Dialog>}
        </>
      )
    }
    render(<Harness />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '열기' }))
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '열기' })).toHaveFocus()
  })

  it('keeps focus inside while tabbing', async () => {
    const user = userEvent.setup()
    render(<><button type="button">밖</button><Dialog title="제목" onClose={vi.fn()}><button type="button">안쪽</button></Dialog></>)
    const dialog = screen.getByRole('dialog')

    for (let i = 0; i < 4; i += 1) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('blocks every way of closing while closeDisabled', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Dialog title="제목" onClose={onClose} closeDisabled><p>내용</p></Dialog>)

    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

기존 `Modal.test.tsx`의 다른 시나리오(있다면)도 같은 방식으로 옮긴다. 대화상자 자체가 포커스를 갖던 검사(`toHaveFocus`)는 RAC가 첫 포커스 대상을 정하므로 "대화상자 안에 포커스가 있다"로 바꿨다.

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/common/Dialog.test.tsx`
Expected: FAIL — `Failed to resolve import "./Dialog"`

- [ ] **Step 4: Dialog 구현**

먼저 `node_modules/react-aria-components/dist/types/src/Modal.d.ts`, `Sheet.d.ts`, `Dialog.d.ts`에서 `ModalOverlay`의 `isOpen`/`onOpenChange`/`isDismissable`/`isKeyboardDismissDisabled`, `SheetOverlay`의 `isOpen`/`onOpenChange`, `Sheet`의 `preventDismissal`을 확인한다. 아래와 다르면 타입을 따르고 보고서에 적는다.

`apps/web/src/common/Dialog.tsx`:

```tsx
import type { ReactNode } from 'react'
import {
  Dialog as AriaDialog, Heading, Modal, ModalOverlay, Sheet, SheetBackdrop, SheetContent, SheetOverlay,
} from 'react-aria-components'
import { useMediaQuery } from './useMediaQuery'
import styles from './Overlay.module.css'
import ui from './ui.module.css'

type FrameProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  isDismissable?: boolean
  headerAction?: ReactNode
  children: (opts: { close: () => void }) => ReactNode
}

/** 넓은 화면은 가운데 모달, 좁은 화면은 아래에서 올라오는 시트. 포커스 가두기·Esc·복귀는 RAC가 맡는다. */
export function DialogFrame({ isOpen, onOpenChange, title, isDismissable = true, headerAction, children }: FrameProps) {
  const narrow = useMediaQuery('(max-width: 820px)')
  const body = (close: () => void) => (
    <>
      <div className={styles.header}>
        <Heading slot="title" className={styles.title}>{title}</Heading>
        {headerAction}
      </div>
      {children({ close })}
    </>
  )
  if (narrow) {
    return (
      <SheetOverlay isOpen={isOpen} onOpenChange={onOpenChange} className={styles.sheetOverlay}>
        <SheetBackdrop className={styles.backdrop} />
        <Sheet preventDismissal={!isDismissable} className={styles.modalSheet}>
          <SheetContent className={styles.content}>{({ close }) => body(close)}</SheetContent>
        </Sheet>
      </SheetOverlay>
    )
  }
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable} className={styles.backdrop}>
      <Modal className={styles.modal}>
        <AriaDialog className={styles.content}>{({ close }) => body(close)}</AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

type Props = { title: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }

/** 화면이 조건부로 그려서 여닫는 대화상자. 기존 Modal과 사용법이 같다. */
export default function Dialog({ title, onClose, closeDisabled = false, children }: Props) {
  return (
    <DialogFrame isOpen onOpenChange={(open) => { if (!open && !closeDisabled) onClose() }}
      title={title} isDismissable={!closeDisabled}
      headerAction={<button type="button" className={ui.button} disabled={closeDisabled} onClick={onClose}>닫기</button>}>
      {() => children}
    </DialogFrame>
  )
}
```

닫기 버튼은 기존 Modal처럼 제목 오른쪽(`headerAction`)에 있다.

`Overlay.module.css`에 더한다(기존 `Modal.module.css`의 값을 그대로 옮긴다):

```css
.backdrop { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; padding: var(--space-6) max(16px, env(safe-area-inset-left, 0px)); background: var(--overlay); }
.modal { width: 100%; max-width: 560px; max-height: 100%; overflow: auto; background: var(--surface-000); border-radius: var(--radius-lg); }
.content { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-6); outline: none; }
.header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.sheetOverlay { z-index: 20; }
.modalSheet { width: 100%; max-height: 85vh; max-height: 85dvh; overflow: auto; background: var(--surface-000); border-radius: var(--radius-lg) var(--radius-lg) 0 0; padding-bottom: env(safe-area-inset-bottom); overscroll-behavior: contain; }
.modalSheet .content { padding: var(--space-4) max(var(--space-4), env(safe-area-inset-right, 0px)) var(--space-4) max(var(--space-4), env(safe-area-inset-left, 0px)); }
```

`.modalSheet`의 `width: 100%`는 Plan 06a에서 찾은 문제(RAC 시트가 가로 가운데 정렬이라 내용 폭만큼만 열림) 때문이다. 주석으로 남긴다.

- [ ] **Step 5: 화면 교체와 Modal 삭제**

`HomePage.tsx`, `MonthDataDialog.tsx`, `GroupsPage.tsx`에서 `import Modal from '../common/Modal'`을 `import Dialog from '../common/Dialog'`로, `<Modal …>…</Modal>`을 `<Dialog …>…</Dialog>`로 바꾼다(props 그대로). `common/Modal.tsx`, `Modal.module.css`, `Modal.test.tsx`를 지운다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/common/Dialog.test.tsx src/home src/groups`
Expected: PASS. `HomePage.test.tsx`의 대화상자 테스트(닫기 비활성, 취소 등)가 그대로 통과해야 한다. 대화상자 이름이나 포커스 검사가 RAC 구조 때문에 실패하면 기대하는 동작(이름, 닫기 가능 여부, 포커스가 대화상자 안)은 유지한 채 찾는 방법만 바꾸고 보고서에 적는다.

- [ ] **Step 7: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add -A apps/web/src/common apps/web/src/home apps/web/src/groups/GroupsPage.tsx
git commit -m "feat(web): React Aria Dialog replaces the hand-made Modal"
```

---

### Task 2: ConfirmDialog와 확인 흐름 세 곳

**Files:**
- Create: `apps/web/src/common/ConfirmDialog.tsx`, `apps/web/src/common/ConfirmDialog.test.tsx`
- Modify: `apps/web/src/groups/GroupSettings.tsx`(`LeaveGroup`), `apps/web/src/groups/MemberList.tsx`(`MemberRow`), `apps/web/src/transactions/TransactionPanel.tsx`
- Test: `groups/GroupsPage.test.tsx`, `groups/GroupsAdmin.test.tsx`, `transactions/TransactionPanel.test.tsx` (필요한 만큼만 수정)

**Interfaces:**
- Consumes: `DialogFrame`(Task 1)
- Produces: `ConfirmDialog` (default), props `{ triggerLabel: string; triggerAriaLabel?: string; triggerIcon?: IconName; title: string; description: string; confirmLabel: string; confirmAriaLabel?: string; isPending: boolean; error: string | null; onConfirm: (close: () => void) => void }`

동작:
- 위험 버튼 모양의 트리거(`ui.button ui.danger`, 아이콘이 있으면 앞에)를 누르면 확인 대화상자가 열린다. 포커스는 "취소" 버튼에 간다(실수로 Enter를 눌러도 실행되지 않게).
- 대화상자: 제목, 설명 문단, 버튼 둘("취소", 위험 버튼 `confirmLabel`). `isPending`이면 두 버튼과 닫기(Esc·바깥 누르기)를 모두 막는다.
- 확인을 누르면 `onConfirm(close)`. 호출한 쪽이 mutation의 `onSuccess`에서 `close()`를 부른다.
- `error`가 있으면 대화상자 안에 `<p role="alert" className={ui.alert}>`로 보인다.
- 닫히면 RAC가 트리거로 포커스를 돌려준다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/ConfirmDialog.test.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

function renderConfirm(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const user = userEvent.setup()
  const view = render(
    <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기" description="우리집에서 나가면 다시 초대받아야 합류할 수 있습니다."
      confirmLabel="나가기 확인" isPending={false} error={null} onConfirm={onConfirm} {...props} />,
  )
  return { onConfirm, user, ...view }
}

describe('ConfirmDialog', () => {
  it('opens on the trigger with focus on cancel and closes back to the trigger', async () => {
    const { user } = renderConfirm()
    const trigger = screen.getByRole('button', { name: '그룹 나가기' })

    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: '그룹 나가기' })
    expect(dialog).toHaveTextContent('다시 초대받아야')
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('confirms through the callback and closes when the caller says so', async () => {
    const { user, onConfirm } = renderConfirm()
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))

    await user.click(screen.getByRole('button', { name: '나가기 확인' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const close = onConfirm.mock.calls[0][0] as () => void
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    close()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('blocks closing and both buttons while pending and shows errors inside', async () => {
    const { user, rerender, onConfirm } = renderConfirm()
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))

    rerender(
      <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기" description="설명" confirmLabel="나가기 확인"
        isPending error="관리자는 나갈 수 없습니다." onConfirm={onConfirm} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: '나가기 확인' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '취소' })).toBeDisabled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('관리자는 나갈 수 없습니다.')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('uses accessible names that differ from the visible labels when given', async () => {
    const { user } = renderConfirm({ triggerLabel: '내보내기', triggerAriaLabel: '짝꿍 내보내기', confirmLabel: '내보내기 확인', confirmAriaLabel: '짝꿍 내보내기 확인' })
    await user.click(screen.getByRole('button', { name: '짝꿍 내보내기' }))
    expect(screen.getByRole('button', { name: '짝꿍 내보내기 확인' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/ConfirmDialog.test.tsx`
Expected: FAIL — import 실패

- [ ] **Step 3: ConfirmDialog 구현**

`apps/web/src/common/ConfirmDialog.tsx`:

```tsx
import { useState } from 'react'
import { Button } from 'react-aria-components'
import { DialogFrame } from './Dialog'
import Icon, { type IconName } from './Icon'
import ui from './ui.module.css'

type Props = {
  triggerLabel: string
  triggerAriaLabel?: string
  triggerIcon?: IconName
  title: string
  description: string
  confirmLabel: string
  confirmAriaLabel?: string
  isPending: boolean
  error: string | null
  onConfirm: (close: () => void) => void
}

/**
 * 되돌릴 수 없는 작업(나가기, 내보내기, 삭제)을 한 번 더 묻는다.
 * 트리거는 RAC Button이라 Safari처럼 누를 때 포커스를 주지 않는 브라우저에서도 닫힌 뒤 트리거로 돌아온다.
 */
export default function ConfirmDialog(props: Props) {
  const { triggerLabel, triggerAriaLabel, triggerIcon, title, description, confirmLabel, confirmAriaLabel, isPending, error, onConfirm } = props
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button aria-label={triggerAriaLabel} className={`${ui.button} ${ui.danger}`} onPress={() => setOpen(true)}>
        {triggerIcon && <Icon name={triggerIcon} size={18} />}{triggerLabel}
      </Button>
      <DialogFrame isOpen={open} onOpenChange={(next) => { if (!isPending) setOpen(next) }} title={title} isDismissable={!isPending}>
        {({ close }) => (
          <>
            <p>{description}</p>
            {error && <p role="alert" className={ui.alert}>{error}</p>}
            <div className={ui.row}>
              <Button autoFocus className={ui.button} isDisabled={isPending} onPress={close}>취소</Button>
              <Button aria-label={confirmAriaLabel} className={`${ui.button} ${ui.danger}`} isDisabled={isPending}
                onPress={() => onConfirm(close)}>{confirmLabel}</Button>
            </div>
          </>
        )}
      </DialogFrame>
    </>
  )
}
```

`DialogFrame`이 `isOpen`이 거짓일 때 트리거에 포커스를 돌려주려면 RAC 오버레이가 열기 전 포커스 위치를 기억해야 한다. 트리거가 RAC `Button`이고 `onPress` 때 포커스를 받으므로 기억된다. 첫 테스트의 `expect(trigger).toHaveFocus()`가 실패하면 `DialogTrigger`로 감싸는 방식으로 바꾸고 보고서에 적는다.

`ui.module.css`의 `.button`은 `button` 요소 기준 스타일이다. RAC `Button`도 `<button>`을 렌더하므로 같은 모양이 나온다. 비활성 모양은 `.button:disabled` 규칙이 맡는다(RAC `isDisabled`는 `disabled` 속성을 단다).

- [ ] **Step 4: 화면 적용**

`GroupSettings.tsx`의 `LeaveGroup`: 확인 단계 상태·ref·포커스 이동 코드(`confirming`, `trigger`, `cancel`, `focusNext`, `useEffect`, `toggleConfirm`)를 지우고 다음으로 바꾼다. 실패 문구는 대화상자 안에 보인다(바깥의 `leave.isError` 문단은 지운다).

```tsx
<ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기"
  description={`${name}에서 나가면 다시 초대받아야 합류할 수 있습니다. 나갈까요?`}
  confirmLabel="나가기 확인" isPending={leave.isPending} error={leave.isError ? errorMessage(leave.error) : null}
  onConfirm={(close) => leave.mutate(groupId, { onSuccess: close })} />
```

`MemberList.tsx`의 `MemberRow`: 같은 방식으로 상태·포커스 코드를 지우고:

```tsx
<ConfirmDialog triggerLabel="내보내기" triggerAriaLabel={`${member.nickname} 내보내기`}
  title={`${member.nickname} 내보내기`} description="내보내면 차단되어 다시 합류할 수 없습니다."
  confirmLabel="내보내기 확인" confirmAriaLabel={`${member.nickname} 내보내기 확인`}
  isPending={removeMember.isPending} error={removeMember.isError ? errorMessage(removeMember.error) : null}
  onConfirm={(close) => removeMember.mutate({ groupId, userId: member.userId }, { onSuccess: close })} />
```

(바깥의 `removeMember.isError` 문단은 지운다.)

`TransactionPanel.tsx`의 삭제: `confirming` 상태와 "이 거래를 삭제할까요?" 블록을 지우고:

```tsx
{canDelete && (
  <ConfirmDialog triggerLabel="삭제" triggerIcon="trash" title="거래 삭제" description="이 거래를 삭제할까요?"
    confirmLabel="삭제 확인" isPending={remove.isPending} error={remove.isError ? errorMessage(remove.error) : null}
    onConfirm={() => remove.mutate(tx.id, { onSuccess: onClose })} />
)}
```

삭제가 성공하면 패널 자체가 닫히므로(`onClose`) 대화상자도 함께 사라진다. 패널의 공통 오류 문단(`error`)에서 `remove` 오류는 빼고 `update` 오류만 남긴다.

- [ ] **Step 5: 기존 테스트 맞추기와 통과 확인**

Run: `npx vitest run src/common/ConfirmDialog.test.tsx src/groups src/transactions`

`GroupsPage.test.tsx` 142줄 근처와 `GroupsAdmin.test.tsx` 50줄 근처의 `expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()`는 그대로 통과해야 한다. 취소 후 트리거로 포커스가 돌아오는지 보는 검사가 있으면 RAC 닫힘이 끝난 뒤를 기다리도록 `await waitFor(...)`로 감싼다. 실패 응답 문구를 확인하는 테스트는 이제 문구가 대화상자 안에 있으므로 `within(screen.getByRole('dialog'))`로 찾도록 바꾼다. 기대 문구와 API 호출 검사는 바꾸지 않는다.

Expected: 모두 PASS

- [ ] **Step 6: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add apps/web/src/common/ConfirmDialog.tsx apps/web/src/common/ConfirmDialog.test.tsx apps/web/src/groups apps/web/src/transactions
git commit -m "feat(web): ConfirmDialog for leaving a group, removing a member and deleting a transaction"
```

---

### Task 3: Toast와 로그아웃 문구 정리

**Files:**
- Create: `apps/web/src/common/Toast.tsx`, `apps/web/src/common/Toast.module.css`, `apps/web/src/common/Toast.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/test/renderPage.tsx`
- Modify: `apps/web/src/transactions/TransactionPanel.tsx`, `apps/web/src/groups/GroupSettings.tsx`(`RenameForm`), `apps/web/src/groups/InviteSection.tsx`
- Modify: `apps/web/src/common/BottomSheet.tsx`, `apps/web/src/app/AccountSheet.tsx`, `apps/web/src/app/AppLayout.tsx`
- Test: `transactions/TransactionPanel.test.tsx`, `groups/GroupsPage.test.tsx`, `groups/GroupsAdmin.test.tsx`, `app/AppRoutes.test.tsx` (수정)

**Interfaces:**
- Produces:
  - `toast(message: string): void` — `common/Toast.tsx`의 named export. 4초 뒤 사라지는 성공 알림을 띄운다.
  - `ToastRegion` (default export of `Toast.tsx`), props 없음. 화면 하단 가운데(모바일 폭에서는 하단 탭 바 위)에 알림을 쌓는다.
  - `BottomSheet`에 `onOpen?: () => void` prop 추가(열릴 때 호출)
  - `AccountSheet`에 `onOpen: () => void` prop 추가

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/Toast.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ToastRegion, { toast } from './Toast'

afterEach(() => vi.useRealTimers())

describe('Toast', () => {
  it('announces a message in a labelled region and hides it after 4 seconds', () => {
    vi.useFakeTimers()
    render(<ToastRegion />)

    act(() => toast('저장했습니다.'))

    const region = screen.getByRole('region', { name: '알림' })
    expect(region).toHaveTextContent('저장했습니다.')
    act(() => { vi.advanceTimersByTime(4100) })
    expect(screen.queryByText('저장했습니다.')).not.toBeInTheDocument()
  })

  it('can be dismissed with its close button', async () => {
    const user = userEvent.setup()
    render(<ToastRegion />)
    act(() => toast('링크를 복사했습니다.'))

    await user.click(screen.getByRole('button', { name: '알림 닫기' }))

    expect(screen.queryByText('링크를 복사했습니다.')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/Toast.test.tsx`
Expected: FAIL — import 실패

- [ ] **Step 3: Toast 구현**

먼저 `node_modules/react-aria-components/dist/types/src/Toast.d.ts`와 `react-stately/dist/types/src/toast/useToastState.d.ts`에서 `UNSTABLE_ToastRegion`(children render prop `{ toast }`), `UNSTABLE_Toast`, `UNSTABLE_ToastContent`, `UNSTABLE_ToastQueue`(`add(content, { timeout })`)를 확인한다. RAC 닫기 버튼은 `<Button slot="close">`다. 다르면 타입을 따르고 보고서에 적는다. 지역 이름("알림")은 `aria-label`로 준다.

`apps/web/src/common/Toast.tsx`:

```tsx
import {
  Button, Text, UNSTABLE_Toast as AriaToast, UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue, UNSTABLE_ToastRegion as AriaToastRegion,
} from 'react-aria-components'
import Icon from './Icon'
import styles from './Toast.module.css'

// 앱 전체에서 하나의 큐를 쓴다. RAC Toast는 1.22.1에서 UNSTABLE API라 이 파일 밖에서는 쓰지 않는다.
const queue = new ToastQueue<string>({ maxVisibleToasts: 3 })

/** 성공 알림. 오류는 놓치지 않게 인라인으로 두고 여기로 보내지 않는다. */
// oxlint-disable-next-line react/only-export-components
export function toast(message: string) {
  queue.add(message, { timeout: 4000 })
}

export default function ToastRegion() {
  return (
    <AriaToastRegion queue={queue} aria-label="알림" className={styles.region}>
      {({ toast: item }) => (
        <AriaToast toast={item} className={styles.toast}>
          <ToastContent className={styles.content}>
            <Text slot="title">{item.content}</Text>
          </ToastContent>
          <Button slot="close" aria-label="알림 닫기" className={styles.close}><Icon name="x" size={18} /></Button>
        </AriaToast>
      )}
    </AriaToastRegion>
  )
}
```

`ToastQueue` 생성자 옵션 이름(`maxVisibleToasts`)이 다르면 타입대로 고친다. 큐가 모듈 단위라 테스트 사이에 알림이 남을 수 있다. 테스트가 서로 영향을 주면 `Toast.tsx`에 테스트용으로 큐를 비우는 함수(예: `clearToasts()`, 주석 "테스트 전용")를 두고 `test/setup.ts`의 `afterEach`에서 부른다.

`apps/web/src/common/Toast.module.css`:

```css
.region { position: fixed; left: 50%; bottom: calc(var(--space-6) + env(safe-area-inset-bottom, 0px)); translate: -50% 0; z-index: 30; display: flex; flex-direction: column; gap: var(--space-2); width: max-content; max-width: calc(100vw - 2 * var(--space-4)); outline: none; }
.toast { display: flex; align-items: center; gap: var(--space-2); min-height: 44px; padding: 0 var(--space-2) 0 var(--space-4); border-radius: var(--radius-sm); background: var(--ink); color: var(--surface-000); box-shadow: 0 4px 16px var(--overlay); }
.toast[data-focus-visible] { outline: 2px solid var(--brand); outline-offset: 2px; }
.content { flex: 1; }
.close { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; border-radius: var(--radius-sm); background: transparent; color: inherit; cursor: pointer; }
@media (max-width: 820px) {
  /* 하단 탭 바(56px) 위에 띄운다. */
  .region { bottom: calc(56px + var(--space-3) + env(safe-area-inset-bottom, 0px)); }
  .close { width: 44px; height: 44px; }
}
```

- [ ] **Step 4: 배치**

- `App.tsx`: `ErrorBoundary` 바깥, `BrowserRouter` 안 마지막 자식으로 `<ToastRegion />`을 둔다(로그인 화면에서도 쓸 수 있게).
- `test/renderPage.tsx`: 렌더 트리 안(예: `GroupProvider` 다음)에 `<ToastRegion />`을 둔다. 화면 테스트가 알림 문구를 찾을 수 있게 한다.

- [ ] **Step 5: 성공 문구 세 곳 교체**

- `TransactionPanel.tsx`: `{update.isSuccess && <p role="status" …>저장했습니다.</p>}`를 지우고, `update.mutate`의 `onSuccess` 안에서 `toast('저장했습니다.')`를 부른다.
- `GroupSettings.tsx` `RenameForm`: `rename.isSuccess` 문단을 지우고 `rename.mutate({ groupId, name: trimmed }, { onSuccess: () => toast('이름을 바꿨습니다.') })`.
- `InviteSection.tsx`: `copied === 'done'` 문단을 지우고, 복사 성공 시 `toast('링크를 복사했습니다.')`. `copied` 상태가 실패 표시에만 쓰이게 되면 `'done'` 값을 없애고 실패 여부만 남긴다(`'failed'` 문구와 동작은 그대로).

테스트를 맞춘다(기대 문구는 바꾸지 않는다):
- `TransactionPanel.test.tsx` 38줄: `findByRole('status')` → `findByText('저장했습니다.')`
- `GroupsPage.test.tsx` 99줄, `GroupsAdmin.test.tsx` 70줄: `findByText`라 그대로 통과해야 한다.

- [ ] **Step 6: 계정 시트를 열 때 지난 로그아웃 실패 문구 지우기**

([Plan 06a 후속](2026-10-22-plan-06a-followups.md)) 지금은 로그아웃 실패 문구가 시트를 닫았다 다시 열어도 남는다.
- `BottomSheet.tsx`: props에 `onOpen?: () => void`를 더하고, 이미 있는 `onOpenChange`에서 `isOpen`이 참일 때 `onOpen?.()`을 부른다.
- `AccountSheet.tsx`: props에 `onOpen: () => void`를 더해 `BottomSheet`에 넘긴다.
- `AppLayout.tsx`: `<AccountSheet … onOpen={() => setLogoutError(false)} />`.
- `AppRoutes.test.tsx`의 좁은 화면 로그아웃 실패 테스트 끝에 추가: 시트에서 Esc → 계정 버튼을 다시 누름 → 새 시트에 `alert`가 없다(jsdom에서는 닫힌 시트가 DOM에 남으므로 `getAllByRole('dialog')`의 마지막 것을 본다). 이 검사가 jsdom 한계로 불안정하면 빼고 Task 6 브라우저 확인 항목으로 넘기며 보고서에 적는다.

- [ ] **Step 7: 통과 확인, 전체 확인, 커밋**

Run: `npx vitest run src/common/Toast.test.tsx src/transactions src/groups src/app` → PASS
Run: `npm run typecheck && npm test && npm run lint`

```bash
git add apps/web/src
git commit -m "feat(web): success toasts and a fresh account sheet after a failed logout"
```

---

### Task 4: Tabs와 SegmentedControl

**Files:**
- Create: `apps/web/src/common/Tabs.tsx`, `Tabs.module.css`, `Tabs.test.tsx`
- Create: `apps/web/src/common/SegmentedControl.tsx`, `SegmentedControl.module.css`, `SegmentedControl.test.tsx`
- Modify: `apps/web/src/auth/LoginPage.tsx`, `LoginPage.module.css`
- Modify: `apps/web/src/transactions/TransactionsPage.tsx`, `TransactionsPage.module.css`
- Test: `auth/LoginPage.test.tsx`, `transactions/TransactionsPage.test.tsx` (수정)

**Interfaces:**
- Produces:
  - `Tabs` (default), props `{ label: string; tabs: { id: string; label: string }[]; selectedKey: string; onSelectionChange: (id: string) => void; children: (id: string) => ReactNode; className?: string }`. 선택된 탭의 패널만 그린다. 패널 이름은 탭 이름.
  - `SegmentedControl` (default), props `{ label: string; items: { id: string; label: string; isDisabled?: boolean }[]; selectedKey: string; onSelectionChange: (id: string) => void }`. 하나만, 늘 하나는 선택된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/Tabs.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import Tabs from './Tabs'

function Harness() {
  const [mode, setMode] = useState('login')
  return (
    <Tabs label="로그인 또는 회원가입" tabs={[{ id: 'login', label: '로그인' }, { id: 'signup', label: '회원가입' }]}
      selectedKey={mode} onSelectionChange={setMode}>
      {(id) => <p>{id} 패널</p>}
    </Tabs>
  )
}

describe('Tabs', () => {
  it('switches tabs with arrow keys and shows the matching named panel', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: '로그인 또는 회원가입' })).toBeInTheDocument()
    const loginTab = screen.getByRole('tab', { name: '로그인' })
    expect(screen.getByRole('tabpanel', { name: '로그인' })).toHaveTextContent('login 패널')

    await user.click(loginTab)
    await user.keyboard('{ArrowRight}')

    const signupTab = screen.getByRole('tab', { name: '회원가입' })
    expect(signupTab).toHaveAttribute('aria-selected', 'true')
    expect(signupTab).toHaveFocus()
    expect(loginTab).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: '회원가입' })).toHaveTextContent('signup 패널')
  })
})
```

`apps/web/src/common/SegmentedControl.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SegmentedControl from './SegmentedControl'

const items = [{ id: 'mine', label: '내 거래' }, { id: 'group', label: '그룹 거래' }]

describe('SegmentedControl', () => {
  it('selects exactly one option and reports changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl label="범위" items={items} selectedKey="mine" onSelectionChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: '범위' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '내 거래' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: '그룹 거래' }))
    expect(onChange).toHaveBeenCalledWith('group')

    onChange.mockClear()
    await user.click(screen.getByRole('radio', { name: '내 거래' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables an option', () => {
    render(<SegmentedControl label="범위" items={[items[0], { ...items[1], isDisabled: true }]} selectedKey="mine" onSelectionChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: '그룹 거래' })).toBeDisabled()
  })
})
```

RAC `ToggleButtonGroup`은 `selectionMode="single"`일 때 `radiogroup`/`radio` 역할을 쓴다. 실제 역할이 다르면(예: `toolbar`/`button aria-pressed`) 테스트를 실제 역할에 맞추고 보고서에 적는다. "이미 선택된 것을 다시 눌러도 선택이 풀리지 않는다"(`disallowEmptySelection`)는 유지한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/Tabs.test.tsx src/common/SegmentedControl.test.tsx`
Expected: FAIL — import 실패

- [ ] **Step 3: 구현**

먼저 `Tabs.d.ts`, `ToggleButtonGroup.d.ts`, `ToggleButton.d.ts`에서 props를 확인한다.

`apps/web/src/common/Tabs.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Tab, TabList, TabPanel, Tabs as AriaTabs } from 'react-aria-components'
import styles from './Tabs.module.css'

type Props = {
  label: string
  tabs: { id: string; label: string }[]
  selectedKey: string
  onSelectionChange: (id: string) => void
  children: (id: string) => ReactNode
  className?: string
}

/** 방향키·Home·End로 탭을 옮기는 탭 묶음. 선택된 탭의 패널만 그린다. */
export default function Tabs({ label, tabs, selectedKey, onSelectionChange, children, className }: Props) {
  return (
    <AriaTabs selectedKey={selectedKey} onSelectionChange={(key) => onSelectionChange(String(key))} className={className}>
      <TabList aria-label={label} className={styles.list}>
        {tabs.map((t) => <Tab key={t.id} id={t.id} className={styles.tab}>{t.label}</Tab>)}
      </TabList>
      {tabs.map((t) => (
        <TabPanel key={t.id} id={t.id} className={styles.panel}>{children(t.id)}</TabPanel>
      ))}
    </AriaTabs>
  )
}
```

`apps/web/src/common/Tabs.module.css` (지금 `LoginPage.module.css`의 `.tabs`·`.tab` 모양을 그대로 옮긴다):

```css
.list { display: flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
.tab { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 44px; background: var(--surface-000); color: var(--ink); cursor: pointer; outline: none; }
.tab[data-selected] { background: var(--brand); color: var(--on-brand); font-weight: 700; }
.tab[data-focus-visible] { outline: 2px solid var(--brand); outline-offset: -4px; }
.tab[data-selected][data-focus-visible] { outline-color: var(--on-brand); }
.panel { outline: none; }
```

`apps/web/src/common/SegmentedControl.tsx`:

```tsx
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import styles from './SegmentedControl.module.css'

type Props = {
  label: string
  items: { id: string; label: string; isDisabled?: boolean }[]
  selectedKey: string
  onSelectionChange: (id: string) => void
}

/** 둘 이상 중 하나만 고르는 버튼 묶음. 늘 하나는 선택되어 있다. */
export default function SegmentedControl({ label, items, selectedKey, onSelectionChange }: Props) {
  return (
    <ToggleButtonGroup aria-label={label} selectionMode="single" disallowEmptySelection
      selectedKeys={[selectedKey]} onSelectionChange={(keys) => {
        const [key] = [...keys]
        if (key != null) onSelectionChange(String(key))
      }} className={styles.group}>
      {items.map((item) => (
        <ToggleButton key={item.id} id={item.id} isDisabled={item.isDisabled} className={styles.button}>{item.label}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
```

`apps/web/src/common/SegmentedControl.module.css` (지금 `TransactionsPage.module.css`의 `.scope`·`.scopeButton` 모양):

```css
.group { display: flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
.button { min-height: 40px; padding: 0 var(--space-4); border: 0; background: var(--surface-000); color: var(--ink); cursor: pointer; }
.button[data-selected] { background: var(--brand); color: var(--on-brand); font-weight: 700; }
.button[data-disabled] { opacity: 0.6; cursor: default; }
.button[data-focus-visible] { outline: 2px solid var(--brand); outline-offset: -4px; }
@media (max-width: 820px) {
  .button { min-height: 44px; }
}
```

- [ ] **Step 4: 화면 적용**

`LoginPage.tsx`:
- `useRef`, `KeyboardEvent`, `tabs` ref, `onTabKeyDown`, `role="tablist"` 블록을 지운다.
- 지금 `<form id="auth-panel" role="tabpanel" …>…</form>` 전체를 `const form = (<form className={styles.form} onSubmit={onSubmit}>…</form>)`로 꺼내고(`id`·`role`·`aria-labelledby`는 지운다), 그 자리에:

```tsx
<Tabs label="로그인 또는 회원가입" tabs={MODES.map((m) => ({ id: m, label: TAB_LABEL[m] }))}
  selectedKey={mode} onSelectionChange={(id) => changeMode(id as Mode)}>
  {() => form}
</Tabs>
```

- `LoginPage.module.css`의 `.tabs`, `.tab`, `.tab[aria-selected…]` 규칙을 지운다. 탭과 폼 사이 간격이 지금과 같도록, 필요하면 `Tabs`에 `className`으로 간격 클래스를 넘긴다(예: `.authTabs { display: flex; flex-direction: column; gap: var(--space-4); }` — 지금 카드 안 간격 값을 그대로 쓴다).

`TransactionsPage.tsx`:
- `role="group" aria-label="범위"` 블록을 다음으로 바꾼다:

```tsx
<SegmentedControl label="범위" items={[{ id: 'mine', label: '내 거래' }, { id: 'group', label: '그룹 거래', isDisabled: selectedGroupId === null }]}
  selectedKey={inGroup ? 'group' : 'mine'} onSelectionChange={(id) => changeScope(id as 'mine' | 'group')} />
```

- `TransactionsPage.module.css`의 `.scope`, `.scopeButton` 규칙을 지운다.

테스트 맞추기(기대값은 바꾸지 않는다):
- `TransactionsPage.test.tsx` 72·144줄: `findByRole('button', { name: '그룹 거래' })` → `findByRole('radio', { name: '그룹 거래' })`. 113줄의 `toBeDisabled()`도 radio로.
- `LoginPage.test.tsx`의 탭 테스트는 역할·이름이 같으므로 그대로 통과해야 한다. `tabpanel` 이름이 탭 이름이 되는지 확인한다.

- [ ] **Step 5: 통과 확인, 전체 확인, 빌드, 커밋**

Run: `npx vitest run src/common src/auth src/transactions src/app` → PASS
Run: `npm run typecheck && npm test && npm run lint && npm run build`

```bash
git add apps/web/src
git commit -m "feat(web): React Aria tabs on login and a segmented scope switch"
```

---

### Task 5: 미뤄 둔 테스트 두 개

([Plan 07a 후속](2026-10-24-plan-07a-followups.md)) 코드 변경 없이 테스트만 더한다. 지금 동작이 맞으면 처음부터 통과한다(회귀 방지용).

**Files:**
- Test: `apps/web/src/groups/GroupsPage.test.tsx`, `apps/web/src/groups/GroupsAdmin.test.tsx`

- [ ] **Step 1: 공개 스위치가 저장 중 비활성인지**

`GroupsPage.test.tsx`의 공개 토글 테스트 근처에 추가한다. 공개 설정 API(기존 테스트가 쓰는 핸들러 경로 그대로)를 `await new Promise(...)`로 붙잡아 두고, 스위치를 누른 직후 `expect(screen.getByRole('switch', { name: '내 거래를 이 그룹에 공개' })).toBeDisabled()`, 응답을 풀어 준 뒤 `toBeEnabled()`를 확인한다(Plan 07a의 업로드 대기 테스트와 같은 방식).

- [ ] **Step 2: 초대 주소 칸이 포커스하면 전체 선택되는지**

`GroupsAdmin.test.tsx`의 초대 링크 테스트(67줄 근처) 끝에 추가한다:

```tsx
const address = screen.getByLabelText('초대 주소') as HTMLInputElement
address.focus()
expect(address.selectionStart).toBe(0)
expect(address.selectionEnd).toBe(address.value.length)
```

jsdom에서 `select()`가 선택 범위를 바꾸지 않으면(그래서 0·0이 나오면) 이 검사는 빼고 Task 6 브라우저 확인 항목으로 넘기며 보고서에 적는다.

- [ ] **Step 3: 확인과 커밋**

Run: `npx vitest run src/groups` → PASS
Run: `npm run typecheck && npm test && npm run lint`

```bash
git add apps/web/src/groups
git commit -m "test(web): share switch disabled while saving and invite address select-all"
```

---

### Task 6: 브라우저 확인과 기록 (컨트롤러가 직접)

확인 중 문제가 나오면 해당 Task 구현자에게 수정을 맡기고, 고친 뒤 Step 4부터 다시 한다.

- [ ] **Step 1: 임시 미리보기 페이지** (커밋하지 않는다)

Plan 07a Task 8과 같은 방식으로 `apps/web/preview.html` + `src/preview.tsx`를 만든다. `fetch`를 가짜 응답으로 바꾸고 `ToastRegion`을 포함한 앱 트리에서 홈(업로드 대화상자), 거래(내 거래/그룹 거래 전환, 거래 상세의 저장·삭제), 그룹(이름 바꾸기, 나가기, 멤버 내보내기, 초대 링크 복사), 로그인 화면을 오갈 수 있게 한다. 이동은 페이지 안 링크(클라이언트 라우팅)로 한다(`/preview.html/…`로 새로 고침하면 dev 서버가 `index.html`을 준다).

- [ ] **Step 2: 넓은 폭(1200×800)**
  - 대화상자: 가운데에 열리고, Tab이 안에서만 돈다. Esc·바깥 누르기·닫기로 닫히고 연 버튼으로 포커스가 돌아온다. 업로드 중에는 셋 다 막힌다.
  - 확인 대화상자: 트리거를 누르면 열리고 포커스가 "취소"에 있다. 실패하면 대화상자 안에 오류가 보인다. 확인이 끝나면 닫힌다.
  - 알림: 저장·이름 바꾸기·링크 복사 뒤 화면 하단 가운데에 뜨고 4초 뒤 사라진다. × 버튼으로 닫힌다. 스크린리더 지역 이름 "알림".
  - 로그인 탭: 방향키로 이동, 모양이 이전과 같다. 범위 전환: 모양이 이전과 같고 그룹이 없으면 "그룹 거래"가 비활성.
- [ ] **Step 3: 좁은 폭(400×800)**
  - 대화상자·확인 대화상자가 하단 시트로 열리고 화면 폭을 다 쓴다. 쓸어 내리기·Esc·바깥 누르기로 닫히고(업로드 중에는 막힘), 닫힌 뒤 연 버튼으로 포커스가 돌아온다.
  - 알림이 하단 탭 바 위에 뜬다.
  - 계정 시트에서 로그아웃 실패 → 시트를 닫았다 다시 열면 실패 문구가 없다.
  - 버튼 터치 영역 44px 이상.
- [ ] **Step 4: 정리, 최종 검증, 기록**

임시 파일을 지우고 미리보기 서버를 멈춘다. `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`. build 출력의 `index-*.js`·`index-*.css` 크기를 `docs/ui-library-poc.md` 번들 표 마지막 줄 다음에 한 줄로 더한다(숫자는 build 출력값으로 바꾼다):

```markdown
| + 대화상자·알림·탭(Plan 07b: Modal, Toast, Tabs, ToggleButtonGroup) | 000.00 kB | **000.00 kB** | 0.00 kB |
```

저장소 루트에서:

```bash
git add docs/ui-library-poc.md
git commit -m "docs: record bundle size after overlays and tabs"
```
