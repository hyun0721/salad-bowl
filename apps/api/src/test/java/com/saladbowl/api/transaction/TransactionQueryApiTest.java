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
