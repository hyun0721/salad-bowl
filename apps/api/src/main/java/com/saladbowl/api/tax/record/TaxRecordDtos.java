package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.law.TaxLawDtos.RowVersionDeserializer;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class TaxRecordDtos {

    /** 금액 한 칸의 상한. 화면의 금액 입력(MoneyField), 세법 금액 검증과 같은 값이다. */
    public static final long MAX_AMOUNT = 9_999_999_999_999L;
    public static final int MAX_CARDS = 50;

    private TaxRecordDtos() {
    }

    /** 정수 토큰만 받는다. 기본 설정은 1000.7 같은 소수를 말없이 1000으로 잘라 저장한다. */
    @Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
    @Retention(RetentionPolicy.RUNTIME)
    @JacksonAnnotationsInside
    @JsonDeserialize(using = RowVersionDeserializer.class)
    public @interface WholeNumber {
    }

    public static class WholeIntegerDeserializer extends ValueDeserializer<Integer> {
        @Override
        public Integer deserialize(JsonParser parser, DeserializationContext context) {
            if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) {
                return (Integer) context.handleUnexpectedToken(Integer.class, parser);
            }
            return parser.getIntValue();
        }
    }

    /** 기본정보. rowVersion이 없으면 새로 만들고, 있으면 그 버전의 기록을 고친다. */
    public record YearRequest(
            @NotNull @Min(1) @Max(MAX_AMOUNT) @WholeNumber Long totalSalary,
            @NotNull @Min(1) @Max(12) @JsonDeserialize(using = WholeIntegerDeserializer.class) Integer workStartMonth,
            @NotNull @Min(1) @Max(12) @JsonDeserialize(using = WholeIntegerDeserializer.class) Integer workEndMonth,
            @NotNull @Min(0) @Max(99) @JsonDeserialize(using = WholeIntegerDeserializer.class) Integer childCount,
            @WholeNumber Long rowVersion) {
    }

    public record CardAmounts(
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditGeneral,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditMarket,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditTransit,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditCulture,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitGeneral,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitMarket,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitTransit,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitCulture) {
    }

    public record CashAmounts(
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long general,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long market,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long transit,
            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long culture) {
    }

    public record CardRequest(@NotNull String issuerName, @NotNull LocalDate asOfDate,
                              @Size(max = 200) String memo, @NotNull @Valid CardAmounts amounts,
                              @WholeNumber Long rowVersion) {
    }

    public record CashRequest(@NotNull LocalDate asOfDate, @Size(max = 200) String memo,
                              @NotNull @Valid CashAmounts amounts, @WholeNumber Long rowVersion) {
    }

    public record CardView(long id, long rowVersion, String issuerName, LocalDate asOfDate, String memo,
                           CardAmounts amounts, int blankCount) {
    }

    public record CashView(long rowVersion, LocalDate asOfDate, String memo, CashAmounts amounts, int blankCount) {
    }

    public record PlanRow(
            @NotNull @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditFixed,
            @NotNull @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitFixed,
            @NotNull @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long flexible) {
    }

    public record PlanRequest(
            @NotNull @Valid PlanRow general,
            @NotNull @Valid PlanRow market,
            @NotNull @Valid PlanRow transit,
            @NotNull @Valid PlanRow culture,
            @WholeNumber Long rowVersion) {
    }

    public record PlanView(long rowVersion, PlanRow general, PlanRow market, PlanRow transit, PlanRow culture) {
    }

    /** 연도 기록이 기억하는 세법 버전. childTiersApply는 웹이 자녀등 입력란을 보일지 판단하는 값이다. */
    public record LawVersionRef(long id, int versionNo, OffsetDateTime appliedAt, boolean childTiersApply) {
    }

    /** 연도 기록 묶음. 모든 조회·저장 응답이 이 모양이다.
     * newerLawVersion은 기록 버전과 현재 적용 버전이 다른지 나타낸다.
     * plan이 null이면 저장된 지출계획이 없다. */
    public record TaxYearView(
            int taxYear,
            long rowVersion,
            long totalSalary,
            int workStartMonth,
            int workEndMonth,
            int childCount,
            LawVersionRef lawVersion,
            boolean newerLawVersion,
            List<CardView> cards,
            CashView cashReceipt,
            PlanView plan,
            SpendingTotals totals,
            int blankCount,
            boolean hasInputs,
            boolean asOfDateMismatch) {
    }

    /** 저장 결과. created가 true면 새로 만든 것(201)이다. */
    public record SavedYear(boolean created, TaxYearView view) {
    }
}
