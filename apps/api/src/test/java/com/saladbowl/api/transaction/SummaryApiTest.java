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
}
