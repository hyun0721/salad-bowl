package com.saladbowl.api.transaction;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class TransactionDtos {

    private TransactionDtos() {
    }

    /** 화면용 거래. categoryMajor/categoryMinor/memo는 override가 있으면 override 값이다. */
    public record TransactionView(
            long id,
            long ownerId,
            String ownerNickname,
            LocalDateTime occurredAt,
            TransactionType type,
            String categoryMajor,
            String categoryMinor,
            String description,
            BigDecimal amount,
            String currency,
            String paymentMethod,
            String memo,
            boolean hidden,
            TransactionSource source,
            boolean edited,
            boolean editable) {
    }

    public record ManualTransactionRequest(
            @NotNull LocalDateTime occurredAt,
            @NotNull TransactionType type,
            @NotBlank @Size(max = 100) String categoryMajor,
            @Size(max = 100) String categoryMinor,
            @NotBlank @Size(max = 500) String description,
            @NotNull @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Size(max = 100) String paymentMethod,
            @Size(max = 1000) String memo) {
    }
}
