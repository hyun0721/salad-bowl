package com.saladbowl.api.transaction;

import com.saladbowl.api.importer.ImportBatch;
import com.saladbowl.api.importer.ImportBatchRepository;
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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TransactionUpdateApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    AuthedUser admin;
    AuthedUser member;
    long groupId;
    long memberTxId;

    @BeforeEach
    void setUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);
        memberTxId = transactions.save(LedgerTransaction.manual(member.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", "김밥", -4000))).getId();
    }

    private ResultActions patchTx(AuthedUser actor, long txId, String json) throws Exception {
        return mvc.perform(patch("/transactions/" + txId).header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void ownerSetsAndClearsOverrides() throws Exception {
        patchTx(member, memberTxId, """
                {"categoryMajor":"외식","memo":"맛있었음"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryMajor").value("외식"))
                .andExpect(jsonPath("$.memo").value("맛있었음"))
                .andExpect(jsonPath("$.edited").value(true));

        patchTx(member, memberTxId, """
                {"categoryMajor":"  "}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryMajor").value("식비"))
                .andExpect(jsonPath("$.memo").value("맛있었음"));
    }

    @Test
    void ownerHidesTransaction() throws Exception {
        patchTx(member, memberTxId, """
                {"hidden":true}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hidden").value(true));

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void adminEditsSharedMemberTransactionAndAuditRecordsTheActor() throws Exception {
        patchTx(admin, memberTxId, """
                {"categoryMajor":"외식"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryMajor").value("외식"));

        mvc.perform(get("/transactions/" + memberTxId + "/audits").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].actorId").value(admin.id()))
                .andExpect(jsonPath("$[0].actorNickname").value("관리자"))
                .andExpect(jsonPath("$[0].field").value("categoryMajor"))
                .andExpect(jsonPath("$[0].before").doesNotExist())
                .andExpect(jsonPath("$[0].after").value("외식"));
    }

    @Test
    void unchangedValuesAreNotAudited() throws Exception {
        patchTx(member, memberTxId, """
                {"memo":"메모"}
                """).andExpect(status().isOk());
        patchTx(member, memberTxId, """
                {"memo":"메모"}
                """).andExpect(status().isOk());

        mvc.perform(get("/transactions/" + memberTxId + "/audits").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void adminCannotHideSomeoneElsesTransaction() throws Exception {
        patchTx(admin, memberTxId, """
                {"hidden":true}
                """)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void memberCannotEditAdminTransaction() throws Exception {
        long adminTxId = transactions.save(LedgerTransaction.manual(admin.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-03T12:00:00", "식비", "국밥", -9000))).getId();

        patchTx(member, adminTxId, """
                {"memo":"x"}
                """)
                .andExpect(status().isForbidden());
    }

    @Test
    void hiddenTransactionIsInvisibleToAdmin() throws Exception {
        patchTx(member, memberTxId, """
                {"hidden":true}
                """).andExpect(status().isOk());

        patchTx(admin, memberTxId, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
        mvc.perform(get("/transactions/" + memberTxId + "/audits").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminCannotSeeTransactionsOfMemberWhoTurnedSharingOff() throws Exception {
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        patchTx(admin, memberTxId, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
    }

    @Test
    void outsiderGets404() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        patchTx(outsider, memberTxId, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
        patchTx(outsider, 999_999L, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
    }

    @Test
    void ownerDeletesManualTransaction() throws Exception {
        mvc.perform(delete("/transactions/" + memberTxId).header("Authorization", member.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/me/transactions").param("month", "2026-09").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void importedTransactionCannotBeDeleted() throws Exception {
        long importedId = transactions.save(LedgerTransaction.imported(member.id(), importBatchFor(member), "c".repeat(64),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-04T12:00:00", "식비", "라면", -1500))).getId();

        mvc.perform(delete("/transactions/" + importedId).header("Authorization", member.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANNOT_DELETE_IMPORTED"));
    }

    @Test
    void onlyOwnerCanDelete() throws Exception {
        mvc.perform(delete("/transactions/" + memberTxId).header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden());
    }

    private long importBatchFor(AuthedUser owner) {
        return batches.save(new ImportBatch(owner.id(), "test.xlsx")).getId();
    }
}
