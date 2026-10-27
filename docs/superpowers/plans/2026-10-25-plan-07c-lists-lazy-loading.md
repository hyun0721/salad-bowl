# Plan 07c: 목록·모바일 패널·지연 로딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거래 목록을 React Aria 표(넓은 화면)와 카드 목록(좁은 화면)으로 바꾸고, 좁은 화면의 거래 상세·추가를 시트로 띄우며, 화면 단위 지연 로딩으로 500 kB 청크 경고를 없앤다.

**Architecture:** "열릴 때의 폭을 기억하는" 로직을 `common/useMediaQuery.ts`의 `useNarrowWhileOpen` 하나로 합치고, `DialogFrame`·`Select`·`DateTimePicker`·거래 화면이 모두 이것을 쓴다. 목록은 공용 `DataTable`(RAC `Table`, 브라우저 정렬)과 `CardList`(RAC `GridList`)를 `TransactionList`가 폭에 따라 고른다. 패널 머리글(제목·닫기)은 화면(`TransactionsPage`)이 그리고, 넓은 화면은 지금의 `aside`, 좁은 화면은 `DialogFrame fullHeight`에 같은 본문을 넣는다. 라우트는 `React.lazy`로 나누고 `Suspense`는 `AppRoutes`와 `AppLayout`의 `Outlet`에 둔다.

**Tech Stack:** React 19, react-aria-components 1.22.1, react-router 7, CSS Modules, Vitest + Testing Library + MSW, Vite(rolldown)

**Spec:** `docs/superpowers/specs/2026-10-22-react-aria-rollout-design.md` 6장(단계 3). [Plan 07b 후속](2026-10-24-plan-07b-followups.md)의 모양 고정 통합·범위 전환 시 `selectedId`·삭제 뒤 포커스, [Plan 06a 후속](2026-10-22-plan-06a-followups.md)의 `mockViewport.set()` 회전 테스트를 넣는다.

## Global Constraints

- 시각 디자인은 바꾸지 않는다. 색·간격·radius는 `apps/web/src/styles/tokens.css`의 변수만 쓴다. 예외: 4px 이하 장식 치수, 터치 영역(44·48px), 열 너비(지금 격자 값 110·100·120px), 글자 크기.
- `react-aria-components`는 `apps/web/src/common/`, 테스트, `main.tsx`에서만 import한다. 화면 코드(`transactions/` 등)는 공용 래퍼만 쓴다.
- 모바일 폭 기준은 `(max-width: 820px)`이고 `common/useMediaQuery.ts`로 판단한다. 모바일 폭의 터치 영역은 44px 이상이다(목록 카드는 48px).
- 열린 동안 폭이 820px을 넘나들어도 오버레이(팝오버/시트/모달/패널) 모양을 바꾸지 않는다. 닫힘 애니메이션이 끝날 때까지도 바꾸지 않는다. 판단은 `useNarrowWhileOpen` 하나로 한다.
- 문구는 지금 그대로 쓴다: "거래 목록", "거래 추가", "거래 추가 (수동)", "거래 상세", "닫기", "취소", "추가", "삭제", "삭제 확인", "불러오는 중입니다." 등. 열 이름은 "일시", "멤버", "카테고리", "내용", "결제수단", "금액".
- 오류 문구는 인라인 `role="alert"` 그대로다.
- 새 npm 패키지를 설치하지 않는다. `build.chunkSizeWarningLimit`을 올려서 경고를 없애지 않는다.
- 주석은 한국어로, "왜"만 짧게 쓴다.
- jsdom 한계(Plan 06a): RAC `Sheet`는 jsdom에서 닫힌 뒤 DOM이 남는다. 시트 경로는 열림까지만 테스트하고, 닫힘·포커스 복귀는 Task 6 브라우저 확인에서 본다.
- 각 Task 끝에 `apps/web`에서 `npm run typecheck && npm test && npm run lint`(lint 경고 0건). Task 5와 Task 6은 `npm run build`도 돌린다.
- 검사 명령은 `apps/web`에서, `git add`/`git commit`은 저장소 루트에서 실행한다. Codex 구현 Task는 Codex가 커밋하지 않고 컨트롤러가 테스트를 다시 돌린 뒤 `Co-Authored-By: Codex (<모델>) <noreply@openai.com>`로 커밋한다.

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 |
|---|---|---|
| 1 모양 고정 통합 | Codex `gpt-6-astra` / medium (공용 부품) | Claude sonnet |
| 2 DataTable·CardList | Codex `gpt-6-astra` / medium (공용 부품) | Claude sonnet |
| 3 거래 목록 교체 | Codex `gpt-6-sol` / medium | Claude sonnet |
| 4 패널 시트·후속 수정 | Codex `gpt-6-sol` / medium | Claude sonnet |
| 5 지연 로딩·번들 기록 | Codex `gpt-6-sol` / medium | Claude sonnet |
| 6 브라우저 확인·후속 문서 | 컨트롤러 | — |
| 최종 브랜치 리뷰 | — | Claude opus 한 번 |

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/web/src/common/useMediaQuery.ts` (수정) + `useMediaQuery.test.ts` (새로) | `NARROW` 쿼리 상수, `useNarrowWhileOpen(isOpen)` |
| `apps/web/src/common/ResponsiveOverlay.tsx` (수정) | `useOverlayMode` 삭제 |
| `apps/web/src/common/Select.tsx`, `DateTimePicker.tsx` (수정) | 열림 상태를 따라 `useNarrowWhileOpen` 사용 |
| `apps/web/src/common/Dialog.tsx`, `Overlay.module.css`, `Dialog.test.tsx` (수정) | 모양 고정을 훅으로, `fullHeight` 시트, 회전 테스트 |
| `apps/web/src/common/DataTable.tsx` + `.module.css` + `.test.tsx` (새로) | RAC `Table`: 열 정의, 정렬, 행 동작, 현재 행 표시 |
| `apps/web/src/common/CardList.tsx` + `.module.css` + `.test.tsx` (새로) | RAC `GridList`: 카드 목록, 동작, 현재 카드 표시 |
| `apps/web/src/transactions/TransactionList.tsx`, `TransactionsPage.module.css` (수정) | 폭에 따라 `DataTable`/`CardList` |
| `apps/web/src/transactions/TransactionsPage.tsx` (수정) | 패널 머리글, 좁은 화면 시트, 범위 전환 시 선택 해제, 삭제 뒤 포커스 |
| `apps/web/src/transactions/TransactionPanel.tsx`, `ManualTransactionForm.tsx` (수정) | 머리글과 "열릴 때 제목 포커스" 제거, `onClose` → `onDeleted` |
| `apps/web/src/transactions/*.test.tsx` (수정) | 요소 찾는 방법 변경, 새 시나리오 |
| `apps/web/src/app/AppRoutes.tsx`, `AppLayout.tsx`, `PageLoading.tsx` (새로) | `React.lazy`, `Suspense`, 화면 전환 포커스 |
| `docs/ui-library-poc.md` (수정) | 번들 크기 기록 |
| `docs/superpowers/plans/2026-10-25-plan-07c-followups.md` (새로) | 후속 과제, 실기기 확인 목록 |

범위 밖(후속 문서에 남긴다): 멤버 내보내기 뒤 포커스, 입력이 있는 시트의 바깥 누르기 닫기, 07b의 사소한 테스트 보강, 대시보드 표 정렬(스펙 8장). 실기기 확인은 사용자가 직접 한다.

---

### Task 1: 모양 고정 로직 통합

**담당:** Codex `gpt-6-astra` / medium

**Files:**
- Modify: `apps/web/src/common/useMediaQuery.ts`, `ResponsiveOverlay.tsx`, `Select.tsx`, `DateTimePicker.tsx`, `Dialog.tsx`, `Overlay.module.css`, `Dialog.test.tsx`
- Create: `apps/web/src/common/useMediaQuery.test.ts`

**Interfaces:**
- Produces:
  - `NARROW` (named export of `useMediaQuery.ts`): `'(max-width: 820px)'`
  - `useNarrowWhileOpen(isOpen: boolean): boolean` (named export of `useMediaQuery.ts`): 열릴 때의 폭을 돌려준다. 열린 동안과 닫힌 뒤(다음에 열 때까지)는 값을 바꾸지 않는다.
  - `DialogFrame`에 `fullHeight?: boolean` 추가: 좁은 화면 시트를 화면 높이 전체로 띄운다(넓은 화면 모달에는 영향 없음).
  - `useOverlayMode`는 삭제한다.

- [ ] **Step 1: 실패하는 훅 테스트 작성**

`apps/web/src/common/useMediaQuery.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../test/mockViewport'
import { useNarrowWhileOpen } from './useMediaQuery'

describe('useNarrowWhileOpen', () => {
  it('keeps the width from when it opened, through closing, until the next open', () => {
    const viewport = mockViewport(false)
    const { result, rerender } = renderHook(({ open }) => useNarrowWhileOpen(open), { initialProps: { open: true } })
    expect(result.current).toBe(false)

    act(() => viewport.set(true))
    expect(result.current).toBe(false) // 열린 동안 회전해도 그대로

    rerender({ open: false })
    expect(result.current).toBe(false) // 닫힘 애니메이션 동안 그대로

    rerender({ open: true })
    expect(result.current).toBe(true) // 다시 열면 지금 폭
  })

  it('uses the current width when opening after the width changed while closed', () => {
    const viewport = mockViewport(true)
    const { result, rerender } = renderHook(({ open }) => useNarrowWhileOpen(open), { initialProps: { open: false } })
    act(() => viewport.set(false))
    rerender({ open: true })
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/useMediaQuery.test.ts`
Expected: FAIL (`useNarrowWhileOpen` is not exported)

- [ ] **Step 3: 훅 구현**

`apps/web/src/common/useMediaQuery.ts` 끝에 더한다(`useState` import 추가):

```ts
export const NARROW = '(max-width: 820px)'

/**
 * 열릴 때의 폭(좁은 화면인지)을 돌려준다. 열린 동안 폭이 바뀌어도(회전 등) 모양을 바꾸지 않는다 — 바꾸면 안의 폼이 다시 마운트되어 입력을 잃는다.
 * 닫힌 뒤에도 다음에 열 때까지 그대로 둬서, 닫힘 애니메이션이 연 모양 그대로 끝난다.
 */
export function useNarrowWhileOpen(isOpen: boolean) {
  const narrow = useMediaQuery(NARROW)
  const [opened, setOpened] = useState({ isOpen, narrow })
  if (opened.isOpen !== isOpen) setOpened({ isOpen, narrow: isOpen ? narrow : opened.narrow })
  return opened.narrow
}
```

Run: `npx vitest run src/common/useMediaQuery.test.ts` → PASS

- [ ] **Step 4: 쓰는 곳을 훅으로 바꾸기**

- `ResponsiveOverlay.tsx`: `useOverlayMode`와 그 위 주석·`oxlint-disable` 줄, `useState`·`useMediaQuery` import를 지운다. `ResponsiveOverlay` 컴포넌트는 그대로 둔다. 파일 맨 위 설명 주석 중 "열린 동안 … 바꾸지 않는다" 문장은 "모양은 부모가 `useNarrowWhileOpen`으로 정한다"로 바꾼다.
- `Select.tsx`:
  ```tsx
  const [open, setOpen] = useState(false)
  const mobile = useNarrowWhileOpen(open)
  // ...
  <AriaSelect ... onOpenChange={setOpen}>
  ```
- `DateTimePicker.tsx`: 같은 방식(`const [open, setOpen] = useState(false)`, `useNarrowWhileOpen(open)`, `onOpenChange={setOpen}`).
- `Dialog.tsx`의 `DialogFrame`: `narrowNow`·`openedNarrow` 세 줄과 주석을 `const narrow = useNarrowWhileOpen(isOpen)` 한 줄로 바꾼다. `useMediaQuery` import를 `useNarrowWhileOpen`으로 바꾼다.
- `DialogFrame`에 `fullHeight?: boolean`(기본 `false`)을 더하고, 시트에 `className={fullHeight ? `${styles.modalSheet} ${styles.fullSheet}` : styles.modalSheet}`를 준다. `Overlay.module.css`:
  ```css
  /* 거래 상세·추가처럼 내용이 긴 시트는 화면 높이를 다 쓴다. 위쪽 안전 영역(노치)을 피한다. */
  .fullSheet { height: 100vh; height: 100dvh; max-height: 100vh; max-height: 100dvh; border-radius: 0; padding-top: env(safe-area-inset-top); }
  ```

- [ ] **Step 5: 회전 테스트 추가 (Plan 06a 후속)**

`Dialog.test.tsx`에 더한다(`mockViewport`, `DialogFrame`, `TextField` import):

```tsx
it('keeps the same modal and its input when the width changes while open', async () => {
  const viewport = mockViewport(false)
  const user = userEvent.setup()
  function Harness() {
    const [name, setName] = useState('')
    return (
      <DialogFrame isOpen onOpenChange={() => {}} title="그룹 만들기">
        {() => <TextField label="이름" value={name} onChange={setName} />}
      </DialogFrame>
    )
  }
  render(<Harness />)
  await user.type(screen.getByLabelText('이름'), '우리집')
  const dialog = screen.getByRole('dialog', { name: '그룹 만들기' })

  act(() => viewport.set(true))

  expect(screen.getByRole('dialog', { name: '그룹 만들기' })).toBe(dialog)
  expect(screen.getByLabelText('이름')).toHaveValue('우리집')
})
```

`TextField`의 실제 props는 `common/TextField.tsx`를 보고 맞춘다. `Select.test.tsx`나 `DateTimePicker.test.tsx`에 이미 "열린 동안 폭이 바뀌면" 테스트가 있으면 그대로 통과해야 한다.

- [ ] **Step 6: 전체 검사**

Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, lint 경고 0건. `grep -rn useOverlayMode src`는 결과가 없어야 한다.

- [ ] **Step 7: 커밋** (컨트롤러)

```bash
git add apps/web/src/common
git commit -m "refactor(web): one hook keeps overlay shape from open through close"
```

---

### Task 2: 공용 DataTable과 CardList

**담당:** Codex `gpt-6-astra` / medium

**Files:**
- Create: `apps/web/src/common/DataTable.tsx`, `DataTable.module.css`, `DataTable.test.tsx`, `CardList.tsx`, `CardList.module.css`, `CardList.test.tsx`

**Interfaces:**
- Produces:
  - `DataTable` (default export): `<T extends { id: Key }>(props: { label: string; columns: DataColumn<T>[]; items: T[]; rowText: (item: T) => string; currentId?: Key | null; onRowAction: (id: Key) => void })`. 처음에는 `items` 순서 그대로(정렬 없음). `sortValue`가 있는 열 머리글을 누르면 오름차순 → 내림차순으로 브라우저에서 정렬한다. Enter나 클릭으로 `onRowAction(id)`. `currentId` 행에 `current` 클래스(`--brand-tint` 배경).
  - `DataColumn<T>` (named type export): `{ id: string; label: string; isRowHeader?: boolean; align?: 'end'; width?: string; sortValue?: (item: T) => string | number; render: (item: T) => ReactNode }`
  - `CardList` (default export): `<T extends { id: Key }>(props: { label: string; items: T[]; textValue: (item: T) => string; currentId?: Key | null; onAction: (id: Key) => void; children: (item: T) => ReactNode })`. RAC `GridList`. Enter나 탭으로 `onAction(id)`. `currentId` 카드에 `current` 클래스.
  - `Key`는 `react-aria-components`의 `Key`를 다시 내보내지 않는다. 화면 코드는 `number`를 넘기고 콜백에서 `Number(id)`로 받는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/DataTable.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DataTable, { type DataColumn } from './DataTable'

type Item = { id: number; name: string; amount: number }
const items: Item[] = [{ id: 1, name: '김밥', amount: -4000 }, { id: 2, name: '월급', amount: 3000 }, { id: 3, name: '국밥', amount: -9000 }]
const columns: DataColumn<Item>[] = [
  { id: 'name', label: '내용', isRowHeader: true, render: (i) => i.name },
  { id: 'amount', label: '금액', align: 'end', sortValue: (i) => i.amount, render: (i) => String(i.amount) },
]
const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getByRole('rowheader').textContent)

describe('DataTable', () => {
  it('is a labelled table with column headers in the given order', () => {
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} onRowAction={vi.fn()} />)
    const table = screen.getByRole('grid', { name: '거래 목록' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['내용', '금액'])
    expect(names()).toEqual(['김밥', '월급', '국밥'])
  })

  it('opens a row by click and by Enter after moving with arrow keys', async () => {
    const onRowAction = vi.fn()
    const user = userEvent.setup()
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} onRowAction={onRowAction} />)

    await user.click(screen.getByRole('row', { name: /김밥/ }))
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onRowAction.mock.calls).toEqual([[1], [2]])
  })

  it('sorts by a sortable column ascending then descending', async () => {
    const user = userEvent.setup()
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} onRowAction={vi.fn()} />)
    const amount = screen.getByRole('columnheader', { name: /금액/ })

    await user.click(amount)
    expect(amount).toHaveAttribute('aria-sort', 'ascending')
    expect(names()).toEqual(['국밥', '김밥', '월급'])

    await user.click(amount)
    expect(amount).toHaveAttribute('aria-sort', 'descending')
    expect(names()).toEqual(['월급', '김밥', '국밥'])
  })

  it('marks the current row', () => {
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} currentId={2} onRowAction={vi.fn()} />)
    expect(screen.getByRole('row', { name: /월급/ })).toHaveClass('current')
    expect(screen.getByRole('row', { name: /김밥/ })).not.toHaveClass('current')
  })
})
```

`apps/web/src/common/CardList.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CardList from './CardList'

const items = [{ id: 1, name: '김밥' }, { id: 2, name: '월급' }]

describe('CardList', () => {
  it('lists cards and opens one by tap and by Enter', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(<CardList label="거래 목록" items={items} textValue={(i) => i.name} currentId={2} onAction={onAction}>{(i) => <span>{i.name}</span>}</CardList>)

    const list = screen.getByRole('grid', { name: '거래 목록' })
    expect(within(list).getAllByRole('row')).toHaveLength(2)
    expect(within(list).getByRole('row', { name: '월급' })).toHaveClass('current')

    await user.click(within(list).getByRole('row', { name: '김밥' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onAction.mock.calls).toEqual([[1], [2]])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/DataTable.test.tsx src/common/CardList.test.tsx`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: DataTable 구현**

`apps/web/src/common/DataTable.tsx`:

```tsx
import { useMemo, useState, type ReactNode } from 'react'
import { Cell, Column, Row, Table, TableBody, TableHeader, type Key, type SortDescriptor } from 'react-aria-components'
import Icon from './Icon'
import styles from './DataTable.module.css'

export type DataColumn<T> = {
  id: string
  label: string
  isRowHeader?: boolean
  align?: 'end'
  width?: string
  /** 있으면 이 열 머리글로 정렬한다. 처음에는 서버가 준 순서를 그대로 둔다. */
  sortValue?: (item: T) => string | number
  render: (item: T) => ReactNode
}

type Props<T extends { id: Key }> = {
  label: string
  columns: DataColumn<T>[]
  items: T[]
  rowText: (item: T) => string
  currentId?: Key | null
  onRowAction: (id: Key) => void
}

export default function DataTable<T extends { id: Key }>({ label, columns, items, rowText, currentId, onRowAction }: Props<T>) {
  const [sort, setSort] = useState<SortDescriptor>()
  const sorted = useMemo(() => {
    const value = columns.find((c) => c.id === sort?.column)?.sortValue
    if (!sort || !value) return items
    const dir = sort.direction === 'descending' ? -1 : 1
    return [...items].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      return (x < y ? -1 : x > y ? 1 : 0) * dir
    })
  }, [items, columns, sort])

  const cellClass = (c: DataColumn<T>) => (c.align === 'end' ? `${styles.cell} ${styles.end}` : styles.cell)
  return (
    <Table aria-label={label} sortDescriptor={sort} onSortChange={setSort} onRowAction={onRowAction} className={styles.table}>
      <TableHeader columns={columns} className={styles.head}>
        {(c) => (
          <Column id={c.id} isRowHeader={c.isRowHeader} allowsSorting={!!c.sortValue} style={{ width: c.width }} className={cellClass(c)}>
            {({ sortDirection }) => (
              <>
                {c.label}
                {sortDirection && <span aria-hidden="true" className={sortDirection === 'ascending' ? styles.up : undefined}><Icon name="chevron-down" size={14} /></span>}
              </>
            )}
          </Column>
        )}
      </TableHeader>
      <TableBody items={sorted}>
        {(item) => (
          <Row id={item.id} columns={columns} textValue={rowText(item)}
            className={item.id === currentId ? `${styles.row} ${styles.current}` : styles.row}>
            {(c) => <Cell className={cellClass(c)}>{c.render(item)}</Cell>}
          </Row>
        )}
      </TableBody>
    </Table>
  )
}
```

`Icon`의 `size` prop과 이름은 `common/Icon.tsx`를 보고 맞춘다. RAC가 `Cell`·`Column`의 `isRowHeader` 열을 `rowheader`로 그린다.

`apps/web/src/common/DataTable.module.css` (값은 지금 `TransactionsPage.module.css`의 `.head`·`.rowButton`에서 옮긴 것):

```css
.table { width: 100%; border-collapse: collapse; }
.cell { padding: var(--space-3) var(--space-4); text-align: left; vertical-align: middle; }
.head .cell { font-size: 13px; font-weight: 400; color: var(--ink-muted); border-bottom: 1px solid var(--line); white-space: nowrap; }
.head .cell[data-allows-sorting] { cursor: pointer; }
.end { text-align: right; }
.up { display: inline-flex; transform: rotate(180deg); }
.row { height: 48px; background: var(--surface-000); color: var(--ink); cursor: pointer; outline: none; }
.row > .cell { border-bottom: 1px solid var(--line); }
.row[data-hovered] { background: var(--surface-100); }
.row[data-focus-visible] { outline: 2px solid var(--brand); outline-offset: -2px; }
.current, .current[data-hovered] { background: var(--brand-tint); }
.head .cell[data-focus-visible] { outline: 2px solid var(--brand); outline-offset: -2px; }
```

포커스 테두리는 `base.css`의 `:focus-visible`(`2px solid var(--brand)`)과 같고, 행 안쪽에 그리도록 `outline-offset: -2px`(이전 `.rowButton`과 같음)다.

- [ ] **Step 4: CardList 구현**

`apps/web/src/common/CardList.tsx`:

```tsx
import type { ReactNode } from 'react'
import { GridList, GridListItem, type Key } from 'react-aria-components'
import styles from './CardList.module.css'

type Props<T extends { id: Key }> = {
  label: string
  items: T[]
  textValue: (item: T) => string
  currentId?: Key | null
  onAction: (id: Key) => void
  children: (item: T) => ReactNode
}

/** 좁은 화면에서 표 대신 쓰는 카드 목록. 방향키로 옮기고 Enter·탭으로 연다. */
export default function CardList<T extends { id: Key }>({ label, items, textValue, currentId, onAction, children }: Props<T>) {
  return (
    <GridList aria-label={label} items={items} onAction={onAction} className={styles.list}>
      {(item) => (
        <GridListItem id={item.id} textValue={textValue(item)}
          className={item.id === currentId ? `${styles.card} ${styles.current}` : styles.card}>
          {children(item)}
        </GridListItem>
      )}
    </GridList>
  )
}
```

`apps/web/src/common/CardList.module.css`:

```css
.list { display: flex; flex-direction: column; }
.card { display: flex; flex-direction: column; gap: 4px; min-height: 48px; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); background: var(--surface-000); color: var(--ink); cursor: pointer; outline: none; }
.card[data-hovered] { background: var(--surface-100); }
.card[data-focus-visible] { outline: 2px solid var(--brand); outline-offset: -2px; }
.current, .current[data-hovered] { background: var(--brand-tint); }
```

카드 두 줄 사이 4px은 `tokens.css`에 토큰이 없다(`--space-2`부터). 거래 화면 검색칸의 `gap: 4px`과 같은 값이다.

- [ ] **Step 5: 통과 확인과 전체 검사**

Run: `npx vitest run src/common/DataTable.test.tsx src/common/CardList.test.tsx` → PASS
Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건

- [ ] **Step 6: 커밋** (컨트롤러)

```bash
git add apps/web/src/common
git commit -m "feat(web): shared data table and card list"
```

---

### Task 3: 거래 목록을 표·카드로 교체

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/src/transactions/TransactionList.tsx`, `TransactionsPage.module.css`, `TransactionsPage.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `DataTable`, `DataColumn`, `CardList`; `useMediaQuery`, `NARROW`(Task 1)
- Produces: `TransactionList` props는 그대로(`items`, `showOwner`, `selectedId`, `onSelect(id: number)`). 넓은 화면은 `grid "거래 목록"` 안의 `row`, 좁은 화면은 `grid "거래 목록"` 안의 카드 `row`.

- [ ] **Step 1: 기존 테스트를 새 역할로 바꾸고 새 시나리오 추가 (실패)**

`TransactionsPage.test.tsx`에서:
- 목록 행 찾기: `within(list).findAllByRole('button')` → `within(list).findAllByRole('row')` 다음 `.slice(1)`(머리글 행 제외). `within(list).getAllByRole('button')[0]` → `within(list).getAllByRole('row')[1]`.
- 행 누르기: `screen.findByRole('button', { name: /김밥/ })` → `screen.findByRole('row', { name: /김밥/ })`.

새 테스트:

```tsx
it('sorts by amount and opens a row with the keyboard', async () => {
  mineHandler([
    { ...base, id: 1, description: '김밥', amount: -4000 },
    { ...base, id: 2, description: '월급', amount: 3000000 },
    { ...base, id: 3, description: '국밥', amount: -9000 },
  ])
  server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
  const { user } = renderPage(<TransactionsPage today={today} />, { groups })
  const table = await screen.findByRole('grid', { name: '거래 목록' })
  expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['일시', '카테고리', '내용', '결제수단', '금액'])

  await user.click(within(table).getByRole('columnheader', { name: /금액/ }))
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['국밥', '김밥', '월급'])

  await user.click(rows[0])
  await user.keyboard('{ArrowDown}{Enter}')
  const detail = screen.getByRole('complementary', { name: '거래 상세' })
  expect(within(detail).getByRole('heading', { name: '김밥' })).toBeInTheDocument()
})

it('shows cards with description, amount and details on a narrow screen', async () => {
  mockViewport(true)
  mineHandler([{ ...base, edited: true }])
  renderPage(<TransactionsPage today={today} />, { groups })

  const list = await screen.findByRole('grid', { name: '거래 목록' })
  const card = within(list).getByRole('row', { name: /김밥/ })
  expect(card).toHaveTextContent('-₩ 4,000')
  expect(card).toHaveTextContent('10-05 12:30')
  expect(card).toHaveTextContent('식비 · 점심')
  expect(card).toHaveTextContent('수정됨')
  expect(within(list).queryByRole('columnheader')).not.toBeInTheDocument()
})
```

`mockViewport`는 `../test/mockViewport`에서 import한다. 정렬 테스트의 행 머리글이 "내용" 열이므로 숨김 배지가 있는 행이면 텍스트에 "숨김"이 붙는다(이 테스트 데이터에는 없다).

Run: `npx vitest run src/transactions/TransactionsPage.test.tsx` → 새 테스트와 바꾼 테스트가 FAIL

- [ ] **Step 2: TransactionList 구현**

`apps/web/src/transactions/TransactionList.tsx`를 바꾼다:

```tsx
import CardList from '../common/CardList'
import DataTable, { type DataColumn } from '../common/DataTable'
import { formatDateTime, formatSignedWon } from '../common/format'
import ui from '../common/ui.module.css'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import styles from './TransactionsPage.module.css'
import type { TransactionView } from './transactionsApi'

type Props = {
  items: TransactionView[]
  showOwner: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}

const category = (tx: TransactionView) => `${tx.categoryMajor}${tx.categoryMinor ? ` · ${tx.categoryMinor}` : ''}`
const editedBadge = (tx: TransactionView) => tx.edited && <span className={`${ui.badge} ${ui.badgePending}`}>수정됨</span>
const hiddenBadge = (tx: TransactionView) => tx.hidden && <span className={ui.badge}>숨김</span>

export default function TransactionList({ items, showOwner, selectedId, onSelect }: Props) {
  const narrow = useMediaQuery(NARROW)
  if (narrow) {
    return (
      <CardList label="거래 목록" items={items} textValue={(tx) => tx.description} currentId={selectedId}
        onAction={(id) => onSelect(Number(id))}>
        {(tx) => (
          <>
            <div className={styles.cardTop}>
              <span>{tx.description}{hiddenBadge(tx)}</span>
              <span className={styles.amount}>{formatSignedWon(tx.amount)}</span>
            </div>
            <div className={styles.cardMeta}>
              {[formatDateTime(tx.occurredAt), category(tx), showOwner ? tx.ownerNickname : null].filter(Boolean).join(' · ')}
              {editedBadge(tx)}
            </div>
          </>
        )}
      </CardList>
    )
  }
  const columns: DataColumn<TransactionView>[] = [
    { id: 'occurredAt', label: '일시', width: '110px', sortValue: (tx) => tx.occurredAt,
      render: (tx) => <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span> },
    ...(showOwner ? [{ id: 'owner', label: '멤버', width: '100px', render: (tx: TransactionView) => tx.ownerNickname }] : []),
    { id: 'category', label: '카테고리', render: (tx) => <>{category(tx)}{editedBadge(tx)}</> },
    { id: 'description', label: '내용', isRowHeader: true, render: (tx) => <>{tx.description}{hiddenBadge(tx)}</> },
    { id: 'paymentMethod', label: '결제수단', width: '110px', render: (tx) => tx.paymentMethod },
    { id: 'amount', label: '금액', width: '120px', align: 'end', sortValue: (tx) => tx.amount,
      render: (tx) => <span className={styles.amount}>{formatSignedWon(tx.amount)}</span> },
  ]
  return (
    <DataTable label="거래 목록" columns={columns} items={items} rowText={(tx) => tx.description}
      currentId={selectedId} onRowAction={(id) => onSelect(Number(id))} />
  )
}
```

- [ ] **Step 3: CSS 정리**

`TransactionsPage.module.css`에서 `.table`, `.head, .rowButton`, `.withOwner`, `.withoutOwner`, `.head`, `.rowButton*` 규칙을 지우고 다음을 더한다(`.when`, `.amount`는 남긴다. `.amount`의 `text-align: right`는 카드에서도 맞다):

```css
/* 표가 좁아지면 열이 뭉개지므로 넓은 화면 카드 안에서 가로로 스크롤한다(이전 격자와 같은 폭). */
.listCard table { min-width: 720px; }
.cardTop { display: flex; justify-content: space-between; gap: var(--space-3); font-weight: 600; }
.cardMeta { font-size: 13px; color: var(--ink-muted); }
```

`.listCard > :is(p, div[class])` 규칙이 RAC 표·목록을 감싼 `div`에 여백을 주지 않는지 확인한다(주면 선택자를 `:is(p, .listState)`처럼 상태 문구에만 걸리게 좁힌다).

- [ ] **Step 4: 통과 확인과 전체 검사**

Run: `npx vitest run src/transactions` → PASS
Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건

- [ ] **Step 5: 커밋** (컨트롤러)

```bash
git add apps/web/src/transactions
git commit -m "feat(web): transactions as a sortable table, cards on narrow screens"
```

---

### Task 4: 좁은 화면 시트 패널과 후속 수정

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/src/transactions/TransactionsPage.tsx`, `TransactionPanel.tsx`, `ManualTransactionForm.tsx`
- Test: `apps/web/src/transactions/TransactionsPage.test.tsx`, `TransactionPanel.test.tsx`, `ManualTransactionForm.test.tsx`

**Interfaces:**
- Consumes: `DialogFrame`(`fullHeight`), `useNarrowWhileOpen`(Task 1), `TransactionList`(Task 3)
- Produces:
  - `TransactionPanel` props: `{ tx: TransactionView; onDeleted: () => void }` — 머리글(제목·닫기)과 열릴 때 포커스 코드를 뺀다. 삭제가 성공하면 `onDeleted`.
  - `ManualTransactionForm` props: 그대로(`onDone`, `onCancel`) — 머리글(제목·닫기)과 열릴 때 포커스 코드를 뺀다. 폼 아래 "취소" 버튼은 남긴다.
  - 머리글은 `TransactionsPage`가 그린다: 넓은 화면은 `aside` 안의 `h2` + "닫기"(열릴 때 `h2`로 포커스), 좁은 화면은 `DialogFrame`의 제목 + `headerAction` "닫기".

- [ ] **Step 1: 실패하는 테스트 작성**

`TransactionsPage.test.tsx`에 더한다:

```tsx
it('opens detail and add form in a full-height sheet on a narrow screen', async () => {
  mockViewport(true)
  mineHandler([{ ...base }])
  server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
  const { user } = renderPage(<TransactionsPage today={today} />, { groups })

  await user.click(await screen.findByRole('row', { name: /김밥/ }))
  const sheet = screen.getByRole('dialog', { name: '김밥' })
  expect(within(sheet).getByRole('button', { name: '닫기' })).toBeInTheDocument()
  expect(within(sheet).getByLabelText('메모')).toBeInTheDocument()
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
})

it('opens the add form in a sheet on a narrow screen', async () => {
  mockViewport(true)
  mineHandler([])
  const { user } = renderPage(<TransactionsPage today={today} />, { groups })

  await user.click(await screen.findByRole('button', { name: '거래 추가' }))
  expect(within(screen.getByRole('dialog', { name: '거래 추가 (수동)' })).getByLabelText('내용')).toBeInTheDocument()
})

it('moves focus to the list heading after deleting a transaction', async () => {
  let deleted = false
  server.use(
    http.get('*/api/me/transactions', () => HttpResponse.json(deleted ? [] : [{ ...base, source: 'MANUAL' }])),
    http.delete('*/api/transactions/:id', () => { deleted = true; return new HttpResponse(null, { status: 204 }) }),
    http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
  )
  const { user } = renderPage(<TransactionsPage today={today} />, { groups })

  await user.click(await screen.findByRole('row', { name: /김밥/ }))
  await user.click(screen.getByRole('button', { name: '삭제' }))
  await user.click(screen.getByRole('button', { name: '삭제 확인' }))

  await waitFor(() => expect(screen.queryByRole('complementary', { name: '거래 상세' })).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('heading', { name: '거래 목록', level: 2 })).toHaveFocus())
})

it('closes a group transaction panel when the scope falls back to my transactions', async () => {
  // 그룹 목록에서 연 내 거래(id 6)는 '내 거래' 목록에도 있으므로, 선택을 풀지 않으면 패널이 남는다.
  mineHandler([{ ...base, id: 6, description: '커피' }])
  server.use(
    http.get('*/api/groups/10', () => HttpResponse.json({ groupId: 10, name: '우리집', myRole: 'ADMIN', members: [] })),
    http.get('*/api/groups/10/transactions', () => HttpResponse.json([{ ...base, id: 6, description: '커피' }])),
    http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
  )
  const { user, client } = renderPage(<TransactionsPage today={today} />, { groups })

  await user.click(await screen.findByRole('radio', { name: '그룹 거래' }))
  await user.click(await screen.findByRole('row', { name: /커피/ }))
  expect(screen.getByRole('complementary', { name: '거래 상세' })).toBeInTheDocument()

  server.use(http.get('*/api/groups', () => HttpResponse.json([])))
  await client.invalidateQueries({ queryKey: ['groups'], exact: true })

  await waitFor(() => expect(screen.getByRole('radio', { name: '내 거래' })).toBeChecked())
  expect(screen.queryByRole('complementary', { name: '거래 상세' })).not.toBeInTheDocument()
})
```

삭제 API는 `transactionsApi.remove`의 `DELETE /api/transactions/:id`다.

`TransactionPanel.test.tsx`: `onClose` prop을 `onDeleted`로 바꾼다. 패널 안 "닫기" 버튼·제목을 찾던 부분이 있으면 지운다(머리글은 화면이 그린다). `ManualTransactionForm.test.tsx`: 제목·"닫기"를 찾던 부분이 있으면 "취소"로 바꾸거나 지운다.

Run: `npx vitest run src/transactions` → 새 테스트 FAIL

- [ ] **Step 2: 패널·폼에서 머리글 빼기**

- `TransactionPanel.tsx`: `headingRef`, 포커스 `useEffect`와 주석, `styles.header` div(제목·닫기 버튼)를 지운다. `useEffect`·`useRef`·`Icon` import가 남지 않게 한다. `Props`를 `{ tx: TransactionView; onDeleted: () => void }`로 바꾸고 `remove.mutate(tx.id, { onSuccess: onDeleted })`.
- `ManualTransactionForm.tsx`: `headingRef`, 포커스 `useEffect`와 주석, `styles.header` div를 지운다.

- [ ] **Step 3: TransactionsPage에 머리글·시트·수정 넣기**

`TransactionsPage.tsx`의 바뀌는 부분:

```tsx
import { DialogFrame } from '../common/Dialog'
import { useNarrowWhileOpen } from '../common/useMediaQuery'
import panelStyles from './TransactionPanel.module.css'
// useEffect, useRef import 추가

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null)
  // 넓은 화면 패널은 목록 아래로 밀려 화면 밖에 열릴 수 있어, 열릴 때 제목으로 포커스를 옮긴다. 다시 렌더할 때는 옮기지 않는다.
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className={panelStyles.header}>
      <h2 ref={ref} tabIndex={-1}>{title}</h2>
      <button type="button" className={ui.button} onClick={onClose}><Icon name="x" size={18} />닫기</button>
    </div>
  )
}

// 컴포넌트 안:
// 그룹이 없어지면 ... (기존 주석 유지)
if (selectedGroupId === null && scope === 'group') {
  setScope('mine')
  // 그룹 목록에서 연 내 거래는 '내 거래' 목록에도 있어 그대로 두면 패널이 남는다.
  setSelectedId(null)
}

const open = adding || selected !== null
const narrow = useNarrowWhileOpen(open)
// 시트가 닫히는 동안(애니메이션) 빈 시트가 내려가지 않도록 마지막으로 연 내용을 기억한다.
const current = adding ? 'add' : selected
const [shown, setShown] = useState<'add' | TransactionView | null>(current)
if (current !== null && current !== shown) setShown(current)

const listHeadingRef = useRef<HTMLHeadingElement>(null)
const focusListAfterDelete = useRef(false)
useEffect(() => {
  // 삭제한 행과 패널이 사라져 포커스가 body로 가므로, 목록 제목으로 옮긴다. 대화상자가 닫힌 뒤(커밋 뒤)에 옮겨야 포커스 가두기에 막히지 않는다.
  if (!focusListAfterDelete.current) return
  focusListAfterDelete.current = false
  listHeadingRef.current?.focus()
})

function closePanel() {
  setAdding(false)
  setSelectedId(null)
}

const title = shown === 'add' ? '거래 추가 (수동)' : shown?.description ?? ''
const body = shown === 'add' ? (
  <ManualTransactionForm onCancel={closePanel} onDone={(created) => { /* 기존 onDone 본문 그대로 */ }} />
) : shown && (
  <TransactionPanel key={shown.id} tx={shown}
    onDeleted={() => { focusListAfterDelete.current = true; setSelectedId(null) }} />
)
```

JSX:
- 목록 제목: `<h2 id="list-title" ref={listHeadingRef} tabIndex={-1} className={styles.visuallyHidden}>거래 목록</h2>`
- 넓은 화면:
  ```tsx
  {!narrow && open && (
    <aside aria-label={adding ? '거래 추가' : '거래 상세'} className={`${ui.card} ${styles.panel}`}>
      <PanelHeader key={shown === 'add' ? 'add' : shown?.id} title={title} onClose={closePanel} />
      {body}
    </aside>
  )}
  ```
- 좁은 화면(`styles.layout` div 밖, 컴포넌트 끝):
  ```tsx
  {narrow && (
    <DialogFrame isOpen={open} onOpenChange={(next) => { if (!next) closePanel() }} title={title} fullHeight
      headerAction={<button type="button" className={ui.button} onClick={closePanel}><Icon name="x" size={18} />닫기</button>}>
      {() => body}
    </DialogFrame>
  )}
  ```
- "거래 추가" 버튼 `onClick`, 목록 `onSelect`는 그대로 둔다(`setAdding`/`setSelectedId`).

`react-hooks` lint가 렌더 중 `setShown`/ref 쓰기를 막으면 lint 메시지를 보고 같은 동작을 lint가 허용하는 형태로 바꾼다(비활성 주석으로 넘기지 않는다).

- [ ] **Step 4: 통과 확인과 전체 검사**

Run: `npx vitest run src/transactions` → PASS(기존 "moves focus to the panel heading…" 테스트도 넓은 화면에서 그대로 통과해야 한다)
Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건

- [ ] **Step 5: 커밋** (컨트롤러)

```bash
git add apps/web/src/transactions
git commit -m "feat(web): transaction panel as a sheet on narrow screens; focus and scope fixes"
```

---

### Task 5: 화면 단위 지연 로딩과 번들 기록

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Create: `apps/web/src/app/PageLoading.tsx`
- Modify: `apps/web/src/app/AppRoutes.tsx`, `apps/web/src/app/AppLayout.tsx`, `apps/web/src/app/AppRoutes.test.tsx`(필요할 때만), `docs/ui-library-poc.md`

**Interfaces:**
- Produces: `PageLoading` (default export): `<p className={ui.status}>불러오는 중입니다.</p>`

사전 측정(계획 작성 때 임시 실험, 되돌림): 6개 화면을 `lazy`로만 바꿔도 가장 큰 청크가 338.65 kB(gzip 106.09 kB)로 500 kB 경고가 사라졌고, 홈 첫 진입 JS(`index.html`의 엔트리 + `modulepreload`)는 gzip 약 181.7 kB였다(이전 단일 청크 223.63 kB). DatePicker는 `TransactionsPage` 청크(gzip 44.87 kB)로 빠졌다.

- [ ] **Step 1: 화면 전환 포커스 테스트가 지연 로딩에서도 지켜지는지 먼저 확인할 테스트 준비**

`AppRoutes.test.tsx`에 이미 메뉴로 화면을 바꾸면 새 `h1`에 포커스가 가는 테스트가 있다(`'그룹 관리'` `toHaveFocus`). 거래 화면도 확인하도록 하나 더한다:

```tsx
it('moves focus to the heading of a lazily loaded page', async () => {
  signedIn([])
  server.use(http.get('*/api/me/categories', () => HttpResponse.json([])))
  renderApp('/')
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: '거래 목록' }))

  expect(await screen.findByRole('heading', { level: 1, name: '거래 목록' })).toHaveFocus()
})
```

사이드바 링크 이름은 `app/menu.ts`의 `label`("거래 목록")이다. `signedIn`은 같은 파일의 기존 테스트에 맞춘다. 지금 코드에서는 PASS다(회귀 방지용).

- [ ] **Step 2: 지연 로딩 적용**

`apps/web/src/app/PageLoading.tsx`:

```tsx
import ui from '../common/ui.module.css'

export default function PageLoading() {
  return <p className={ui.status}>불러오는 중입니다.</p>
}
```

`AppRoutes.tsx`: `LoginPage`, `InvitePage`, `DashboardPage`, `TransactionsPage`, `UploadPage`, `GroupsPage` import를 `const X = lazy(() => import('...'))`로 바꾼다. 홈(`HomePage`)과 `PagePlaceholder`는 그대로 둔다. `<Routes>`를 `<Suspense fallback={<PageLoading />}>`로 감싼다(로그인·초대 화면용).

`AppLayout.tsx`:
- `<Outlet />`을 `<Suspense fallback={<PageLoading />}>`로 감싼다(화면을 불러오는 동안 메뉴·상단 바가 사라지지 않게).
- 화면 전환 포커스 `useEffect`를 `Suspense` 안의 작은 컴포넌트로 옮긴다. 같은 경계 안에 있어야 새 화면이 다 불러와진 뒤에 effect가 돈다(밖에 두면 fallback일 때 `h1`이 없어 포커스를 못 옮긴다):

  ```tsx
  function FocusHeadingOnRouteChange({ mainRef }: { mainRef: RefObject<HTMLElement | null> }) {
    const location = useLocation()
    const lastPath = useRef(location.pathname)
    useEffect(() => {
      // (기존 주석과 본문을 그대로 옮긴다)
    }, [location.pathname, mainRef])
    return null
  }
  // ...
  <Suspense fallback={<PageLoading />}>
    <Outlet />
    <FocusHeadingOnRouteChange mainRef={mainRef} />
  </Suspense>
  ```

- [ ] **Step 3: 검사와 빌드**

Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건
Run: `npm run build` → "Some chunks are larger than 500 kB" 경고가 없어야 한다. `dist/sw.js`에 `TransactionsPage-` 청크 이름이 있는지 확인한다(`grep -c TransactionsPage dist/sw.js` ≥ 1, PWA precache).

경고가 남으면 멈추고 보고한다(한도를 올리지 않는다).

- [ ] **Step 4: 번들 크기 기록**

`docs/ui-library-poc.md`:
- "번들 크기" 표 제목의 "(단일 JS 청크)"를 "(JS 합계)"로 바꾸고, 줄을 하나 더한다: `| + 목록·시트·지연 로딩(Plan 07c: Table, GridList, React.lazy) | <JS 합계 raw> | **<JS 합계 gzip>** | <CSS gzip> |`
- 표 아래에 한 단락: 홈 첫 진입 JS gzip(엔트리 + `index.html`의 `modulepreload` 청크 gzip 합), 가장 큰 청크 크기, 거래 화면 청크 크기(DatePicker 포함), 500 kB 경고가 사라졌다는 것. "Vite가 500 kB 초과 청크 경고를 낸다…" 문장은 "Plan 07c에서 사라졌다"로 고친다.
- 숫자는 `npm run build` 출력의 gzip 열을 더해 구한다. 계산한 명령을 보고서에 적는다.

- [ ] **Step 5: 커밋** (컨트롤러)

```bash
git add apps/web/src/app docs/ui-library-poc.md
git commit -m "perf(web): load pages lazily and record bundle sizes"
```

---

### Task 6: 브라우저 확인과 후속 과제 문서

**담당:** 컨트롤러

**Files:**
- Create: `docs/superpowers/plans/2026-10-25-plan-07c-followups.md`
- 임시(커밋하지 않음): `apps/web/preview.html`, `apps/web/src/preview.tsx` — `fetch`를 가짜로 바꿔 거래 목록·상세·삭제·그룹 API를 돌려준다(Plan 07b와 같은 방식).

- [ ] **Step 1: 미리보기 띄우기**

임시 `preview.html`·`src/preview.tsx`를 만들고 `npx vite --port 5199`로 띄워 `/preview.html`을 브라우저 패널에서 연다.

- [ ] **Step 2: 1200px 폭 확인**
- 표: 열 이름 6개(그룹 보기), 금액 오른쪽 정렬, 배지, 시각 디자인이 이전 격자와 같다(열 너비·여백·글자 크기).
- 방향키로 행 이동, Enter로 상세, 선택 행 `--brand-tint`, 일시·금액 정렬 표시.
- 상세 패널 오른쪽, 열릴 때 제목 포커스, 삭제 뒤 "거래 목록" 제목 포커스.

- [ ] **Step 3: 400px 폭 확인**
- 카드 두 줄(내용·금액 / 일시·카테고리·멤버), 카드 높이 48px 이상.
- 카드를 누르면 전체 높이 시트, 닫기·Esc·아래로 쓸기로 닫히고 포커스가 카드로 돌아온다.
- 시트에서 삭제 → 확인 → 시트가 닫히고 포커스가 "거래 목록" 제목으로 간다(body가 아님). body로 가면 원인을 적고 수정 Task를 만든다.
- 거래 추가 시트에서 입력 중 폭을 1200px로 바꿔도 시트와 입력이 그대로이고, 닫으면 시트 닫힘 애니메이션으로 사라진다(07b 후속: 모양 고정).
- Select·DatePicker 시트도 열린 채 폭을 바꿨다가 닫으면 시트 애니메이션으로 닫힌다.

- [ ] **Step 4: 정리**

임시 파일을 지우고 `git status`가 깨끗한지 본다.

- [ ] **Step 5: 후속 과제 문서**

`docs/superpowers/plans/2026-10-25-plan-07c-followups.md`에 적는다:
- 실행 중 바뀐 결정, 번들 결과
- 넘긴 항목: 멤버 내보내기 뒤 포커스, 입력이 있는 시트의 바깥 누르기 닫기, 07b의 사소한 테스트 보강(Plan 07b 후속 "나중에" 목록), 리뷰에서 넘긴 Minor
- **실기기 확인 목록(사용자가 직접)**: Plan 06a 후속의 "실기기에서 확인할 것" 전체 + 이번 단계의 표·카드·전체 높이 시트(iOS Safari 쓸어 닫기, 주소창이 줄어들 때 `100dvh`, VoiceOver·TalkBack이 표의 열 이름과 정렬 상태를 읽는지, NVDA 표 탐색), 시트 배경 진하기(Plan 07b 후속)

```bash
git add docs/superpowers/plans/2026-10-25-plan-07c-followups.md
git commit -m "docs: record plan 07c follow-ups"
```
