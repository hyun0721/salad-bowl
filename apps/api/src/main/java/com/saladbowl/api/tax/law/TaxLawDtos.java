package com.saladbowl.api.tax.law;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

public final class TaxLawDtos {

    private TaxLawDtos() {
    }

    public record CreateRequest(@NotNull @Min(1000) @Max(9999) Integer taxYear) {
    }

    /**
     * 초안 전체 교체. 설정값은 비워 둘 수 있고(null) 범위 검사는 적용할 때 한다.
     * 여기서는 DB 열에 들어갈 수 있는 형태(길이, 단계 3칸)만 본다.
     */
    public record UpdateRequest(
            @NotNull Long rowVersion,
            Integer minSpendRatePct,
            Long bracketBoundary,
            Integer rateCreditPct,
            Integer rateDebitCashPct,
            Integer rateCulturePct,
            Integer rateMarketPct,
            Integer rateTransitPct,
            @Size(min = 3, max = 3) List<Long> basicLimitLow,
            @Size(min = 3, max = 3) List<Long> basicLimitHigh,
            Long extraLimitLow,
            Long extraLimitHigh,
            @Size(max = 200) String basisLawName,
            @Size(max = 200) String basisArticle,
            @Size(max = 500) String basisUrl,
            LocalDate periodStart,
            LocalDate periodEnd,
            @Size(max = 1000) String memo) {
    }

    public record ApplyRequest(@NotNull @JsonDeserialize(using = RowVersionDeserializer.class) Long rowVersion) {
    }

    // 소수를 long으로 자동 절삭하면 다른 버전을 적용할 수 있으므로 정수 토큰만 받는다.
    public static class RowVersionDeserializer extends ValueDeserializer<Long> {
        @Override
        public Long deserialize(JsonParser parser, DeserializationContext context) {
            if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) {
                return (Long) context.handleUnexpectedToken(Long.class, parser);
            }
            return parser.getLongValue();
        }
    }

    public record FieldError(String field, String message) {
    }

    /** errors가 비어 있으면 적용할 수 있다. */
    public record ValidationResponse(List<FieldError> errors) {
    }

    /** basicLimitLow·basicLimitHigh는 자녀등 0명 / 1명 / 2명 이상 순서의 3칸이다. */
    public record VersionResponse(
            long id,
            int taxYear,
            int versionNo,
            TaxLawStatus status,
            int algorithmVersion,
            Integer minSpendRatePct,
            Long bracketBoundary,
            Integer rateCreditPct,
            Integer rateDebitCashPct,
            Integer rateCulturePct,
            Integer rateMarketPct,
            Integer rateTransitPct,
            List<Long> basicLimitLow,
            List<Long> basicLimitHigh,
            Long extraLimitLow,
            Long extraLimitHigh,
            boolean childTiersApply,
            String basisLawName,
            String basisArticle,
            String basisUrl,
            LocalDate periodStart,
            LocalDate periodEnd,
            String memo,
            String createdByNickname,
            String appliedByNickname,
            OffsetDateTime createdAt,
            OffsetDateTime appliedAt,
            long rowVersion) {

        public static VersionResponse of(TaxLawVersion v, String createdByNickname, String appliedByNickname, String memo) {
            // List.of는 null을 받지 않는다. 초안의 빈 칸을 null로 내려야 한다.
            List<Long> low = Arrays.asList(v.getBasicLimitLow0(), v.getBasicLimitLow1(), v.getBasicLimitLow2());
            List<Long> high = Arrays.asList(v.getBasicLimitHigh0(), v.getBasicLimitHigh1(), v.getBasicLimitHigh2());
            return new VersionResponse(v.getId(), v.getTaxYear(), v.getVersionNo(), v.getStatus(),
                    v.getAlgorithmVersion(), v.getMinSpendRatePct(), v.getBracketBoundary(), v.getRateCreditPct(),
                    v.getRateDebitCashPct(), v.getRateCulturePct(), v.getRateMarketPct(), v.getRateTransitPct(),
                    low, high, v.getExtraLimitLow(), v.getExtraLimitHigh(), differs(low) || differs(high),
                    v.getBasisLawName(), v.getBasisArticle(), v.getBasisUrl(), v.getPeriodStart(), v.getPeriodEnd(),
                    memo, createdByNickname, appliedByNickname, v.getCreatedAt(), v.getAppliedAt(),
                    v.getRowVersion());
        }

        private static boolean differs(List<Long> tiers) {
            return !Objects.equals(tiers.get(0), tiers.get(1)) || !Objects.equals(tiers.get(1), tiers.get(2));
        }
    }
}
