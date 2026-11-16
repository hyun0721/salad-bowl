package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.law.TaxLawDtos.RowVersionDeserializer;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.OffsetDateTime;

public final class TaxRecordDtos {

    /** 금액 한 칸의 상한. 화면의 금액 입력(MoneyField), 세법 금액 검증과 같은 값이다. */
    public static final long MAX_AMOUNT = 9_999_999_999_999L;

    private TaxRecordDtos() {
    }

    /** 정수 토큰만 받는다. 기본 설정은 1000.7 같은 소수를 말없이 1000으로 잘라 저장한다. */
    @Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
    @Retention(RetentionPolicy.RUNTIME)
    @JacksonAnnotationsInside
    @JsonDeserialize(using = RowVersionDeserializer.class)
    public @interface WholeNumber {
    }

    /** 기본정보. rowVersion이 없으면 새로 만들고, 있으면 그 버전의 기록을 고친다. */
    public record YearRequest(
            @NotNull @Min(1) @Max(MAX_AMOUNT) @WholeNumber Long totalSalary,
            @NotNull @Min(1) @Max(12) Integer workStartMonth,
            @NotNull @Min(1) @Max(12) Integer workEndMonth,
            @NotNull @Min(0) @Max(99) Integer childCount,
            @WholeNumber Long rowVersion) {
    }

    /** 연도 기록이 기억하는 세법 버전. childTiersApply는 웹이 자녀등 입력란을 보일지 판단하는 값이다. */
    public record LawVersionRef(long id, int versionNo, OffsetDateTime appliedAt, boolean childTiersApply) {
    }

    /** 연도 기록 묶음. 모든 조회·저장 응답이 이 모양이다. */
    public record TaxYearView(
            int taxYear,
            long rowVersion,
            long totalSalary,
            int workStartMonth,
            int workEndMonth,
            int childCount,
            LawVersionRef lawVersion) {
    }

    /** 저장 결과. created가 true면 새로 만든 것(201)이다. */
    public record SavedYear(boolean created, TaxYearView view) {
    }
}
