package com.saladbowl.api.transaction;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

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

    /** null은 변경 없음, 공백 문자열은 override 삭제. hidden은 소유자만 보낼 수 있다. */
    public record UpdateTransactionRequest(
            @Size(max = 100) String categoryMajor,
            @Size(max = 100) String categoryMinor,
            @Size(max = 1000) String memo,
            Boolean hidden) {
    }

    public record AuditView(long actorId, String actorNickname, String field, String before, String after,
                            OffsetDateTime changedAt) {
    }

    /** month는 yyyy-MM. import 거래가 있는 달만 돌려준다. */
    public record CoverageMonth(String month, long importedCount) {
    }
}
