package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 소득공제액 산식(PRD 7.1절, TAX-40~42·45·71, AC-07~13). DB 없이 계산만 본다.
 * 기대값은 PRD 7.1절 식을 손으로 계산한 숫자다(AC-24). 계산기를 불러 기대값을 만들지 않는다.
 */
class DeductionCalculatorTest {

    /** 2026 귀속 값(조세특례제한법 제126조의2, PRD 8.1절). */
    static final TaxLawValues LAW_2026 = new TaxLawValues(25, 70_000_000L, 15, 30, 30, 40, 40,
            List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
            3_000_000L, 2_000_000L);

    /** 2025 귀속 값. 자녀등 단계가 없어 세 칸이 같다. */
    static final TaxLawValues LAW_2025 = new TaxLawValues(25, 70_000_000L, 15, 30, 30, 40, 40,
            List.of(3_000_000L, 3_000_000L, 3_000_000L), List.of(2_500_000L, 2_500_000L, 2_500_000L),
            3_000_000L, 2_000_000L);

    /** 12칸 순서: 신용카드(일반·전통시장·대중교통·문화체육), 체크카드 4칸, 현금영수증 4칸. */
    static SpendingTotals totals(long... c) {
        return new SpendingTotals(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11]);
    }

    private static long amount(long salary, int childCount, TaxLawValues law, long... cells) {
        return DeductionCalculator.calculate(salary, childCount, totals(cells), law).amount();
    }

    @Test
    void prdExample1ShowsEveryStep() {
        // 신용 일반 1,200만 / 체크 일반 200만 + 현금 일반 100만 / 전통시장 100만 / 대중교통 50만 / 문화체육 50만
        DeductionResult r = DeductionCalculator.calculate(40_000_000L, 0, totals(
                12_000_000, 1_000_000, 500_000, 500_000, 2_000_000, 0, 0, 0, 1_000_000, 0, 0, 0), LAW_2026);

        assertThat(r.highBracket()).isFalse();
        assertThat(List.of(r.credit(), r.debitCash(), r.culture(), r.market(), r.transit()))
                .containsExactly(12_000_000L, 3_000_000L, 500_000L, 1_000_000L, 500_000L);
        assertThat(r.total()).isEqualTo(17_000_000L);
        assertThat(r.threshold()).isEqualTo(10_000_000L);
        assertThat(r.thresholdReached()).isTrue();
        assertThat(r.remainingToThreshold()).isZero();
        // 1,800,000 + 900,000 + 150,000 + 400,000 + 200,000
        assertThat(r.beforeThresholdCut()).isEqualTo(3_450_000L);
        assertThat(r.thresholdCut()).isEqualTo(1_500_000L);
        assertThat(r.deductible()).isEqualTo(1_950_000L);
        assertThat(r.basicLimit()).isEqualTo(3_000_000L);
        assertThat(r.basicUsed()).isEqualTo(1_950_000L);
        assertThat(r.extraCap()).isEqualTo(3_000_000L);
        // 전통시장 400,000 + 대중교통 200,000 + 문화체육 150,000
        assertThat(r.extraEligible()).isEqualTo(750_000L);
        assertThat(r.extraUsed()).isZero();
        assertThat(r.amount()).isEqualTo(1_950_000L);
    }

    @Test
    void prdExample2MovesCultureToItsPaymentMethodAboveTheBoundary() {
        // 총급여 8,000만: 체크 문화체육 100만은 체크 일반으로 보고 추가한도 대상에서 빠진다(AC-10).
        DeductionResult r = DeductionCalculator.calculate(80_000_000L, 0, totals(
                30_000_000, 2_000_000, 1_000_000, 0, 10_000_000, 0, 0, 1_000_000, 0, 0, 0, 0), LAW_2026);

        assertThat(r.highBracket()).isTrue();
        assertThat(r.credit()).isEqualTo(30_000_000L);
        assertThat(r.debitCash()).isEqualTo(11_000_000L);
        assertThat(r.culture()).isZero();
        assertThat(r.thresholdCut()).isEqualTo(3_000_000L);
        assertThat(r.deductible()).isEqualTo(6_000_000L);
        assertThat(r.basicLimit()).isEqualTo(2_500_000L);
        assertThat(r.basicUsed()).isEqualTo(2_500_000L);
        assertThat(r.extraCap()).isEqualTo(2_000_000L);
        // 전통시장 800,000 + 대중교통 400,000. 초과분 3,500,000과 상한 2,000,000보다 작다(AC-12).
        assertThat(r.extraEligible()).isEqualTo(1_200_000L);
        assertThat(r.extraUsed()).isEqualTo(1_200_000L);
        assertThat(r.amount()).isEqualTo(3_700_000L);
    }

    @Test
    void wireframeStatusExample() {
        // 일반 1,400만/200만/50만, 전통시장 30만/20만/10만, 대중교통 20만/30만/0, 문화체육 10만/10만/0
        assertThat(amount(50_000_000L, 0, LAW_2026,
                14_000_000, 300_000, 200_000, 100_000, 2_000_000, 200_000, 300_000, 100_000, 500_000, 100_000, 0, 0))
                .isEqualTo(1_475_000L);
    }

    @Test
    void nothingIsDeductedUpToTheThresholdAndFractionsOfAWonAreDropped() {
        // 최저사용금액 1,000만. 1원 미만 → 0원, 1원 초과 → 0.15원 → 0원, 7원 초과 → 1.05원 → 1원(AC-07, TAX-45)
        assertThat(amount(40_000_000L, 0, LAW_2026, 9_999_999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).isZero();
        assertThat(amount(40_000_000L, 0, LAW_2026, 10_000_001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).isZero();
        assertThat(amount(40_000_000L, 0, LAW_2026, 10_000_007, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).isEqualTo(1L);

        DeductionResult equal = DeductionCalculator.calculate(40_000_000L, 0,
                totals(10_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(equal.thresholdReached()).isFalse();
        assertThat(equal.remainingToThreshold()).isEqualTo(1L);
        assertThat(equal.amount()).isZero();

        DeductionResult below = DeductionCalculator.calculate(40_000_000L, 0,
                totals(4_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(below.thresholdReached()).isFalse();
        assertThat(below.remainingToThreshold()).isEqualTo(6_000_000L);
        assertThat(below.deductible()).isZero();
    }

    @Test
    void remainingThresholdRoundsUpWithoutChangingWhetherItWasReached() {
        // 70,000,001 × 25% = 17,500,000.25원. 17,500,000원 소비 시 남은 0.25원은 1원으로 표시한다.
        DeductionResult below = DeductionCalculator.calculate(70_000_001L, 0,
                totals(17_500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(below.thresholdReached()).isFalse();
        assertThat(below.remainingToThreshold()).isEqualTo(1L);

        DeductionResult reached = DeductionCalculator.calculate(70_000_001L, 0,
                totals(17_500_001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(reached.thresholdReached()).isTrue();
        assertThat(reached.remainingToThreshold()).isZero();
    }

    @Test
    void thresholdIsFilledByCreditThenDebitCashAndCultureThenMarketAndTransit() {
        // 신용 < 최저 ≤ 신용+직불등+문화체육: 차감 = 600만×15% + 400만×30% = 2,100,000(AC-08)
        DeductionResult second = DeductionCalculator.calculate(40_000_000L, 0, totals(
                6_000_000, 1_000_000, 0, 0, 5_000_000, 0, 0, 1_000_000, 0, 0, 0, 0), LAW_2026);
        assertThat(second.beforeThresholdCut()).isEqualTo(3_100_000L);
        assertThat(second.thresholdCut()).isEqualTo(2_100_000L);
        assertThat(second.amount()).isEqualTo(1_000_000L);

        // 그보다 큼: 차감 = 400만×15% + 400만×30% + 200만×40% = 2,600,000
        DeductionResult third = DeductionCalculator.calculate(40_000_000L, 0, totals(
                4_000_000, 3_000_000, 1_000_000, 0, 3_000_000, 0, 0, 1_000_000, 0, 0, 0, 0), LAW_2026);
        assertThat(third.beforeThresholdCut()).isEqualTo(3_400_000L);
        assertThat(third.thresholdCut()).isEqualTo(2_600_000L);
        assertThat(third.amount()).isEqualTo(800_000L);
    }

    @Test
    void salaryExactlyAtTheBoundaryIsTheLowBracket() {
        // 신용 일반 2,000만 + 신용 문화체육 100만(AC-09)
        long[] cells = {20_000_000, 0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0};
        // 7,000만: 3,000,000 + 300,000 − 1,750만×15% = 675,000
        assertThat(amount(70_000_000L, 0, LAW_2026, cells)).isEqualTo(675_000L);
        // 7,000만 1원: 2,100만×15% − 17,500,000.25×15% = 524,999.9625 → 524,999
        DeductionResult above = DeductionCalculator.calculate(70_000_001L, 0, totals(cells), LAW_2026);
        assertThat(above.highBracket()).isTrue();
        assertThat(above.culture()).isZero();
        assertThat(above.threshold()).isEqualTo(17_500_000L);
        assertThat(above.amount()).isEqualTo(524_999L);
    }

    @Test
    void basicLimitDependsOnBracketAndChildTier() {
        long[] cells = {100_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
        assertThat(amount(50_000_000L, 0, LAW_2026, cells)).isEqualTo(3_000_000L);
        assertThat(amount(50_000_000L, 1, LAW_2026, cells)).isEqualTo(3_500_000L);
        assertThat(amount(50_000_000L, 2, LAW_2026, cells)).isEqualTo(4_000_000L);
        assertThat(amount(50_000_000L, 3, LAW_2026, cells)).isEqualTo(4_000_000L);
        assertThat(amount(80_000_000L, 0, LAW_2026, cells)).isEqualTo(2_500_000L);
        assertThat(amount(80_000_000L, 1, LAW_2026, cells)).isEqualTo(2_750_000L);
        assertThat(amount(80_000_000L, 2, LAW_2026, cells)).isEqualTo(3_000_000L);
    }

    @Test
    void childCountIsIgnoredWhenTheLawHasNoChildTiers() {
        // 서버는 childCount를 항상 저장한다. 자녀등 단계가 없는 세법(2025 값)에서는 무시한다(AC-11).
        long[] cells = {100_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
        assertThat(LAW_2025.childTiersApply()).isFalse();
        assertThat(LAW_2026.childTiersApply()).isTrue();
        assertThat(amount(50_000_000L, 0, LAW_2025, cells)).isEqualTo(3_000_000L);
        assertThat(amount(50_000_000L, 2, LAW_2025, cells)).isEqualTo(3_000_000L);
        assertThat(amount(80_000_000L, 0, LAW_2025, cells)).isEqualTo(2_500_000L);
        assertThat(amount(80_000_000L, 2, LAW_2025, cells)).isEqualTo(2_500_000L);
    }

    @Test
    void extraLimitIsBoundedByTheExcessAndByTheCap() {
        // 기본한도 정확히: 3,000만×15% − 150만 = 3,000,000, 추가 0(AC-12)
        DeductionResult exact = DeductionCalculator.calculate(40_000_000L, 0,
                totals(30_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(exact.deductible()).isEqualTo(3_000_000L);
        assertThat(exact.extraUsed()).isZero();
        assertThat(exact.amount()).isEqualTo(3_000_000L);

        // 초과분으로 제한: 공제 가능 3,500,000, 전통시장 공제액 2,000,000 → 추가 500,000
        DeductionResult excess = DeductionCalculator.calculate(40_000_000L, 0,
                totals(20_000_000, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(excess.extraUsed()).isEqualTo(500_000L);
        assertThat(excess.amount()).isEqualTo(3_500_000L);

        // 상한으로 제한: 공제 가능 7,000,000, 전통시장 공제액 4,000,000, 상한 3,000,000 → 추가 3,000,000
        DeductionResult capped = DeductionCalculator.calculate(40_000_000L, 0,
                totals(30_000_000, 10_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(capped.extraEligible()).isEqualTo(4_000_000L);
        assertThat(capped.extraUsed()).isEqualTo(3_000_000L);
        assertThat(capped.amount()).isEqualTo(6_000_000L);
    }

    @Test
    void largestInputsDoNotOverflow() {
        // 연말 예상 합계의 최악: 12칸 합 240조(누계 상한 + 지출계획 상한보다 크다). 비율은 모두 100%.
        long max = 9_999_999_999_999L;
        TaxLawValues everything = new TaxLawValues(100, max, 100, 100, 100, 100, 100,
                List.of(max, max, max), List.of(max, max, max), max, max);
        long cell = 20_000_000_000_000L;
        DeductionResult r = DeductionCalculator.calculate(max, 0,
                totals(cell, cell, cell, cell, cell, cell, cell, cell, cell, cell, cell, cell), everything);

        assertThat(r.total()).isEqualTo(240_000_000_000_000L);
        assertThat(r.beforeThresholdCut()).isEqualTo(240_000_000_000_000L);
        assertThat(r.thresholdCut()).isEqualTo(max);
        assertThat(r.deductible()).isEqualTo(230_000_000_000_001L);
        assertThat(r.extraEligible()).isEqualTo(180_000_000_000_000L);
        // 기본한도 9,999,999,999,999 + 추가한도 상한 9,999,999,999,999
        assertThat(r.amount()).isEqualTo(19_999_999_999_998L);
    }
}
