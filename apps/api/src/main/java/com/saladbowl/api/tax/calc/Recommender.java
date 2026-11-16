package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;
import com.saladbowl.api.tax.calc.Recommendation.MethodShare;
import com.saladbowl.api.tax.calc.Recommendation.Pair;
import com.saladbowl.api.tax.calc.Recommendation.Reason;
import com.saladbowl.api.tax.calc.Recommendation.ReasonCode;
import com.saladbowl.api.tax.calc.Recommendation.Scenario;
import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 남은 기간의 결제수단 추천(PRD 7.2절, TAX-52). 근사식 없이 (누계 + 계획)을 DeductionCalculator에 넣어 비교한다.
 * 현재 계획에서 시작해 소비구분을 하나씩 보며 "바꿀 수 있는 금액"을 전부 체크카드·현금영수증 / 전부 신용카드에 둔
 * 후보가 지금까지의 최댓값보다 클 때만 바꾼다. 같으면 현재 계획을 유지한다. 계산기 호출은 요청마다 9번이다.
 */
public final class Recommender {

    private static final List<SpendingCategory> SEARCH_ORDER = List.of(SpendingCategory.GENERAL,
            SpendingCategory.CULTURE, SpendingCategory.MARKET, SpendingCategory.TRANSIT);

    private Recommender() {
    }

    public static Recommendation recommend(long totalSalary, int childCount, SpendingTotals totals, PlanView plan,
                                           TaxLawValues law) {
        ByCategory<PlanRow> rows = new ByCategory<>(plan.general(), plan.market(), plan.transit(), plan.culture());
        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);
        Map<SpendingCategory, Pair> best = new EnumMap<>(SpendingCategory.class);
        for (SpendingCategory category : SpendingCategory.values()) {
            Split split = current.get(category);
            best.put(category, new Pair(split.credit(), split.debit() + split.cash()));
        }
        DeductionResult currentResult = DeductionCalculator.calculate(totalSalary, childCount,
                yearEnd(totals, rows, best), law);
        long bestAmount = currentResult.amount();

        List<Reason> reasons = new ArrayList<>();
        for (SpendingCategory category : SEARCH_ORDER) {
            long flexible = rows.get(category).flexible();
            Pair kept = best.get(category);
            for (Pair candidate : List.of(new Pair(0, flexible), new Pair(flexible, 0))) {
                best.put(category, candidate);
                long amount = DeductionCalculator.calculate(totalSalary, childCount,
                        yearEnd(totals, rows, best), law).amount();
                if (amount > bestAmount) {
                    bestAmount = amount;
                    kept = candidate;
                }
            }
            best.put(category, kept);
            Split before = current.get(category);
            if (kept.credit() < before.credit()) {
                reasons.add(new Reason(ReasonCode.CREDIT_OVER_THRESHOLD, category, before.credit()));
            } else if (kept.credit() > before.credit()) {
                reasons.add(new Reason(ReasonCode.CREDIT_RATE_HIGHER, category, before.debit() + before.cash()));
            }
        }
        if (reasons.isEmpty()) {
            reasons.add(noDifference(rows, currentResult));
        }
        return new Recommendation(methodShare(totals),
                new Scenario<>(current, currentResult.amount()),
                new Scenario<>(new ByCategory<>(best.get(SpendingCategory.GENERAL), best.get(SpendingCategory.MARKET),
                        best.get(SpendingCategory.TRANSIT), best.get(SpendingCategory.CULTURE)), bestAmount),
                bestAmount - currentResult.amount(), List.copyOf(reasons));
    }

    /** 누계에 지출계획을 더한 연말 예상 합계표. 체크카드·현금영수증 몫은 공제율이 같아 체크카드 칸에 더한다. */
    private static SpendingTotals yearEnd(SpendingTotals t, ByCategory<PlanRow> rows,
                                          Map<SpendingCategory, Pair> allocation) {
        // SpendingCategory 선언 순서는 SpendingTotals의 각 결제수단별 일반·전통시장·대중교통·문화체육 생성자 순서와 같다.
        long[] credit = new long[4];
        long[] debit = new long[4];
        for (SpendingCategory category : SpendingCategory.values()) {
            PlanRow row = rows.get(category);
            Pair pair = allocation.get(category);
            credit[category.ordinal()] = row.creditFixed() + pair.credit();
            debit[category.ordinal()] = row.debitFixed() + pair.debitCash();
        }
        return new SpendingTotals(
                t.creditGeneral() + credit[0], t.creditMarket() + credit[1],
                t.creditTransit() + credit[2], t.creditCulture() + credit[3],
                t.debitGeneral() + debit[0], t.debitMarket() + debit[1],
                t.debitTransit() + debit[2], t.debitCulture() + debit[3],
                t.cashGeneral(), t.cashMarket(), t.cashTransit(), t.cashCulture());
    }

    /** 어떤 후보도 현재 계획보다 크지 않을 때의 이유. 위에서부터 먼저 맞는 것 하나다. */
    private static Reason noDifference(ByCategory<PlanRow> rows, DeductionResult current) {
        long general = rows.general().flexible();
        long culture = rows.culture().flexible();
        if (general + culture + rows.market().flexible() + rows.transit().flexible() == 0) {
            return new Reason(ReasonCode.NO_FLEXIBLE_AMOUNT, null, null);
        }
        if (!current.thresholdReached()) {
            return new Reason(ReasonCode.BELOW_THRESHOLD, null, current.remainingToThreshold());
        }
        if (current.amount() == current.basicLimit() + Math.min(current.extraEligible(), current.extraCap())) {
            return new Reason(ReasonCode.LIMIT_REACHED, null, null);
        }
        // 일반은 언제나, 문화체육은 높은 급여구간에서만 결제수단에 따라 공제율이 달라진다.
        if (general == 0 && (culture == 0 || !current.highBracket())) {
            return new Reason(ReasonCode.METHOD_NEUTRAL, null, null);
        }
        return new Reason(ReasonCode.ALREADY_BEST, null, null);
    }

    private static MethodShare methodShare(SpendingTotals t) {
        long credit = t.creditGeneral() + t.creditMarket() + t.creditTransit() + t.creditCulture();
        long debit = t.debitGeneral() + t.debitMarket() + t.debitTransit() + t.debitCulture();
        long cash = t.cashGeneral() + t.cashMarket() + t.cashTransit() + t.cashCulture();
        long total = credit + debit + cash;
        return total == 0 ? null : new MethodShare(percent(credit, total), percent(debit, total), percent(cash, total));
    }

    private static BigDecimal percent(long part, long total) {
        return BigDecimal.valueOf(part).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }
}
