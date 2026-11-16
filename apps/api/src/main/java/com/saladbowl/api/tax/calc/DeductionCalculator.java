package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;

/**
 * 신용카드 등 사용금액 소득공제액 계산(PRD 7.1절, 알고리즘 버전 1). 계산은 이 클래스 한 곳에서만 한다.
 * 부동소수점을 쓰지 않는다. 중간값은 원 × 10,000 정수(금액 × 100 × 퍼센트)이고 소득공제액에서 한 번 버린다(TAX-45).
 * 12칸의 합이 240조 원(누계 상한 + 지출계획 상한) 이하이면 중간값은 2.4 × 10^18로 long 안에 있다.
 */
public final class DeductionCalculator {

    /** 중간값 단위(원 × 10,000)를 원으로 되돌리는 값. */
    private static final long SCALE = 10_000;

    private DeductionCalculator() {
    }

    public static DeductionResult calculate(long totalSalary, int childCount, SpendingTotals totals,
                                            TaxLawValues law) {
        // 경계와 같으면 낮은 구간이다. 높은 구간은 문화체육을 원래 결제수단의 일반 사용분으로 본다(TAX-41).
        boolean high = totalSalary > law.bracketBoundary();
        long credit = totals.creditGeneral() + (high ? totals.creditCulture() : 0);
        long debitCash = totals.debitGeneral() + totals.cashGeneral()
                + (high ? totals.debitCulture() + totals.cashCulture() : 0);
        long culture = high ? 0 : totals.creditCulture() + totals.debitCulture() + totals.cashCulture();
        long market = totals.creditMarket() + totals.debitMarket() + totals.cashMarket();
        long transit = totals.creditTransit() + totals.debitTransit() + totals.cashTransit();
        long total = credit + debitCash + culture + market + transit;

        // 최저사용금액(원 × 100)을 신용 → 직불등 → 문화체육 → 전통시장 → 대중교통 순으로 채운다.
        // 채운 부분에 그 구분의 공제율을 곱한 합이 차감액이다. 전체가 최저사용금액 이하면 전부 차감돼 0원이 된다.
        long[] amounts = {credit, debitCash, culture, market, transit};
        int[] rates = {law.rateCreditPct(), law.rateDebitCashPct(), law.rateCulturePct(),
                law.rateMarketPct(), law.rateTransitPct()};
        long threshold = totalSalary * law.minSpendRatePct();
        long unfilled = threshold;
        long before = 0;
        long cut = 0;
        for (int i = 0; i < amounts.length; i++) {
            long amount = amounts[i] * 100;
            long filled = Math.min(unfilled, amount);
            before += amount * rates[i];
            cut += filled * rates[i];
            unfilled -= filled;
        }
        long deductible = before - cut;

        // 자녀등 단계가 없는 세법(세 칸이 같은 값)에서는 저장된 자녀등 수를 쓰지 않는다.
        int tier = law.childTiersApply() ? Math.min(childCount, 2) : 0;
        long basicLimit = (high ? law.basicLimitHigh() : law.basicLimitLow()).get(tier);
        long extraCap = high ? law.extraLimitHigh() : law.extraLimitLow();
        long extraEligible = (culture * law.rateCulturePct() + market * law.rateMarketPct()
                + transit * law.rateTransitPct()) * 100;
        long basicUsed = Math.min(deductible, basicLimit * SCALE);
        long extraUsed = Math.min(deductible - basicUsed, Math.min(extraEligible, extraCap * SCALE));

        return new DeductionResult(high, credit, debitCash, culture, market, transit, total,
                threshold / 100, total * 100 > threshold, unfilled / 100,
                before / SCALE, cut / SCALE, deductible / SCALE,
                basicLimit, basicUsed / SCALE, extraCap, extraEligible / SCALE, extraUsed / SCALE,
                (basicUsed + extraUsed) / SCALE);
    }
}
