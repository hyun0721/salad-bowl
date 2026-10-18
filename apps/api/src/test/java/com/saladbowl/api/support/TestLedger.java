package com.saladbowl.api.support;

import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 테스트용 거래 원본 값. dateTime은 ISO 형식(예: 2026-09-01T12:00:00)이다. */
public final class TestLedger {

    private TestLedger() {
    }

    public static TransactionData data(TransactionType type, String dateTime, String categoryMajor,
                                       String description, long amount) {
        return new TransactionData(LocalDateTime.parse(dateTime), type, categoryMajor, "", description,
                BigDecimal.valueOf(amount).setScale(2), "KRW", "카드", null);
    }
}
