package com.saladbowl.api.importer;

import com.saladbowl.api.support.TestLedger;
import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DedupKeysTest {

    private static ParsedRow row(int rowNumber, TransactionData data) {
        return new ParsedRow(rowNumber, data);
    }

    @Test
    void keysAreStableHex64() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);

        List<String> first = DedupKeys.keysFor(1L, List.of(row(2, data)));
        List<String> second = DedupKeys.keysFor(1L, List.of(row(7, data)));

        assertThat(first.get(0)).matches("[0-9a-f]{64}").isEqualTo(second.get(0));
    }

    @Test
    void identicalRowsInOneFileGetDifferentKeys() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);

        List<String> keys = DedupKeys.keysFor(1L, List.of(row(2, data), row(3, data)));

        assertThat(keys.get(0)).isNotEqualTo(keys.get(1));
    }

    @Test
    void categoryIsNotPartOfTheKey() {
        TransactionData a = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        TransactionData b = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "외식", "김밥", -4000);

        assertThat(DedupKeys.keysFor(1L, List.of(row(2, a))))
                .isEqualTo(DedupKeys.keysFor(1L, List.of(row(2, b))));
    }

    @Test
    void ownerIsPartOfTheKey() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);

        assertThat(DedupKeys.keysFor(1L, List.of(row(2, data))))
                .isNotEqualTo(DedupKeys.keysFor(2L, List.of(row(2, data))));
    }
}
