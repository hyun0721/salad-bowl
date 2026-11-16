package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.law.TaxLawVersion;

import java.util.List;

/**
 * 계산에 쓰는 세법 수치. 금액은 원, 비율은 정수 퍼센트다.
 * basicLimitLow·basicLimitHigh는 자녀등 0명 / 1명 / 2명 이상 순서의 3칸이다.
 */
public record TaxLawValues(
        int minSpendRatePct,
        long bracketBoundary,
        int rateCreditPct,
        int rateDebitCashPct,
        int rateCulturePct,
        int rateMarketPct,
        int rateTransitPct,
        List<Long> basicLimitLow,
        List<Long> basicLimitHigh,
        long extraLimitLow,
        long extraLimitHigh) {

    /** 적용된 세법 버전만 넘긴다. 적용본은 검증(TaxLawValidator)을 거쳐 빈 값이 없다. */
    public static TaxLawValues from(TaxLawVersion v) {
        return new TaxLawValues(v.getMinSpendRatePct(), v.getBracketBoundary(), v.getRateCreditPct(),
                v.getRateDebitCashPct(), v.getRateCulturePct(), v.getRateMarketPct(), v.getRateTransitPct(),
                List.of(v.getBasicLimitLow0(), v.getBasicLimitLow1(), v.getBasicLimitLow2()),
                List.of(v.getBasicLimitHigh0(), v.getBasicLimitHigh1(), v.getBasicLimitHigh2()),
                v.getExtraLimitLow(), v.getExtraLimitHigh());
    }

    /** 자녀등 단계별 기본한도가 서로 다른가. 같으면(2025 값) 자녀등 수는 계산에 쓰지 않는다. */
    public boolean childTiersApply() {
        return basicLimitLow.stream().distinct().count() > 1 || basicLimitHigh.stream().distinct().count() > 1;
    }
}
