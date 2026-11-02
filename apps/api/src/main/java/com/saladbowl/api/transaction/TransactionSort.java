package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;

import java.util.Comparator;

/** 거래 목록 정렬. 동률은 최신순으로 고정한다. */
public enum TransactionSort {
    DATE_DESC, DATE_ASC, AMOUNT_DESC, AMOUNT_ASC;

    private static final Comparator<TransactionView> NEWEST =
            Comparator.comparing(TransactionView::occurredAt).thenComparingLong(TransactionView::id).reversed();

    public Comparator<TransactionView> comparator() {
        Comparator<TransactionView> amount = Comparator.comparing(tx -> tx.amount().abs());
        return switch (this) {
            case DATE_DESC -> NEWEST;
            case DATE_ASC -> NEWEST.reversed();
            case AMOUNT_DESC -> amount.reversed().thenComparing(NEWEST);
            case AMOUNT_ASC -> amount.thenComparing(NEWEST);
        };
    }
}
