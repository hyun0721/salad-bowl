# Plan 17 거래 목록 화면 높이 맞춤과 전체 너비 목록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좁은 화면 거래 목록이 창 높이에 맞고 목록만 안에서 스크롤하며, 목록은 전체 너비, 풋터는 `현재 / 전체` + 아이콘 이동 버튼, 추가 버튼은 `+ 추가`, 카드 2줄은 `분류 | 메모` + 일시가 된다.

**Architecture:** 거래 페이지 루트가 `data-fit-viewport`를 달고, `AppLayout.module.css`가 `:has()`로 그 표시가 있을 때만 좁은 화면 셸을 `100dvh`로 고정한다. 목록 영역(`.layout`)은 본문 여백만큼 음수 여백으로 늘려 전체 너비가 된다. 풋터·카드·추가 버튼은 `TransactionList.tsx`·`TransactionsPage.tsx` 안에서만 바뀐다.

**Tech Stack:** React 19, CSS Modules, react-aria-components(GridList), Vitest + Testing Library + MSW.

**설계:** [거래 목록 화면 높이 맞춤과 전체 너비 목록 설계](../specs/2026-10-30-transactions-fit-layout-design.md)

## Global Constraints

- 구현은 `apps/web`만 바꾼다. 기능 지도(`.claude/skills/verify/features/transactions.md`)와 검증 산출물은 컨트롤러가 쓴다.
- 좁은 화면 기준은 `(max-width: 820px)`다(`useMediaQuery(NARROW)`와 CSS 미디어 쿼리).
- 토큰만 쓴다: 간격 `--space-*`, 컨트롤 높이 `--control-height`(넓은 32px, 좁은 44px). 16px 같은 고정 여백값을 새로 쓰지 않는다. 하단 탭 바 높이 `56px`은 기존 값 그대로 쓴다.
- 본문 좌우 여백 식(음수 여백도 같은 식): 넓은 화면 `max(var(--space-5), env(safe-area-inset-left|right, 0px))`, 좁은 화면 `max(var(--space-4), env(safe-area-inset-left|right, 0px))`. 넓은 화면 아래 여백 `var(--space-6)`.
- 높이 맞춤은 거래 목록 화면에만 적용한다. 다른 화면의 스크롤 동작은 바꾸지 않는다.
- 공용 `ui.row`에 자식 선택자를 걸지 않는다(풋터 등 다른 곳도 `ui.row`를 쓴다).
- 접근 이름 유지: 추가 버튼 `거래 추가`, 이동 버튼 `이전 페이지`/`다음 페이지`, 풋터 `nav` `거래 목록 페이지`, 목록 `거래 목록`.
- 메모 구분자: 분류 정보와 메모 사이 ` | `. `|`는 `aria-hidden="true"`인 span이고 앞뒤 공백은 그 밖의 텍스트다. 메모가 null·빈 문자열·공백만이면 구분자와 메모를 모두 생략한다.
- 넓은 화면 표(`DataTable`) 열 구성, 검색 대상, 페이지 크기 500은 바꾸지 않는다.
- 최종 검증: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`.
- 구현은 Codex `write`(codex-collab 3장, `apps/web` Task), 리뷰는 Claude sonnet. 커밋은 컨트롤러가 한다.

---

### Task 1: 화면 높이 맞춤·전체 너비 목록·페이징 풋터

담당: Codex `write` medium → 리뷰 Claude sonnet

**Files:**
- Modify: `apps/web/src/app/AppLayout.module.css`
- Modify: `apps/web/src/transactions/TransactionsPage.tsx` (페이지 루트 속성, 필터 순서)
- Modify: `apps/web/src/transactions/TransactionsPage.module.css`
- Modify: `apps/web/src/transactions/TransactionList.tsx` (풋터)
- Test: `apps/web/src/transactions/TransactionsPage.test.tsx`

**Interfaces:**
- Produces: 페이지 루트 `data-fit-viewport` 속성(값 없음). 풋터 `role="status"` 텍스트는 `{현재} / {전체}` 뒤에 화면에서 숨긴 `, {첫}–{끝} / {총}건`.

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`TransactionsPage.test.tsx`의 `'pages 500 transactions and searches the whole month (narrow: %s)'`에서 status 단정을 바꾸고, 새 테스트 두 개를 더한다.

```tsx
    // 기존 expect(screen.getByRole('status')).toHaveTextContent('1–500 / 501건') 세 곳을 아래처럼 바꾼다.
    // 첫 번째(첫 렌더 직후)
    expect(screen.getByRole('status')).toHaveTextContent(/^1 \/ 2/)
    expect(screen.getByRole('status')).toHaveTextContent('1–500 / 501건')
    // 넓은 화면 정렬 뒤
    expect(screen.getByRole('status')).toHaveTextContent(/^1 \/ 2/)
    // 검색 뒤
    expect(screen.getByRole('status')).toHaveTextContent(/^1 \/ 1/)
    expect(screen.getByRole('status')).toHaveTextContent('1–1 / 1건')
```

다음 페이지로 간 직후(`거래 501`이 보이는 단정 다음)에 추가:

```tsx
    expect(screen.getByRole('status')).toHaveTextContent(/^2 \/ 2/)
```

새 테스트(같은 `describe` 안, 위 테스트 다음):

```tsx
  it('shows the page footer as current / total with icon buttons', async () => {
    mockViewport(true)
    mineHandler([{ ...base }])
    renderPage(<TransactionsPage today={today} />, { groups })
    const footer = await screen.findByRole('navigation', { name: '거래 목록 페이지' })
    expect(within(footer).getByRole('button', { name: '이전 페이지' })).toHaveTextContent(/^$/)
    expect(within(footer).getByRole('button', { name: '다음 페이지' })).toHaveTextContent(/^$/)
    expect(within(footer).getByRole('status')).toHaveTextContent(/^1 \/ 1/)
  })

  it('marks the page so the shell fits the viewport', async () => {
    mineHandler([{ ...base }])
    renderPage(<TransactionsPage today={today} />, { groups })
    const heading = await screen.findByRole('heading', { level: 1, name: '거래 목록' })
    expect(heading.closest('[data-fit-viewport]')).not.toBeNull()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/transactions/TransactionsPage.test.tsx`
Expected: 위 세 테스트가 FAIL(`1 / 2`로 시작하지 않음, 버튼에 글자가 있음, `data-fit-viewport` 없음).

- [ ] **Step 3: 셸 규칙 (`AppLayout.module.css`)**

파일 끝(넓은 화면 `@media (min-width: 821px)` 블록 다음)에 추가:

```css
/* 페이지가 data-fit-viewport를 달면 좁은 화면에서도 창 높이에 맞추고 페이지 안에서 스크롤한다. 본문 아래는 탭 바 높이만 비운다. */
@media (max-width: 820px) {
  .shell:has([data-fit-viewport]) { height: 100vh; height: 100dvh; flex-wrap: nowrap; }
  .shell:has([data-fit-viewport]) .main { min-height: 0; }
  .content:has(> [data-fit-viewport]) { flex: 1; min-height: 0; overflow: hidden; padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
}
```

`.content:has(> …)`는 `.withTabBar`보다 구체성이 높아 아래 여백을 덮어쓴다.

- [ ] **Step 4: 페이지 (`TransactionsPage.tsx`)**

루트에 표시를 달고, 필터 줄에 전용 클래스를 주고, `MonthPicker`를 줄의 첫 자식으로 옮긴다(화면 순서와 포커스 순서를 같게 하려고 CSS `order` 대신 DOM 순서를 바꾼다).

```tsx
    <div className={styles.page} data-fit-viewport="">
      ...
      <div className={`${ui.row} ${styles.filters}`}>
        <MonthPicker month={month} onChange={changeMonth} />
        <SegmentedControl label="범위" items={[{ id: 'mine', label: '내 거래' }, { id: 'group', label: '그룹 거래', isDisabled: selectedGroupId === null }]}
          selectedKey={inGroup ? 'group' : 'mine'} onSelectionChange={(id) => changeScope(id as Scope)} />
        {/* 멤버 Select, 멤버 오류, SearchField는 지금 순서 그대로 */}
```

- [ ] **Step 5: 페이지 CSS (`TransactionsPage.module.css`)**

바꿀 규칙(나머지는 유지):

```css
/* 목록과 오른쪽 패널을 본문 여백 밖까지 늘려 전체 너비로 둔다. 여백 식은 AppLayout .content와 같아야 한다. */
.layout { flex: 1; min-height: 0; display: flex; margin: 0 calc(-1 * max(var(--space-5), env(safe-area-inset-right, 0px))) calc(-1 * var(--space-6)) calc(-1 * max(var(--space-5), env(safe-area-inset-left, 0px))); }
.listCard { flex: 1 1 0; padding: 0; min-height: 0; overflow: hidden; gap: 0; border-width: 1px 0 0; border-radius: 0; }
.panel { flex: 0 0 360px; overflow-y: auto; border-width: 1px 0 0 1px; border-radius: 0; }
@media (max-width: 820px) {
  /* 좁은 화면은 아래 여백이 탭 바 자리라 좌우만 늘린다. 첫 줄은 월 선택만 둔다. */
  .layout { margin: 0 calc(-1 * max(var(--space-4), env(safe-area-inset-right, 0px))) 0 calc(-1 * max(var(--space-4), env(safe-area-inset-left, 0px))); }
  .filters > :first-child { flex: 1 1 100%; }
  /* 사이드바를 연 채 창을 좁히면 목록과 패널을 세로로 배치한다. (리뷰 뒤 4fe70ed에서 wrap 대신 이 규칙으로 바뀜) */
  .layout:has(> .panel) { flex-direction: column; }
  .panel { flex: 0 1 auto; max-height: 60%; border-width: 1px 0 0; }
}
.pagination { flex: none; display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-top: 1px solid var(--line); }
.pageStep { width: var(--control-height); padding: 0; }
```

지울 규칙: 기존 `.layout { … gap: var(--space-3); }`의 gap, 기존 `@media (max-width: 820px) { .layout { flex-wrap: wrap; } .panel { flex: 1 1 100%; } }` 블록(위 블록으로 대체), 기존 `@media (max-width: 820px) { .listScroll { flex: auto; max-height: 60vh; max-height: 60dvh; } }` 블록과 그 위 주석.

- [ ] **Step 6: 풋터 (`TransactionList.tsx`)**

`import Icon from '../common/Icon'`을 더하고 `<nav>`를 바꾼다.

```tsx
      <nav aria-label="거래 목록 페이지" className={styles.pagination}>
        <span role="status">
          {page + 1} / {pageCount}
          <span className={styles.visuallyHidden}>, {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} / {items.length}건</span>
        </span>
        <button type="button" className={`${ui.button} ${styles.pageStep}`} aria-label="이전 페이지"
          disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="chevron-left" size={18} /></button>
        <button type="button" className={`${ui.button} ${styles.pageStep}`} aria-label="다음 페이지"
          disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}><Icon name="chevron-right" size={18} /></button>
      </nav>
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/web && npx vitest run src/transactions/TransactionsPage.test.tsx`
Expected: PASS

- [ ] **Step 8: 전체 검증**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 성공, 새 lint 경고 없음.

- [ ] **Step 9: 커밋 (컨트롤러)**

```bash
git add apps/web/src/app/AppLayout.module.css apps/web/src/transactions/TransactionsPage.tsx apps/web/src/transactions/TransactionsPage.module.css apps/web/src/transactions/TransactionList.tsx apps/web/src/transactions/TransactionsPage.test.tsx
git commit -m "feat(web): 거래 목록을 화면 높이에 맞추고 전체 너비로 표시"
```

---

### Task 2: 추가 버튼과 좁은 화면 항목 배치

담당: Codex `write` medium(Task 1 세션 `resume`이 아니라 새 세션) → 리뷰 Claude sonnet

**Files:**
- Modify: `apps/web/src/transactions/TransactionsPage.tsx` (추가 버튼)
- Modify: `apps/web/src/transactions/TransactionList.tsx` (카드 2줄)
- Modify: `apps/web/src/transactions/TransactionsPage.module.css` (`.cardMeta`, `.cardInfo`, `.when`)
- Test: `apps/web/src/transactions/TransactionsPage.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `TransactionList.tsx`·`TransactionsPage.module.css`(풋터 규칙 유지).

- [ ] **Step 1: 실패하는 테스트**

`'shows cards with description, amount and details on a narrow screen'`을 아래로 바꾼다.

```tsx
  it('shows cards with category | memo and the time under the amount on a narrow screen', async () => {
    mockViewport(true)
    mineHandler([
      { ...base, edited: true, memo: '회사 앞 김밥' },
      { ...base, id: 2, description: '커피', categoryMinor: '', memo: '   ' },
    ])
    renderPage(<TransactionsPage today={today} />, { groups })

    const list = await screen.findByRole('grid', { name: '거래 목록' })
    const card = within(list).getByRole('row', { name: /김밥/ })
    expect(card).toHaveTextContent(/김밥.*-₩ 4,000.*식비 · 점심 \| 회사 앞 김밥.*수정됨.*10-05 12:30/)
    expect(within(card).getByText('|')).toHaveAttribute('aria-hidden', 'true')
    const plain = within(list).getByRole('row', { name: /커피/ })
    expect(plain).toHaveTextContent(/식비10-05 12:30$/)
    expect(plain).not.toHaveTextContent('|')
    expect(within(list).queryByRole('columnheader')).not.toBeInTheDocument()
  })

  it('labels the add button 추가 while keeping its accessible name', async () => {
    mineHandler([])
    renderPage(<TransactionsPage today={today} />, { groups })
    const add = await screen.findByRole('button', { name: '거래 추가' })
    expect(add).toHaveTextContent(/^추가$/)
  })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/transactions/TransactionsPage.test.tsx -t "category \\| memo|add button"`
Expected: FAIL 2건.

- [ ] **Step 3: 추가 버튼 (`TransactionsPage.tsx`)**

```tsx
        <button type="button" className={`${ui.button} ${ui.primary}`} aria-label="거래 추가"
          onClick={() => { setAdding(true); setSelectedId(null) }}><Icon name="plus" />추가</button>
```

- [ ] **Step 4: 카드 (`TransactionList.tsx`)**

`CardList` 자식의 둘째 줄을 바꾼다. `category` 헬퍼는 표 열이 계속 쓰므로 둔다.

```tsx
const memoOf = (tx: TransactionView) => tx.memo?.trim() || null
```

```tsx
          <div className={styles.cardMeta}>
            <span className={styles.cardInfo}>
              {[tx.categoryMajor, tx.categoryMinor, showOwner ? tx.ownerNickname : null].filter(Boolean).join(' · ')}
              {memoOf(tx) && <>{' '}<span aria-hidden="true">|</span>{' '}{memoOf(tx)}</>}
            </span>
            {editedBadge(tx)}
            <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span>
          </div>
```

- [ ] **Step 5: 카드 CSS (`TransactionsPage.module.css`)**

```css
.cardMeta { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--ink-muted); }
/* 분류 | 메모는 한 줄로 두고 넘치면 말줄임한다. 메모 전문은 상세 창에서 본다. */
.cardInfo { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cardMeta .when { flex: none; margin-left: auto; }
```

기존 `.cardMeta`의 `overflow-wrap: anywhere`는 지운다(2줄은 말줄임으로 바뀜). `.when, .amount` 규칙은 유지한다.

- [ ] **Step 6: 통과 확인**

Run: `cd apps/web && npx vitest run src/transactions/TransactionsPage.test.tsx`
Expected: PASS (기존 `keeps long unbroken descriptions and categories readable` 포함).

- [ ] **Step 7: 전체 검증**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 성공.

- [ ] **Step 8: 커밋 (컨트롤러)**

```bash
git add apps/web/src/transactions/TransactionsPage.tsx apps/web/src/transactions/TransactionList.tsx apps/web/src/transactions/TransactionsPage.module.css apps/web/src/transactions/TransactionsPage.test.tsx
git commit -m "feat(web): 거래 추가 버튼을 줄이고 카드에 분류 | 메모와 일시를 나눠 표시"
```

---

### 마무리 (컨트롤러)

- [ ] `/verify` 스택에서 설계 7장의 측정(375×812: 문서 높이 = 창 높이, 목록 내부 스크롤, 풋터 아래 = 탭 바 위, 목록 좌우 = 화면 끝 / 그룹 거래 + 멤버 선택 / 1280×800 문서 높이 = 창 높이, 오른쪽 패널 / 홈·대시보드 페이지 스크롤 유지)을 하고 전후 스크린샷을 `.verify-artifacts/`에 남긴다. 시드는 한 달 6건이라 목록이 넘치지 않으므로, 화면의 `추가` 흐름으로 가짜 거래를 더해 내부 스크롤을 확인한다.
- [ ] `.claude/skills/verify/features/transactions.md`: 추가 버튼 글자(`추가`, 이름 `거래 추가`), 풋터 `현재 / 전체`, 좁은 화면 높이 맞춤, 카드 `분류 | 메모` 규칙을 반영한다.
- [ ] 브랜치 최종 리뷰(opus, codex-collab 3장) 뒤 PR.
