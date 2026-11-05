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
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TransactionBulkUpdateApiTest extends IntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired LedgerTransactionRepository transactions;
    @Autowired TransactionAuditRepository audits;

    AuthedUser admin;
    AuthedUser member;
    long adminTx;
    long memberTx;
    long secondMemberTx;

    @BeforeEach
    void setUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "bulk-admin@test.com", "관리자");
        member = TestAuth.signupAndLogin(mvc, "bulk-member@test.com", "멤버");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);
        adminTx = add(admin, "관리자 거래", -1000);
        memberTx = add(member, "멤버 거래", -2000);
        secondMemberTx = add(member, "멤버 거래 2", -3000);
    }

    private long add(AuthedUser owner, String description, long amount) {
        return transactions.save(LedgerTransaction.manual(owner.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", description, amount))).getId();
    }

    private ResultActions bulk(AuthedUser actor, String json) throws Exception {
        return mvc.perform(patch("/transactions/bulk").header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private String request(String ids, String fields) {
        return "{\"ids\":[" + ids + "]," + fields + "}";
    }

    private void unchanged(long... ids) {
        for (long id : ids) {
            LedgerTransaction tx = transactions.findById(id).orElseThrow();
            assertThat(tx.getCategoryMajorOverride()).isNull();
            assertThat(tx.getTypeOverride()).isNull();
            assertThat(tx.isHidden()).isFalse();
            assertThat(audits.findByTransactionIdOrderByChangedAtAscIdAsc(id)).isEmpty();
        }
    }

    @Test
    void ownerUpdatesThreeCategoriesWithThreeAudits() throws Exception {
        long third = add(member, "멤버 거래 3", -4000);
        bulk(member, request(memberTx + "," + secondMemberTx + "," + third, "\"categoryMajor\":\"외식\""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.updated").value(3));
        for (long id : new long[]{memberTx, secondMemberTx, third}) {
            assertThat(transactions.findById(id).orElseThrow().getCategoryMajorOverride()).isEqualTo("외식");
            var rows = audits.findByTransactionIdOrderByChangedAtAscIdAsc(id);
            assertThat(rows).hasSize(1);
            assertThat(rows.getFirst().getField()).isEqualTo("categoryMajor");
            assertThat(rows.getFirst().getBeforeValue()).isNull();
            assertThat(rows.getFirst().getAfterValue()).isEqualTo("외식");
        }
    }

    @Test
    void typeOverrideCanBeClearedWithOriginalType() throws Exception {
        String ids = memberTx + "," + secondMemberTx;
        bulk(member, request(ids, "\"type\":\"TRANSFER\""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.updated").value(2));
        bulk(member, request(ids, "\"type\":\"EXPENSE\""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.updated").value(2));
        for (long id : new long[]{memberTx, secondMemberTx}) {
            assertThat(transactions.findById(id).orElseThrow().getTypeOverride()).isNull();
            var rows = audits.findByTransactionIdOrderByChangedAtAscIdAsc(id);
            assertThat(rows).hasSize(2);
            assertThat(rows.get(0).getField()).isEqualTo("type");
            assertThat(rows.get(0).getAfterValue()).isEqualTo("TRANSFER");
            assertThat(rows.get(1).getBeforeValue()).isEqualTo("TRANSFER");
            assertThat(rows.get(1).getAfterValue()).isNull();
        }
    }

    @Test
    void adminCanEditMembersButMemberCannotEditAdminsAndRollsBack() throws Exception {
        bulk(admin, request(memberTx + "," + secondMemberTx, "\"categoryMinor\":\"점심\""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.updated").value(2));
        assertThat(transactions.findById(memberTx).orElseThrow().getCategoryMinorOverride()).isEqualTo("점심");
        assertThat(transactions.findById(secondMemberTx).orElseThrow().getCategoryMinorOverride()).isEqualTo("점심");

        bulk(member, request(memberTx + "," + adminTx, "\"categoryMajor\":\"외식\""))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(transactions.findById(memberTx).orElseThrow().getCategoryMajorOverride()).isNull();
        assertThat(transactions.findById(adminTx).orElseThrow().getCategoryMajorOverride()).isNull();
        assertThat(audits.findByTransactionIdOrderByChangedAtAscIdAsc(memberTx)).hasSize(1);
        assertThat(audits.findByTransactionIdOrderByChangedAtAscIdAsc(adminTx)).isEmpty();
    }

    @Test
    void nonOwnerCannotHideAndRollsBack() throws Exception {
        bulk(admin, request(adminTx + "," + memberTx, "\"hidden\":true"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        unchanged(adminTx, memberTx);
    }

    @Test
    void hiddenOrMissingTransactionReturns404AndRollsBack() throws Exception {
        bulk(member, request("" + memberTx, "\"hidden\":true")).andExpect(status().isOk());
        bulk(admin, request(adminTx + "," + memberTx, "\"categoryMajor\":\"외식\""))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        unchanged(adminTx);
        bulk(admin, request(adminTx + ",999999999", "\"categoryMajor\":\"외식\""))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        unchanged(adminTx);
    }

    @Test
    void negativeAmountCannotBecomeIncomeAndRollsBack() throws Exception {
        long positive = add(member, "양수 거래", 5000);
        bulk(member, request(positive + "," + memberTx, "\"type\":\"INCOME\""))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        unchanged(positive, memberTx);
    }

    @Test
    void invalidIdsAndEmptyPatchReturn400() throws Exception {
        String tooMany = (memberTx + ",").repeat(1000) + memberTx;
        for (String json : new String[]{request("", "\"hidden\":true"),
                request(tooMany, "\"hidden\":true"),
                request(memberTx + "," + memberTx, "\"hidden\":true"),
                request("" + memberTx, "\"type\":null,\"categoryMajor\":null,\"categoryMinor\":null,\"hidden\":null")}) {
            bulk(member, json).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        unchanged(memberTx);
    }
}
