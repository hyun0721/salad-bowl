# 거래 목록 필터·정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Claude 세션은 `.claude/skills/codex-collab/SKILL.md`의 담당·리뷰 표를 따른다.

**Goal:** 거래 목록 API에 분류·타입 필터와 정렬을 추가하고, 재사용 가능한 `FilterButton`·`SortButton`을 만들어 거래목록 화면과 분포 팝업에 붙인다.

**Architecture:** API는 기존 조회(공개 범위·소유권 판단 포함) 결과인 `List<TransactionView>`에 `TransactionQuery`를 적용해 거르고 정렬한다. 화면에 보이는 값(`displayType`, 표시용 분류)과 같은 기준으로 거르기 위해 쿼리 조건이 아니라 뷰 목록에서 처리한다. 웹 부품은 도메인을 모르는 `src/common/` 부품이고, 거래 화면이 그룹·옵션을 계산해 넘긴다.

**Tech Stack:** Spring Boot(JDK 21, MockMvc + Testcontainers), React + react-aria-components + TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-02-transaction-filter-sort-design.md`

## Global Constraints

- 정렬 값: `DATE_DESC`(기본) · `DATE_ASC` · `AMOUNT_DESC` · `AMOUNT_ASC`. 금액은 절댓값 기준, 동률은 `occurredAt` 내림차순 → `id` 내림차순.
- 필터: `major`·`minor`·`type` 반복 파라미터. 같은 항목 안은 OR, 항목 사이는 AND. 빈 문자열 `minor`는 미분류.
- 잘못된 `sort`·`type` 값은 400 `VALIDATION_FAILED`(기존 `MethodArgumentTypeMismatchException` 처리).
- 공개 범위·소유권·숨김 판단 쿼리(`findOwnedBetween`, `findVisibleBetween`, `GroupAccess`)는 바꾸지 않는다.
- 아이콘은 Lucide `lucide-static@1.61.0` 경로를 복사한다. 새 의존성을 추가하지 않는다.
- 적용 상태 표시: 아이콘 교체 + `--brand-tint` 배경, `--brand` 테두리·아이콘 색. 색만으로 상태를 전달하지 않는다.
- 모바일(375px) 우선. 테스트 데이터는 코드로 만든 가짜 데이터만 쓴다.
- 웹 최종 검증: `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`. API: `apps/api`에서 `./gradlew test`.

## PR 구성

- **PR 1** (`feat(api): ...`): Task 1.
- **PR 2** (`feat(web): ...`): Task 2~5. 375px 이전·이후 캡처를 `pr-assets` 브랜치에 올린다.

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/api/.../transaction/TransactionSort.java` (생성) | 정렬 enum + Comparator |
| `apps/api/.../transaction/TransactionQuery.java` (생성) | 필터·정렬 값 묶음, `apply(List<TransactionView>)` |
| `apps/api/.../transaction/TransactionService.java` (수정) | `myTransactions`·`groupTransactions`가 `TransactionQuery`를 받는다 |
| `apps/api/.../transaction/SummaryService.java` (수정) | `categoryTransactions`가 `TransactionSort`를 받는다 |
| `apps/api/.../transaction/TransactionController.java`, `SummaryController.java` (수정) | 파라미터 바인딩 |
| `apps/web/src/common/Icon.tsx` (수정) | 아이콘 5개 추가 |
| `apps/web/src/common/OptionButton.module.css` (생성) | 두 버튼·패널 공용 스타일 |
| `apps/web/src/common/SortButton.tsx` (생성) | 정렬 버튼 + 모달 |
| `apps/web/src/common/FilterButton.tsx` (생성) | 필터 버튼 + 모달 |
| `apps/web/src/transactions/transactionQuery.ts` (생성) | 거래 필터·정렬 타입, 쿼리 파라미터 변환, 필터 그룹 계산 |
| `apps/web/src/transactions/transactionsApi.ts`, `TransactionsPage.tsx` (수정) | 거래목록 적용 |
| `apps/web/src/dashboard/dashboardApi.ts`, `CategoryTransactionsDialog.tsx` (수정) | 분포 팝업 정렬 |

---

### Task 1: API 필터·정렬 파라미터

**담당:** Codex `gpt-6-sol` / `medium` (`api` 모드). 리뷰: Claude sonnet.

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionSort.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionQuery.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java:61-121`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionController.java:35-67`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java:156-170`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryController.java:49-55`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/TransactionQueryApiTest.java`, `SummaryApiTest.java`

**Interfaces:**
- Produces (HTTP): `GET /me/transactions` · `GET /groups/{id}/transactions` 에 `major*`, `minor*`, `type*`, `sort`. `GET /groups/{id}/summary/transactions` 에 `sort`.

- [ ] **Step 1: 실패하는 테스트 작성** — `TransactionQueryApiTest`에 추가. 기존 `save` 헬퍼는 EXPENSE·식비 고정이므로 타입·분류를 받는 헬퍼를 추가한다.

```java
    private LedgerTransaction save(AuthedUser owner, TransactionType type, String dateTime, String major,
                                   String description, long amount) {
        return transactions.save(LedgerTransaction.manual(owner.id(),
                TestLedger.data(type, dateTime, major, description, amount)));
    }

    @Test
    void myTransactionsFilterByMajorAndTypeWithOrInsideAndAcross() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "점심", -8000);
        save(member, TransactionType.EXPENSE, "2026-09-02T09:00:00", "교통", "버스", -1500);
        save(member, TransactionType.EXPENSE, "2026-09-03T09:00:00", "쇼핑", "옷", -30000);
        save(member, TransactionType.INCOME, "2026-09-04T09:00:00", "식비", "환급", 2000);

        mvc.perform(get("/me/transactions").param("month", "2026-09")
                        .param("major", "식비", "교통").param("type", "EXPENSE")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].description").value("버스"))
                .andExpect(jsonPath("$[1].description").value("점심"));
    }

    @Test
    void myTransactionsFilterUncategorizedMinorWithEmptyValue() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "미분류 거래", -1000);

        mvc.perform(get("/me/transactions").param("month", "2026-09").param("minor", "")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void myTransactionsSortByAbsoluteAmountThenNewest() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "작은", -1000);
        save(member, TransactionType.INCOME, "2026-09-02T09:00:00", "급여", "큰", 50000);
        save(member, TransactionType.EXPENSE, "2026-09-03T09:00:00", "식비", "중간-새", -5000);
        save(member, TransactionType.EXPENSE, "2026-09-01T10:00:00", "식비", "중간-옛", -5000);

        mvc.perform(get("/me/transactions").param("month", "2026-09").param("sort", "AMOUNT_DESC")
                        .header("Authorization", member.bearer()))
                .andExpect(jsonPath("$[*].description").value(org.hamcrest.Matchers.contains("큰", "중간-새", "중간-옛", "작은")));
        mvc.perform(get("/me/transactions").param("month", "2026-09").param("sort", "AMOUNT_ASC")
                        .header("Authorization", member.bearer()))
                .andExpect(jsonPath("$[*].description").value(org.hamcrest.Matchers.contains("작은", "중간-새", "중간-옛", "큰")));
        mvc.perform(get("/me/transactions").param("month", "2026-09").param("sort", "DATE_ASC")
                        .header("Authorization", member.bearer()))
                .andExpect(jsonPath("$[0].description").value("작은"));
    }

    @Test
    void invalidSortOrTypeIsRejected() throws Exception {
        mvc.perform(get("/me/transactions").param("month", "2026-09").param("sort", "price")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/me/transactions").param("month", "2026-09").param("type", "GIFT")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void groupFilterDoesNotRevealHiddenTransactions() throws Exception {
        LedgerTransaction hidden = save(member, TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "숨김", -1000);
        hidden.setHidden(true);
        transactions.save(hidden);

        mvc.perform(get("/groups/{id}/transactions", groupId).param("month", "2026-09").param("major", "식비")
                        .header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
```

`SummaryApiTest`에는 기존 `categoryTransactions` 테스트의 준비 코드를 그대로 쓰고 `.param("sort", "AMOUNT_DESC")`를 붙여 금액 큰 순서를 확인하는 테스트 하나를 추가한다(기존 테스트 파일의 거래 생성 헬퍼를 사용).

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TransactionQueryApiTest' --tests '*SummaryApiTest'`
Expected: 새 테스트가 FAIL (필터가 무시되어 건수 불일치, 잘못된 값이 200).

- [ ] **Step 3: `TransactionSort` 구현**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;

import java.util.Comparator;

/** 거래 목록 정렬. 동률은 최신순으로 고정한다. */
public enum TransactionSort {
    DATE_DESC, DATE_ASC, AMOUNT_DESC, AMOUNT_ASC;

    private static final Comparator<TransactionView> NEWEST =
            Comparator.comparing(TransactionView::occurredAt).thenComparingLong(TransactionView::id).reversed();

    public Comparator<TransactionView> comparator() {
        Comparator<TransactionView> amount = Comparator.comparing(tx -> tx.amount().abs());
        return switch (this) {
            case DATE_DESC -> NEWEST;
            case DATE_ASC -> NEWEST.reversed();
            case AMOUNT_DESC -> amount.reversed().thenComparing(NEWEST);
            case AMOUNT_ASC -> amount.thenComparing(NEWEST);
        };
    }
}
```

- [ ] **Step 4: `TransactionQuery` 구현**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;

import java.util.List;

/** 조회 결과에 적용하는 화면 필터·정렬. 비어 있는 목록은 그 항목을 거르지 않는다. */
public record TransactionQuery(List<String> majors, List<String> minors, List<TransactionType> types,
                               TransactionSort sort) {

    public static final TransactionQuery NONE = new TransactionQuery(null, null, null, null);

    public TransactionQuery {
        majors = majors == null ? List.of() : List.copyOf(majors);
        minors = minors == null ? List.of() : List.copyOf(minors);
        types = types == null ? List.of() : List.copyOf(types);
        sort = sort == null ? TransactionSort.DATE_DESC : sort;
    }

    public List<TransactionView> apply(List<TransactionView> views) {
        return views.stream()
                .filter(tx -> majors.isEmpty() || majors.contains(tx.categoryMajor()))
                .filter(tx -> minors.isEmpty() || minors.contains(tx.categoryMinor()))
                .filter(tx -> types.isEmpty() || types.contains(tx.type()))
                .sorted(sort.comparator())
                .toList();
    }
}
```

주의: `@RequestParam List<String> minor`에 `minor=` 하나만 오면 Spring이 빈 리스트로 바꿀 수 있다. Step 2에서 미분류 테스트가 실패한 이유가 이것이면 컨트롤러에서 `String[]`로 받아 `List.of(array)`로 넘긴다. 테스트로 확인하고 맞는 쪽을 남긴다.

- [ ] **Step 5: 서비스·컨트롤러 연결**

`TransactionService`:

```java
    public List<TransactionView> myTransactions(long userId, YearMonth month, TransactionQuery query) {
        Range range = monthRange(month);
        return query.apply(views.toViews(transactions.findOwnedBetween(userId, range.from(), range.to()), owner -> true));
    }

    public List<TransactionView> groupTransactions(long groupId, long userId, YearMonth month, Long memberId,
                                                   TransactionQuery query) {
        // 기존 본문 유지, 마지막 return만 query.apply(...)로 감싼다.
    }
```

기존 호출부(테스트 포함)는 `grep -rn "myTransactions(\|groupTransactions(" apps/api/src`로 찾아 `TransactionQuery.NONE`을 넘긴다.

`TransactionController`:

```java
    @GetMapping("/me/transactions")
    public List<TransactionView> mine(@CurrentUser Long userId, @RequestParam YearMonth month,
                                      @RequestParam(required = false) List<String> major,
                                      @RequestParam(required = false) List<String> minor,
                                      @RequestParam(required = false) List<TransactionType> type,
                                      @RequestParam(defaultValue = "DATE_DESC") TransactionSort sort) {
        return transactionService.myTransactions(userId, month, new TransactionQuery(major, minor, type, sort));
    }
```

`group(...)`도 같은 네 파라미터를 받아 넘긴다.

`SummaryService.categoryTransactions`에 `TransactionSort sort`를 추가하고 `views.toViews(...)` 결과에 `.stream().sorted(sort.comparator()).toList()`를 적용한다. `SummaryController`는 `@RequestParam(defaultValue = "DATE_DESC") TransactionSort sort`를 받는다.

- [ ] **Step 6: 통과 확인**

Run: `cd apps/api && ./gradlew test`
Expected: 전체 PASS.

- [ ] **Step 7: 커밋** (컨트롤러가 수행)

```bash
git add apps/api
git commit -m "feat(api): 거래 목록 분류·타입 필터와 정렬 파라미터 추가"
```

---

### Task 2: 아이콘과 `SortButton`

**담당:** Codex `gpt-6-astra` / `medium` (`write`). 리뷰: Claude sonnet.

**Files:**
- Modify: `apps/web/src/common/Icon.tsx`
- Create: `apps/web/src/common/OptionButton.module.css`
- Create: `apps/web/src/common/SortButton.tsx`
- Test: `apps/web/src/common/SortButton.test.tsx`

**Interfaces:**
- Produces:

```ts
export type SortOption<T extends string> = { value: T; label: string; direction: 'asc' | 'desc' }
export default function SortButton<T extends string>(props: {
  options: SortOption<T>[]; value: T; defaultValue: T; onApply: (next: T) => void
}): JSX.Element
```
- `IconName`에 `funnel`, `funnel-filled`, `arrow-up-down`, `arrow-down-wide-narrow`, `arrow-up-narrow-wide` 추가.

- [ ] **Step 1: 아이콘 추가** (`ICONS` 객체 끝, `sheet-upload` 앞뒤 순서는 무관)

```tsx
  funnel: <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />,
  // 도메인 아이콘: funnel 경로를 채워 '필터 적용됨'을 나타낸다.
  'funnel-filled': <path fill="currentColor" d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />,
  'arrow-up-down': (
    <>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </>
  ),
  'arrow-down-wide-narrow': (
    <>
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="M11 4h10" />
      <path d="M11 8h7" />
      <path d="M11 12h4" />
    </>
  ),
  'arrow-up-narrow-wide': (
    <>
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
      <path d="M11 12h4" />
      <path d="M11 16h7" />
      <path d="M11 20h10" />
    </>
  ),
```

- [ ] **Step 2: 실패하는 테스트 작성** — `Select.test.tsx`의 `mockViewport` 패턴을 따른다.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockViewport } from '../test/mockViewport'
import SortButton, { type SortOption } from './SortButton'

type S = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC'
const options: SortOption<S>[] = [
  { value: 'DATE_DESC', label: '최신순', direction: 'desc' },
  { value: 'DATE_ASC', label: '오래된순', direction: 'asc' },
  { value: 'AMOUNT_DESC', label: '금액 큰 순', direction: 'desc' },
]
afterEach(() => vi.unstubAllGlobals())

describe('SortButton', () => {
  it('names the current sort and marks non-default as applied', () => {
    const { rerender } = render(<SortButton options={options} value="DATE_DESC" defaultValue="DATE_DESC" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '정렬, 최신순' })).not.toHaveAttribute('data-applied')
    rerender(<SortButton options={options} value="AMOUNT_DESC" defaultValue="DATE_DESC" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '정렬, 금액 큰 순' })).toHaveAttribute('data-applied')
  })

  it('applies the draft only on 적용, and 초기화 resets the draft to default', async () => {
    mockViewport(true)
    const onApply = vi.fn()
    render(<SortButton options={options} value="AMOUNT_DESC" defaultValue="DATE_DESC" onApply={onApply} />)
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    await userEvent.click(screen.getByRole('radio', { name: '오래된순' }))
    expect(onApply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByRole('radio', { name: '최신순' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onApply).toHaveBeenCalledWith('DATE_DESC')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('discards the draft when closed without applying', async () => {
    render(<SortButton options={options} value="DATE_DESC" defaultValue="DATE_DESC" onApply={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    await userEvent.click(screen.getByRole('radio', { name: '오래된순' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    expect(screen.getByRole('radio', { name: '최신순' })).toBeChecked()
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/SortButton.test.tsx`
Expected: FAIL (모듈 없음).

- [ ] **Step 4: 구현**

`OptionButton.module.css`:

```css
.applied { background: var(--brand-tint); border-color: var(--brand); color: var(--brand); }
.panel { display: grid; gap: 16px; padding: 16px; min-width: 260px; }
.group { display: grid; gap: 8px; border: 0; margin: 0; padding: 0; }
.legend { font-weight: 700; margin-bottom: 4px; }
.radio { display: flex; align-items: center; gap: 8px; min-height: 40px; cursor: pointer; }
.actions { display: flex; gap: 8px; justify-content: flex-end; }
```

`SortButton.tsx`:

```tsx
import { useState } from 'react'
import { DialogTrigger, Radio, RadioGroup, Label } from 'react-aria-components'
import Icon from './Icon'
import { ResponsiveOverlay } from './ResponsiveOverlay'
import { useNarrowWhileOpen } from './useMediaQuery'
import ui from './ui.module.css'
import styles from './OptionButton.module.css'

export type SortOption<T extends string> = { value: T; label: string; direction: 'asc' | 'desc' }
type Props<T extends string> = { options: SortOption<T>[]; value: T; defaultValue: T; onApply: (next: T) => void }

export default function SortButton<T extends string>({ options, value, defaultValue, onApply }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const mobile = useNarrowWhileOpen(open)
  const current = options.find((o) => o.value === value)
  const applied = value !== defaultValue
  const icon = !applied ? 'arrow-up-down' : current?.direction === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow'

  function toggle(next: boolean) {
    if (next) setDraft(value)
    setOpen(next)
  }

  return (
    <DialogTrigger isOpen={open} onOpenChange={toggle}>
      <button type="button" className={`${ui.button} ${ui.iconButton} ${applied ? styles.applied : ''}`}
        data-applied={applied || undefined} aria-label={`정렬, ${current?.label ?? ''}`}>
        <Icon name={icon} />
      </button>
      <ResponsiveOverlay mobile={mobile} title="정렬">
        <div className={styles.panel}>
          <RadioGroup value={draft} onChange={(v) => setDraft(v as T)} className={styles.group}>
            <Label className={styles.legend}>정렬 기준</Label>
            {options.map((o) => <Radio key={o.value} value={o.value} className={styles.radio}>{o.label}</Radio>)}
          </RadioGroup>
          <div className={styles.actions}>
            <button type="button" className={ui.button} onClick={() => setDraft(defaultValue)}>초기화</button>
            <button type="button" className={`${ui.button} ${ui.primary}`}
              onClick={() => { onApply(draft); setOpen(false) }}>적용</button>
          </div>
        </div>
      </ResponsiveOverlay>
    </DialogTrigger>
  )
}
```

`DialogTrigger`의 트리거가 react-aria `Button`이어야 하면(테스트에서 열리지 않으면) 일반 `button` 대신 `react-aria-components`의 `Button`을 쓰고 같은 className을 준다. 라디오 선택 표시는 `Radio`의 render props로 `SelectionIndicator`(`src/common/SelectionIndicator.tsx`)를 쓸 수 있으면 그것을 따른다.

- [ ] **Step 5: 통과 확인**

Run: `cd apps/web && npx vitest run src/common/SortButton.test.tsx`
Expected: PASS.

- [ ] **Step 6: 커밋** (컨트롤러)

```bash
git add apps/web/src/common
git commit -m "feat(web): 정렬 버튼 공용 부품 추가"
```

---

### Task 3: `FilterButton`

**담당:** Codex `gpt-6-astra` / `medium` (`write`). 리뷰: Claude sonnet.

**Files:**
- Create: `apps/web/src/common/FilterButton.tsx`
- Test: `apps/web/src/common/FilterButton.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `OptionButton.module.css`, 아이콘 `funnel`/`funnel-filled`, `Checkbox`(`src/common/Checkbox.tsx`).
- Produces:

```ts
export type FilterGroup = { key: string; label: string; options: { value: string; label: string }[] }
export type FilterValue = Record<string, string[]>
export default function FilterButton(props: {
  groups: FilterGroup[]
  value: FilterValue
  onApply: (next: FilterValue) => void
  onDraftChange?: (draft: FilterValue) => void
}): JSX.Element
export function countFilters(value: FilterValue): number
```

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FilterButton, { countFilters, type FilterGroup } from './FilterButton'

const groups: FilterGroup[] = [
  { key: 'type', label: '타입', options: [{ value: 'EXPENSE', label: '지출' }, { value: 'INCOME', label: '수입' }] },
  { key: 'major', label: '대분류', options: [{ value: '식비', label: '식비' }] },
]

describe('FilterButton', () => {
  it('counts selections across groups', () => {
    expect(countFilters({ type: ['EXPENSE', 'INCOME'], major: [] })).toBe(2)
  })

  it('shows the applied state with count in its name', () => {
    const { rerender } = render(<FilterButton groups={groups} value={{}} onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '필터' })).not.toHaveAttribute('data-applied')
    rerender(<FilterButton groups={groups} value={{ type: ['EXPENSE'] }} onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '필터, 1개 적용됨' })).toHaveAttribute('data-applied')
  })

  it('multi-selects in a draft, applies on 적용, and resets with 초기화', async () => {
    const onApply = vi.fn()
    const onDraftChange = vi.fn()
    render(<FilterButton groups={groups} value={{ major: ['식비'] }} onApply={onApply} onDraftChange={onDraftChange} />)
    await userEvent.click(screen.getByRole('button', { name: /필터/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: '지출' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '수입' }))
    expect(onDraftChange).toHaveBeenLastCalledWith({ major: ['식비'], type: ['EXPENSE', 'INCOME'] })
    expect(onApply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByRole('checkbox', { name: '식비' })).not.toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: '지출' }))
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onApply).toHaveBeenCalledWith({ type: ['EXPENSE'] })
  })

  it('discards the draft when closed without applying', async () => {
    render(<FilterButton groups={groups} value={{}} onApply={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '필터' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '지출' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: '필터' }))
    expect(screen.getByRole('checkbox', { name: '지출' })).not.toBeChecked()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/FilterButton.test.tsx`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: 구현** — 열림·적용·초기화 흐름은 Task 2의 `SortButton`과 같은 구조로 쓴다.

```tsx
import { useState } from 'react'
import { DialogTrigger } from 'react-aria-components'
import Checkbox from './Checkbox'
import Icon from './Icon'
import { ResponsiveOverlay } from './ResponsiveOverlay'
import { useNarrowWhileOpen } from './useMediaQuery'
import ui from './ui.module.css'
import styles from './OptionButton.module.css'

export type FilterGroup = { key: string; label: string; options: { value: string; label: string }[] }
export type FilterValue = Record<string, string[]>
type Props = {
  groups: FilterGroup[]
  value: FilterValue
  onApply: (next: FilterValue) => void
  /** 소분류처럼 다른 그룹 선택에 따라 옵션이 바뀌면 호출 쪽이 groups를 다시 계산한다. */
  onDraftChange?: (draft: FilterValue) => void
}

export function countFilters(value: FilterValue): number {
  return Object.values(value).reduce((sum, list) => sum + list.length, 0)
}

export default function FilterButton({ groups, value, onApply, onDraftChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraftState] = useState(value)
  const mobile = useNarrowWhileOpen(open)
  const count = countFilters(value)

  function setDraft(next: FilterValue) {
    setDraftState(next)
    onDraftChange?.(next)
  }
  function toggle(next: boolean) {
    if (next) setDraft(value)
    setOpen(next)
  }
  function check(key: string, option: string, selected: boolean) {
    const list = draft[key] ?? []
    setDraft({ ...draft, [key]: selected ? [...list, option] : list.filter((v) => v !== option) })
  }

  return (
    <DialogTrigger isOpen={open} onOpenChange={toggle}>
      <button type="button" className={`${ui.button} ${ui.iconButton} ${count > 0 ? styles.applied : ''}`}
        data-applied={count > 0 || undefined} aria-label={count > 0 ? `필터, ${count}개 적용됨` : '필터'}>
        <Icon name={count > 0 ? 'funnel-filled' : 'funnel'} />
      </button>
      <ResponsiveOverlay mobile={mobile} title="필터">
        <div className={styles.panel}>
          {groups.map((g) => (
            <fieldset key={g.key} className={styles.group}>
              <legend className={styles.legend}>{g.label}</legend>
              {g.options.map((o) => (
                <Checkbox key={o.value} isSelected={(draft[g.key] ?? []).includes(o.value)}
                  onChange={(selected) => check(g.key, o.value, selected)}>{o.label}</Checkbox>
              ))}
            </fieldset>
          ))}
          <div className={styles.actions}>
            <button type="button" className={ui.button} onClick={() => setDraft({})}>초기화</button>
            <button type="button" className={`${ui.button} ${ui.primary}`}
              onClick={() => { onApply(Object.fromEntries(Object.entries(draft).filter(([, v]) => v.length > 0))); setOpen(false) }}>적용</button>
          </div>
        </div>
      </ResponsiveOverlay>
    </DialogTrigger>
  )
}
```

옵션이 많은 그룹(대분류·소분류)이 모바일 시트를 넘치면 `.panel`에 `max-height: 70dvh; overflow-y: auto`를 주고, 적용·초기화 버튼은 `position: sticky; bottom: 0; background: var(--surface)`로 고정한다. `--surface` 토큰 이름은 `Overlay.module.css`에서 시트 배경으로 쓰는 변수를 따른다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/common/FilterButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: 커밋** (컨트롤러)

```bash
git add apps/web/src/common
git commit -m "feat(web): 필터 버튼 공용 부품 추가"
```

---

### Task 4: 거래목록 화면 적용

**담당:** Codex `gpt-6-sol` / `medium` (`write`). 리뷰: Claude sonnet.

**Files:**
- Create: `apps/web/src/transactions/transactionQuery.ts`
- Test: `apps/web/src/transactions/transactionQuery.test.ts`
- Modify: `apps/web/src/transactions/transactionsApi.ts:54-59`
- Modify: `apps/web/src/transactions/TransactionsPage.tsx:79-86,210-226`
- Test: `apps/web/src/transactions/TransactionsPage.test.tsx`

**Interfaces:**
- Consumes: Task 2·3의 `SortButton`, `FilterButton`, `FilterGroup`, `FilterValue`; `useCategories`·`CategoryOption`(`categoriesApi.ts`).
- Produces:

```ts
export type TransactionSort = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'
export const DEFAULT_SORT: TransactionSort
export const SORT_OPTIONS: SortOption<TransactionSort>[]
export function queryParams(params: URLSearchParams, filter: FilterValue, sort: TransactionSort): URLSearchParams
export function transactionFilterGroups(categories: CategoryOption[], draft: FilterValue): FilterGroup[]
```

- [ ] **Step 1: 실패하는 테스트 작성** (`transactionQuery.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import { queryParams, transactionFilterGroups } from './transactionQuery'

const categories = [
  { major: '식비', count: 3, minors: [{ minor: '외식', count: 2 }] },
  { major: '교통', count: 1, minors: [{ minor: '버스', count: 1 }] },
]

describe('transactionQuery', () => {
  it('appends repeated filter params and omits the default sort', () => {
    const p = queryParams(new URLSearchParams({ month: '2026-09' }), { major: ['식비', '교통'], minor: [''] }, 'DATE_DESC')
    expect(p.toString()).toBe('month=2026-09&major=%EC%8B%9D%EB%B9%84&major=%EA%B5%90%ED%86%B5&minor=')
    expect(queryParams(new URLSearchParams(), {}, 'AMOUNT_ASC').get('sort')).toBe('AMOUNT_ASC')
  })

  it('narrows minor options to the drafted majors and keeps 미분류', () => {
    const minor = transactionFilterGroups(categories, { major: ['교통'] }).find((g) => g.key === 'minor')!
    expect(minor.options).toEqual([{ value: '버스', label: '교통 · 버스' }, { value: '', label: '미분류' }])
    const all = transactionFilterGroups(categories, {}).find((g) => g.key === 'minor')!
    expect(all.options.map((o) => o.value)).toEqual(['외식', '버스', ''])
  })

  it('orders groups as 타입, 대분류, 소분류', () => {
    expect(transactionFilterGroups(categories, {}).map((g) => g.key)).toEqual(['type', 'major', 'minor'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/transactions/transactionQuery.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현** (`transactionQuery.ts`)

```ts
import type { FilterGroup, FilterValue } from '../common/FilterButton'
import type { SortOption } from '../common/SortButton'
import type { CategoryOption } from './categoriesApi'

export type TransactionSort = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'
export const DEFAULT_SORT: TransactionSort = 'DATE_DESC'
export const SORT_OPTIONS: SortOption<TransactionSort>[] = [
  { value: 'DATE_DESC', label: '최신순', direction: 'desc' },
  { value: 'DATE_ASC', label: '오래된순', direction: 'asc' },
  { value: 'AMOUNT_DESC', label: '금액 큰 순', direction: 'desc' },
  { value: 'AMOUNT_ASC', label: '금액 작은 순', direction: 'asc' },
]

export function queryParams(params: URLSearchParams, filter: FilterValue, sort: TransactionSort) {
  for (const [key, values] of Object.entries(filter)) values.forEach((v) => params.append(key, v))
  if (sort !== DEFAULT_SORT) params.set('sort', sort)
  return params
}

export function transactionFilterGroups(categories: CategoryOption[], draft: FilterValue): FilterGroup[] {
  const majors = draft.major ?? []
  const scoped = majors.length ? categories.filter((c) => majors.includes(c.major)) : categories
  // 소분류 이름이 대분류마다 겹칠 수 있어 값은 이름 그대로, 대분류를 고른 경우에만 라벨에 대분류를 붙인다.
  const minors = [...new Set(scoped.flatMap((c) => c.minors.map((m) => m.minor)))]
  const owner = (minor: string) => scoped.find((c) => c.minors.some((m) => m.minor === minor))!.major
  return [
    { key: 'type', label: '타입', options: [
      { value: 'EXPENSE', label: '지출' }, { value: 'INCOME', label: '수입' }, { value: 'TRANSFER', label: '이체' }] },
    { key: 'major', label: '대분류', options: categories.map((c) => ({ value: c.major, label: c.major })) },
    { key: 'minor', label: '소분류', options: [
      ...minors.map((m) => ({ value: m, label: majors.length ? `${owner(m)} · ${m}` : m })),
      { value: '', label: '미분류' }] },
  ]
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/transactions/transactionQuery.test.ts`
Expected: PASS.

- [ ] **Step 5: API와 화면 연결**

`transactionsApi.ts`:

```ts
  mine: (month: string, filter: FilterValue = {}, sort: TransactionSort = DEFAULT_SORT) =>
    apiFetch<TransactionView[]>(`/me/transactions?${queryParams(new URLSearchParams({ month }), filter, sort)}`),
  group: (groupId: number, month: string, memberId: number | null, filter: FilterValue = {}, sort: TransactionSort = DEFAULT_SORT) => {
    const params = new URLSearchParams({ month })
    if (memberId !== null) params.set('memberId', String(memberId))
    return apiFetch<TransactionView[]>(`/groups/${groupId}/transactions?${queryParams(params, filter, sort)}`)
  },
```

`TransactionsPage.tsx`:
- 상태 추가: `const [filter, setFilter] = useState<FilterValue>({})`, `const [sort, setSort] = useState<TransactionSort>(DEFAULT_SORT)`, `const [draft, setDraft] = useState<FilterValue>({})`, `const categories = useCategories()`.
- 쿼리 키 끝에 `filter, sort`를 추가하고 `queryFn`에 넘긴다. 키 앞부분(`['transactions', 'mine', month]` 등)은 그대로 둬서 기존 무효화(`invalidateQueries({ queryKey: ['transactions'] })` 류)가 계속 맞도록 한다.
- 필터 줄의 `SearchField` 앞에 배치:

```tsx
        <FilterButton groups={transactionFilterGroups(categories.data ?? [], draft)} value={filter}
          onApply={(next) => { setFilter(next); setSelectedId(null) }} onDraftChange={setDraft} />
        <SortButton options={SORT_OPTIONS} value={sort} defaultValue={DEFAULT_SORT} onApply={setSort} />
```

- [ ] **Step 6: 화면 테스트 추가** (`TransactionsPage.test.tsx`의 기존 fetch 모킹 방식을 따른다)

```tsx
  it('sends applied filter and sort as query params', async () => {
    // 기존 테스트의 렌더·fetch 모킹 헬퍼로 페이지를 띄운다.
    await userEvent.click(screen.getByRole('button', { name: '필터' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '지출' }))
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    await userEvent.click(screen.getByRole('radio', { name: '금액 큰 순' }))
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    await waitFor(() => expect(lastRequestedUrl()).toContain('type=EXPENSE'))
    expect(lastRequestedUrl()).toContain('sort=AMOUNT_DESC')
    expect(screen.getByRole('button', { name: '필터, 1개 적용됨' })).toBeInTheDocument()
  })
```

`lastRequestedUrl()`은 이 파일의 fetch 모킹이 받은 마지막 `/me/transactions` 요청 URL을 돌려주는 헬퍼로, 기존 모킹 구조에 맞춰 같은 파일에 만든다. 이 테스트는 `/me/categories` 응답도 모킹해야 한다.

- [ ] **Step 7: 전체 검증**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 통과.

- [ ] **Step 8: 커밋** (컨트롤러)

```bash
git add apps/web/src/transactions
git commit -m "feat(transactions): 거래 목록에 필터·정렬 버튼 적용"
```

---

### Task 5: 분포 팝업 정렬

**담당:** Codex `gpt-6-sol` / `medium` (`write`). 리뷰: Claude sonnet.

**Files:**
- Modify: `apps/web/src/dashboard/dashboardApi.ts:30-34`
- Modify: `apps/web/src/dashboard/CategoryTransactionsDialog.tsx:34-38,71-82`
- Test: `apps/web/src/dashboard/CategoryTransactionsDialog.test.tsx`

**Interfaces:**
- Consumes: `SortButton`, `SORT_OPTIONS`, `DEFAULT_SORT`, `TransactionSort`(Task 2·4).

- [ ] **Step 1: 실패하는 테스트 작성** — 기존 테스트의 렌더·fetch 모킹을 따른다.

```tsx
  it('sorts the category transactions through the API', async () => {
    // 기존 테스트처럼 category='식비'로 팝업을 연다.
    await userEvent.click(await screen.findByRole('button', { name: '정렬, 최신순' }))
    await userEvent.click(screen.getByRole('radio', { name: '금액 큰 순' }))
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    await waitFor(() => expect(lastRequestedUrl()).toContain('sort=AMOUNT_DESC'))
  })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/dashboard/CategoryTransactionsDialog.test.tsx`
Expected: 새 테스트 FAIL.

- [ ] **Step 3: 구현**

`dashboardApi.ts`:

```ts
  categoryTransactions: (groupId: number, month: string, category: string, minor?: string, sort: TransactionSort = DEFAULT_SORT) => {
    const params = new URLSearchParams({ month, category })
    if (minor !== undefined) params.set('minor', minor)
    return apiFetch<TransactionView[]>(`/groups/${groupId}/summary/transactions?${queryParams(params, {}, sort)}`)
  },
```

`CategoryTransactionsDialog.tsx`:
- `const [sort, setSort] = useState<TransactionSort>(DEFAULT_SORT)`. 분류가 바뀌는 기존 분기(`lastSelection` 갱신 블록)에서 `setSort(DEFAULT_SORT)`도 호출한다.
- 쿼리 키 끝에 `sort`를 추가하고 `queryFn`에 넘긴다. 키 앞부분 `['summary', groupId, month, 'transactions', ...]`는 유지한다.
- `headerAction`의 목록 상태(`!selected`)일 때 닫기 버튼 앞에 `<SortButton options={SORT_OPTIONS} value={sort} defaultValue={DEFAULT_SORT} onApply={setSort} />`를 둔다.
- 모달 안의 팝오버가 바깥 클릭 닫힘(`closeOnOutsideClick`)으로 팝업 전체를 닫지 않는지 375px·데스크톱에서 직접 확인한다. 닫히면 `DialogFrame`의 바깥 클릭 판정을 고치지 말고 BLOCKED로 보고한다.

- [ ] **Step 4: 전체 검증**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 통과.

- [ ] **Step 5: 커밋** (컨트롤러)

```bash
git add apps/web/src/dashboard
git commit -m "feat(dashboard): 분포 거래 팝업에 정렬 버튼 추가"
```

---

## 마무리 (컨트롤러)

- 브랜치 최종 리뷰: Claude opus 한 번(SDD 최종 리뷰어). 인증·권한 변경이 없으므로 템플릿 F 반론 리뷰는 생략.
- PR 2 캡처: 거래목록(기본·필터 적용·정렬 적용), 필터 모달, 분포 팝업을 375px로 가짜 데이터 화면에서 찍는다.

## 알려진 제약

- 필터 옵션은 `/me/categories`(내 거래 기준)에서 온다. 그룹 범위에서 다른 멤버만 쓴 분류는 옵션에 나오지 않는다. 필요하면 후속으로 그룹 분류 목록 API를 추가한다.
- 필터·정렬 상태는 URL에 저장하지 않는다(스펙 범위 밖).
