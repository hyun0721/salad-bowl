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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CoverageApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    private int seq = 0;

    private void imported(AuthedUser owner, long batchId, String dateTime) {
        String key = String.format("%064d", ++seq);
        transactions.save(LedgerTransaction.imported(owner.id(), batchId, key,
                TestLedger.data(TransactionType.EXPENSE, dateTime, "식비", "거래" + seq, -1000)));
    }

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

        mvc.perform(get("/me/coverage").param("year", "2026").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].month").value("2026-01"))
                .andExpect(jsonPath("$[0].importedCount").value(1))
                .andExpect(jsonPath("$[1].month").value("2026-09"))
                .andExpect(jsonPath("$[1].importedCount").value(2));
    }

    @Test
    void coverageIsPerOwner() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@test.com", "남");
        long batchId = batches.save(new ImportBatch(other.id(), "b.xlsx")).getId();
        imported(other, batchId, "2026-09-01T00:00:00");

        mvc.perform(get("/me/coverage").param("year", "2026").header("Authorization", me.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void yearIsRequired() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");

        mvc.perform(get("/me/coverage").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/me/coverage").param("year", "abc").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void yearOutsideSupportedRangeIsRejected() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");

        mvc.perform(get("/me/coverage").param("year", "0").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/me/coverage").param("year", "1000000000").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
