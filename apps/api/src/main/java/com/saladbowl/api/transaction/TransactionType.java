package com.saladbowl.api.transaction;

import java.util.Arrays;
import java.util.Optional;

public enum TransactionType {
    INCOME("수입"),
    EXPENSE("지출"),
    TRANSFER("이체");

    private final String label;

    TransactionType(String label) {
        this.label = label;
    }

    /** 뱅크샐러드 엑셀의 '타입' 값(수입/지출/이체)으로 찾는다. */
    public static Optional<TransactionType> fromLabel(String label) {
        return Arrays.stream(values()).filter(t -> t.label.equals(label)).findFirst();
    }
}
