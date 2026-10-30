package com.saladbowl.api.transaction;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import com.saladbowl.api.support.TestLedger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SummaryApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    AuthedUser admin;
    AuthedUser member;
    long groupId;

    @BeforeEach
    void setUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);
    }

    private LedgerTransaction save(AuthedUser owner, TransactionType type, String dateTime, String category,
                                   long amount) {
        return transactions.save(LedgerTransaction.manual(owner.id(),
                TestLedger.data(type, dateTime, category, category + " 거래", amount)));
    }

    @Test
    void summarizesIncomeExpenseByCategoryAndMember() throws Exception {
        save(admin, TransactionType.INCOME, "2026-09-25T09:00:00", "급여", 3_000_000);
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", -10_000);
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        save(member, TransactionType.EXPENSE, "2026-09-03T12:00:00", "교통", -5_000);
        save(member, TransactionType.EXPENSE, "2026-09-04T12:00:00", "식비", 3_000);
        save(member, TransactionType.TRANSFER, "2026-09-05T12:00:00", "이체", -500_000);
        save(member, TransactionType.EXPENSE, "2026-10-01T12:00:00", "식비", -99_000);

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-09"))
                .andExpect(jsonPath("$.income").value(3_000_000.0))
                .andExpect(jsonPath("$.expense").value(32_000.0))
                .andExpect(jsonPath("$.byCategory", hasSize(2)))
                .andExpect(jsonPath("$.byCategory[0].category").value("식비"))
                .andExpect(jsonPath("$.byCategory[0].expense").value(27_000.0))
                .andExpect(jsonPath("$.byCategory[1].category").value("교통"))
                .andExpect(jsonPath("$.byCategory[1].expense").value(5_000.0))
                .andExpect(jsonPath("$.byMember", hasSize(2)))
                .andExpect(jsonPath("$.byMember[0].nickname").value("관리자"))
                .andExpect(jsonPath("$.byMember[0].income").value(3_000_000.0))
                .andExpect(jsonPath("$.byMember[0].expense").value(10_000.0))
                .andExpect(jsonPath("$.byMember[1].nickname").value("멤버"))
                .andExpect(jsonPath("$.byMember[1].expense").value(22_000.0));
    }

    @Test
    void overrideCategoryIsUsedAndHiddenIsExcluded() throws Exception {
        LedgerTransaction lunch = save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        lunch.setCategoryMajorOverride("외식");
        transactions.save(lunch);
        LedgerTransaction secret = save(member, TransactionType.EXPENSE, "2026-09-03T12:00:00", "쇼핑", -50_000);
        secret.setHidden(true);
        transactions.save(secret);

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.expense").value(20_000.0))
                .andExpect(jsonPath("$.byCategory", hasSize(1)))
                .andExpect(jsonPath("$.byCategory[0].category").value("외식"));
    }

    @Test
    void nonKrwTransactionsAreExcluded() throws Exception {
        transactions.save(LedgerTransaction.manual(member.id(), new TransactionData(
                java.time.LocalDateTime.parse("2026-09-02T12:00:00"), TransactionType.EXPENSE, "여행", "", "호텔",
                new BigDecimal("-120.00"), "USD", "카드", null)));

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.expense").value(0.0))
                .andExpect(jsonPath("$.byCategory", hasSize(0)));
    }

    @Test
    void membersWhoTurnedSharingOffAreExcluded() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.expense").value(0.0))
                .andExpect(jsonPath("$.byMember", hasSize(1)))
                .andExpect(jsonPath("$.byMember[0].nickname").value("관리자"));
    }

    private org.springframework.test.web.servlet.ResultActions categoryTxs(AuthedUser who, String category)
            throws Exception {
        return mvc.perform(get("/groups/" + groupId + "/summary/transactions").param("month", "2026-09")
                .param("category", category).header("Authorization", who.bearer()));
    }

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

        subcategories("2026-09", "2026-09")
                .andExpect(jsonPath("$[?(@.major == '식비' && @.minor == '외식')]", hasSize(1)))
                .andExpect(jsonPath("$[?(@.major == '식비' && @.minor == '외식')].expense").value(11_000.0));
    }

    @Test
    void categoryTransactionsMatchSummaryAndApplySummaryRules() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", -10_000);
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        save(member, TransactionType.EXPENSE, "2026-09-04T12:00:00", "식비", 3_000);
        save(member, TransactionType.EXPENSE, "2026-09-03T12:00:00", "교통", -5_000);
        save(member, TransactionType.EXPENSE, "2026-10-01T12:00:00", "식비", -99_000);
        save(member, TransactionType.TRANSFER, "2026-09-05T12:00:00", "식비", -500_000);
        LedgerTransaction secret = save(member, TransactionType.EXPENSE, "2026-09-06T12:00:00", "식비", -7_000);
        secret.setHidden(true);
        transactions.save(secret);
        transactions.save(LedgerTransaction.manual(member.id(), new TransactionData(
                java.time.LocalDateTime.parse("2026-09-07T12:00:00"), TransactionType.EXPENSE, "식비", "", "해외",
                new BigDecimal("-50.00"), "USD", "카드", null)));

        categoryTxs(admin, "식비")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].amount").value(3_000.0))
                .andExpect(jsonPath("$[1].amount").value(-20_000.0))
                .andExpect(jsonPath("$[2].amount").value(-10_000.0));

        // 합계(부호 반전)가 요약의 같은 대분류 expense와 같다: 27,000
        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.byCategory[0].category").value("식비"))
                .andExpect(jsonPath("$.byCategory[0].expense").value(27_000.0));
    }

    @Test
    void categoryTransactionsExcludeMembersWhoTurnedSharingOff() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", -10_000);
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        categoryTxs(admin, "식비")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].amount").value(-10_000.0));
    }

    @Test
    void categoryTransactionsFollowOverrideCategory() throws Exception {
        LedgerTransaction lunch = save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        lunch.setCategoryMajorOverride("외식");
        transactions.save(lunch);

        categoryTxs(admin, "외식").andExpect(jsonPath("$", hasSize(1)));
        categoryTxs(admin, "식비").andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void blankMajorCategoryIsGroupedAsUncategorized() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "", -1_000);
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "   ", -2_000);

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.byCategory", hasSize(1)))
                .andExpect(jsonPath("$.byCategory[0].category").value("미분류"))
                .andExpect(jsonPath("$.byCategory[0].expense").value(3_000.0));

        categoryTxs(admin, "미분류").andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void categoryTransactionsAcceptSlashInCategoryAndUnknownIsEmpty() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "교통/차량", -4_000);

        categoryTxs(admin, "교통/차량").andExpect(jsonPath("$", hasSize(1)));
        categoryTxs(admin, "없는분류").andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void categoryTransactionsRejectOutsider() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        categoryTxs(outsider, "식비").andExpect(status().isNotFound());
    }

    @Test
    void outsiderGets404() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
    }

    private org.springframework.test.web.servlet.ResultActions trend(AuthedUser who, String from, String to)
            throws Exception {
        var req = get("/groups/" + groupId + "/summary/trend").header("Authorization", who.bearer());
        if (from != null) {
            req.param("from", from);
        }
        if (to != null) {
            req.param("to", to);
        }
        return mvc.perform(req);
    }

    @Test
    void trendMatchesMonthlySummaryPerMonthAndFillsEmptyMonthsWithZero() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-08-01T12:00:00", "식비", -10_000);
        save(member, TransactionType.EXPENSE, "2026-08-31T23:59:00", "식비", -20_000);
        save(member, TransactionType.EXPENSE, "2026-08-04T12:00:00", "식비", 3_000);
        save(member, TransactionType.EXPENSE, "2026-10-01T00:00:00", "식비", -7_000);
        save(member, TransactionType.EXPENSE, "2026-10-02T12:00:00", "교통", -50_000);
        save(member, TransactionType.EXPENSE, "2026-10-03T12:00:00", "", -1_000);
        LedgerTransaction lunch = save(member, TransactionType.EXPENSE, "2026-08-05T12:00:00", "식비", -4_000);
        lunch.setCategoryMajorOverride("외식");
        transactions.save(lunch);

        trend(admin, "2026-08", "2026-10").andExpect(status().isOk())
                .andExpect(jsonPath("$.months", hasSize(3)))
                .andExpect(jsonPath("$.months[0]").value("2026-08"))
                .andExpect(jsonPath("$.months[2]").value("2026-10"))
                .andExpect(jsonPath("$.categories", hasSize(4)))
                .andExpect(jsonPath("$.categories[0].category").value("교통"))
                .andExpect(jsonPath("$.categories[0].expenses[0]").value(0.0))
                .andExpect(jsonPath("$.categories[0].expenses[1]").value(0.0))
                .andExpect(jsonPath("$.categories[0].expenses[2]").value(50_000.0))
                .andExpect(jsonPath("$.categories[0].total").value(50_000.0))
                .andExpect(jsonPath("$.categories[1].category").value("식비"))
                .andExpect(jsonPath("$.categories[1].expenses[0]").value(27_000.0))
                .andExpect(jsonPath("$.categories[1].expenses[1]").value(0.0))
                .andExpect(jsonPath("$.categories[1].expenses[2]").value(7_000.0))
                .andExpect(jsonPath("$.categories[1].total").value(34_000.0))
                .andExpect(jsonPath("$.categories[2].category").value("외식"))
                .andExpect(jsonPath("$.categories[2].total").value(4_000.0))
                .andExpect(jsonPath("$.categories[3].category").value("미분류"))
                .andExpect(jsonPath("$.categories[3].total").value(1_000.0));

        // 모든 월·모든 대분류가 같은 달 /summary 의 byCategory 와 같아야 한다.
        String body = trend(admin, "2026-08", "2026-10").andReturn().getResponse().getContentAsString();
        var root = new tools.jackson.databind.ObjectMapper().readTree(body);
        String[] months = {"2026-08", "2026-09", "2026-10"};
        for (var cat : root.get("categories")) {
            org.junit.jupiter.api.Assertions.assertEquals(3, cat.get("expenses").size());
        }
        for (int i = 0; i < months.length; i++) {
            var summary = new tools.jackson.databind.ObjectMapper().readTree(
                    mvc.perform(get("/groups/" + groupId + "/summary").param("month", months[i])
                                    .header("Authorization", admin.bearer()))
                            .andReturn().getResponse().getContentAsString());
            java.util.Map<String, BigDecimal> expected = new java.util.HashMap<>();
            for (var c : summary.get("byCategory")) {
                expected.put(c.get("category").asText(), c.get("expense").decimalValue());
            }
            for (var cat : root.get("categories")) {
                BigDecimal want = expected.getOrDefault(cat.get("category").asText(), BigDecimal.ZERO);
                org.junit.jupiter.api.Assertions.assertEquals(0,
                        want.compareTo(cat.get("expenses").get(i).decimalValue()),
                        cat.get("category").asText() + " " + months[i]);
            }
        }
    }

    @Test
    void trendExcludesTransferHiddenForeignCurrencyAndSharingOff() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", -10_000);
        save(member, TransactionType.TRANSFER, "2026-09-05T12:00:00", "식비", -500_000);
        LedgerTransaction secret = save(admin, TransactionType.EXPENSE, "2026-09-06T12:00:00", "식비", -7_000);
        secret.setHidden(true);
        transactions.save(secret);
        transactions.save(LedgerTransaction.manual(admin.id(), new TransactionData(
                java.time.LocalDateTime.parse("2026-09-02T12:00:00"), TransactionType.EXPENSE, "식비", "", "호텔",
                new BigDecimal("-120.00"), "USD", "카드", null)));
        save(member, TransactionType.EXPENSE, "2026-09-07T12:00:00", "쇼핑", -20_000);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        trend(admin, "2026-09", "2026-09").andExpect(status().isOk())
                .andExpect(jsonPath("$.months", hasSize(1)))
                .andExpect(jsonPath("$.categories", hasSize(1)))
                .andExpect(jsonPath("$.categories[0].category").value("식비"))
                .andExpect(jsonPath("$.categories[0].total").value(10_000.0));
    }

    @Test
    void trendSortsByTotalDescendingThenName() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "나", -5_000);
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "가", -5_000);
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "다", -9_000);

        trend(admin, "2026-09", "2026-09").andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].category").value("다"))
                .andExpect(jsonPath("$.categories[1].category").value("가"))
                .andExpect(jsonPath("$.categories[2].category").value("나"));
    }

    @Test
    void trendAcceptsTwelveMonthsButRejectsInvalidRanges() throws Exception {
        trend(admin, "2025-11", "2026-10").andExpect(status().isOk())
                .andExpect(jsonPath("$.months", hasSize(12)));
        trend(admin, "2026-10", "2026-09").andExpect(status().isBadRequest());
        trend(admin, "2025-10", "2026-10").andExpect(status().isBadRequest());
        trend(admin, null, "2026-10").andExpect(status().isBadRequest());
        trend(admin, "2026-10", null).andExpect(status().isBadRequest());
        trend(admin, "2026-13", "2026-10").andExpect(status().isBadRequest());
        trend(admin, "9999-01", "9999-12").andExpect(status().isOk());
        trend(admin, "9999-12", "9999-12").andExpect(status().isOk());
        trend(admin, "0000-01", "0000-02").andExpect(status().isBadRequest());
        trend(admin, "9999-12", "+10000-01").andExpect(status().isBadRequest());
        trend(admin, "-0001-01", "9999-12").andExpect(status().isBadRequest());
        trend(admin, "+999999999-01", "+999999999-12").andExpect(status().isBadRequest());
    }

    @Test
    void trendRejectsOutsider() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        trend(outsider, "2026-09", "2026-10").andExpect(status().isNotFound());
    }

    @Test
    void subcategoriesUseSixMonthsAndDisplayCategories() throws Exception {
        save(admin, TransactionType.EXPENSE, "2026-04-01T00:00:00", "식비", -10_000);
        LedgerTransaction dinner = save(member, TransactionType.EXPENSE, "2026-09-30T23:59:59", "원본", -20_000);
        dinner.setCategoryMajorOverride("식비");
        dinner.setCategoryMinorOverride("외식");
        transactions.save(dinner);
        LedgerTransaction refund = save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", 3_000);
        refund.setCategoryMinorOverride("외식");
        transactions.save(refund);
        save(admin, TransactionType.EXPENSE, "2026-03-31T23:59:59", "범위 밖", -99_000);
        save(admin, TransactionType.EXPENSE, "2026-10-01T00:00:00", "다음 달", -99_000);
        save(admin, TransactionType.INCOME, "2026-09-01T12:00:00", "급여", 99_000);
        save(admin, TransactionType.TRANSFER, "2026-09-01T12:00:00", "이체", -99_000);
        LedgerTransaction hidden = save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "숨김", -99_000);
        hidden.setHidden(true);
        transactions.save(hidden);
        transactions.save(LedgerTransaction.manual(member.id(), new TransactionData(
                java.time.LocalDateTime.parse("2026-09-02T12:00:00"), TransactionType.EXPENSE, "여행", "호텔", "호텔",
                new BigDecimal("-120.00"), "USD", "카드", null)));

        mvc.perform(get("/groups/" + groupId + "/summary/subcategories").param("month", "2026-09")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].month").value("2026-04"))
                .andExpect(jsonPath("$[0].expense").value(10_000))
                .andExpect(jsonPath("$[1].month").value("2026-09"))
                .andExpect(jsonPath("$[1].major").value("식비"))
                .andExpect(jsonPath("$[1].minor").value("외식"))
                .andExpect(jsonPath("$[1].expense").value(17_000));

        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/groups/" + groupId + "/summary/subcategories").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].month").value("2026-04"));
    }

    @Test
    void subcategoriesValidateMonthAndMembership() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "sub-out@test.com", "외부인");
        mvc.perform(get("/groups/" + groupId + "/summary/subcategories").param("month", "2026-09")
                        .header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
        for (String month : java.util.List.of("0000-01", "+10000-01", "2026-13", "bad")) {
            mvc.perform(get("/groups/" + groupId + "/summary/subcategories").param("month", month)
                            .header("Authorization", admin.bearer()))
                    .andExpect(status().isBadRequest());
        }
    }

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

    private org.springframework.test.web.servlet.ResultActions memberCategories(AuthedUser who, String month)
            throws Exception {
        return mvc.perform(get("/groups/" + groupId + "/summary/members").param("month", month)
                .header("Authorization", who.bearer()));
    }

    @Test
    void memberCategoriesAggregateNetExpenseAndMatchSubcategories() throws Exception {
        saveMinor(admin, "2026-09-01T12:00:00", "식비", "외식", -10_000);
        saveMinor(member, "2026-09-02T12:00:00", "식비", "외식", -2_000);
        saveMinor(member, "2026-09-03T12:00:00", "식비", "외식", 3_000);
        saveMinor(admin, "2026-09-04T12:00:00", "식비", "장보기", -4_000);
        LedgerTransaction moved = saveMinor(admin, "2026-09-05T12:00:00", "원본", "원본", -500);
        moved.setCategoryMajorOverride("식비");
        moved.setCategoryMinorOverride("외식");
        transactions.save(moved);
        save(admin, TransactionType.INCOME, "2026-09-06T12:00:00", "급여", 99_000);
        save(admin, TransactionType.TRANSFER, "2026-09-07T12:00:00", "이체", -99_000);
        LedgerTransaction hidden = saveMinor(admin, "2026-09-08T12:00:00", "식비", "외식", -99_000);
        hidden.setHidden(true);
        transactions.save(hidden);
        saveMinor(admin, "2026-10-01T12:00:00", "식비", "외식", -99_000);
        transactions.save(LedgerTransaction.manual(member.id(), new TransactionData(
                java.time.LocalDateTime.parse("2026-09-09T12:00:00"), TransactionType.EXPENSE,
                "식비", "외식", "해외", new BigDecimal("-99.00"), "USD", "카드", null)));

        var rows = new tools.jackson.databind.ObjectMapper().readTree(
                memberCategories(member, "2026-09").andExpect(status().isOk())
                        .andExpect(jsonPath("$", hasSize(3)))
                        .andExpect(jsonPath("$[0].major").value("식비"))
                        .andExpect(jsonPath("$[0].minor").value("외식"))
                        .andExpect(jsonPath("$[0].userId").value(admin.id()))
                        .andExpect(jsonPath("$[0].expense").value(10_500))
                        .andExpect(jsonPath("$[1].userId").value(member.id()))
                        .andExpect(jsonPath("$[1].expense").value(-1_000))
                        .andExpect(jsonPath("$[2].minor").value("장보기"))
                        .andExpect(jsonPath("$[2].expense").value(4_000))
                        .andReturn().getResponse().getContentAsString());
        var subcategories = new tools.jackson.databind.ObjectMapper().readTree(
                subcategories("2026-09", "2026-09").andReturn().getResponse().getContentAsString());
        for (var category : subcategories) {
            BigDecimal total = BigDecimal.ZERO;
            for (var row : rows) {
                if (row.get("major").asText().equals(category.get("major").asText())
                        && row.get("minor").asText().equals(category.get("minor").asText())) {
                    total = total.add(row.get("expense").decimalValue());
                }
            }
            org.junit.jupiter.api.Assertions.assertEquals(0, total.compareTo(category.get("expense").decimalValue()));
        }
    }

    @Test
    void memberCategoriesRespectSharingAndMembership() throws Exception {
        saveMinor(admin, "2026-09-01T12:00:00", "식비", "외식", -1_000);
        saveMinor(member, "2026-09-02T12:00:00", "식비", "외식", -2_000);
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "member-summary-out@test.com", "외부인");
        saveMinor(outsider, "2026-09-03T12:00:00", "식비", "외식", -3_000);
        memberCategories(admin, "2026-09").andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk());
        memberCategories(admin, "2026-09").andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(admin.id()))
                .andExpect(jsonPath("$[0].expense").value(1_000));
        memberCategories(outsider, "2026-09").andExpect(status().isNotFound());
    }

    @Test
    void memberCategoriesRejectInvalidMonth() throws Exception {
        for (String month : java.util.List.of("2026-13", "bad", "0000-01")) {
            memberCategories(admin, month).andExpect(status().isBadRequest());
        }
    }
}
