package com.saladbowl.api.transaction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 거래의 원본 값. import와 수동 추가가 같은 형태를 쓴다. memo만 null을 허용한다. */
public record TransactionData(
        LocalDateTime occurredAt,
        TransactionType type,
        String categoryMajor,
        String categoryMinor,
        String description,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        String memo) {
}
