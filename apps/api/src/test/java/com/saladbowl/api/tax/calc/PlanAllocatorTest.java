package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;
import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;
import org.junit.jupiter.api.Test;

import static com.saladbowl.api.tax.calc.DeductionCalculatorTest.totals;
import static org.assertj.core.api.Assertions.assertThat;

/** 현재 계획의 배분 규칙(PRD 7.2절 규칙 1~4, TAX-69, AC-35). 기대값은 PRD 합성 예시 3~5와 와이어프레임의 숫자다. */
class PlanAllocatorTest {

    /** 12칸 순서: 일반·전통시장·대중교통·문화체육 각각 신용카드 고정 / 체크카드·현금영수증 고정 / 바꿀 수 있음. */
    static PlanView plan(long... c) {
        return new PlanView(0L, new PlanRow(c[0], c[1], c[2]), new PlanRow(c[3], c[4], c[5]),
                new PlanRow(c[6], c[7], c[8]), new PlanRow(c[9], c[10], c[11]));
    }

    private static void assertSumsToFlexible(ByCategory<Split> current, PlanView plan) {
        assertThat(sum(current.general())).isEqualTo(plan.general().flexible());
        assertThat(sum(current.market())).isEqualTo(plan.market().flexible());
        assertThat(sum(current.transit())).isEqualTo(plan.transit().flexible());
        assertThat(sum(current.culture())).isEqualTo(plan.culture().flexible());
    }

    private static long sum(Split split) {
        return split.credit() + split.debit() + split.cash();
    }

    @Test
    void splitsByTheCategoryRatioAndGivesLeftoverWonToCredit() {
        // 합성 예시 3: 일반 3,000,000 / 1,000,000 / 0, V = 1,000,001 → 750,000.75 / 250,000.25 / 0, 남는 1원은 신용카드
        SpendingTotals totals = totals(3_000_000, 0, 0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0);
        PlanView plan = plan(0, 0, 1_000_001, 0, 0, 0, 0, 0, 0, 0, 0, 0);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.general()).isEqualTo(new Split(750_001, 250_000, 0));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void fallsBackToTheYearRatioWhenTheCategoryHasNoSpending() {
        // 합성 예시 4: 문화체육 입력액 0, 연도 전체 6,000,000 / 3,000,000 / 1,000,000, V = 333,333
        // → 199,999.8 / 99,999.9 / 33,333.3, 남는 2원은 신용카드
        SpendingTotals totals = totals(6_000_000, 0, 0, 0, 3_000_000, 0, 0, 0, 1_000_000, 0, 0, 0);
        PlanView plan = plan(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 333_333);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.culture()).isEqualTo(new Split(200_001, 99_999, 33_333));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void putsEverythingOnCreditWhenTheYearHasNoSpending() {
        // 합성 예시 5
        PlanView plan = plan(0, 0, 500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), plan);

        assertThat(current.general()).isEqualTo(new Split(500_000, 0, 0));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void wireframeExample() {
        // 일반 1,200,000 × (14,000,000 : 2,000,000 : 500,000) → 1,018,181 / 145,454 / 36,363, 남는 2원
        // 전통시장 100,000 × (300,000 : 200,000 : 100,000) → 50,000 / 33,333 / 16,666, 남는 1원
        // 문화체육 100,000 × (100,000 : 100,000 : 0) → 50,000 / 50,000 / 0
        SpendingTotals totals = totals(14_000_000, 300_000, 200_000, 100_000,
                2_000_000, 200_000, 300_000, 100_000, 500_000, 100_000, 0, 0);
        PlanView plan = plan(500_000, 300_000, 1_200_000, 0, 100_000, 100_000, 100_000, 0, 0, 0, 0, 100_000);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.general()).isEqualTo(new Split(1_018_183, 145_454, 36_363));
        assertThat(current.market()).isEqualTo(new Split(50_001, 33_333, 16_666));
        assertThat(current.transit()).isEqualTo(new Split(0, 0, 0));
        assertThat(current.culture()).isEqualTo(new Split(50_000, 50_000, 0));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void largestAmountsDoNotOverflow() {
        // V × 입력액 = 약 10^26으로 long을 넘는다. 9,999,999,999,999 ÷ 3 = 3,333,333,333,333(나머지 없음)
        long max = 9_999_999_999_999L;
        SpendingTotals totals = totals(max, max, max, max, max, max, max, max, max, max, max, max);
        PlanView plan = plan(max, max, max, max, max, max, max, max, max, max, max, max);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.general())
                .isEqualTo(new Split(3_333_333_333_333L, 3_333_333_333_333L, 3_333_333_333_333L));
        assertSumsToFlexible(current, plan);
    }
}
