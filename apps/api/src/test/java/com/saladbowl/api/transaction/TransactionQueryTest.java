package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TransactionQueryTest {

    private TransactionView tx(long id, TransactionType type, String major, String minor) {
        return new TransactionView(id, 1, "사용자", LocalDateTime.parse("2026-09-01T12:00:00"), type,
                major, minor, "거래", BigDecimal.ONE, "KRW", "", null, false,
                TransactionSource.MANUAL, false, true);
    }

    @Test
    void matchesTypeAndExcludesOnlyMatchingCategories() {
        var expenseFood = tx(1, TransactionType.EXPENSE, "식비", "점심");
        var expenseTransport = tx(2, TransactionType.EXPENSE, "교통", "버스");
        var incomeFood = tx(3, TransactionType.INCOME, "식비", "환급");
        var incomeSalary = tx(4, TransactionType.INCOME, "급여", "월급");
        var transfer = tx(5, TransactionType.TRANSFER, "이체", "");
        var all = List.of(expenseFood, expenseTransport, incomeFood, incomeSalary, transfer);

        assertEquals(List.of(expenseTransport, expenseFood), new TransactionQuery(List.of(),
                List.of(TransactionType.EXPENSE), null).apply(all));
        assertEquals(List.of(incomeSalary, incomeFood, expenseTransport), new TransactionQuery(List.of(
                new TransactionQuery.Exclude(TransactionType.EXPENSE, "식비", null)),
                List.of(TransactionType.EXPENSE, TransactionType.INCOME), null).apply(all));
        assertEquals(List.of(transfer, incomeSalary, incomeFood, expenseTransport), new TransactionQuery(List.of(
                new TransactionQuery.Exclude(TransactionType.EXPENSE, "식비", null)), List.of(), null).apply(all));
    }

    @Test
    void excludesExactMinorIncludingEmptyAndMajorExcludesAllMinors() {
        var empty = tx(1, TransactionType.EXPENSE, "식비", "");
        var lunch = tx(2, TransactionType.EXPENSE, "식비", "점심");
        var transport = tx(3, TransactionType.EXPENSE, "교통", "");
        var all = List.of(empty, lunch, transport);

        assertEquals(List.of(transport, lunch), new TransactionQuery(List.of(
                new TransactionQuery.Exclude(TransactionType.EXPENSE, "식비", "")), List.of(), null).apply(all));
        assertEquals(List.of(transport, empty), new TransactionQuery(List.of(
                new TransactionQuery.Exclude(TransactionType.EXPENSE, "식비", "점심")), List.of(), null).apply(all));
        assertEquals(List.of(transport), new TransactionQuery(List.of(
                new TransactionQuery.Exclude(TransactionType.EXPENSE, "식비", null)), List.of(), null).apply(all));
    }
}
