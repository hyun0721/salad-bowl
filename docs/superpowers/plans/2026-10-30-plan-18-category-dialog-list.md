# Plan 18 대분류 거래 창 목록 구성과 고정 머리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대분류 거래 창의 표·카드를 거래 목록과 같은 구성으로 바꾸고, 제목·`N건 · 합계`·열 머리를 고정한 채 목록만 스크롤한다.

**Architecture:** 거래 목록의 표 열과 카드 내용을 `transactions/transactionRows.tsx`로 옮겨 `TransactionList`와 `CategoryTransactionsDialog`가 같이 쓴다. `DialogFrame`에 opt-in 속성 `pinnedHeader`를 더해 모달/시트를 세로 flex로 만들고, 창 본문 안의 목록 영역만 스크롤한다.

**Tech Stack:** React 19, CSS Modules, react-aria-components, Vitest + Testing Library + MSW.

**설계:** [대분류 거래 창 목록 구성과 고정 머리 설계](../specs/2026-10-30-category-dialog-list-design.md). 카드 규칙은 [거래 목록 설계](../specs/2026-10-30-transactions-fit-layout-design.md) 4.6.

## Global Constraints

- `apps/web`만 바꾼다. 브랜치 `claude/category-dialog-list`(PR #59 브랜치 위).
- 거래 목록(`TransactionList`)의 화면·테스트 동작은 바뀌지 않아야 한다(표 열, 정렬, 카드 2줄, 페이징·풋터).
- `pinnedHeader`를 켜지 않은 다른 창(`Dialog`, `ConfirmDialog`, 거래 상세, 멤버별 창 등)의 CSS·동작은 바꾸지 않는다.
- 창의 접근 이름·버튼은 그대로: 창 이름 = 대분류, `<대분류> 소분류 보기`, `닫기`, 목록 `거래 목록`.
- 요약 문구 `N건 · 합계 ₩ …`(환불 반영 합계)는 그대로.
- 토큰만 쓴다(`--space-*`, `--line`, `--surface-000`).
- 최종 검증: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`. lint는 기존 `CoverageSection` 경고 1건 외 새 경고 없음.
- 구현은 Codex가 사용량 한도라 Claude가 하고, 리뷰는 Codex(`read`, 한도가 풀린 뒤)가 한다. 커밋은 컨트롤러가 한다.

---

### Task 1: 공용 행 정의, 고정 머리, 창 목록 교체

**Files:**
- Create: `apps/web/src/transactions/transactionRows.tsx`
- Modify: `apps/web/src/transactions/TransactionList.tsx`
- Modify: `apps/web/src/common/Dialog.tsx`, `apps/web/src/common/Overlay.module.css`
- Modify: `apps/web/src/dashboard/CategoryTransactionsDialog.tsx`, `apps/web/src/dashboard/CategoryBreakdown.module.css`
- Test: `apps/web/src/dashboard/CategoryTransactionsDialog.test.tsx`, `apps/web/src/common/Dialog.test.tsx`

**Interfaces:**
- Produces:
  - `transactionColumns(showOwner: boolean): DataColumn<TransactionView>[]` — 지금 `TransactionList` 안의 `columns`와 같은 내용.
  - `TransactionCard({ tx, showOwner }: { tx: TransactionView; showOwner: boolean }): JSX.Element` — 지금 `TransactionList`의 `CardList` 자식(1줄 `cardTop`, 2줄 `cardMeta`)과 같은 내용.
  - `DialogFrame`의 `pinnedHeader?: boolean`.

- [ ] **Step 1: 실패하는 테스트**

`CategoryTransactionsDialog.test.tsx`:

```tsx
  it('shows a desktop grid and the refund-adjusted total', async () => {
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000), tx(2, -20000), tx(3, 3000)])))
    renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    const summary = await within(dialog).findByText('3건 · 합계 ₩ 27,000')
    const grid = within(dialog).getByRole('grid', { name: '거래 목록' })
    expect(within(grid).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['일시', '멤버', '카테고리', '내용', '결제수단', '금액'])
    expect(within(grid).getAllByRole('row')[1]).toHaveTextContent('식비 · 외식')
    // 요약 줄은 목록 스크롤 영역 밖(위)에 있어 목록을 내려도 남는다.
    expect(summary.contains(grid)).toBe(false)
    expect(grid.closest('[data-dialog-list]')).not.toBeNull()
    expect(summary.closest('[data-dialog-list]')).toBeNull()
    expect(dialog.parentElement).toHaveClass('wide')
    expect(dialog.parentElement).toHaveClass('pinned')
  })

  it('shows a card list on a narrow screen', async () => {
    mockViewport(true)
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([{ ...tx(1, -10000), memo: '회사 앞' }])))
    renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    const card = within(await within(dialog).findByRole('grid', { name: '거래 목록' })).getByRole('row', { name: /점심 1/ })
    expect(card).toHaveTextContent(/점심 1.*-₩ 10,000.*식비 · 외식 · 나 \| 회사 앞.*10-19 12:30/)
    expect(within(dialog).queryByRole('columnheader')).not.toBeInTheDocument()
  })
```

(위 두 테스트는 기존 같은 이름의 테스트를 바꾼다. 기존 `'10-19 12:30 · 외식 · 나'` 단정은 지운다.)

`common/Dialog.test.tsx`에 추가(기존 파일의 import·render 방식을 따른다):

```tsx
  it('pins the header only when asked', async () => {
    const { rerender } = render(<DialogFrame isOpen onOpenChange={() => {}} title="창">{() => <p>본문</p>}</DialogFrame>)
    expect(screen.getByRole('dialog', { name: '창' }).parentElement).not.toHaveClass('pinned')
    rerender(<DialogFrame isOpen onOpenChange={() => {}} title="창" pinnedHeader>{() => <p>본문</p>}</DialogFrame>)
    expect(screen.getByRole('dialog', { name: '창' }).parentElement).toHaveClass('pinned')
  })
```

(CSS Modules 클래스 이름은 테스트 설정에서 원래 이름으로 나온다 — 기존 `toHaveClass('wide')` 단정과 같다.)

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/dashboard/CategoryTransactionsDialog.test.tsx src/common/Dialog.test.tsx`
Expected: 새/바뀐 테스트 FAIL.

- [ ] **Step 3: 공용 행 정의 (`transactions/transactionRows.tsx`)**

`TransactionList.tsx`의 `category`, `editedBadge`, `hiddenBadge`, `memoOf`, 표 `columns`, `CardList` 자식 JSX를 그대로 옮긴다. 스타일은 계속 `./TransactionsPage.module.css`를 쓴다.

```tsx
import DataTable, { type DataColumn } from '../common/DataTable' // DataColumn 타입만
import { formatDateTime, formatSignedWon } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './TransactionsPage.module.css'
import type { TransactionView } from './transactionsApi'

/** 거래 목록과 대시보드 거래 창이 같이 쓰는 표 열. */
export function transactionColumns(showOwner: boolean): DataColumn<TransactionView>[] { return [ /* 지금 columns 그대로 */ ] }

/** 좁은 화면 카드 한 장의 내용. 2줄은 `분류 | 메모`와 일시다. */
export function TransactionCard({ tx, showOwner }: { tx: TransactionView; showOwner: boolean }) { /* 지금 CardList 자식 그대로 */ }
```

`TransactionList.tsx`는 `columns` 대신 `transactionColumns(showOwner)`, 카드 자식은 `{(tx) => <TransactionCard tx={tx} showOwner={showOwner} />}`를 쓴다. 쓰지 않게 된 import는 지운다.

- [ ] **Step 4: 고정 머리 (`Dialog.tsx`, `Overlay.module.css`)**

```tsx
  pinnedHeader?: boolean
  ...
  const pinned = pinnedHeader ? ` ${styles.pinned}` : ''
  ...
      <Modal className={(narrow ? sheetClass : modalClass) + pinned}>
```

```css
/* 머리를 고정하고 본문 안의 목록만 스크롤하는 창. 본문이 남은 높이를 받고, 스크롤할 영역은 본문이 정한다. */
.pinned { display: flex; flex-direction: column; }
.pinned .content { flex: 1 1 auto; min-height: 0; }
.pinned .header { flex: none; }
```

- [ ] **Step 5: 창 (`CategoryTransactionsDialog.tsx`, `CategoryBreakdown.module.css`)**

- 파일 안 `columns` 상수를 지우고 `transactionColumns(true)`를 쓴다. 카드 자식은 `<TransactionCard tx={tx} showOwner />`.
- `DialogFrame`에 `pinnedHeader`를 더한다.
- 본문 구조:

```tsx
        <div className={styles.dialogBody}>
          {/* 불러오는 중·오류는 그대로 */}
          {transactions.isSuccess && <>
            <p className={styles.summary}>{items.length}건 · 합계 {formatWon(total)}</p>
            {items.length === 0 ? <p className={ui.status}>거래가 없습니다.</p> : (
              <div className={styles.dialogList} data-dialog-list="">
                {narrow ? <CardList …>{(tx) => <TransactionCard tx={tx} showOwner />}</CardList>
                  : <DataTable label="거래 목록" columns={transactionColumns(true)} items={items} rowText={(tx) => tx.description} onRowAction={() => {}} />}
              </div>
            )}
          </>}
        </div>
```

```css
/* 창 머리와 요약 줄은 고정하고 목록만 스크롤한다. 넓은 화면 높이는 전과 같다. */
.dialogBody { flex: 1 1 auto; min-height: 0; max-height: min(70vh, 680px); display: flex; flex-direction: column; gap: var(--space-4); }
.summary { flex: none; margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.dialogList { min-height: 0; overflow: auto; }
.dialogList thead th { position: sticky; top: 0; z-index: 1; background: var(--surface-000); box-shadow: inset 0 -1px var(--line); }
```

쓰지 않게 된 `.cardTop`, `.cardMeta`, `.txAmount`는 다른 곳에서 안 쓰면 지운다(`grep`으로 확인).

- [ ] **Step 6: 통과 확인**

Run: `cd apps/web && npx vitest run src/dashboard src/common/Dialog.test.tsx src/transactions`
Expected: PASS.

- [ ] **Step 7: 전체 검증**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`

- [ ] **Step 8: 커밋 (컨트롤러)**

```bash
git add apps/web/src/transactions/transactionRows.tsx apps/web/src/transactions/TransactionList.tsx apps/web/src/common/Dialog.tsx apps/web/src/common/Overlay.module.css apps/web/src/common/Dialog.test.tsx apps/web/src/dashboard/CategoryTransactionsDialog.tsx apps/web/src/dashboard/CategoryBreakdown.module.css apps/web/src/dashboard/CategoryTransactionsDialog.test.tsx
git commit -m "feat(web): 대분류 거래 창 목록을 거래 목록과 같게 하고 머리 고정"
```

---

### 마무리 (컨트롤러)

- [ ] `/verify`: 375×812·1280×800에서 행이 많은 대분류 창을 열고 목록 스크롤 전후 제목·요약·열 머리 위치가 같은지 잰다. 스크린샷을 `.verify-artifacts/`에 남긴다.
- [ ] `.claude/skills/verify/features/dashboard.md`의 Category drill-down 문장을 새 구성(카테고리 열, 카드 2줄, 고정 머리)에 맞춘다.
- [ ] Codex 리뷰(한도가 풀린 뒤) → 반영 → PR(base `claude/transactions-fit-layout`).
