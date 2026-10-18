package com.saladbowl.api.transaction;

import com.saladbowl.api.importer.ImportBatch;
import com.saladbowl.api.importer.ImportBatchRepository;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestLedger;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LedgerTransactionRepositoryTest extends IntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    long ownerId;
    long batchId;

    @BeforeEach
    void setUp() {
        ownerId = users.save(new User("owner@test.com", "hash", "소유자")).getId();
        batchId = batches.save(new ImportBatch(ownerId, "test.xlsx")).getId();
    }

    @Test
    void importedTransactionIsUniquePerOwnerAndKey() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        transactions.saveAndFlush(LedgerTransaction.imported(ownerId, batchId, "a".repeat(64), data));

        assertThatThrownBy(() -> transactions.saveAndFlush(
                LedgerTransaction.imported(ownerId, batchId, "a".repeat(64), data)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void manualTransactionsHaveNoKeyAndMayRepeat() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        transactions.saveAndFlush(LedgerTransaction.manual(ownerId, data));
        transactions.saveAndFlush(LedgerTransaction.manual(ownerId, data));

        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(2);
    }

    @Test
    void displayValuesPreferOverrides() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        LedgerTransaction tx = LedgerTransaction.manual(ownerId, data);
        assertThat(tx.displayCategory()).isEqualTo(new Category("식비", ""));
        assertThat(tx.isEdited()).isFalse();

        tx.setCategoryMajorOverride("외식");
        tx.setMemoOverride("점심");

        assertThat(tx.displayCategory()).isEqualTo(new Category("외식", ""));
        assertThat(tx.displayMemo()).isEqualTo("점심");
        assertThat(tx.isEdited()).isTrue();
    }

    @Test
    void refreshOriginalUpdatesNonKeyFieldsOnly() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        LedgerTransaction tx = LedgerTransaction.imported(ownerId, batchId, "b".repeat(64), data);
        tx.setCategoryMajorOverride("외식");

        TransactionData changed = new TransactionData(data.occurredAt(), data.type(), "생활", "편의점",
                data.description(), data.amount(), data.currency(), data.paymentMethod(), "메모");

        assertThat(tx.refreshOriginal(data)).isFalse();
        assertThat(tx.refreshOriginal(changed)).isTrue();
        assertThat(tx.getCategoryMajorOverride()).isEqualTo("외식");
        assertThat(tx.displayCategory()).isEqualTo(new Category("외식", "편의점"));
    }

    @Test
    void monthQueriesFilterByRangeAndHiddenAndSortNewestFirst() {
        LedgerTransaction early = transactions.save(LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "아침", -3000)));
        LedgerTransaction late = transactions.save(LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-09-30T23:59:59", "식비", "야식", -9000)));
        LedgerTransaction hidden = LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-09-15T12:00:00", "식비", "점심", -8000));
        hidden.setHidden(true);
        transactions.save(hidden);
        transactions.save(LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-10-01T00:00:00", "식비", "다음달", -1000)));
        LocalDateTime from = LocalDateTime.of(2026, 9, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 10, 1, 0, 0);

        List<LedgerTransaction> owned = transactions.findOwnedBetween(ownerId, from, to);
        List<LedgerTransaction> visible = transactions.findVisibleBetween(List.of(ownerId), from, to);

        assertThat(owned).extracting(LedgerTransaction::getDescription).containsExactly("야식", "점심", "아침");
        assertThat(visible).extracting(LedgerTransaction::getId).containsExactly(late.getId(), early.getId());
    }
}
