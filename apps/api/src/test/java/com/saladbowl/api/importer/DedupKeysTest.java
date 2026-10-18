package com.saladbowl.api.importer;

import com.saladbowl.api.support.TestLedger;
import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    /** 이 값이 바뀌면 이미 저장된 모든 dedup_key가 어긋난다. 바꾸려면 데이터 마이그레이션이 필요하다. */
    static final String PINNED_KEY = "265539d5ba039b67e68937d68095a9490774d024d0bb2220b49cfe7c4f226cc9";

    @Test
    void keyFormatIsPinned() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);

        assertThat(DedupKeys.keysFor(1L, List.of(row(2, data)))).containsExactly(PINNED_KEY);
    }

    @Test
    void scaleOfAmountDoesNotChangeTheKey() {
        TransactionData scaleZero = new TransactionData(LocalDateTime.of(2026, 9, 1, 12, 0, 0),
                TransactionType.EXPENSE, "식비", "", "김밥", BigDecimal.valueOf(-4000), "KRW", "카드", null);

        assertThat(DedupKeys.keysFor(1L, List.of(row(2, scaleZero)))).containsExactly(PINNED_KEY);
    }

    @Test
    void subSecondPartOfTimeDoesNotChangeTheKey() {
        TransactionData withNanos = new TransactionData(LocalDateTime.of(2026, 9, 1, 12, 0, 0, 500_000_000),
                TransactionType.EXPENSE, "식비", "", "김밥", new BigDecimal("-4000.00"), "KRW", "카드", null);

        assertThat(DedupKeys.keysFor(1L, List.of(row(2, withNanos)))).containsExactly(PINNED_KEY);
    }

    @Test
    void amountWithMoreThanTwoDecimalsFailsLoudly() {
        TransactionData tooPrecise = new TransactionData(LocalDateTime.of(2026, 9, 1, 12, 0, 0),
                TransactionType.EXPENSE, "식비", "", "김밥", new BigDecimal("-4000.001"), "KRW", "카드", null);

        assertThatThrownBy(() -> DedupKeys.keysFor(1L, List.of(row(2, tooPrecise))))
                .isInstanceOf(ArithmeticException.class);
    }
}
