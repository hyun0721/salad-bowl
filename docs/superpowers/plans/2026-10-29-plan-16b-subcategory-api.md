# Plan 16b 소분류 API 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 16d 소분류 화면이 쓸 수 있도록 `summary/subcategories`에 선택 값 `from`을, `summary/transactions`에 선택 값 `minor`를 더한다.

**Architecture:** 규칙은 `SummaryService`에 두고, `SummaryController`는 선택 인자를 받아 넘기기만 한다. 기간 검증은 `trend`의 검사를 `requireRange(from, to)`로 꺼내 두 엔드포인트가 함께 쓴다. 소분류 이름 규칙(비었으면 "미분류")은 `minorLabel(tx)`로 꺼내 집계와 거래 거르기가 같은 키를 쓴다. 두 값 모두 선택 값이라 지금 웹 호출은 바뀌지 않는다.

**Tech Stack:** Java 21, Spring Boot(MVC, `@RequestParam`), JUnit 5 + MockMvc + Testcontainers(`IntegrationTest`).

**설계:** [메뉴 개편 설계](../specs/2026-10-29-menu-restructure-design.md) 7.1·9장.

## Global Constraints

- 바꾸는 파일은 `apps/api`의 `SummaryController.java`, `SummaryService.java`, `SummaryApiTest.java`뿐이다. 웹(`apps/web`)은 이 계획에서 바꾸지 않는다. 웹은 16d에서 새 값을 쓴다.
- `subcategories`의 `from`: 없으면 지금처럼 `month - 5`(6개월)이다. 있으면 `from`~`month`(양끝 포함)이고 검증은 `summary/trend`와 같다. 연도 범위는 `TransactionService.monthRange`로 보고, `from > month` 또는 13개월 이상이면 400(`VALIDATION_FAILED`)이다. 최대는 `MAX_TREND_MONTHS = 12`개월이다.
- `transactions`의 `minor`: 없으면 지금과 같다(대분류만으로 거른다). 있으면 대분류와 소분류가 둘 다 맞는 거래만 준다. 소분류 비교 키는 `subcategories`와 같다. 표시 분류(`displayCategory`, 수정값 우선)의 `minor`가 `null`이거나 공백이면 `"미분류"`다.
- 집계·선별 규칙(공유 켠 멤버, KRW만, 이체·숨김 제외, 환불 포함, 정렬)은 바꾸지 않는다.
- 기존 테스트는 고치지 않고 모두 통과해야 한다. API 검증 명령은 `apps/api`에서 `./gradlew test`. 업로드·파서·메모리와 무관하므로 `memoryTest`는 돌리지 않는다.
- 구현은 Codex `api` 모드(codex-collab 3장, `apps/api`)로 하고 커밋은 컨트롤러가 한다.

---

### Task 1: `subcategories`에 `from` 더하기

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryController.java` (`subcategories` 메서드)
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java` (`trend`, `subcategories`)
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/SummaryApiTest.java`

**Interfaces:**
- Produces: `SummaryService.subcategories(long groupId, long userId, YearMonth month, YearMonth from)`. `from == null`이면 `month.minusMonths(5)`.
- Produces: `private static void requireRange(YearMonth from, YearMonth to)`. `trend`와 `subcategories`가 함께 쓴다.

- [ ] **Step 1: Write the failing tests**

`SummaryApiTest`의 `subcategoriesValidateMonthAndMembership` 아래에 더한다.

```java
    private org.springframework.test.web.servlet.ResultActions subcategories(String month, String from)
            throws Exception {
        var request = get("/groups/" + groupId + "/summary/subcategories").param("month", month)
                .header("Authorization", admin.bearer());
        if (from != null) request.param("from", from);
        return mvc.perform(request);
    }

    @Test
    void subcategoriesFromWidensRangeAndMatchesDefaultOnOverlappingMonths() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-01-15T12:00:00", "식비", -1_000);
        save(admin, TransactionType.EXPENSE, "2026-04-15T12:00:00", "식비", -2_000);
        save(member, TransactionType.EXPENSE, "2026-09-15T12:00:00", "교통", -3_000);
        save(admin, TransactionType.EXPENSE, "2025-12-31T23:59:59", "범위 밖", -99_000);

        subcategories("2026-09", null).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].month").value("2026-04"))
                .andExpect(jsonPath("$[0].expense").value(2_000))
                .andExpect(jsonPath("$[1].month").value("2026-09"))
                .andExpect(jsonPath("$[1].major").value("교통"))
                .andExpect(jsonPath("$[1].expense").value(3_000));

        subcategories("2026-09", "2026-01").andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].month").value("2026-01"))
                .andExpect(jsonPath("$[0].major").value("식비"))
                .andExpect(jsonPath("$[0].minor").value("미분류"))
                .andExpect(jsonPath("$[0].expense").value(1_000))
                .andExpect(jsonPath("$[1].month").value("2026-04"))
                .andExpect(jsonPath("$[1].expense").value(2_000))
                .andExpect(jsonPath("$[2].month").value("2026-09"))
                .andExpect(jsonPath("$[2].expense").value(3_000));

        subcategories("2026-09", "2026-09").andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].month").value("2026-09"));
    }

    @Test
    void subcategoriesFromFollowsTrendRangeRules() throws Exception {
        subcategories("2026-09", "2025-10").andExpect(status().isOk());
        subcategories("2026-09", "2025-09").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        subcategories("2026-09", "2026-10").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        subcategories("2026-09", "2026-13").andExpect(status().isBadRequest());
        subcategories("2026-09", "bad").andExpect(status().isBadRequest());
        subcategories("0000-02", "0000-01").andExpect(status().isBadRequest());
        subcategories("9999-12", "9999-01").andExpect(status().isOk());
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run (`apps/api`): `./gradlew test --tests 'com.saladbowl.api.transaction.SummaryApiTest'`
Expected: FAIL. `from`을 아직 무시하므로 `hasSize(3)`이 2로, `2025-09`·`2026-10` 범위 검사가 200으로 실패한다.

- [ ] **Step 3: Implement**

`SummaryService`에서 `trend`의 범위 검사를 꺼낸다.

```java
    /** trend와 subcategories가 같은 기간 규칙을 쓴다. 연도 범위를 먼저 보고, 12개월 검사는 넘침 없는 월 차이로 한다. */
    private static void requireRange(YearMonth from, YearMonth to) {
        TransactionService.monthRange(from);
        TransactionService.monthRange(to);
        if (from.isAfter(to) || from.until(to, java.time.temporal.ChronoUnit.MONTHS) >= MAX_TREND_MONTHS) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "from must not be after to, and the range is at most " + MAX_TREND_MONTHS + " months");
        }
    }
```

`trend`의 첫 부분은 이렇게 된다(원래 주석 한 줄과 세 문장을 `requireRange` 호출로 바꾼다).

```java
    public CategoryTrend trend(long groupId, long userId, YearMonth from, YearMonth to) {
        access.requireMember(groupId, userId);
        requireRange(from, to);
        List<YearMonth> months = new ArrayList<>();
```

`subcategories`의 시그니처와 앞부분:

```java
    /** from(없으면 month - 5)~month의 소분류별 순지출. 거래가 없는 월은 화면에서 0으로 채운다. */
    @Transactional(readOnly = true)
    public List<SummaryDtos.SubcategoryMonth> subcategories(long groupId, long userId, YearMonth month,
                                                            YearMonth from) {
        access.requireMember(groupId, userId);
        if (from == null) {
            // 기본 6개월은 검사 전에 month - 5를 계산하므로 month의 연도 범위를 먼저 본다.
            TransactionService.monthRange(month);
            from = month.minusMonths(5);
        }
        requireRange(from, month);
        List<Long> owners = access.sharedOwnerIds(groupId);
```

나머지(`owners.isEmpty()`부터 끝까지)는 그대로 둔다.

`SummaryController.subcategories`:

```java
    @GetMapping("/groups/{groupId}/summary/subcategories")
    public List<SummaryDtos.SubcategoryMonth> subcategories(
            @CurrentUser Long userId, @PathVariable long groupId, @RequestParam YearMonth month,
            @RequestParam(required = false) YearMonth from) {
        return summaryService.subcategories(groupId, userId, month, from);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run (`apps/api`): `./gradlew test --tests 'com.saladbowl.api.transaction.SummaryApiTest'`
Expected: PASS. 기존 `subcategoriesUseSixMonthsAndDisplayCategories`, `subcategoriesValidateMonthAndMembership`, `trendAcceptsTwelveMonthsButRejectsInvalidRanges`도 통과해야 한다.

- [ ] **Step 5: Commit (컨트롤러, 저장소 루트에서)**

Codex 구현자는 커밋하지 않는다. 컨트롤러가 테스트를 다시 돌려 확인한 뒤 저장소 루트에서 커밋한다(`Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>`).

```bash
git add apps/api/src/main/java/com/saladbowl/api/transaction/SummaryController.java \
  apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java \
  apps/api/src/test/java/com/saladbowl/api/transaction/SummaryApiTest.java
git commit -m "feat(api): 소분류 집계에 시작 월 from 지원"
```

---

### Task 2: `summary/transactions`에 `minor` 더하기

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryController.java` (`categoryTransactions`)
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java` (`categoryTransactions`, `subcategories`)
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/SummaryApiTest.java`

**Interfaces:**
- Consumes: Task 1의 `subcategories(long, long, YearMonth, YearMonth)`.
- Produces: `SummaryService.categoryTransactions(long groupId, long userId, YearMonth month, String category, String minor)`. `minor == null`이면 지금과 같다.
- Produces: `static String minorLabel(LedgerTransaction tx)`. `subcategories`의 키도 이것을 쓴다.

- [ ] **Step 1: Write the failing test**

`SummaryApiTest`에 더한다. 소분류를 직접 넣는 저장 도우미가 필요하다(`TestLedger.data`는 소분류를 `""`로 둔다).

```java
    private LedgerTransaction saveMinor(AuthedUser owner, String dateTime, String major, String minor,
                                        long amount) {
        return transactions.save(LedgerTransaction.manual(owner.id(), new TransactionData(
                java.time.LocalDateTime.parse(dateTime), TransactionType.EXPENSE, major, minor,
                major + "/" + minor + " 거래", BigDecimal.valueOf(amount).setScale(2), "KRW", "카드", null)));
    }

    private org.springframework.test.web.servlet.ResultActions minorTxs(String category, String minor)
            throws Exception {
        return mvc.perform(get("/groups/" + groupId + "/summary/transactions").param("month", "2026-09")
                .param("category", category).param("minor", minor).header("Authorization", admin.bearer()));
    }

    @Test
    void categoryTransactionsFilterByMinorWithSubcategoryKeys() throws Exception {
        saveMinor(admin, "2026-09-01T12:00:00", "식비", "외식", -10_000);
        saveMinor(member, "2026-09-02T12:00:00", "식비", "외식", 2_000);
        LedgerTransaction moved = saveMinor(member, "2026-09-03T12:00:00", "원본", "원본", -3_000);
        moved.setCategoryMajorOverride("식비");
        moved.setCategoryMinorOverride("외식");
        transactions.save(moved);
        saveMinor(admin, "2026-09-04T12:00:00", "식비", "장보기", -5_000);
        saveMinor(admin, "2026-09-05T12:00:00", "식비", "  ", -1_000);
        saveMinor(admin, "2026-09-06T12:00:00", "카페", "외식", -4_000);
        saveMinor(admin, "2026-10-01T12:00:00", "식비", "외식", -99_000);

        minorTxs("식비", "외식").andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].amount").value(-3_000.0))
                .andExpect(jsonPath("$[1].amount").value(2_000.0))
                .andExpect(jsonPath("$[2].amount").value(-10_000.0));
        minorTxs("식비", "미분류").andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].amount").value(-1_000.0));
        minorTxs("카페", "외식").andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].amount").value(-4_000.0));
        minorTxs("식비", "없는소분류").andExpect(jsonPath("$", hasSize(0)));
        categoryTxs(admin, "식비").andExpect(jsonPath("$", hasSize(5)));

        // 합계(부호 반전)가 같은 (대분류, 소분류) 집계 행과 같다: 11,000
        subcategories("2026-09", "2026-09")
                .andExpect(jsonPath("$[?(@.major == '식비' && @.minor == '외식')]", hasSize(1)))
                .andExpect(jsonPath("$[?(@.major == '식비' && @.minor == '외식')].expense").value(11_000));
    }
```

거래 목록의 순서는 `categoryTransactionsMatchSummaryAndApplySummaryRules`와 같은 규칙(최근 거래 먼저)을 따른다. 위 기대 순서는 9-03, 9-02, 9-01이다.

- [ ] **Step 2: Run test to verify it fails**

Run (`apps/api`): `./gradlew test --tests 'com.saladbowl.api.transaction.SummaryApiTest'`
Expected: FAIL. `minor`를 무시하므로 `("식비", "외식")`이 5건을 준다.

- [ ] **Step 3: Implement**

`SummaryService`의 `majorLabel` 아래에 더한다.

```java
    /** 소분류가 비었으면 "미분류". subcategories 집계 키와 거래 거르기가 같은 규칙을 쓴다. */
    static String minorLabel(LedgerTransaction tx) {
        String minor = tx.displayCategory().minor();
        return minor == null || minor.isBlank() ? UNCATEGORIZED : minor;
    }
```

`subcategories`의 키 계산을 바꾼다(`Category category = …` 줄은 지운다).

```java
            Key key = new Key(YearMonth.from(tx.getOccurredAt()).toString(), majorLabel(tx), minorLabel(tx));
```

`Category` import가 더 이상 쓰이지 않으면 지운다.

`categoryTransactions`:

```java
    /** 요약의 대분류(minor가 있으면 그 소분류) 조각 하나를 이루는 거래. 환불(양수 지출)도 넣어야 합계가 조각과 같다. */
    @Transactional(readOnly = true)
    public List<TransactionView> categoryTransactions(long groupId, long userId, YearMonth month, String category,
                                                      String minor) {
        access.requireMember(groupId, userId);
        List<LedgerTransaction> matched = summaryTransactions(access.sharedOwnerIds(groupId), month).stream()
                .filter(tx -> tx.getType() == TransactionType.EXPENSE)
                .filter(tx -> majorLabel(tx).equals(category))
                .filter(tx -> minor == null || minorLabel(tx).equals(minor))
                .toList();
```

나머지는 그대로 둔다.

`SummaryController.categoryTransactions`:

```java
    @GetMapping("/groups/{groupId}/summary/transactions")
    public List<TransactionView> categoryTransactions(@CurrentUser Long userId, @PathVariable long groupId,
                                                      @RequestParam YearMonth month,
                                                      @RequestParam String category,
                                                      @RequestParam(required = false) String minor) {
        return summaryService.categoryTransactions(groupId, userId, month, category, minor);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run (`apps/api`): `./gradlew test`
Expected: PASS(전체). 끝난 뒤 `build/test-results`의 시각이 이번 실행인지 확인한다. "up-to-date"로 건너뛰었으면 `./gradlew test --rerun`.

- [ ] **Step 5: Commit (컨트롤러, 저장소 루트에서)**

Codex 구현자는 커밋하지 않는다. 컨트롤러가 테스트를 다시 돌려 확인한 뒤 저장소 루트에서 커밋한다(`Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>`).

```bash
git add apps/api/src/main/java/com/saladbowl/api/transaction/SummaryController.java \
  apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java \
  apps/api/src/test/java/com/saladbowl/api/transaction/SummaryApiTest.java
git commit -m "feat(api): 대분류 거래 목록에 소분류 거르기 minor 지원"
```

---

## 마무리

- 브랜치 최종 리뷰: opus 최종 리뷰어와 `.claude/skills/codex-collab/codex-run.sh review main .superpowers/sdd/2026-10-29-plan-16b-subcategory-api/codex-final-review.md`를 함께 돌리고 수정은 한 번에 맡긴다(codex-collab 3장).
- 실제 앱 검증(`/verify`)은 하지 않는다. 화면에서 새 값을 쓰는 곳이 없어 사용자 경로로 확인할 방법이 없다. 16d에서 화면과 함께 확인한다.
- 배포 순서: 이 PR을 서버에 먼저 반영한 뒤 16d 웹을 공개한다(설계 7.1).
- PR 본문의 확인 칸에는 `./gradlew test` 결과를 적고, 웹 검증을 생략한 이유(웹 코드 변경 없음)를 쓴다.
