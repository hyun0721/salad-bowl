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
