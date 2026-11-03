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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TransactionQueryApiTest extends IntegrationTest {

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

    private LedgerTransaction save(AuthedUser owner, String dateTime, String description, long amount) {
        return transactions.save(LedgerTransaction.manual(owner.id(),
                TestLedger.data(TransactionType.EXPENSE, dateTime, "식비", description, amount)));
    }

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
                        .param("pick", "EXPENSE\t식비", "EXPENSE\t교통").param("type", "EXPENSE")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].description").value("버스"))
                .andExpect(jsonPath("$[1].description").value("점심"));
    }

    @Test
    void majorContainingCommaIsKeptWholeForMineAndGroup() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비,외식", "쉼표 분류", -8000);

        mvc.perform(get("/me/transactions").param("month", "2026-09").param("pick", "EXPENSE\t식비,외식")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/groups/{id}/transactions", groupId).param("month", "2026-09").param("pick", "EXPENSE\t식비,외식")
                        .header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void myTransactionsFilterUncategorizedMinorWithEmptyValue() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "미분류 거래", -1000);
        LedgerTransaction categorized = save(member, TransactionType.EXPENSE, "2026-09-02T09:00:00", "식비", "분류 거래", -2000);
        categorized.setCategoryMinorOverride("외식");
        transactions.save(categorized);

        mvc.perform(get("/me/transactions").param("month", "2026-09").param("pick", "EXPENSE\t식비\t")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description").value("미분류 거래"));
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
    void invalidPicksAreRejectedForMineAndGroup() throws Exception {
        for (String path : new String[] {"/me/transactions", "/groups/" + groupId + "/transactions"}) {
            for (String pick : new String[] {"EXPENSE", "EXPENSE\t식비\t외식\t추가", "GIFT\t식비"}) {
                mvc.perform(get(path).param("month", "2026-09").param("pick", pick)
                                .header("Authorization", member.bearer()))
                        .andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
            }
        }
    }

    @Test
    void groupFilterDoesNotRevealHiddenTransactions() throws Exception {
        LedgerTransaction hidden = save(member, TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "숨김", -1000);
        hidden.setHidden(true);
        transactions.save(hidden);

        mvc.perform(get("/groups/{id}/transactions", groupId).param("month", "2026-09").param("pick", "EXPENSE\t식비")
                        .header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void myTransactionsListTheMonthNewestFirstIncludingHidden() throws Exception {
        save(member, "2026-09-01T09:00:00", "아침", -3000);
        LedgerTransaction hidden = save(member, "2026-09-10T12:00:00", "점심", -8000);
        hidden.setHidden(true);
        transactions.save(hidden);
        save(member, "2026-10-01T09:00:00", "다음달", -1000);

        mvc.perform(get("/me/transactions").param("month", "2026-09").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].description").value("점심"))
                .andExpect(jsonPath("$[0].hidden").value(true))
                .andExpect(jsonPath("$[0].editable").value(true))
                .andExpect(jsonPath("$[0].occurredAt").value("2026-09-10T12:00:00"))
                .andExpect(jsonPath("$[1].description").value("아침"))
                .andExpect(jsonPath("$[1].amount").value(-3000.0))
                .andExpect(jsonPath("$[1].ownerNickname").value("멤버"));
    }

    @Test
    void groupTransactionsShowSharedMembersAndHideHiddenOnes() throws Exception {
        save(admin, "2026-09-01T09:00:00", "관리자 거래", -3000);
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);
        LedgerTransaction hidden = save(member, "2026-09-03T09:00:00", "숨긴 거래", -5000);
        hidden.setHidden(true);
        transactions.save(hidden);

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].description").value("멤버 거래"))
                .andExpect(jsonPath("$[0].editable").value(true))
                .andExpect(jsonPath("$[1].description").value("관리자 거래"))
                .andExpect(jsonPath("$[1].ownerNickname").value("관리자"))
                .andExpect(jsonPath("$[1].editable").value(false));
    }

    @Test
    void adminSeesMemberTransactionsAsEditable() throws Exception {
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$[0].editable").value(true));
    }

    @Test
    void membersWhoTurnedSharingOffAreExcluded() throws Exception {
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void memberFilterNarrowsTheList() throws Exception {
        save(admin, "2026-09-01T09:00:00", "관리자 거래", -3000);
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .param("memberId", Long.toString(admin.id()))
                        .header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description").value("관리자 거래"));
    }

    @Test
    void outsiderGets404() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void monthIsRequiredAndValidated() throws Exception {
        mvc.perform(get("/me/transactions").header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/me/transactions").param("month", "2026-13").header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void monthOutsideSupportedRangeIsRejected() throws Exception {
        for (String month : new String[] {"0000-01", "+999999999-12"}) {
            mvc.perform(get("/me/transactions").param("month", month).header("Authorization", member.bearer()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "0000-01")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void manualTransactionIsCreated() throws Exception {
        mvc.perform(post("/me/transactions").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"occurredAt":"2026-09-05T13:30:00","type":"EXPENSE","categoryMajor":"식비",
                                 "description":"현금 점심","amount":-6500,"paymentMethod":"현금","memo":"동료와"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.categoryMinor").value(""))
                .andExpect(jsonPath("$.amount").value(-6500.0))
                .andExpect(jsonPath("$.currency").value("KRW"))
                .andExpect(jsonPath("$.memo").value("동료와"));

        mvc.perform(get("/me/transactions").param("month", "2026-09").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void manualTransactionAcceptsMinutePrecisionOccurredAt() throws Exception {
        // 웹의 datetime-local 입력은 초 없이 `YYYY-MM-DDTHH:mm`을 보낸다.
        mvc.perform(post("/me/transactions").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"occurredAt":"2026-09-05T13:30","type":"EXPENSE","categoryMajor":"식비",
                                 "description":"분 단위 시각","amount":-6500}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.occurredAt").value("2026-09-05T13:30:00"));

        mvc.perform(get("/me/transactions").param("month", "2026-09").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].occurredAt").value("2026-09-05T13:30:00"));
    }

    @Test
    void manualTransactionIsValidated() throws Exception {
        mvc.perform(post("/me/transactions").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"occurredAt":"2026-09-05T13:30:00","type":"EXPENSE","categoryMajor":"",
                                 "description":"x","amount":-6500}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
