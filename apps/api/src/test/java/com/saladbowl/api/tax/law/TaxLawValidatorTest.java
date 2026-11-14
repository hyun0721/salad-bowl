package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.FieldError;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 적용 전 검증 규칙(TAX-63, TAX-64, AC-21). DB 없이 규칙만 본다. */
class TaxLawValidatorTest {

    private static final LocalDate START = LocalDate.of(2026, 1, 1);
    private static final LocalDate END = LocalDate.of(2026, 12, 31);

    /** 2026 귀속 값으로 채운 초안. */
    private static TaxLawVersion draft(UpdateRequest request) {
        TaxLawVersion version = TaxLawVersion.draft(2026, 1, 1L);
        version.edit(request);
        return version;
    }

    private static UpdateRequest request(Integer minSpend, Integer credit, Integer debitCash, Integer culture,
                                         Integer market, Integer transit, Long boundary, List<Long> low,
                                         List<Long> high, Long extraLow, Long extraHigh, String lawName,
                                         String article, String url, LocalDate start, LocalDate end, String memo) {
        return new UpdateRequest(0L, minSpend, boundary, credit, debitCash, culture, market, transit, low, high,
                extraLow, extraHigh, lawName, article, url, start, end, memo);
    }

    private static UpdateRequest valid2026() {
        return request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2",
                "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389", START, END, null);
    }

    private static List<String> fields(TaxLawVersion version) {
        return TaxLawValidator.validate(version).stream().map(FieldError::field).toList();
    }

    @Test
    void values2026PassWithoutMemo() {
        assertThat(TaxLawValidator.validate(draft(valid2026()))).isEmpty();
    }

    @Test
    void blankDraftReportsEveryRequiredFieldButNotMemo() {
        assertThat(fields(TaxLawVersion.draft(2026, 1, 1L))).containsExactly(
                "minSpendRatePct", "rateCreditPct", "rateDebitCashPct", "rateCulturePct", "rateMarketPct",
                "rateTransitPct", "bracketBoundary", "basicLimitLow[0]", "basicLimitLow[1]", "basicLimitLow[2]",
                "basicLimitHigh[0]", "basicLimitHigh[1]", "basicLimitHigh[2]", "extraLimitLow", "extraLimitHigh",
                "basisLawName", "basisArticle", "basisUrl", "periodStart", "periodEnd");
    }

    @Test
    void ratesMustBeBetween0And100() {
        TaxLawVersion outOfRange = draft(request(101, -1, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(outOfRange)).containsExactly(
                new FieldError("minSpendRatePct", "0~100 사이여야 합니다"),
                new FieldError("rateCreditPct", "0~100 사이여야 합니다"));

        TaxLawVersion edges = draft(request(0, 100, 0, 100, 0, 100, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(edges)).isEmpty();
    }

    @Test
    void amountsMustBeZeroOrMore() {
        TaxLawVersion negative = draft(request(25, 15, 30, 30, 40, 40, -1L,
                List.of(3_000_000L, -1L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, -1L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(negative)).containsExactly(
                new FieldError("bracketBoundary", "0 이상이어야 합니다"),
                new FieldError("basicLimitLow[1]", "0 이상이어야 합니다"),
                new FieldError("extraLimitHigh", "0 이상이어야 합니다"));

        TaxLawVersion zeros = draft(request(25, 15, 30, 30, 40, 40, 0L,
                List.of(0L, 0L, 0L), List.of(0L, 0L, 0L), 0L, 0L,
                "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(zeros)).isEmpty();
    }

    @Test
    void childTiersMustAllBeFilled() {
        TaxLawVersion missingTier = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                Arrays.asList(3_000_000L, null, 4_000_000L), Arrays.asList(2_500_000L, 2_750_000L, null),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(fields(missingTier)).containsExactly("basicLimitLow[1]", "basicLimitHigh[2]");
    }

    @Test
    void basisAndPeriodAreRequired() {
        TaxLawVersion missing = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "   ", null, "", null, null, "메모만 있음"));
        assertThat(fields(missing))
                .containsExactly("basisLawName", "basisArticle", "basisUrl", "periodStart", "periodEnd");
    }

    @Test
    void basisUrlMustBeHttp() {
        TaxLawVersion script = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "javascript:alert(1)", START, END, null));
        assertThat(TaxLawValidator.validate(script))
                .containsExactly(new FieldError("basisUrl", "http:// 또는 https://로 시작해야 합니다"));
    }

    @Test
    void periodStartMustNotBeAfterEnd() {
        TaxLawVersion reversed = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", END, START, null));
        assertThat(TaxLawValidator.validate(reversed))
                .containsExactly(new FieldError("periodEnd", "종료일이 시작일보다 빠릅니다"));

        TaxLawVersion sameDay = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, START, null));
        assertThat(TaxLawValidator.validate(sameDay)).isEmpty();
    }
}
