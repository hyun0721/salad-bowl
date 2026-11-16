package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;
import com.saladbowl.api.tax.calc.Recommendation.MethodShare;
import com.saladbowl.api.tax.calc.Recommendation.Pair;
import com.saladbowl.api.tax.calc.Recommendation.Reason;
import com.saladbowl.api.tax.calc.Recommendation.ReasonCode;
import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static com.saladbowl.api.tax.calc.DeductionCalculatorTest.LAW_2025;
import static com.saladbowl.api.tax.calc.DeductionCalculatorTest.LAW_2026;
import static com.saladbowl.api.tax.calc.DeductionCalculatorTest.totals;
import static com.saladbowl.api.tax.calc.PlanAllocatorTest.plan;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * 추천(PRD 7.2절, TAX-50·52~54, AC-17·18). 기대 공제액은 PRD 7.1절 식을 손으로 계산한 숫자다(AC-24).
 * 탐색 검증 한 건만 계산기를 불러 후보의 최댓값과 비교한다(탐색이 빠뜨린 배분이 없는지 본다).
 */
class RecommenderTest {

    private static final SpendingTotals WIREFRAME_TOTALS = totals(14_000_000, 300_000, 200_000, 100_000,
            2_000_000, 200_000, 300_000, 100_000, 500_000, 100_000, 0, 0);
    private static final PlanView WIREFRAME_PLAN =
            plan(500_000, 300_000, 1_200_000, 0, 100_000, 100_000, 100_000, 0, 0, 0, 0, 100_000);

    private static Recommendation noDifference(long salary, SpendingTotals totals, PlanView plan) {
        Recommendation r = Recommender.recommend(salary, 0, totals, plan, LAW_2026);
        assertThat(r.difference()).isZero();
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(r.current().yearEndDeduction());
        for (SpendingCategory category : SpendingCategory.values()) {
            Split current = r.current().allocation().get(category);
            assertThat(r.recommended().allocation().get(category))
                    .isEqualTo(new Pair(current.credit(), current.debit() + current.cash()));
        }
        return r;
    }

    @Test
    void wireframeExampleMovesGeneralSpendingOffCredit() {
        Recommendation r = Recommender.recommend(50_000_000L, 0, WIREFRAME_TOTALS, WIREFRAME_PLAN, LAW_2026);

        // 연도 전체: 14,600,000 / 2,600,000 / 600,000 ÷ 17,800,000 = 82.02% / 14.61% / 3.37%
        assertThat(r.methodShare()).isEqualTo(
                new MethodShare(new BigDecimal("82.0"), new BigDecimal("14.6"), new BigDecimal("3.4")));
        assertThat(r.current().allocation().general()).isEqualTo(new Split(1_018_183, 145_454, 36_363));
        // 현재 계획 연말: A 15,518,183 / B 2,981,817 / M 300,000 / T 800,000 / P 600,000
        // 2,327,727.45 + 894,545.10 + 90,000 + 320,000 + 240,000 − 1,875,000 = 1,997,272.55
        assertThat(r.current().yearEndDeduction()).isEqualTo(1_997_272L);
        // 일반 1,200,000을 모두 체크카드·현금영수증으로: A 14,500,000 / B 4,000,000 → 2,150,000
        assertThat(r.recommended().allocation().general()).isEqualTo(new Pair(0, 1_200_000));
        assertThat(r.recommended().allocation().market()).isEqualTo(new Pair(50_001, 49_999));
        assertThat(r.recommended().allocation().transit()).isEqualTo(new Pair(0, 0));
        assertThat(r.recommended().allocation().culture()).isEqualTo(new Pair(50_000, 50_000));
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(2_150_000L);
        assertThat(r.difference()).isEqualTo(152_728L);
        assertThat(r.reasons()).containsExactly(
                new Reason(ReasonCode.CREDIT_OVER_THRESHOLD, SpendingCategory.GENERAL, 1_018_183L));
    }

    @Test
    void higherCreditRateCanMoveGeneralSpendingToCredit() {
        TaxLawValues law = new TaxLawValues(25, 70_000_000L, 30, 15, 30, 40, 40,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L);
        // 최저사용금액 1,000만은 신용에서 차감. 현황 250만×30% + 1,250만×15% = 2,625,000원.
        Recommendation r = Recommender.recommend(40_000_000L, 0,
                totals(12_000_000, 0, 0, 0, 12_000_000, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0), law);

        assertThat(r.current().allocation().general()).isEqualTo(new Split(500_000, 500_000, 0));
        assertThat(r.current().yearEndDeduction()).isEqualTo(2_625_000L);
        assertThat(r.recommended().allocation().general()).isEqualTo(new Pair(1_000_000, 0));
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(2_700_000L);
        assertThat(r.difference()).isEqualTo(75_000L);
        assertThat(r.reasons()).containsExactly(
                new Reason(ReasonCode.CREDIT_RATE_HIGHER, SpendingCategory.GENERAL, 500_000L));
    }

    @Test
    void spendingCategoryOrderMatchesSpendingTotalsConstructor() {
        assertThat(SpendingCategory.values()).containsExactly(SpendingCategory.GENERAL, SpendingCategory.MARKET,
                SpendingCategory.TRANSIT, SpendingCategory.CULTURE);
    }

    @Test
    void totalsPerCategoryAreTheSameBeforeAndAfter() {
        Recommendation r = Recommender.recommend(50_000_000L, 0, WIREFRAME_TOTALS, WIREFRAME_PLAN, LAW_2026);

        for (SpendingCategory category : SpendingCategory.values()) {
            PlanRow row = new ByCategory<>(WIREFRAME_PLAN.general(), WIREFRAME_PLAN.market(),
                    WIREFRAME_PLAN.transit(), WIREFRAME_PLAN.culture()).get(category);
            Split current = r.current().allocation().get(category);
            Pair recommended = r.recommended().allocation().get(category);
            assertThat(current.credit() + current.debit() + current.cash()).isEqualTo(row.flexible());
            assertThat(recommended.credit() + recommended.debitCash()).isEqualTo(row.flexible());
        }
    }

    @Test
    void cultureFollowsItsPaymentMethodAboveTheBoundary() {
        // 총급여 8,000만, 신용 일반 3,000만, 문화체육 바꿀 수 있음 100만(입력액이 신용뿐이라 현재 계획은 전부 신용카드)
        // 현재: 3,100만×15% − 2,000만×15% = 1,650,000. 추천: 3,000만×15% + 100만×30% − 300만 = 1,800,000
        Recommendation r = Recommender.recommend(80_000_000L, 0,
                totals(30_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1_000_000), LAW_2026);

        assertThat(r.methodShare()).isEqualTo(
                new MethodShare(new BigDecimal("100.0"), new BigDecimal("0.0"), new BigDecimal("0.0")));
        assertThat(r.current().yearEndDeduction()).isEqualTo(1_650_000L);
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(1_800_000L);
        assertThat(r.recommended().allocation().culture()).isEqualTo(new Pair(0, 1_000_000));
        assertThat(r.difference()).isEqualTo(150_000L);
        assertThat(r.reasons()).containsExactly(
                new Reason(ReasonCode.CREDIT_OVER_THRESHOLD, SpendingCategory.CULTURE, 1_000_000L));
    }

    @Test
    void noDifferenceWhenNothingIsFlexible() {
        // 신용 일반 1,200만 + 고정 100만/50만: 1,300만×15% + 50만×30% − 150만 = 600,000
        Recommendation r = noDifference(40_000_000L, totals(12_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(1_000_000, 500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isEqualTo(600_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.NO_FLEXIBLE_AMOUNT, null, null));
    }

    @Test
    void noDifferenceBelowTheThreshold() {
        // 연말 예상 400만 ≤ 최저사용금액 1,000만. 남은 금액 600만
        Recommendation r = noDifference(40_000_000L, totals(3_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isZero();
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.BELOW_THRESHOLD, null, 6_000_000L));
    }

    @Test
    void noDifferenceAtTheLimit() {
        // 신용 일반 1억 100만: 1,515만 − 187.5만 = 13,275,000 > 기본한도 300만, 추가한도 대상 0
        Recommendation r = noDifference(50_000_000L, totals(100_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isEqualTo(3_000_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.LIMIT_REACHED, null, null));
    }

    @Test
    void noDifferenceWhenOnlyMethodNeutralCategoriesAreFlexible() {
        // 전통시장 50만·대중교통 30만만 바꿀 수 있다: 180만 + 32만 − 150만 = 620,000
        Recommendation r = noDifference(40_000_000L, totals(12_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 0, 0, 0, 500_000, 0, 0, 300_000, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isEqualTo(620_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.METHOD_NEUTRAL, null, null));

        // 총급여 7천만원 이하의 문화체육도 결제수단과 무관하다: 450만 + 30만 − 187.5만 = 2,925,000
        Recommendation culture = noDifference(50_000_000L, totals(30_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1_000_000));

        assertThat(culture.current().yearEndDeduction()).isEqualTo(2_925_000L);
        assertThat(culture.reasons()).containsExactly(new Reason(ReasonCode.METHOD_NEUTRAL, null, null));
    }

    @Test
    void noDifferenceWhenTheCurrentPlanIsAlreadyBest() {
        // 지금까지 체크카드만 썼다 → 현재 계획이 전부 체크카드. 1,300만×30% − 1,000만×30% = 900,000
        // 전부 신용카드여도 15만 + 360만 − (15만 + 900만×30%) = 900,000으로 같다(신용카드가 최저사용금액 아래).
        Recommendation r = noDifference(40_000_000L, totals(0, 0, 0, 0, 12_000_000, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().allocation().general()).isEqualTo(new Split(0, 1_000_000, 0));
        assertThat(r.current().yearEndDeduction()).isEqualTo(900_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.ALREADY_BEST, null, null));
    }

    @Test
    void methodShareIsMissingWhenTheYearHasNoSpending() {
        Recommendation r = Recommender.recommend(40_000_000L, 0, totals(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);

        assertThat(r.methodShare()).isNull();
        assertThat(r.current().allocation().general()).isEqualTo(new Split(500_000, 0, 0));
    }

    @Test
    void largestInputsDoNotOverflow() {
        // 누계 12칸과 지출계획 12칸이 모두 상한. 연말 12칸 합은 약 240조이고 공제액은 한도로 묶인다.
        // 총급여가 경계를 넘으므로 기본한도 2,500,000 + 추가한도 상한 2,000,000
        long max = 9_999_999_999_999L;
        Recommendation r = noDifference(max, totals(max, max, max, max, max, max, max, max, max, max, max, max),
                plan(max, max, max, max, max, max, max, max, max, max, max, max));

        assertThat(r.current().yearEndDeduction()).isEqualTo(4_500_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.LIMIT_REACHED, null, null));
    }

    @Test
    void recommendationIsTheBestOfAllCreditOrAllDebitCashCombinations() {
        // 손계산한 최댓값: 2,150,000 / 450,000 / 4,050,000 / 3,630,000
        assertBestOfSixteen(50_000_000L, 0, WIREFRAME_TOTALS, WIREFRAME_PLAN, LAW_2026, 2_150_000L);
        // 신용 950만 + 바꿀 수 있음 200만: 전부 체크카드면 950만×15% + 200만×30% − (950만×15% + 50만×30%) = 450,000
        assertBestOfSixteen(40_000_000L, 0, totals(9_500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 2_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026, 450_000L);
        SpendingTotals mixed = totals(20_000_000, 500_000, 0, 300_000, 3_000_000, 0, 700_000, 0,
                1_000_000, 0, 0, 200_000);
        PlanView mixedPlan = plan(1_000_000, 0, 3_000_000, 0, 0, 400_000, 0, 200_000, 0, 0, 0, 600_000);
        assertBestOfSixteen(60_000_000L, 1, mixed, mixedPlan, LAW_2026, 4_050_000L);
        // 2025: 기본한도 300만 + 추가 인정 105만 = 405만(문화 33만 + 시장 44만 + 교통 28만).
        assertBestOfSixteen(60_000_000L, 1, mixed, mixedPlan, LAW_2025, 4_050_000L);
        SpendingTotals high = totals(25_000_000, 500_000, 0, 300_000, 3_000_000, 0, 700_000, 0,
                1_000_000, 0, 0, 200_000);
        assertBestOfSixteen(90_000_000L, 2, high, mixedPlan, LAW_2026, 3_630_000L);
    }

    private static void assertBestOfSixteen(long salary, int childCount, SpendingTotals t, PlanView plan,
                                            TaxLawValues law, long expected) {
        Recommendation r = Recommender.recommend(salary, childCount, t, plan, law);
        List<PlanRow> rows = List.of(plan.general(), plan.market(), plan.transit(), plan.culture());
        long best = r.current().yearEndDeduction();
        for (int mask = 0; mask < 16; mask++) {
            long[] credit = new long[4];
            long[] debit = new long[4];
            for (int i = 0; i < 4; i++) {
                boolean allCredit = (mask & (1 << i)) != 0;
                credit[i] = rows.get(i).creditFixed() + (allCredit ? rows.get(i).flexible() : 0);
                debit[i] = rows.get(i).debitFixed() + (allCredit ? 0 : rows.get(i).flexible());
            }
            SpendingTotals yearEnd = new SpendingTotals(
                    t.creditGeneral() + credit[0], t.creditMarket() + credit[1],
                    t.creditTransit() + credit[2], t.creditCulture() + credit[3],
                    t.debitGeneral() + debit[0], t.debitMarket() + debit[1],
                    t.debitTransit() + debit[2], t.debitCulture() + debit[3],
                    t.cashGeneral(), t.cashMarket(), t.cashTransit(), t.cashCulture());
            best = Math.max(best, DeductionCalculator.calculate(salary, childCount, yearEnd, law).amount());
        }
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(best).isEqualTo(expected);
        assertThat(r.difference()).isEqualTo(best - r.current().yearEndDeduction());
    }
}
