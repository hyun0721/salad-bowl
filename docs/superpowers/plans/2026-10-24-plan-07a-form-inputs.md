# Plan 07a: 폼 입력과 카테고리 자동완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱의 입력칸(텍스트, 금액, 일시, 검색, 체크박스, 스위치, 셀렉트)을 React Aria 기반 공용 부품으로 바꾸고, 대분류·소분류에 내 카테고리 자동완성을 붙인다.

**Architecture:** `apps/web/src/common/`에 공용 래퍼(TextField, TextAreaField, MoneyField, DateTimePicker, SearchField, Checkbox, Switch, ComboBox)를 만들고 화면은 래퍼만 쓴다. 넓은 화면 팝오버와 좁은 화면 하단 시트를 고르는 로직은 `Select.tsx`에서 `ResponsiveOverlay`로 분리해 Select와 DateTimePicker가 같이 쓴다. 카테고리 후보는 새 API `GET /me/categories`가 내 거래의 화면 표시 카테고리를 많이 쓴 순서로 돌려준다.

**Tech Stack:** Spring Boot 3 + JPA(JPQL) + MockMvc 통합 테스트(Testcontainers), React 19, react-aria-components 1.22.1, @internationalized/date 3.12.4, TanStack Query 5, CSS Modules, Vitest + Testing Library + MSW

**Spec:** `docs/superpowers/specs/2026-10-22-react-aria-rollout-design.md` 4장(단계 1). 계획 번호는 [Plan 06a 후속 과제](2026-10-22-plan-06a-followups.md)의 결정대로 07a다.

## Global Constraints

- 시각 디자인은 바꾸지 않는다. 색·간격·radius는 `apps/web/src/styles/tokens.css`의 변수만 쓴다. 예외: 4px 이하 장식 치수, 터치 영역 높이(40px, 44px, 48px), 글자 크기(토큰이 없다).
- `react-aria-components`와 `@internationalized/date`는 `apps/web/src/common/`에서만 import한다. 화면 코드는 `common/`의 래퍼만 쓴다.
- 모바일 폭 기준은 `(max-width: 820px)`이고 `common/useMediaQuery.ts`의 `useMediaQuery`로 판단한다. 모바일 폭에서 입력칸·버튼 높이는 44px 이상이다.
- 라벨은 화면에 보인다. 테스트는 지금처럼 `getByLabelText('<라벨>')`로 입력칸을 찾을 수 있어야 한다(라벨 문구는 바꾸지 않는다).
- 검증은 브라우저 기본 검증을 쓴다(`validationBehavior="native"`, `isRequired`, `maxLength`). 오류 문구는 RAC `FieldError`로 입력칸 아래에 보인다. 서버 오류는 지금처럼 폼 아래 `ui.alert`.
- 새 npm 패키지를 설치하지 않는다. `@internationalized/date@^3.12.4`는 컨트롤러가 이미 `apps/web/package.json`에 넣었다.
- 주석은 한국어로, 주변 코드처럼 "왜"만 짧게 쓴다.
- 웹 Task 끝에는 `apps/web`에서 `npm run typecheck && npm test && npm run lint`, 마지막 웹 Task와 Task 8은 `npm run build`도 돌린다. API Task 끝에는 `apps/api`에서 `./gradlew test`를 돌린다.
- 검사 명령은 각 앱 폴더에서, `git add`/`git commit`은 **저장소 루트에서** 실행한다.

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/api/.../transaction/TransactionDtos.java` (수정) | `CategoryOption`, `MinorOption` 응답 레코드 |
| `apps/api/.../transaction/LedgerTransactionRepository.java` (수정) | 표시 카테고리별 건수 조회 |
| `apps/api/.../transaction/TransactionService.java` (수정) | 건수를 대분류→소분류로 묶고 정렬 |
| `apps/api/.../transaction/TransactionController.java` (수정) | `GET /me/categories` |
| `apps/api/src/test/.../transaction/CategoryApiTest.java` (새로) | API 통합 테스트 |
| `apps/web/src/test/renderPage.tsx`, `app/AppRoutes.test.tsx` (수정) | 테스트도 `I18nProvider locale="ko-KR"`(운영 `main.tsx`와 같게) |
| `apps/web/src/common/Field.module.css` (새로) | 공용 입력 부품의 라벨·입력·설명·오류 모양 |
| `apps/web/src/common/TextField.tsx` (새로) | `TextField`, `TextAreaField` |
| `apps/web/src/common/SearchField.tsx` (새로) | 지우기 버튼이 있는 검색칸 |
| `apps/web/src/common/Checkbox.tsx`, `Switch.tsx` (새로) | 체크박스, 스위치 |
| `apps/web/src/common/ResponsiveOverlay.tsx` (새로) | 팝오버/하단 시트 선택과 열린 동안 모양 고정 |
| `apps/web/src/common/Select.tsx` + `.module.css` (수정) | `ResponsiveOverlay` 사용, `variant` 추가 |
| `apps/web/src/common/MoneyField.tsx` (새로) | 원화 금액 입력 |
| `apps/web/src/common/DateTimePicker.tsx` + `.module.css` (새로) | 일시 입력과 달력 |
| `apps/web/src/common/ComboBox.tsx` + `.module.css` (새로) | 후보가 있는 입력칸 |
| `apps/web/src/transactions/categoriesApi.ts` (새로) | 카테고리 API와 `useCategories` 훅 |
| `apps/web/src/transactions/ManualTransactionForm.tsx`, `TransactionPanel.tsx`, `TransactionsPage.tsx` (수정) | 공용 부품 적용 |
| `apps/web/src/groups/CreateGroupForm.tsx`, `GroupSettings.tsx`, `InviteSection.tsx`, `auth/LoginPage.tsx` (수정) | 공용 부품 적용 |
| `docs/ui-library-poc.md` (수정) | 번들 크기 한 줄 |

---

### Task 1: 카테고리 API `GET /me/categories` (Claude 구현)

Codex 샌드박스에서는 Docker·Gradle이 막혀 있어 Claude가 구현한다.

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionDtos.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/LedgerTransactionRepository.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionController.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/CategoryApiTest.java`

**Interfaces:**
- Produces: `GET /me/categories` → `200 [{ "major": string, "count": number, "minors": [{ "minor": string, "count": number }] }]`. 인증 필요(없으면 기존 인증 필터가 401).

규칙:
- 대상: 로그인한 사용자 본인의 거래 전부(숨긴 거래 포함). 다른 사람 거래와 그룹 거래는 넣지 않는다. 삭제는 실제 삭제라 따로 거를 것이 없다.
- 값: 화면에 보이는 값(`LedgerTransaction.displayCategory()`와 같은 규칙: override가 있으면 override).
- `count`: 대분류는 그 대분류 거래 수, 소분류는 그 대분류·소분류 조합의 거래 수.
- 소분류가 빈 문자열이면 `minors`에 넣지 않는다(대분류 `count`에는 센다).
- 정렬: 대분류는 `count` 내림차순, 같으면 `major` 오름차순. 소분류도 같은 규칙.

- [ ] **Step 1: 실패하는 테스트 작성**

`CategoryApiTest.java`:

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CategoryApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    private LedgerTransaction manual(AuthedUser owner, String major, String minor) {
        return transactions.save(LedgerTransaction.manual(owner.id(), new TransactionData(
                LocalDateTime.parse("2026-10-01T12:00:00"), TransactionType.EXPENSE, major, minor, "거래",
                BigDecimal.valueOf(-1000).setScale(2), "KRW", "카드", null)));
    }

    @Test
    void groupsMyDisplayCategoriesByUsage() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        manual(me, "식비", "카페");
        manual(me, "식비", "카페");
        manual(me, "식비", "점심");
        manual(me, "식비", "");
        manual(me, "교통", "택시");
        manual(me, "교통", "버스");
        LedgerTransaction overridden = manual(me, "기타", "");
        overridden.setCategoryMajorOverride("교통");
        overridden.setCategoryMinorOverride("버스");
        transactions.save(overridden);
        LedgerTransaction hidden = manual(me, "쇼핑", "옷");
        hidden.setHidden(true);
        transactions.save(hidden);

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].major").value("식비"))
                .andExpect(jsonPath("$[0].count").value(4))
                .andExpect(jsonPath("$[0].minors", hasSize(2)))
                .andExpect(jsonPath("$[0].minors[0].minor").value("카페"))
                .andExpect(jsonPath("$[0].minors[0].count").value(2))
                .andExpect(jsonPath("$[0].minors[1].minor").value("점심"))
                .andExpect(jsonPath("$[1].major").value("교통"))
                .andExpect(jsonPath("$[1].count").value(3))
                .andExpect(jsonPath("$[1].minors[0].minor").value("버스"))
                .andExpect(jsonPath("$[1].minors[0].count").value(2))
                .andExpect(jsonPath("$[1].minors[1].minor").value("택시"))
                .andExpect(jsonPath("$[2].major").value("쇼핑"))
                .andExpect(jsonPath("$[2].count").value(1));
    }

    @Test
    void sortsTiesByName() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        manual(me, "쇼핑", "");
        manual(me, "교통", "");

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(jsonPath("$[0].major").value("교통"))
                .andExpect(jsonPath("$[0].minors", hasSize(0)))
                .andExpect(jsonPath("$[1].major").value("쇼핑"));
    }

    @Test
    void showsOnlyMyTransactions() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@test.com", "남");
        manual(other, "식비", "카페");

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/me/categories")).andExpect(status().isUnauthorized());
    }
}
```

`LedgerTransaction`에 `setHidden`, `setCategoryMajorOverride`, `setCategoryMinorOverride`가 있는지 확인한다(`CoverageApiTest`가 `setHidden`을 쓴다). `requiresLogin`의 상태 코드는 다른 API 테스트가 인증 없는 요청에 기대하는 값(예: `TransactionQueryApiTest`)과 맞춘다.

- [ ] **Step 2: 실패 확인**

Run (in `apps/api`): `./gradlew test --tests com.saladbowl.api.transaction.CategoryApiTest`
Expected: FAIL (404, 매핑 없음)

- [ ] **Step 3: 구현**

`TransactionDtos.java`의 마지막 레코드 다음에 추가한다:

```java
    /** 내 거래에서 쓴 대분류와 그 소분류. 많이 쓴 순서다. 소분류가 비어 있는 거래는 대분류 count에만 센다. */
    public record CategoryOption(String major, long count, List<MinorOption> minors) {
    }

    public record MinorOption(String minor, long count) {
    }
```

(`java.util.List` import가 없으면 더한다.)

`LedgerTransactionRepository.java`에 추가한다:

```java
    /** 내 거래의 화면 표시 카테고리(override 우선)별 건수. 결과 행은 [대분류, 소분류, 건수]. 숨긴 거래도 센다. */
    @Query("""
            select coalesce(t.categoryMajorOverride, t.categoryMajor),
                   coalesce(t.categoryMinorOverride, t.categoryMinor),
                   count(t)
            from LedgerTransaction t
            where t.ownerId = :ownerId
            group by coalesce(t.categoryMajorOverride, t.categoryMajor),
                     coalesce(t.categoryMinorOverride, t.categoryMinor)
            """)
    List<Object[]> countDisplayCategories(@Param("ownerId") Long ownerId);
```

`TransactionService.java`에 추가한다(`coverage` 다음):

```java
    @Transactional(readOnly = true)
    public List<CategoryOption> categories(long userId) {
        Map<String, Map<String, Long>> byMajor = new HashMap<>();
        for (Object[] row : transactions.countDisplayCategories(userId)) {
            byMajor.computeIfAbsent((String) row[0], k -> new HashMap<>())
                    .merge((String) row[1], ((Number) row[2]).longValue(), Long::sum);
        }
        Comparator<CategoryOption> majorOrder = Comparator.comparingLong(CategoryOption::count).reversed()
                .thenComparing(CategoryOption::major);
        Comparator<MinorOption> minorOrder = Comparator.comparingLong(MinorOption::count).reversed()
                .thenComparing(MinorOption::minor);
        return byMajor.entrySet().stream()
                .map(e -> new CategoryOption(
                        e.getKey(),
                        e.getValue().values().stream().mapToLong(Long::longValue).sum(),
                        e.getValue().entrySet().stream()
                                .filter(m -> !m.getKey().isEmpty())
                                .map(m -> new MinorOption(m.getKey(), m.getValue()))
                                .sorted(minorOrder)
                                .toList()))
                .sorted(majorOrder)
                .toList();
    }
```

필요한 import(`java.util.Comparator`, `HashMap`, `Map`, `TransactionDtos.CategoryOption`, `TransactionDtos.MinorOption`)를 더한다.

`TransactionController.java`의 `coverage` 다음에 추가한다:

```java
    @GetMapping("/me/categories")
    public List<CategoryOption> categories(@CurrentUser Long userId) {
        return transactionService.categories(userId);
    }
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.saladbowl.api.transaction.CategoryApiTest`
Expected: PASS (4 tests)

- [ ] **Step 5: 전체 확인과 커밋**

Run (in `apps/api`): `./gradlew test`
Expected: 모두 통과

```bash
git add apps/api/src/main/java/com/saladbowl/api/transaction apps/api/src/test/java/com/saladbowl/api/transaction/CategoryApiTest.java
git commit -m "feat(api): GET /me/categories for category autocomplete"
```

---

### Task 2: 테스트 로케일과 기본 입력 부품

**Files:**
- Modify: `apps/web/src/test/renderPage.tsx`, `apps/web/src/app/AppRoutes.test.tsx` (`renderApp`)
- Create: `apps/web/src/common/Field.module.css`
- Create: `apps/web/src/common/TextField.tsx`, `SearchField.tsx`, `Checkbox.tsx`, `Switch.tsx`
- Test: `apps/web/src/common/Fields.test.tsx`

**Interfaces:**
- Produces (모두 `common/`의 named export가 아니라 아래 이름의 export):
  - `TextField` (default export of `TextField.tsx`), props `{ label: string; value: string; onChange: (value: string) => void; type?: 'text' | 'email' | 'password'; isRequired?: boolean; maxLength?: number; minLength?: number; autoComplete?: string; isReadOnly?: boolean; description?: string; className?: string }`
  - `TextAreaField` (named export of `TextField.tsx`), props `{ label: string; value: string; onChange: (value: string) => void; maxLength?: number; rows?: number }`
  - `SearchField` (default), props `{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }`
  - `Checkbox` (default), props `{ children: ReactNode; isSelected: boolean; onChange: (value: boolean) => void; isDisabled?: boolean }`
  - `Switch` (default), props 같음
  - `Field.module.css` 클래스: `field`, `label`, `input`, `description`, `error` (다음 Task들도 쓴다)

- [ ] **Step 1: 테스트 로케일 맞추기**

운영 `main.tsx`는 `<I18nProvider locale="ko-KR">`로 감싼다. 테스트도 같게 한다. 이 파일들은 `test/`·테스트 파일이라 RAC import 예외로 둔다(Global Constraints의 "common/에서만"은 앱 코드 규칙이다).

`apps/web/src/test/renderPage.tsx`: `import { I18nProvider } from 'react-aria-components'`를 더하고, `render(` 안의 `<QueryClientProvider ...>` 바깥을 `<I18nProvider locale="ko-KR">…</I18nProvider>`로 감싼다.
`apps/web/src/app/AppRoutes.test.tsx`의 `renderApp`도 같은 방식으로 감싼다.

Run (in `apps/web`): `npm test` → 기존 테스트가 그대로 통과해야 한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`apps/web/src/common/Fields.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Checkbox from './Checkbox'
import SearchField from './SearchField'
import Switch from './Switch'
import TextField, { TextAreaField } from './TextField'

function ControlledText() {
  const [value, setValue] = useState('')
  return (
    <form>
      <TextField label="그룹 이름" value={value} onChange={setValue} isRequired maxLength={5} description="최대 5자" />
      <button type="submit">저장</button>
    </form>
  )
}

describe('TextField', () => {
  it('is labelled, described, limited and reports changes', async () => {
    const user = userEvent.setup()
    render(<ControlledText />)
    const input = screen.getByLabelText('그룹 이름')
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription('최대 5자')

    await user.type(input, '우리집가계부')

    expect(input).toHaveValue('우리집가계')
  })

  it('shows the native validation message under the field', async () => {
    const user = userEvent.setup()
    render(<ControlledText />)

    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(screen.getByLabelText('그룹 이름')).toBeInvalid()
    expect(screen.getByText(/./, { selector: '[slot="errorMessage"]' })).toBeInTheDocument()
  })
})

describe('TextAreaField', () => {
  it('renders a labelled textarea', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TextAreaField label="메모" value="" onChange={onChange} maxLength={10} rows={2} />)

    await user.type(screen.getByLabelText('메모'), '가')

    expect(screen.getByLabelText('메모').tagName).toBe('TEXTAREA')
    expect(onChange).toHaveBeenCalledWith('가')
  })
})

describe('SearchField', () => {
  it('clears with the clear button and with Escape', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<SearchField label="검색" value="택시" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(onChange).toHaveBeenLastCalledWith('')

    rerender(<SearchField label="검색" value="택시" onChange={onChange} />)
    await user.type(screen.getByRole('searchbox', { name: '검색' }), '{Escape}')
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})

describe('Checkbox and Switch', () => {
  it('toggles a checkbox', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox isSelected={false} onChange={onChange}>그룹 화면에서 숨기기 (본인만)</Checkbox>)

    await user.click(screen.getByRole('checkbox', { name: '그룹 화면에서 숨기기 (본인만)' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles a switch and respects disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<Switch isSelected onChange={onChange}>내 거래를 이 그룹에 공개</Switch>)
    const toggle = screen.getByRole('switch', { name: '내 거래를 이 그룹에 공개' })
    expect(toggle).toBeChecked()

    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith(false)

    rerender(<Switch isSelected onChange={onChange} isDisabled>내 거래를 이 그룹에 공개</Switch>)
    expect(screen.getByRole('switch', { name: '내 거래를 이 그룹에 공개' })).toBeDisabled()
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/common/Fields.test.tsx`
Expected: FAIL — `Failed to resolve import "./Checkbox"`

- [ ] **Step 4: 공용 CSS**

`apps/web/src/common/Field.module.css`:

```css
.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.label { font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-muted); }
.input { min-height: 40px; padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); color: var(--ink); font: inherit; }
textarea.input { padding: var(--space-2) var(--space-3); resize: vertical; }
.input[data-focused], .input:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
.input[data-invalid] { border-color: var(--danger); }
.input[readonly] { background: var(--surface-100); }
.description { font-size: 13px; line-height: 18px; color: var(--ink-muted); }
.error { font-size: 13px; line-height: 18px; color: var(--danger); }
.check { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 40px; cursor: pointer; }
.check[data-disabled] { opacity: 0.6; cursor: default; }
.box { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface-000); color: var(--on-brand); }
.check[data-selected] .box { background: var(--brand); border-color: var(--brand); }
.track { position: relative; width: 40px; height: 24px; border-radius: 12px; background: var(--line); transition: background 120ms; }
.thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--surface-000); transition: translate 120ms; }
.check[data-selected] .track { background: var(--brand); }
.check[data-selected] .thumb { translate: 16px 0; }
.check[data-focus-visible] .box, .check[data-focus-visible] .track { outline: 2px solid var(--brand); outline-offset: 2px; }
.search { position: relative; display: flex; align-items: center; }
.search .input { flex: 1; padding-right: 40px; }
.search .input::-webkit-search-cancel-button { display: none; }
.clear { position: absolute; right: 2px; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; background: transparent; color: var(--ink-muted); cursor: pointer; }
.search[data-empty] .clear { display: none; }
@media (max-width: 820px) {
  .input, .check { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .track, .thumb { transition: none; }
}
```

- [ ] **Step 5: 부품 구현**

먼저 `node_modules/react-aria-components/dist/types/src/`의 `TextField.d.ts`, `SearchField.d.ts`, `Checkbox.d.ts`, `Switch.d.ts`, `FieldError.d.ts`, `Text.d.ts`를 확인한다. 1.22.1에서 `Checkbox`·`Switch`는 deprecated이고 `CheckboxField`+`CheckboxButton`, `SwitchField`+`SwitchButton`을 쓴다. 아래 코드와 props가 다르면 타입을 따르고 보고서에 적는다.

`apps/web/src/common/TextField.tsx`:

```tsx
import { FieldError, Input, Label, Text, TextArea, TextField as AriaTextField } from 'react-aria-components'
import styles from './Field.module.css'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password'
  isRequired?: boolean
  maxLength?: number
  minLength?: number
  autoComplete?: string
  isReadOnly?: boolean
  description?: string
  className?: string
}

/** 보이는 라벨, 설명, 브라우저 검증 오류 자리를 같은 모양으로 둔 한 줄 입력칸. */
export default function TextField({ label, description, className, ...rest }: Props) {
  return (
    <AriaTextField {...rest} validationBehavior="native" className={className ?? styles.field}>
      <Label className={styles.label}>{label}</Label>
      <Input className={styles.input} />
      {description && <Text slot="description" className={styles.description}>{description}</Text>}
      <FieldError className={styles.error} />
    </AriaTextField>
  )
}

type AreaProps = { label: string; value: string; onChange: (value: string) => void; maxLength?: number; rows?: number }

export function TextAreaField({ label, rows = 2, ...rest }: AreaProps) {
  return (
    <AriaTextField {...rest} validationBehavior="native" className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <TextArea rows={rows} className={styles.input} />
      <FieldError className={styles.error} />
    </AriaTextField>
  )
}
```

`apps/web/src/common/SearchField.tsx`:

```tsx
import { Button, Input, Label, SearchField as AriaSearchField } from 'react-aria-components'
import Icon from './Icon'
import styles from './Field.module.css'

type Props = { label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }

/** 지우기 버튼과 Esc로 비우는 검색칸. 브라우저 기본 지우기 버튼은 모양이 제각각이라 숨긴다. */
export default function SearchField({ label, placeholder, className, ...rest }: Props) {
  return (
    <AriaSearchField {...rest} className={className ?? styles.field}>
      <Label className={styles.label}>{label}</Label>
      <div className={styles.search}>
        <Input placeholder={placeholder} className={styles.input} />
        <Button aria-label="검색어 지우기" className={styles.clear}><Icon name="x" size={18} /></Button>
      </div>
    </AriaSearchField>
  )
}
```

`data-empty`는 RAC `SearchField` 루트에 붙는다. 지우기 버튼을 숨기는 선택자가 `.search[data-empty]`로는 잡히지 않으면(루트가 `.field`이기 때문) `.field[data-empty] .clear`처럼 실제 DOM에 맞춰 고치고 보고서에 적는다.

`apps/web/src/common/Checkbox.tsx`:

```tsx
import type { ReactNode } from 'react'
import { CheckboxButton, CheckboxField } from 'react-aria-components'
import Icon from './Icon'
import styles from './Field.module.css'

type Props = { children: ReactNode; isSelected: boolean; onChange: (value: boolean) => void; isDisabled?: boolean }

/** 저장 버튼을 눌러야 반영되는 선택에 쓴다. 누르는 즉시 반영되면 Switch를 쓴다. */
export default function Checkbox({ children, ...rest }: Props) {
  return (
    <CheckboxField {...rest}>
      <CheckboxButton className={styles.check}>
        {({ isSelected }) => (
          <>
            <span className={styles.box} aria-hidden="true">{isSelected && <Icon name="check" size={16} />}</span>
            {children}
          </>
        )}
      </CheckboxButton>
    </CheckboxField>
  )
}
```

`apps/web/src/common/Switch.tsx`:

```tsx
import type { ReactNode } from 'react'
import { SwitchButton, SwitchField } from 'react-aria-components'
import styles from './Field.module.css'

type Props = { children: ReactNode; isSelected: boolean; onChange: (value: boolean) => void; isDisabled?: boolean }

/** 누르는 즉시 반영되는 설정에 쓴다. */
export default function Switch({ children, ...rest }: Props) {
  return (
    <SwitchField {...rest}>
      <SwitchButton className={styles.check}>
        <span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span>
        {children}
      </SwitchButton>
    </SwitchField>
  )
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/common/Fields.test.tsx`
Expected: PASS (6 tests)

오류 문구 테스트의 선택자(`[slot="errorMessage"]`)가 RAC `FieldError`의 실제 DOM과 다르면, `FieldError`가 렌더하는 요소를 확인해 그 속성으로 바꾸고 보고서에 적는다. 오류 문구 자체(브라우저가 정하는 문장)는 검사하지 않는다.

- [ ] **Step 7: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add apps/web/src/test/renderPage.tsx apps/web/src/app/AppRoutes.test.tsx apps/web/src/common/Field.module.css apps/web/src/common/TextField.tsx apps/web/src/common/SearchField.tsx apps/web/src/common/Checkbox.tsx apps/web/src/common/Switch.tsx apps/web/src/common/Fields.test.tsx
git commit -m "feat(web): text, search, checkbox and switch fields on React Aria"
```

---

### Task 3: ResponsiveOverlay, Select variant, MoneyField, DateTimePicker

**Files:**
- Create: `apps/web/src/common/ResponsiveOverlay.tsx`
- Modify: `apps/web/src/common/Select.tsx`, `apps/web/src/common/Select.module.css`
- Create: `apps/web/src/common/MoneyField.tsx`
- Create: `apps/web/src/common/DateTimePicker.tsx`, `apps/web/src/common/DateTimePicker.module.css`
- Test: `apps/web/src/common/Select.test.tsx` (추가), `apps/web/src/common/MoneyField.test.tsx`, `apps/web/src/common/DateTimePicker.test.tsx`

**Interfaces:**
- Consumes: `Field.module.css`(Task 2)
- Produces:
  - `useOverlayMode(): { mobile: boolean; onOpenChange: (open: boolean) => void }`, `ResponsiveOverlay` props `{ mobile: boolean; title: string; children: ReactNode }` — `ResponsiveOverlay.tsx`의 named export
  - `Select` props에 `variant?: 'inline' | 'field'` 추가(기본 `'inline'`, 지금 헤더 동작 그대로). `'field'`는 라벨 위·트리거 전체 폭(폼 안)
  - `MoneyField` (default), props `{ label: string; value: number | null; onChange: (value: number | null) => void; isRequired?: boolean; minValue?: number }`
  - `DateTimePicker` (default), props `{ label: string; value: string; onChange: (value: string) => void; isRequired?: boolean }`. `value`는 `''` 또는 `'YYYY-MM-DDTHH:mm'`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/MoneyField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nProvider } from 'react-aria-components'
import { describe, expect, it, vi } from 'vitest'
import MoneyField from './MoneyField'

function Controlled({ onValue }: { onValue: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null)
  return <MoneyField label="금액 (원)" value={value} onChange={(v) => { setValue(v); onValue(v) }} isRequired minValue={1} />
}

describe('MoneyField', () => {
  it('formats won with separators and reports a whole number', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<I18nProvider locale="ko-KR"><Controlled onValue={onValue} /></I18nProvider>)
    const input = screen.getByLabelText('금액 (원)')

    await user.type(input, '12345')
    await user.tab()

    expect(input).toHaveValue('12,345')
    expect(onValue).toHaveBeenLastCalledWith(12345)
    expect(screen.getByText('원')).toBeInTheDocument()
  })

  it('reports null when cleared', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<I18nProvider locale="ko-KR"><Controlled onValue={onValue} /></I18nProvider>)
    const input = screen.getByLabelText('금액 (원)')
    await user.type(input, '5')
    await user.tab()

    await user.clear(input)
    await user.tab()

    expect(onValue).toHaveBeenLastCalledWith(null)
  })
})
```

`apps/web/src/common/DateTimePicker.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nProvider } from 'react-aria-components'
import { describe, expect, it, vi } from 'vitest'
import DateTimePicker from './DateTimePicker'

function Controlled({ onValue, initial = '' }: { onValue: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial)
  return <DateTimePicker label="일시" value={value} onChange={(v) => { setValue(v); onValue(v) }} isRequired />
}

function renderPicker(onValue = vi.fn(), initial?: string) {
  const user = userEvent.setup()
  render(<I18nProvider locale="ko-KR"><Controlled onValue={onValue} initial={initial} /></I18nProvider>)
  return { user, onValue }
}

describe('DateTimePicker', () => {
  it('reports YYYY-MM-DDTHH:mm after typing every segment', async () => {
    const { user, onValue } = renderPicker()
    const group = screen.getByRole('group', { name: '일시' })
    const segments = within(group).getAllByRole('spinbutton')

    await user.click(segments[0])
    await user.keyboard('202610051330')

    expect(onValue).toHaveBeenLastCalledWith('2026-10-05T13:30')
  })

  it('shows an initial value and opens a calendar', async () => {
    const { user } = renderPicker(vi.fn(), '2026-10-05T13:30')

    await user.click(screen.getByRole('button', { name: /달력/ }))

    expect(await screen.findByRole('grid')).toBeInTheDocument()
  })
})
```

`apps/web/src/common/Select.test.tsx` 끝(마지막 `describe` 블록 안)에 추가:

```tsx
  it('puts the label above a full-width trigger in the field variant', () => {
    render(<Select variant="field" label="타입" items={[{ id: 'EXPENSE', label: '지출' }]} selectedKey="EXPENSE" onSelectionChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /타입/ })
    expect(trigger).toHaveTextContent('지출')
    expect(trigger.closest('[data-variant="field"]')).not.toBeNull()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/MoneyField.test.tsx src/common/DateTimePicker.test.tsx src/common/Select.test.tsx`
Expected: FAIL — 새 모듈 import 실패, `variant` 테스트 실패

- [ ] **Step 3: ResponsiveOverlay 분리**

먼저 `Select.tsx`의 지금 코드와 `Select.module.css`의 `.popover`, `.sheet`, `.dialog`, `.title` 규칙을 읽는다. 그 동작(모바일 폭은 하단 고정 Popover + 제목 + Dialog, 넓은 폭은 트리거 아래 Popover, 열린 동안 모양 고정)을 그대로 옮긴다.

`apps/web/src/common/ResponsiveOverlay.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import { Dialog, Heading, Popover } from 'react-aria-components'
import { useMediaQuery } from './useMediaQuery'
import styles from './Select.module.css'

/**
 * 넓은 화면은 트리거 아래 팝오버, 좁은 화면은 하단 시트로 띄운다.
 * 열린 동안 폭이 바뀌어도(회전 등) 모양을 바꾸지 않는다. 바꾸면 포커스와 위치가 깨진다.
 * 부모(Select, DatePicker)의 onOpenChange에 onOpenChange를 넘긴다.
 */
export function useOverlayMode() {
  const narrow = useMediaQuery('(max-width: 820px)')
  const [openedNarrow, setOpenedNarrow] = useState<boolean | null>(null)
  return {
    mobile: openedNarrow ?? narrow,
    onOpenChange: (open: boolean) => setOpenedNarrow(open ? narrow : null),
  }
}

// Modal은 닫힌 상태에서 Select가 컬렉션을 수집하지 못하므로 모바일도 Popover를 쓴다.
export function ResponsiveOverlay({ mobile, title, children }: { mobile: boolean; title: string; children: ReactNode }) {
  return mobile ? (
    <Popover placement="bottom start" className={styles.sheet}>
      <Dialog className={styles.dialog}>
        <Heading slot="title" className={styles.title}>{title}</Heading>
        {children}
      </Dialog>
    </Popover>
  ) : (
    <Popover placement="bottom start" offset={4} className={styles.popover}>
      <Dialog aria-label={title} className={styles.dialog}>{children}</Dialog>
    </Popover>
  )
}
```

넓은 폭에도 `Dialog`를 두는 이유: RAC `DatePicker`는 Popover 안에 Dialog가 있어야 한다. Select의 넓은 폭 팝오버에 Dialog가 생겨도 기존 Select 테스트(키보드 열기·Esc 닫기·선택)가 그대로 통과해야 한다. 통과하지 않으면 `ResponsiveOverlay`에 `dialog?: boolean` prop을 두어 Select에서는 넓은 폭 Dialog를 빼고, 보고서에 적는다.

`Select.tsx`를 고친다:
- `useState`·`useMediaQuery`·`Dialog`·`Heading`·`Popover` import와 `narrow`/`openedNarrow`/`mobile` 계산을 지우고 `const { mobile, onOpenChange } = useOverlayMode()`를 쓴다.
- `onOpenChange={onOpenChange}`.
- `{mobile ? (...) : (...)}` 블록을 `<ResponsiveOverlay mobile={mobile} title={label}>{list}</ResponsiveOverlay>`로 바꾼다.
- props에 `variant?: 'inline' | 'field'`를 더하고 루트에 `data-variant={variant}`와 `className={variant === 'field' ? `${styles.select} ${styles.field}` : styles.select}`를 준다(기본 `'inline'`).

`Select.module.css`에 더한다:

```css
/* 폼 안에서는 다른 입력칸처럼 라벨을 위에, 트리거를 칸 전체 폭으로 둔다. */
.field { flex-direction: column; align-items: stretch; gap: 4px; }
.field .label { font-weight: 500; line-height: 18px; }
.field .trigger { max-width: none; width: 100%; }
```

- [ ] **Step 4: MoneyField**

먼저 `NumberField.d.ts`와 `react-stately`의 `useNumberFieldState.d.ts`에서 `formatOptions`, `minValue`, `onChange`(빈 값일 때 `NaN`)를 확인한다.

`apps/web/src/common/MoneyField.tsx`:

```tsx
import { FieldError, Group, Input, Label, NumberField } from 'react-aria-components'
import styles from './Field.module.css'

type Props = { label: string; value: number | null; onChange: (value: number | null) => void; isRequired?: boolean; minValue?: number }

const WON: Intl.NumberFormatOptions = { maximumFractionDigits: 0, useGrouping: true }

/** 원 단위 정수. 비우면 RAC가 NaN을 주므로 null로 바꿔 넘긴다. 휴대폰에서는 숫자 키패드가 뜬다. */
export default function MoneyField({ label, value, onChange, isRequired, minValue = 1 }: Props) {
  return (
    <NumberField value={value ?? Number.NaN} onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      isRequired={isRequired} minValue={minValue} formatOptions={WON} validationBehavior="native"
      isWheelDisabled className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <Group className={styles.money}>
        <Input className={styles.input} />
        <span className={styles.unit} aria-hidden="true">원</span>
      </Group>
      <FieldError className={styles.error} />
    </NumberField>
  )
}
```

`isWheelDisabled`가 1.22.1 타입에 없으면 지운다. `Field.module.css`에 더한다:

```css
.money { position: relative; display: flex; align-items: center; }
.money .input { flex: 1; padding-right: 36px; text-align: right; font-variant-numeric: tabular-nums; }
.unit { position: absolute; right: var(--space-3); color: var(--ink-muted); pointer-events: none; }
```

"원"은 라벨 "금액 (원)"에 이미 있으므로 화면 읽기에서는 숨긴다(`aria-hidden`). 테스트의 `getByText('원')`은 aria-hidden 요소도 찾는다.

- [ ] **Step 5: DateTimePicker**

먼저 `DatePicker.d.ts`, `Calendar.d.ts`와 `@internationalized/date`의 `parseDateTime`, `CalendarDateTime.toString()` 형식을 확인한다.

`apps/web/src/common/DateTimePicker.tsx`:

```tsx
import { parseDateTime, type CalendarDateTime } from '@internationalized/date'
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment,
  FieldError, Group, Heading, Label,
} from 'react-aria-components'
import Icon from './Icon'
import { ResponsiveOverlay, useOverlayMode } from './ResponsiveOverlay'
import fields from './Field.module.css'
import styles from './DateTimePicker.module.css'

type Props = { label: string; value: string; onChange: (value: string) => void; isRequired?: boolean }

function toValue(text: string): CalendarDateTime | null {
  if (!text) return null
  try {
    return parseDateTime(text)
  } catch {
    return null
  }
}

/** 연·월·일·시·분을 칸별로 입력하거나 달력에서 고른다. API에는 지금처럼 YYYY-MM-DDTHH:mm으로 보낸다. */
export default function DateTimePicker({ label, value, onChange, isRequired }: Props) {
  const { mobile, onOpenChange } = useOverlayMode()
  return (
    <DatePicker value={toValue(value)} onChange={(v) => onChange(v ? v.toString().slice(0, 16) : '')}
      granularity="minute" hourCycle={24} isRequired={isRequired} validationBehavior="native"
      onOpenChange={onOpenChange} className={fields.field}>
      <Label className={fields.label}>{label}</Label>
      <Group className={styles.group}>
        <DateInput className={styles.input}>
          {(segment) => <DateSegment segment={segment} className={styles.segment} />}
        </DateInput>
        <Button aria-label="달력 열기" className={styles.button}><Icon name="calendar" size={18} /></Button>
      </Group>
      <FieldError className={fields.error} />
      <ResponsiveOverlay mobile={mobile} title={label}>
        <Calendar className={styles.calendar}>
          <header className={styles.header}>
            <Button slot="previous" aria-label="이전 달" className={styles.nav}><Icon name="chevron-left" size={18} /></Button>
            <Heading className={styles.month} />
            <Button slot="next" aria-label="다음 달" className={styles.nav}><Icon name="chevron-right" size={18} /></Button>
          </header>
          <CalendarGrid className={styles.grid}>
            {(date) => <CalendarCell date={date} className={styles.cell} />}
          </CalendarGrid>
        </Calendar>
      </ResponsiveOverlay>
    </DatePicker>
  )
}
```

`Icon.tsx`에 Lucide `calendar` 경로를 더한다(파일 상단 주석 규칙대로, `check` 근처):

```tsx
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
```

`apps/web/src/common/DateTimePicker.module.css`:

```css
.group { display: flex; align-items: center; min-height: 40px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); }
.group[data-focus-within] { outline: 2px solid var(--brand); outline-offset: 1px; }
.group[data-invalid] { border-color: var(--danger); }
.input { flex: 1; display: flex; align-items: center; padding: 0 var(--space-3); font-variant-numeric: tabular-nums; }
.segment { padding: 0 1px; border-radius: 4px; outline: none; }
.segment[data-placeholder] { color: var(--ink-muted); }
.segment[data-focused] { background: var(--brand); color: var(--on-brand); }
.button { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 38px; border: 0; border-left: 1px solid var(--line); background: transparent; color: var(--ink-muted); cursor: pointer; }
.calendar { padding: var(--space-3); }
.header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-2); }
.month { margin: 0; font-size: 15px; font-weight: 700; }
.nav { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--ink); cursor: pointer; }
.grid { border-collapse: collapse; }
.grid th { font-size: 12px; font-weight: 500; color: var(--ink-muted); padding-bottom: 4px; }
.cell { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius-sm); cursor: pointer; font-variant-numeric: tabular-nums; }
.cell[data-outside-month] { display: none; }
.cell[data-hovered], .cell[data-focused] { background: var(--surface-100); }
.cell[data-selected] { background: var(--brand); color: var(--on-brand); font-weight: 700; }
@media (max-width: 820px) {
  .group { min-height: 44px; }
  .button { width: 44px; height: 42px; }
  .grid { width: 100%; }
  .cell { width: auto; height: 44px; }
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/common/MoneyField.test.tsx src/common/DateTimePicker.test.tsx src/common/Select.test.tsx`
Expected: PASS

DateTimePicker 첫 테스트는 ko-KR에서 칸 순서가 연·월·일·시·분이고, 칸이 다 차면 다음 칸으로 넘어간다고 가정한다. 순서나 자동 이동이 다르면 칸마다 `user.click(segments[i])` 후 입력하도록 바꾸고 보고서에 적는다. 검사하는 값(`'2026-10-05T13:30'`)은 바꾸지 않는다.

- [ ] **Step 7: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add apps/web/src/common
git commit -m "feat(web): responsive overlay, field select, money and date-time inputs"
```

---

### Task 4: 카테고리 API 연결과 ComboBox

**Files:**
- Create: `apps/web/src/transactions/categoriesApi.ts`
- Create: `apps/web/src/common/ComboBox.tsx`, `apps/web/src/common/ComboBox.module.css`
- Modify: `apps/web/src/transactions/useTransactionMutations.ts`, `apps/web/src/imports/useUpload.ts`, `apps/web/src/home/useDeleteMonth.ts`
- Test: `apps/web/src/common/ComboBox.test.tsx`, `apps/web/src/transactions/categoriesApi.test.tsx`

**Interfaces:**
- Consumes: `GET /me/categories`(Task 1), `Field.module.css`(Task 2), `apiFetch`(`api/client.ts`)
- Produces:
  - `type CategoryOption = { major: string; count: number; minors: { minor: string; count: number }[] }`
  - `categoriesApi.list(): Promise<CategoryOption[]>`, `useCategories()`(쿼리 키 `['categories']`) — `transactions/categoriesApi.ts`
  - `majorOptions(list: CategoryOption[]): string[]`, `minorOptions(list: CategoryOption[], major: string): string[]`
  - `ComboBox` (default), props `{ label: string; value: string; onChange: (value: string) => void; options: string[]; isRequired?: boolean; maxLength?: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/ComboBox.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ComboBox from './ComboBox'

function Controlled({ onValue, options }: { onValue: (v: string) => void; options: string[] }) {
  const [value, setValue] = useState('')
  return <ComboBox label="대분류" value={value} onChange={(v) => { setValue(v); onValue(v) }} options={options} isRequired maxLength={100} />
}

describe('ComboBox', () => {
  it('suggests matching options and picks one', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} options={['식비', '교통', '식료품']} />)

    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식')
    const list = await screen.findByRole('listbox')
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['식비', '식료품'])
    await user.click(within(list).getByRole('option', { name: '식료품' }))

    expect(onValue).toHaveBeenLastCalledWith('식료품')
    expect(screen.getByRole('combobox', { name: '대분류' })).toHaveValue('식료품')
  })

  it('keeps a value that is not in the list', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} options={['식비']} />)

    await user.type(screen.getByRole('combobox', { name: '대분류' }), '새 카테고리')
    await user.tab()

    expect(onValue).toHaveBeenLastCalledWith('새 카테고리')
    expect(screen.getByRole('combobox', { name: '대분류' })).toHaveValue('새 카테고리')
  })

  it('works as a plain input without options', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} options={[]} />)

    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')

    expect(onValue).toHaveBeenLastCalledWith('식비')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
```

`apps/web/src/transactions/categoriesApi.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { majorOptions, minorOptions, type CategoryOption } from './categoriesApi'

const list: CategoryOption[] = [
  { major: '식비', count: 4, minors: [{ minor: '카페', count: 2 }, { minor: '점심', count: 1 }] },
  { major: '교통', count: 3, minors: [{ minor: '버스', count: 2 }] },
]

describe('category options', () => {
  it('keeps the server order for majors', () => {
    expect(majorOptions(list)).toEqual(['식비', '교통'])
  })

  it('returns minors only for an exact major', () => {
    expect(minorOptions(list, '식비')).toEqual(['카페', '점심'])
    expect(minorOptions(list, '식')).toEqual([])
    expect(minorOptions(list, '')).toEqual([])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/ComboBox.test.tsx src/transactions/categoriesApi.test.tsx`
Expected: FAIL — import 실패

- [ ] **Step 3: categoriesApi 구현**

`apps/web/src/transactions/categoriesApi.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'

export type CategoryOption = { major: string; count: number; minors: { minor: string; count: number }[] }

export const categoriesApi = {
  list: () => apiFetch<CategoryOption[]>('/me/categories'),
}

/** 대분류·소분류 입력칸의 후보. 실패하거나 불러오는 중이면 후보 없이 일반 입력칸처럼 쓴다. */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list, staleTime: 5 * 60 * 1000 })
}

export function majorOptions(list: CategoryOption[]): string[] {
  return list.map((c) => c.major)
}

export function minorOptions(list: CategoryOption[], major: string): string[] {
  return list.find((c) => c.major === major)?.minors.map((m) => m.minor) ?? []
}
```

거래를 바꾸는 곳에서 카테고리 후보도 새로 받게 한다:
- `useTransactionMutations.ts`: `refreshLists`를 `() => Promise.all([client.invalidateQueries({ queryKey: ['transactions'] }), client.invalidateQueries({ queryKey: ['categories'] })])`로 바꾼다.
- `imports/useUpload.ts`의 `onSuccess`에 `void client.invalidateQueries({ queryKey: ['categories'] })`를 더한다.
- `home/useDeleteMonth.ts`의 `onSuccess`에 같은 줄을 더한다.

- [ ] **Step 4: ComboBox 구현**

먼저 `ComboBox.d.ts`에서 `allowsCustomValue`, `inputValue`/`onInputChange`, `menuTrigger`, `items`를 확인한다.

`apps/web/src/common/ComboBox.tsx`:

```tsx
import { Button, ComboBox as AriaComboBox, FieldError, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components'
import Icon from './Icon'
import fields from './Field.module.css'
import styles from './ComboBox.module.css'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  isRequired?: boolean
  maxLength?: number
}

/**
 * 후보가 있는 입력칸. 목록에 없는 값도 그대로 쓴다(allowsCustomValue).
 * 모바일에서도 입력칸 바로 아래 팝오버를 쓴다. 하단 시트는 화면 키보드에 가려진다.
 */
export default function ComboBox({ label, value, onChange, options, isRequired, maxLength }: Props) {
  const items = options.map((name) => ({ id: name, name }))
  return (
    <AriaComboBox allowsCustomValue inputValue={value} onInputChange={onChange} items={items}
      menuTrigger="focus" isRequired={isRequired} validationBehavior="native" className={fields.field}>
      <Label className={fields.label}>{label}</Label>
      <div className={styles.wrap}>
        <Input maxLength={maxLength} className={`${fields.input} ${styles.input}`} />
        {options.length > 0 && (
          <Button aria-label={`${label} 후보 보기`} className={styles.button}><Icon name="chevron-down" size={18} /></Button>
        )}
      </div>
      <FieldError className={fields.error} />
      <Popover placement="bottom start" offset={4} className={styles.popover}>
        <ListBox className={styles.list}>
          {(item: { id: string; name: string }) => <ListBoxItem id={item.id} className={styles.item}>{item.name}</ListBoxItem>}
        </ListBox>
      </Popover>
    </AriaComboBox>
  )
}
```

`apps/web/src/common/ComboBox.module.css`:

```css
.wrap { position: relative; display: flex; align-items: center; }
.input { flex: 1; padding-right: 40px; }
.button { position: absolute; right: 2px; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; background: transparent; color: var(--ink-muted); cursor: pointer; }
.popover { min-width: var(--trigger-width); max-height: 280px; overflow: auto; background: var(--surface-000); border: 1px solid var(--line); border-radius: var(--radius-sm); box-shadow: 0 4px 16px var(--overlay); }
.list { padding: 4px; outline: none; }
.item { display: flex; align-items: center; min-height: 40px; padding: 0 var(--space-3); border-radius: var(--radius-sm); cursor: pointer; outline: none; }
.item[data-focused], .item[data-hovered] { background: var(--surface-100); }
@media (max-width: 820px) {
  .item { min-height: 48px; }
}
```

`menuTrigger="focus"`에서 후보가 0개면 RAC가 빈 팝오버를 열지 않아야 한다. 세 번째 테스트가 실패하면 `options.length === 0`일 때 `menuTrigger="manual"`로 바꾸고 보고서에 적는다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/common/ComboBox.test.tsx src/transactions/categoriesApi.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add apps/web/src/common/ComboBox.tsx apps/web/src/common/ComboBox.module.css apps/web/src/common/ComboBox.test.tsx apps/web/src/transactions/categoriesApi.ts apps/web/src/transactions/categoriesApi.test.tsx apps/web/src/transactions/useTransactionMutations.ts apps/web/src/imports/useUpload.ts apps/web/src/home/useDeleteMonth.ts
git commit -m "feat(web): category options API client and ComboBox"
```

---

### Task 5: 거래 화면에 적용

**Files:**
- Modify: `apps/web/src/transactions/ManualTransactionForm.tsx`, `TransactionPanel.tsx`, `TransactionsPage.tsx`, `TransactionsPage.module.css`
- Test: `apps/web/src/transactions/ManualTransactionForm.test.tsx`, `TransactionPanel.test.tsx`, `TransactionsPage.test.tsx` (수정)

**Interfaces:**
- Consumes: `TextField`, `TextAreaField`, `SearchField`, `Checkbox`(Task 2), `Select`(`variant`), `MoneyField`, `DateTimePicker`(Task 3), `ComboBox`, `useCategories`, `majorOptions`, `minorOptions`(Task 4)

- [ ] **Step 1: 테스트를 새 입력칸에 맞추기 (실패 확인)**

`ManualTransactionForm.test.tsx`:
- `fireEvent` import를 지우고 파일 위에 도우미를 둔다:

```tsx
async function typeDateTime(user: ReturnType<typeof import('@testing-library/user-event').default.setup>, text: string) {
  const group = await screen.findByRole('group', { name: '일시' })
  await user.click(within(group).getAllByRole('spinbutton')[0])
  await user.keyboard(text)
}
```

(`within`을 import한다. 타입 표현이 길면 `UserEvent` 타입을 `@testing-library/user-event`에서 가져와 쓴다.)
- 두 테스트의 `fireEvent.change(await screen.findByLabelText('일시'), …)`를 `await typeDateTime(user, '202610051330')`로 바꾼다.
- 대분류 입력은 `screen.getByRole('combobox', { name: '대분류' })`로 찾는다.
- 기본 핸들러로 `server.use(http.get('*/api/me/categories', () => HttpResponse.json([{ major: '식비', count: 3, minors: [{ minor: '점심', count: 2 }] }])))`를 각 테스트 앞에 둔다.
- 기대값(`occurredAt: '2026-10-05T13:30'`, `amount: -6500` 등)은 바꾸지 않는다.
- 새 테스트를 하나 더한다: 대분류 칸에 `식`을 치면 후보 `식비`가 보이고, 고르면 소분류 칸을 눌렀을 때 후보 `점심`이 보인다.

```tsx
  it('suggests my categories for major and minor', async () => {
    server.use(http.get('*/api/me/categories', () => HttpResponse.json([{ major: '식비', count: 3, minors: [{ minor: '점심', count: 2 }] }])))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} onCancel={vi.fn()} />)

    await user.type(await screen.findByRole('combobox', { name: '대분류' }), '식')
    await user.click(await screen.findByRole('option', { name: '식비' }))
    await user.click(screen.getByRole('combobox', { name: '소분류' }))

    expect(await screen.findByRole('option', { name: '점심' })).toBeInTheDocument()
  })
```

`TransactionPanel.test.tsx`:
- `findByLabelText('대분류')`는 그대로 쓸 수 있다(ComboBox 입력칸도 라벨이 붙는다). 각 테스트에 `*/api/me/categories` 핸들러(`HttpResponse.json([])`)를 더한다. MSW `onUnhandledRequest: 'error'`라서 없으면 실패한다.
- 숨기기 체크박스는 `getByRole('checkbox', { name: '그룹 화면에서 숨기기 (본인만)' })`로 찾을 수 있어야 한다(기존 `findByLabelText`도 통과하면 그대로 둔다).

`TransactionsPage.test.tsx`:
- 멤버 필터는 이제 공용 Select다. `user.selectOptions(…combobox '멤버'…, '2')`를 `await user.click(screen.getByRole('button', { name: /멤버/ }))` 후 `await user.click(await screen.findByRole('option', { name: '멤버' }))`로 바꾼다(옵션 이름은 테스트 데이터의 닉네임). 기대값은 바꾸지 않는다.
- 검색칸은 `getByRole('searchbox', { name: '검색' })`로 찾는다.
- 페이지가 수동 추가 폼을 열 수 있으므로 `*/api/me/categories` 핸들러(`[]`)를 기본으로 둔다.

Run: `npx vitest run src/transactions`
Expected: 바꾼 테스트들이 FAIL(아직 새 입력칸이 없다)

- [ ] **Step 2: ManualTransactionForm 적용**

- 상태: `amount`를 `useState<number | null>(null)`로 바꾼다. 제출할 때 `amount: toSignedAmount(type, amount ?? 0)`(브라우저 검증이 빈 값을 막는다).
- `const categories = useCategories()`, `const list = categories.data ?? []`.
- 입력칸 교체(라벨 문구는 그대로):
  - 일시 → `<DateTimePicker label="일시" value={occurredAt} onChange={setOccurredAt} isRequired />`
  - 타입 → `<Select variant="field" label="타입" items={[{ id: 'EXPENSE', label: '지출' }, { id: 'INCOME', label: '수입' }, { id: 'TRANSFER', label: '이체(출금)' }]} selectedKey={type} onSelectionChange={(key) => { if (key != null) setType(key as TransactionType) }} />`
  - 대분류 → `<ComboBox label="대분류" value={major} onChange={setMajor} options={majorOptions(list)} isRequired maxLength={100} />`
  - 소분류 → `<ComboBox label="소분류" value={minor} onChange={setMinor} options={minorOptions(list, major.trim())} maxLength={100} />`
  - 내용 → `<TextField label="내용" value={description} onChange={setDescription} isRequired maxLength={500} />`
  - 금액 → `<MoneyField label="금액 (원)" value={amount} onChange={setAmount} isRequired minValue={1} />`
  - 결제수단 → `<TextField label="결제수단" value={payment} onChange={setPayment} maxLength={100} />`
  - 메모 → `<TextAreaField label="메모" value={memo} onChange={setMemo} maxLength={1000} rows={2} />`
- `ui.field`/`ui.input`을 쓰던 `<label>` 블록은 모두 사라진다.

- [ ] **Step 3: TransactionPanel 적용**

- `const list = useCategories().data ?? []`
- 대분류·소분류 → `ComboBox`(위와 같은 options 규칙, `maxLength={100}`, 대분류는 필수 아님 — 비우면 원본으로 돌아가는 기존 동작 유지).
- 메모 → `TextAreaField`.
- 숨기기 → `<Checkbox isSelected={hidden} onChange={setHidden}>그룹 화면에서 숨기기 (본인만)</Checkbox>`(기존 `styles.check` 라벨 블록 대체).

- [ ] **Step 4: TransactionsPage 적용**

- 멤버 필터 → `<Select label="멤버" items={[{ id: 'all', label: '전체' }, ...detail.data.members.map((m) => ({ id: m.userId, label: m.nickname }))]} selectedKey={memberId ?? 'all'} onSelectionChange={(key) => setMember(key == null || key === 'all' ? null : { groupId, userId: Number(key) })} />`. 기존 `styles.inlineField` 라벨 블록을 대체한다.
- 검색 → `<SearchField label="검색" value={search} onChange={setSearch} placeholder="내용·카테고리" className={styles.search} />`.
- `TransactionsPage.module.css`: `.inlineField`, `.inlineField > span`, `.search > input` 규칙이 더 쓰이지 않으면 지운다. `.search`는 `flex: 1 1 200px; display: flex; flex-direction: column; gap: 4px; min-width: 0;`로 바꾼다(SearchField 루트에 붙는다).

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/transactions`
Expected: 모두 PASS

- [ ] **Step 6: 전체 확인과 커밋**

Run: `npm run typecheck && npm test && npm run lint`

```bash
git add apps/web/src/transactions
git commit -m "feat(web): transaction forms and filters use shared fields with category suggestions"
```

---

### Task 6: 그룹·초대·로그인 화면에 적용

**Files:**
- Modify: `apps/web/src/groups/CreateGroupForm.tsx`, `GroupSettings.tsx`, `InviteSection.tsx`, `GroupsPage.module.css`
- Modify: `apps/web/src/auth/LoginPage.tsx`, `apps/web/src/auth/LoginPage.module.css`
- Test: `apps/web/src/groups/GroupsPage.test.tsx` (공개 스위치)

**Interfaces:**
- Consumes: `TextField`, `Switch`(Task 2)

- [ ] **Step 1: 테스트를 스위치에 맞추기 (실패 확인)**

`GroupsPage.test.tsx` 112줄 근처의 `findByRole('checkbox', { name: '내 거래를 이 그룹에 공개' })`를 `findByRole('switch', { name: '내 거래를 이 그룹에 공개' })`로 바꾼다. 나머지 기대값(클릭하면 API 호출, 저장 중 비활성 등)은 그대로 둔다.

Run: `npx vitest run src/groups`
Expected: 공개 토글 테스트 FAIL

- [ ] **Step 2: 그룹 화면 적용**

- `CreateGroupForm.tsx`: `<TextField label="그룹 이름" value={name} onChange={setName} isRequired maxLength={50} />`
- `GroupSettings.tsx` `RenameForm`: `<TextField label="새 이름" value={value} onChange={(v) => { setValue(v); rename.reset() }} isRequired maxLength={50} />`
- `GroupSettings.tsx` `ShareToggle`: `<Switch isSelected={enabled} isDisabled={setShare.isPending} onChange={(v) => setShare.mutate({ groupId, enabled: v })}>내 거래를 이 그룹에 공개</Switch>`(기존 `styles.check` 라벨 블록 대체)
- `InviteSection.tsx`: 읽기 전용 주소 칸을 `<TextField label="초대 주소" value={link} onChange={() => {}} isReadOnly className={styles.linkField} />`로 바꾼다. 기존의 "포커스하면 전체 선택"은 유지해야 한다(복사 실패 안내가 "주소 칸을 눌러 직접 복사"이다). `TextField`에 `onFocus?: (event: FocusEvent<HTMLInputElement>) => void` prop을 더해 `Input`에 넘기고, 여기서 `onFocus={(e) => e.currentTarget.select()}`를 준다. `TextField`의 Interfaces 변경은 보고서에 적는다.
- `GroupsPage.module.css`: `styles.check`, `.linkInput` 등 더 쓰이지 않는 규칙을 지운다. `.linkField`가 `ui.field`와 함께 쓰이던 폭 규칙이면 새 `TextField` 루트에서도 같은 폭이 나오게 맞춘다.

- [ ] **Step 3: 로그인 화면 적용**

`LoginPage.tsx`의 세 입력칸을 `TextField`로 바꾼다(라벨 문구 그대로):
- `<TextField label="이메일" type="email" autoComplete="email" isRequired value={email} onChange={setEmail} className={styles.field} />`
- `<TextField label={`비밀번호${mode === 'signup' ? ' (8~64자)' : ''}`} type="password" isRequired minLength={mode === 'signup' ? 8 : undefined} maxLength={64} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={setPassword} className={styles.field} />`
- `<TextField label="닉네임 (그룹에서 보이는 이름)" isRequired maxLength={50} value={nickname} onChange={setNickname} className={styles.field} />`

로그인 화면은 입력칸 높이가 44px로 더 크다. `LoginPage.module.css`의 `.field > span`, `.field > input` 규칙을 `.field label`, `.field input`으로 바꿔 `TextField`의 `Label`·`Input`에도 같은 모양이 나오게 한다(CSS Modules 클래스 `Field.module.css`의 `.label`·`.input` 규칙보다 이 선택자의 명시도가 높아야 한다). 바꾼 뒤 로그인 화면의 모양이 이전과 같아야 한다(Task 8에서 브라우저로 확인).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/groups src/auth src/app`
Expected: 모두 PASS

- [ ] **Step 5: 전체 확인, 빌드, 커밋**

Run: `npm run typecheck && npm test && npm run lint && npm run build`

```bash
git add apps/web/src/groups apps/web/src/auth apps/web/src/common/TextField.tsx
git commit -m "feat(web): group, invite and login forms use shared fields"
```

---

### Task 7: 남은 기본 입력칸 점검 (컨트롤러가 직접)

코드를 바꾸지 않는 점검이다. 남은 것이 있으면 해당 Task 구현자에게 맡긴다.

- [ ] **Step 1:** 저장소 루트에서 `grep -rnE "<(input|select|textarea)\b" apps/web/src --include=*.tsx | grep -v "\.test\."`를 돌린다. 남아도 되는 것: `MonthPicker.tsx`의 `type="month"`(스펙 범위 밖). 그 밖에 남은 것이 있으면 목록을 만들어 해당 Task로 돌려보낸다.
- [ ] **Step 2:** `grep -rn "react-aria-components\|@internationalized/date" apps/web/src --include=*.tsx --include=*.ts | grep -v "src/common/\|src/test/\|\.test\.\|src/main.tsx"`가 비어 있어야 한다(`main.tsx`의 `I18nProvider`는 PR #12에서 둔 예외).

---

### Task 8: 브라우저 확인과 기록 (컨트롤러가 직접)

확인 중 문제가 나오면 해당 Task 구현자에게 수정을 맡기고, 고친 뒤 Step 4부터 다시 한다.

- [ ] **Step 1: 실행 환경**

Docker가 켜져 있으면 README 절차대로 API와 `npm run dev`를 띄우고, 회원가입 후 엑셀 없이 거래 몇 건을 수동 추가해 본다(카테고리 후보가 생긴다). Docker를 쓸 수 없으면 Plan 06a Task 4와 같은 방식의 임시 미리보기 페이지(`apps/web/preview.html` + `src/preview.tsx`, 커밋하지 않음)를 만든다. 이 페이지는 `fetch`를 가짜 응답으로 바꾸고(`/me/categories`는 `[{ major: '식비', count: 3, minors: [{ minor: '점심', count: 2 }, { minor: '카페', count: 1 }] }, { major: '교통', count: 1, minors: [] }]`), `ManualTransactionForm`, `TransactionPanel`(내 거래 하나), `CreateGroupForm`, `ShareToggle`, `LoginPage`를 한 화면에 렌더한다.

- [ ] **Step 2: 넓은 폭(1200×800)**
  - 일시: 칸별 입력, 달력 버튼으로 트리거 아래 달력이 열리고 날짜를 고르면 값이 채워진다. 키보드(방향키·Enter)로도 고를 수 있다.
  - 타입: 폼 안에서 라벨 위·칸 전체 폭, 목록이 아래로 펼쳐진다.
  - 대분류: 포커스하면 후보가 아래로 펼쳐지고, 입력하면 걸러지고, 목록에 없는 값도 남는다. 소분류 후보는 고른 대분류의 것만.
  - 금액: `12345` 입력 후 칸을 벗어나면 `12,345`, 오른쪽에 "원".
  - 필수 칸을 비우고 제출하면 칸 아래에 오류 문구, 칸 테두리가 위험 색.
  - 검색: 글자가 있을 때만 × 버튼, Esc로 비워진다.
  - 공개 스위치·숨기기 체크박스 모양과 포커스 링.
  - 로그인 화면 입력칸 모양이 이전과 같다.
- [ ] **Step 3: 좁은 폭(400×800)**
  - 입력칸·버튼 높이 44px 이상.
  - 일시 달력과 타입 목록은 하단 시트로, 대분류 후보는 입력칸 바로 아래 팝오버로 뜬다.
- [ ] **Step 4: 정리, 최종 검증, 기록**

임시 파일을 지우고 미리보기 서버를 멈춘다. `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`, `apps/api`에서 `./gradlew test`. build 출력의 `index-*.js`·`index-*.css` 크기를 `docs/ui-library-poc.md` 번들 표 마지막 줄 다음에 한 줄로 더한다(숫자는 build 출력값으로 바꾼다):

```markdown
| + 폼 입력·카테고리 자동완성(Plan 07a: TextField, NumberField, DatePicker, ComboBox 등) | 000.00 kB | **000.00 kB** | 0.00 kB |
```

저장소 루트에서:

```bash
git add docs/ui-library-poc.md
git commit -m "docs: record bundle size after form inputs"
```
