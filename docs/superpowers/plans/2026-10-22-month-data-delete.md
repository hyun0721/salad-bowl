# 월 데이터 삭제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 이 저장소에서는 `.claude/skills/codex-collab` 규칙으로 Task마다 구현자(Claude/Codex)를 정한다.

**Goal:** 홈의 월별 등록 현황에서 등록된 달을 눌러 그 달의 거래를 영구 삭제할 수 있게 한다. 기본은 업로드한 거래만 지우고, 선택하면 직접 추가한 거래도 함께 지운다.

**Architecture:**
- API: `GET /me/coverage`가 달마다 `manualCount`를 함께 돌려준다. 새 `DELETE /me/transactions?month=&includeManual=`이 본인의 그 달 거래를 출처(`IMPORT`/`MANUAL`)별 벌크 `DELETE` 쿼리로 지운다. 수정 이력은 DB FK `ON DELETE CASCADE`로 함께 지워진다.
- 웹: 달력의 "등록됨" 칸이 버튼이 되고, 누르면 `MonthDataDialog`(요약 → 다시 업로드 | 삭제 확인)가 열린다. 삭제 mutation이 끝나면 coverage·transactions·summary 캐시를 무효화한다.

**Tech Stack:** Spring Boot 4.1.1 / Java 21 / Spring Data JPA / Testcontainers(Postgres), React 19 / TanStack Query / Vitest + MSW.

**스펙:** [월 데이터 삭제 설계](../specs/2026-10-22-month-data-delete-design.md)

**선행 조건:** `main`에서 `feat/month-data-delete` 브랜치를 딴다. 스펙(`80e2975`)과 이 계획 문서의 커밋이 `main`에 없으면 그 커밋들을 cherry-pick한다.

**범위 밖:** 되돌리기·휴지통, 여러 달 한꺼번에 삭제, 배치 단위 삭제, 업로드 이력 삭제, 그룹 알림.

## Global Constraints

- 삭제는 **영구 삭제**다. soft delete 컬럼을 만들지 않는다. 마이그레이션을 추가하지 않는다(`transaction_audits.transaction_id`는 이미 `ON DELETE CASCADE`).
- 월 범위는 `TransactionService.monthRange(YearMonth)`(`[월 1일 00:00, 다음 달 1일 00:00)`, `occurred_at` 기준)를 그대로 쓴다.
- 본인 거래만 지운다. 그룹 권한과 관계없다.
- `includeManual`은 생략하면 `false`다.
- 지울 거래가 없어도 `200 {"deletedImported":0,"deletedManual":0}`이다.
- `month`가 없거나 형식이 틀리면 `400`이고 `code`는 `VALIDATION_FAILED`다(기존 `/me/transactions` GET과 같은 처리).
- `import_batches`(업로드 이력)는 지우지 않는다.
- 화면 문구(정확히 이대로):
  - 등록됨 칸 이름: `{YYYY}년 {M}월 등록됨 {N}건, 데이터 관리`
  - 대화상자 제목: `{YYYY}년 {M}월 데이터`
  - 버튼: `다시 업로드`, `이 달 데이터 삭제`, `취소`, `삭제`
  - 안내문: `{대상}을 영구 삭제합니다. 바꾼 카테고리·메모·숨김과 수정 이력도 함께 사라집니다. 같은 엑셀을 다시 올리면 거래는 돌아오지만 수정한 내용은 돌아오지 않습니다.` — `{대상}`은 체크박스가 꺼져 있으면 `업로드한 거래 {importedCount}건`, 켜져 있으면 `거래 {importedCount + manualCount}건`
  - 체크박스: `직접 추가한 거래 {manualCount}건도 함께 삭제` (manualCount가 0이면 보이지 않는다)
  - 확인 입력 라벨: `삭제하려면 {YYYY-MM}를 입력하세요`
  - 업로드 중: `업로드가 끝난 뒤 삭제할 수 있습니다.`
  - 완료(홈, `role="status"`): `{YYYY}년 {M}월 거래 {deletedImported + deletedManual}건을 삭제했습니다.`
- 아이콘·이모지를 새로 넣지 않는다. 버튼 스타일은 `ui.button`, 위험 버튼은 `ui.button ui.danger`.

## 파일 구조

| 파일 | 책임 | Task |
|---|---|---|
| `apps/api/.../transaction/LedgerTransactionRepository.java` | 월별 출처별 건수 쿼리, 출처별 월 벌크 삭제 쿼리 | 1, 2 |
| `apps/api/.../transaction/TransactionDtos.java` | `CoverageMonth`에 `manualCount`, 새 `MonthDeleteResult` | 1, 2 |
| `apps/api/.../transaction/TransactionService.java` | `coverage`, 새 `deleteMonth` | 1, 2 |
| `apps/api/.../transaction/TransactionController.java` | `DELETE /me/transactions` | 2 |
| `apps/api/src/test/.../transaction/CoverageApiTest.java` | `manualCount` 검증 | 1 |
| `apps/api/src/test/.../transaction/MonthDeleteApiTest.java` (신규) | 월 삭제 API 검증 | 2 |
| `apps/web/src/home/coverageApi.ts` | `CoverageMonth.manualCount` | 3 |
| `apps/web/src/transactions/transactionsApi.ts` | `deleteMonth`, `MonthDeleteResult` | 3 |
| `apps/web/src/home/useDeleteMonth.ts` (신규) | 삭제 mutation과 캐시 무효화 | 3 |
| `apps/web/src/home/CoverageCalendar.tsx`, `.module.css` | 등록됨 칸을 버튼으로 | 3 |
| `apps/web/src/home/MonthDataDialog.tsx` (신규) | 요약·다시 업로드·삭제 확인 대화상자 | 3 |
| `apps/web/src/home/HomePage.tsx`, `.module.css`, `.test.tsx` | 대화상자 연결, 완료 문구, 테스트 | 3 |
| `docs/superpowers/specs/2026-10-19-web-screen-design.md` | 홈 설명·API 표 갱신 | 3 |

---

### Task 1: coverage에 `manualCount` 추가 (API, Claude 구현자)

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/LedgerTransactionRepository.java:37-51`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionDtos.java:60-62`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java:62-73`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/CoverageApiTest.java`

**Interfaces:**
- Produces: `record CoverageMonth(String month, long importedCount, long manualCount)`. JSON `{"month":"2026-09","importedCount":168,"manualCount":12}`. 항목은 지금처럼 import 거래가 1건 이상인 달만 나온다.

- [ ] **Step 1: 실패하는 테스트 작성**

`CoverageApiTest.coverageCountsImportedTransactionsPerMonthOfTheYear`의 수동 거래를 9월에도 하나 추가하고 `manualCount`를 확인한다. 기존 3월 수동 거래(import 없는 달)는 그대로 두어 "수동만 있는 달은 나오지 않는다"를 계속 확인한다. 숨긴 수동 거래도 세는지 확인한다.

```java
    @Test
    void coverageCountsImportedTransactionsPerMonthOfTheYear() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        long batchId = batches.save(new ImportBatch(me.id(), "a.xlsx")).getId();
        imported(me, batchId, "2026-01-05T10:00:00");
        imported(me, batchId, "2026-09-01T00:00:00");
        imported(me, batchId, "2026-09-30T23:59:59");
        imported(me, batchId, "2025-12-31T23:59:59");
        transactions.save(LedgerTransaction.manual(me.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-03-01T12:00:00", "식비", "수동", -500)));
        transactions.save(LedgerTransaction.manual(me.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-10T12:00:00", "식비", "수동 9월", -700)));
        LedgerTransaction hiddenManual = LedgerTransaction.manual(me.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-11T12:00:00", "식비", "숨긴 수동", -800));
        hiddenManual.setHidden(true);
        transactions.save(hiddenManual);

        mvc.perform(get("/me/coverage").param("year", "2026").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].month").value("2026-01"))
                .andExpect(jsonPath("$[0].importedCount").value(1))
                .andExpect(jsonPath("$[0].manualCount").value(0))
                .andExpect(jsonPath("$[1].month").value("2026-09"))
                .andExpect(jsonPath("$[1].importedCount").value(2))
                .andExpect(jsonPath("$[1].manualCount").value(2));
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests 'com.saladbowl.api.transaction.CoverageApiTest'`
Expected: FAIL — `No value at JSON path "$[0].manualCount"`

- [ ] **Step 3: 구현**

`LedgerTransactionRepository`의 `countImportedByMonth`를 아래 `countByMonth`로 바꾼다(다른 호출처 없음).

```java
    /**
     * 내 거래의 월별 출처별 건수(시작 포함, 끝 미포함 범위). import 거래가 있는 달만 돌려준다.
     * 결과 행은 [월(1~12), import 건수, 수동 건수]. 숨긴 거래도 센다.
     */
    @Query("""
            select extract(month from t.occurredAt),
                   sum(case when t.source = com.saladbowl.api.transaction.TransactionSource.IMPORT then 1 else 0 end),
                   sum(case when t.source = com.saladbowl.api.transaction.TransactionSource.MANUAL then 1 else 0 end)
            from LedgerTransaction t
            where t.ownerId = :ownerId
              and t.occurredAt >= :from and t.occurredAt < :to
            group by extract(month from t.occurredAt)
            having sum(case when t.source = com.saladbowl.api.transaction.TransactionSource.IMPORT then 1 else 0 end) > 0
            order by extract(month from t.occurredAt)
            """)
    List<Object[]> countByMonth(@Param("ownerId") Long ownerId,
                                @Param("from") LocalDateTime from,
                                @Param("to") LocalDateTime to);
```

`TransactionDtos`:

```java
    /** month는 yyyy-MM. import 거래가 있는 달만 돌려준다. manualCount는 그 달의 직접 추가한 거래 수다. */
    public record CoverageMonth(String month, long importedCount, long manualCount) {
    }
```

`TransactionService.coverage`:

```java
        return transactions.countByMonth(userId, from, to).stream()
                .map(row -> new CoverageMonth(
                        YearMonth.of(year, ((Number) row[0]).intValue()).toString(),
                        ((Number) row[1]).longValue(),
                        ((Number) row[2]).longValue()))
                .toList();
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests 'com.saladbowl.api.transaction.*'`
Expected: PASS (CoverageApiTest 전체와 같은 패키지 테스트)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main/java/com/saladbowl/api/transaction apps/api/src/test/java/com/saladbowl/api/transaction/CoverageApiTest.java
git commit -m "feat(api): coverage returns manual transaction counts"
```

---

### Task 2: `DELETE /me/transactions` 월 삭제 (API, Claude 구현자)

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/LedgerTransactionRepository.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionDtos.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionController.java`
- Create: `apps/api/src/test/java/com/saladbowl/api/transaction/MonthDeleteApiTest.java`

**Interfaces:**
- Consumes: `TransactionService.monthRange(YearMonth)` (기존)
- Produces: `DELETE /me/transactions?month=YYYY-MM&includeManual=true|false` → `200 {"deletedImported": int, "deletedManual": int}`. `record MonthDeleteResult(int deletedImported, int deletedManual)`.

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.importer.ImportBatch;
import com.saladbowl.api.importer.ImportBatchRepository;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestLedger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MonthDeleteApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    TransactionAuditRepository audits;

    @Autowired
    ImportBatchRepository batches;

    private int seq = 0;

    private long imported(AuthedUser owner, long batchId, String dateTime) {
        String key = String.format("%064d", ++seq);
        return transactions.save(LedgerTransaction.imported(owner.id(), batchId, key,
                TestLedger.data(TransactionType.EXPENSE, dateTime, "식비", "거래" + seq, -1000))).getId();
    }

    private long manual(AuthedUser owner, String dateTime) {
        return transactions.save(LedgerTransaction.manual(owner.id(),
                TestLedger.data(TransactionType.EXPENSE, dateTime, "식비", "수동" + (++seq), -500))).getId();
    }

    @Test
    void deletesOnlyImportedTransactionsOfTheMonthByDefault() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        long batchId = batches.save(new ImportBatch(me.id(), "a.xlsx")).getId();
        long first = imported(me, batchId, "2026-09-01T00:00:00");
        long last = imported(me, batchId, "2026-09-30T23:59:59");
        long before = imported(me, batchId, "2026-08-31T23:59:59");
        long after = imported(me, batchId, "2026-10-01T00:00:00");
        long manualInMonth = manual(me, "2026-09-15T12:00:00");

        mvc.perform(delete("/me/transactions").param("month", "2026-09").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedImported").value(2))
                .andExpect(jsonPath("$.deletedManual").value(0));

        assertThat(transactions.existsById(first)).isFalse();
        assertThat(transactions.existsById(last)).isFalse();
        assertThat(transactions.existsById(before)).isTrue();
        assertThat(transactions.existsById(after)).isTrue();
        assertThat(transactions.existsById(manualInMonth)).isTrue();
        assertThat(batches.existsById(batchId)).isTrue();
    }

    @Test
    void includeManualAlsoDeletesManualTransactions() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        long batchId = batches.save(new ImportBatch(me.id(), "a.xlsx")).getId();
        imported(me, batchId, "2026-09-05T10:00:00");
        long manualInMonth = manual(me, "2026-09-15T12:00:00");
        long manualOtherMonth = manual(me, "2026-10-15T12:00:00");

        mvc.perform(delete("/me/transactions").param("month", "2026-09").param("includeManual", "true")
                        .header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedImported").value(1))
                .andExpect(jsonPath("$.deletedManual").value(1));

        assertThat(transactions.existsById(manualInMonth)).isFalse();
        assertThat(transactions.existsById(manualOtherMonth)).isTrue();
    }

    @Test
    void leavesOtherUsersTransactions() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@test.com", "남");
        long otherBatch = batches.save(new ImportBatch(other.id(), "b.xlsx")).getId();
        long othersImported = imported(other, otherBatch, "2026-09-05T10:00:00");
        long othersManual = manual(other, "2026-09-06T10:00:00");

        mvc.perform(delete("/me/transactions").param("month", "2026-09").param("includeManual", "true")
                        .header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedImported").value(0))
                .andExpect(jsonPath("$.deletedManual").value(0));

        assertThat(transactions.existsById(othersImported)).isTrue();
        assertThat(transactions.existsById(othersManual)).isTrue();
    }

    @Test
    void deletesAuditsWithTheTransactions() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        long batchId = batches.save(new ImportBatch(me.id(), "a.xlsx")).getId();
        long txId = imported(me, batchId, "2026-09-05T10:00:00");
        audits.save(new TransactionAudit(txId, me.id(), "memo", null, "메모"));

        mvc.perform(delete("/me/transactions").param("month", "2026-09").header("Authorization", me.bearer()))
                .andExpect(status().isOk());

        assertThat(audits.findByTransactionIdOrderByChangedAtAscIdAsc(txId)).isEmpty();
    }

    @Test
    void invalidOrMissingMonthIsRejected() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");

        mvc.perform(delete("/me/transactions").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(delete("/me/transactions").param("month", "2026-13").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(delete("/me/transactions").param("month", "2026-09"))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests 'com.saladbowl.api.transaction.MonthDeleteApiTest'`
Expected: FAIL — DELETE 매핑이 없어 `405`(또는 `404`)이 나오고, `requiresAuthentication`만 통과할 수 있다.

`invalidOrMissingMonthIsRejected`의 기대값(400 `VALIDATION_FAILED`)은 바꾸지 않는다. `GlobalExceptionHandler`가 파라미터 누락·타입 변환 실패를 이미 이 코드로 매핑하고, `TransactionQueryApiTest`가 GET에서 같은 것을 확인한다. 구현 후에도 다르면 예외 매핑 회귀로 보고 원인을 조사한다.

- [ ] **Step 3: 구현**

`LedgerTransactionRepository`에 추가(import `org.springframework.data.jpa.repository.Modifying`):

```java
    /** 내 거래 중 한 출처의 기간 거래를 지운다. 수정 이력은 DB FK(ON DELETE CASCADE)로 함께 지워진다. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from LedgerTransaction t
            where t.ownerId = :ownerId and t.source = :source
              and t.occurredAt >= :from and t.occurredAt < :to
            """)
    int deleteOwnedBetween(@Param("ownerId") Long ownerId,
                           @Param("source") TransactionSource source,
                           @Param("from") LocalDateTime from,
                           @Param("to") LocalDateTime to);
```

`TransactionDtos`에 추가:

```java
    /** 월 삭제 결과. 출처별로 지운 건수다. */
    public record MonthDeleteResult(int deletedImported, int deletedManual) {
    }
```

`TransactionService`에 추가(`deleteManual` 위):

```java
    /** 내 그 달 거래를 영구 삭제한다. 기본은 import 거래만, includeManual이면 수동 거래도 지운다. */
    @Transactional
    public MonthDeleteResult deleteMonth(long userId, YearMonth month, boolean includeManual) {
        Range range = monthRange(month);
        int imported = transactions.deleteOwnedBetween(userId, TransactionSource.IMPORT, range.from(), range.to());
        int manual = includeManual
                ? transactions.deleteOwnedBetween(userId, TransactionSource.MANUAL, range.from(), range.to())
                : 0;
        return new MonthDeleteResult(imported, manual);
    }
```

`TransactionController`에 추가(`addManual` 아래):

```java
    @DeleteMapping("/me/transactions")
    public MonthDeleteResult deleteMonth(@CurrentUser Long userId, @RequestParam YearMonth month,
                                         @RequestParam(defaultValue = "false") boolean includeManual) {
        return transactionService.deleteMonth(userId, month, includeManual);
    }
```

(필요한 import: `TransactionDtos.MonthDeleteResult`)

- [ ] **Step 4: 통과 확인**

Run: `cd apps/api && ./gradlew test`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main/java/com/saladbowl/api/transaction apps/api/src/test/java/com/saladbowl/api/transaction/MonthDeleteApiTest.java
git commit -m "feat(api): delete a month of my transactions"
```

---

### Task 3: 홈 월 데이터 대화상자 (웹, Codex 구현자)

**Files:**
- Modify: `apps/web/src/home/coverageApi.ts`
- Modify: `apps/web/src/transactions/transactionsApi.ts`
- Create: `apps/web/src/home/useDeleteMonth.ts`
- Modify: `apps/web/src/home/CoverageCalendar.tsx`, `apps/web/src/home/CoverageCalendar.module.css`
- Create: `apps/web/src/home/MonthDataDialog.tsx`
- Modify: `apps/web/src/home/HomePage.tsx`, `apps/web/src/home/HomePage.module.css`
- Test: `apps/web/src/home/HomePage.test.tsx`
- Modify: `docs/superpowers/specs/2026-10-19-web-screen-design.md`

**Interfaces:**
- Consumes: Task 1의 coverage `manualCount`, Task 2의 `DELETE /me/transactions` 응답 `{deletedImported, deletedManual}`.
- Produces: `CoverageCalendar`의 새 prop `onPickRegistered: (entry: CoverageMonth) => void`. `MonthDataDialog` props `{ coverage: CoverageMonth; onClose: () => void; onDeleted: (message: string) => void }`.

- [ ] **Step 1: 실패하는 테스트 작성**

먼저 `HomePage.test.tsx`의 `handlers` 인자 타입을 `CoverageMonth[]`로 바꾸고(`import type { CoverageMonth } from './coverageApi'`), 기존 fixture의 모든 coverage 객체에 `manualCount: 0`을 넣는다(`handlers([...])` 호출과 `server.use` 안의 coverage 응답 모두). 그러지 않으면 Step 3 뒤 타입 검사가 TS2353으로 실패한다.

```tsx
function handlers(coverage: CoverageMonth[]) {
```

그다음 파일 끝 `describe` 안에 추가한다(`delay`, `waitFor`는 이미 import되어 있다. `act`는 `@testing-library/react`에서 import에 더한다).

```tsx
  it('opens the month dialog from a registered month', async () => {
    handlers([{ month: '2026-09', importedCount: 168, manualCount: 12 }])
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 9월 등록됨 168건, 데이터 관리' }))

    const dialog = screen.getByRole('dialog', { name: '2026년 9월 데이터' })
    expect(within(dialog).getByText('168건')).toBeInTheDocument()
    expect(within(dialog).getByText('12건')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '다시 업로드' })).toBeInTheDocument()
  })

  it('deletes a month after typing it, optionally with manual transactions', async () => {
    let deleted = false
    let query = new URLSearchParams()
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json(deleted
        ? []
        : [{ month: '2026-09', importedCount: 168, manualCount: 12 }])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.delete('*/api/me/transactions', ({ request }) => {
        query = new URL(request.url).searchParams
        deleted = true
        return HttpResponse.json({ deletedImported: 168, deletedManual: 12 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 9월 등록됨 168건, 데이터 관리' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 9월 데이터' })
    await user.click(within(dialog).getByRole('button', { name: '이 달 데이터 삭제' }))

    expect(within(dialog).getByText(/업로드한 거래 168건을 영구 삭제합니다/)).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: '삭제' })
    expect(confirm).toBeDisabled()
    await user.click(within(dialog).getByLabelText('직접 추가한 거래 12건도 함께 삭제'))
    expect(within(dialog).getByText(/거래 180건을 영구 삭제합니다/)).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요'), '2026-08')
    expect(confirm).toBeDisabled()
    await user.clear(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요'))
    await user.type(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요'), '2026-09')
    await user.click(confirm)

    expect(await screen.findByRole('status')).toHaveTextContent('2026년 9월 거래 180건을 삭제했습니다.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(query.get('month')).toBe('2026-09')
    expect(query.get('includeManual')).toBe('true')
    expect(await screen.findByRole('button', { name: '2026년 9월 미등록, 업로드하기' })).toBeInTheDocument()
  })

  it('hides the manual option when there are none and shows delete errors in the dialog', async () => {
    let query = new URLSearchParams()
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([{ month: '2026-09', importedCount: 3, manualCount: 0 }])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.delete('*/api/me/transactions', ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 9월 등록됨 3건, 데이터 관리' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 9월 데이터' })
    await user.click(within(dialog).getByRole('button', { name: '이 달 데이터 삭제' }))
    expect(within(dialog).queryByLabelText(/직접 추가한 거래/)).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요'), '2026-09')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(query.get('includeManual')).toBe('false')
    expect(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요')).toHaveValue('2026-09')
  })

  it('keeps the month dialog open while re-uploading', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([{ month: '2026-09', importedCount: 3, manualCount: 0 }])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.post('*/api/imports', async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 9월 등록됨 3건, 데이터 관리' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 9월 데이터' })
    await user.click(within(dialog).getByRole('button', { name: '다시 업로드' }))
    await user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"]')!, new File([new Uint8Array(10)], 'sep.xlsx'))
    await user.click(within(dialog).getByRole('button', { name: '업로드' }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled())
  })

  it('deletes only uploaded transactions when the manual option stays off', async () => {
    let query = new URLSearchParams()
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([{ month: '2026-09', importedCount: 168, manualCount: 12 }])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.delete('*/api/me/transactions', ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json({ deletedImported: 168, deletedManual: 0 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 9월 등록됨 168건, 데이터 관리' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 9월 데이터' })
    await user.click(within(dialog).getByRole('button', { name: '이 달 데이터 삭제' }))
    expect(within(dialog).getByLabelText('직접 추가한 거래 12건도 함께 삭제')).not.toBeChecked()
    await user.type(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요'), '2026-09')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(await screen.findByRole('status')).toHaveTextContent('2026년 9월 거래 168건을 삭제했습니다.')
    expect(query.get('includeManual')).toBe('false')
  })

  it('cannot delete while an upload is running', async () => {
    handlers([{ month: '2026-09', importedCount: 3, manualCount: 0 }])
    const { client, user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 9월 등록됨 3건, 데이터 관리' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 9월 데이터' })
    await user.click(within(dialog).getByRole('button', { name: '이 달 데이터 삭제' }))
    await user.type(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요'), '2026-09')
    expect(within(dialog).getByRole('button', { name: '삭제' })).toBeEnabled()

    // 다른 화면에서 시작한 업로드처럼, 같은 QueryClient에 진행 중인 'upload' mutation을 만든다.
    let release!: () => void
    const upload = client.getMutationCache().build(client, {
      mutationKey: ['upload'],
      mutationFn: () => new Promise<void>((resolve) => { release = resolve }),
    })
    let running!: Promise<unknown>
    act(() => { running = upload.execute(undefined) })

    await waitFor(() => expect(within(dialog).getByRole('button', { name: '삭제' })).toBeDisabled())
    expect(within(dialog).getByText('업로드가 끝난 뒤 삭제할 수 있습니다.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled()

    await act(async () => { release(); await running })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '삭제' })).toBeEnabled())
  })

  it('locks the dialog while a delete is in flight', async () => {
    let started = false
    let release = () => {}
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([{ month: '2026-09', importedCount: 3, manualCount: 0 }])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.delete('*/api/me/transactions', async () => {
        started = true
        await new Promise<void>((resolve) => { release = resolve })
        return HttpResponse.json({ deletedImported: 3, deletedManual: 0 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 9월 등록됨 3건, 데이터 관리' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 9월 데이터' })
    await user.click(within(dialog).getByRole('button', { name: '이 달 데이터 삭제' }))
    await user.type(within(dialog).getByLabelText('삭제하려면 2026-09를 입력하세요'), '2026-09')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: '삭제' })).toBeDisabled())
    expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: '2026년 9월 데이터' })).toBeInTheDocument()

    await waitFor(() => expect(started).toBe(true))
    release()
    expect(await screen.findByRole('status')).toHaveTextContent('2026년 9월 거래 3건을 삭제했습니다.')
  })
```

마지막 테스트는 요청이 MSW 핸들러에 도착한 것(`started`)을 확인한 뒤에 `release`를 부른다. 버튼이 꺼진 시점에는 요청이 아직 핸들러에 닿지 않았을 수 있다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/home`
Expected: 새 테스트 7개 FAIL — `Unable to find role="button" and name "2026년 9월 등록됨 168건, 데이터 관리"`. 기존 테스트는 PASS.

- [ ] **Step 3: API 타입과 mutation**

`apps/web/src/home/coverageApi.ts`:

```ts
export type CoverageMonth = { month: string; importedCount: number; manualCount: number }
```

`apps/web/src/transactions/transactionsApi.ts`에 타입과 메서드 추가:

```ts
export type MonthDeleteResult = { deletedImported: number; deletedManual: number }
```

```ts
  deleteMonth: (month: string, includeManual: boolean) =>
    apiFetch<MonthDeleteResult>(
      `/me/transactions?${new URLSearchParams({ month, includeManual: String(includeManual) })}`,
      { method: 'DELETE' }),
```

`apps/web/src/home/useDeleteMonth.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi } from '../transactions/transactionsApi'

type Input = { month: string; includeManual: boolean }

/** 한 달 거래를 영구 삭제하고, 그 달을 보여주는 화면들을 새로 가져오게 한다. */
export function useDeleteMonth() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: ['delete-month'],
    mutationFn: ({ month, includeManual }: Input) => transactionsApi.deleteMonth(month, includeManual),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coverage'] })
      void client.invalidateQueries({ queryKey: ['transactions'] })
      void client.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}
```

- [ ] **Step 4: 달력의 등록됨 칸을 버튼으로**

`CoverageCalendar.tsx`: `Props` 타입에 `onPickRegistered: (entry: CoverageMonth) => void`를 추가하고, 함수 인자 구조 분해에도 넣는다. `counts`를 `Map<string, CoverageMonth>`로 바꾼다.

```tsx
export default function CoverageCalendar({ year, today, coverage, onPickMissing, onPickRegistered }: Props) {
```

등록됨 칸:

```tsx
  const entries = new Map(coverage.map((c) => [c.month, c]))
```

```tsx
        const entry = entries.get(month)
```

```tsx
            {entry !== undefined ? (
              <button type="button" className={`${styles.cell} ${styles.registered}`}
                aria-label={`${year}년 ${label} 등록됨 ${entry.importedCount}건, 데이터 관리`}
                onClick={() => onPickRegistered(entry)}>
                <span className={styles.month}>{label}</span>
                <span className={styles.state}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  등록됨 · {entry.importedCount}건
                </span>
              </button>
            ) : future ? (
```

`CoverageCalendar.module.css`의 `.registered` 줄에 `cursor: pointer;`를 더한다.

- [ ] **Step 5: `MonthDataDialog`**

`apps/web/src/home/HomePage.module.css` 끝에 추가:

```css
.check { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; cursor: pointer; }
.check > input { width: 20px; height: 20px; }
```

`apps/web/src/home/MonthDataDialog.tsx`:

```tsx
import { useIsMutating } from '@tanstack/react-query'
import { useState } from 'react'
import Modal from '../common/Modal'
import { errorMessage } from '../common/errorMessage'
import { formatMonthLabel } from '../common/format'
import ui from '../common/ui.module.css'
import UploadForm from '../imports/UploadForm'
import type { CoverageMonth } from './coverageApi'
import styles from './HomePage.module.css'
import { useDeleteMonth } from './useDeleteMonth'

type Props = { coverage: CoverageMonth; onClose: () => void; onDeleted: (message: string) => void }
type Step = 'summary' | 'upload' | 'confirm'

/** 등록된 달의 건수, 다시 업로드, 영구 삭제. 삭제는 월(YYYY-MM)을 똑같이 입력해야 켜진다. */
export default function MonthDataDialog({ coverage, onClose, onDeleted }: Props) {
  const { month, importedCount, manualCount } = coverage
  const label = formatMonthLabel(month)
  const [step, setStep] = useState<Step>('summary')
  const [includeManual, setIncludeManual] = useState(false)
  const [typed, setTyped] = useState('')
  const remove = useDeleteMonth()
  const uploading = useIsMutating({ mutationKey: ['upload'] }) > 0
  const target = includeManual ? `거래 ${importedCount + manualCount}건` : `업로드한 거래 ${importedCount}건`

  function confirmDelete() {
    remove.mutate({ month, includeManual }, {
      onSuccess: (result) => onDeleted(`${label} 거래 ${result.deletedImported + result.deletedManual}건을 삭제했습니다.`),
    })
  }

  return (
    <Modal title={`${label} 데이터`} onClose={onClose} closeDisabled={uploading || remove.isPending}>
      {step === 'summary' && (
        <div className={ui.stack}>
          <dl className={styles.totals}>
            <div><dt>업로드한 거래</dt><dd>{importedCount}건</dd></div>
            {manualCount > 0 && <div><dt>직접 추가한 거래</dt><dd>{manualCount}건</dd></div>}
          </dl>
          {uploading && <p className={ui.status}>업로드가 끝난 뒤 삭제할 수 있습니다.</p>}
          <div className={ui.row}>
            <button type="button" className={ui.button} onClick={() => setStep('upload')}>다시 업로드</button>
            <button type="button" className={`${ui.button} ${ui.danger}`} disabled={uploading}
              onClick={() => setStep('confirm')}>이 달 데이터 삭제</button>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <>
          <p className={ui.status}>뱅크샐러드에서 내려받은 엑셀(.xlsx)을 올려주세요. 여러 달이 들어 있어도 거래 일자에 맞게 반영됩니다.</p>
          <UploadForm />
        </>
      )}

      {step === 'confirm' && (
        <div className={ui.stack}>
          <p>
            {target}을 영구 삭제합니다. 바꾼 카테고리·메모·숨김과 수정 이력도 함께 사라집니다.
            같은 엑셀을 다시 올리면 거래는 돌아오지만 수정한 내용은 돌아오지 않습니다.
          </p>
          {manualCount > 0 && (
            <label className={styles.check}>
              <input type="checkbox" checked={includeManual} disabled={remove.isPending}
                onChange={(e) => setIncludeManual(e.target.checked)} />
              <span>직접 추가한 거래 {manualCount}건도 함께 삭제</span>
            </label>
          )}
          <label className={ui.field}>
            <span>삭제하려면 {month}를 입력하세요</span>
            <input className={ui.input} value={typed} autoComplete="off" disabled={remove.isPending}
              onChange={(e) => setTyped(e.target.value)} />
          </label>
          {uploading && <p className={ui.status}>업로드가 끝난 뒤 삭제할 수 있습니다.</p>}
          {remove.isError && <p role="alert" className={ui.alert}>{errorMessage(remove.error)}</p>}
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={remove.isPending}
              onClick={() => setStep('summary')}>취소</button>
            <button type="button" className={`${ui.button} ${ui.danger}`}
              disabled={typed !== month || uploading || remove.isPending}
              onClick={confirmDelete}>삭제</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
```

- [ ] **Step 6: 홈에 연결**

`HomePage.tsx`:
- import `MonthDataDialog`와 `type CoverageMonth`.
- 상태 `const [managed, setManaged] = useState<CoverageMonth | null>(null)`, `const [notice, setNotice] = useState<string | null>(null)`.
- 달력: `<CoverageCalendar ... onPickMissing={setUploadMonth} onPickRegistered={(entry) => { setNotice(null); setManaged(entry) }} />`
- 미등록 칸을 누를 때도 이전 완료 문구를 지운다: `onPickMissing={(month) => { setNotice(null); setUploadMonth(month) }}`.
- "월별 등록 현황" `section`의 `pageHeader` 바로 아래에 `{notice && <p role="status" className={ui.status}>{notice}</p>}`.
- 업로드 `Modal` 아래:

```tsx
      {managed && (
        <MonthDataDialog coverage={managed} onClose={() => setManaged(null)}
          onDeleted={(message) => { setManaged(null); setNotice(message) }} />
      )}
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 PASS

- [ ] **Step 8: 화면 설계 문서 갱신**

`docs/superpowers/specs/2026-10-19-web-screen-design.md`:
- 2절 표의 **홈** 행 설명 끝에 `, 등록된 월을 누르면 월 데이터 대화상자(다시 업로드·월 삭제)`를 더하고, API 열에 `` `DELETE /me/transactions?month=&includeManual=` ``을 더한다.
- 6절 표의 `GET /me/coverage` 행을 `` `[{month: "2026-09", importedCount: 168, manualCount: 12}]`. import 거래가 있는 달만 돌려준다 ``로 바꾸고, 아래 행을 추가한다:

```markdown
| `DELETE /me/transactions?month=YYYY-MM&includeManual=` | 내 그 달 거래 영구 삭제. 기본은 import만. `{deletedImported, deletedManual}` ([월 데이터 삭제 설계](2026-10-22-month-data-delete-design.md)) |
```

- [ ] **Step 9: Commit** (Codex는 커밋할 수 없다. 컨트롤러가 테스트를 다시 돌린 뒤 커밋한다.)

```bash
git add apps/web/src docs/superpowers/specs/2026-10-19-web-screen-design.md
git commit -m "feat(web): month data dialog with delete on the home calendar

Co-Authored-By: Codex (gpt-6-astra) <noreply@openai.com>"
```

---

## 마무리

- 브랜치 최종 리뷰: opus 최종 리뷰어와 `.claude/skills/codex-collab/codex-run.sh review main .superpowers/sdd/month-data-delete/codex-final-review.md high`를 동시에 돌리고 수정은 한 번에 맡긴다.
- 삭제 기능이므로 PR 전에 Codex 반론 리뷰(템플릿 F, `xhigh`)를 돌린다. 위험 영역: 월 삭제 API의 범위(다른 사용자·다른 달), 확인 단계 우회.
- PR을 만들고 Auto-fix를 켠다.
