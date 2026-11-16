package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;

import java.math.BigInteger;

/** 현재 계획: 지출계획의 "바꿀 수 있는 금액"을 지금까지의 결제수단 비율대로 나눈 배분(PRD 7.2절, TAX-69). */
public final class PlanAllocator {

    /** 한 소비구분의 "바꿀 수 있는 금액"을 결제수단에 나눈 금액. 세 값의 합은 그 금액과 같다. */
    public record Split(long credit, long debit, long cash) {
    }

    private PlanAllocator() {
    }

    public static ByCategory<Split> currentPlan(SpendingTotals t, PlanView plan) {
        long[] year = {
                t.creditGeneral() + t.creditMarket() + t.creditTransit() + t.creditCulture(),
                t.debitGeneral() + t.debitMarket() + t.debitTransit() + t.debitCulture(),
                t.cashGeneral() + t.cashMarket() + t.cashTransit() + t.cashCulture()};
        return new ByCategory<>(
                split(plan.general().flexible(), year, t.creditGeneral(), t.debitGeneral(), t.cashGeneral()),
                split(plan.market().flexible(), year, t.creditMarket(), t.debitMarket(), t.cashMarket()),
                split(plan.transit().flexible(), year, t.creditTransit(), t.debitTransit(), t.cashTransit()),
                split(plan.culture().flexible(), year, t.creditCulture(), t.debitCulture(), t.cashCulture()));
    }

    /** 비율의 기준: 그 소비구분의 입력액 → 0원이면 연도 전체 → 그것도 0원이면 전부 신용카드. */
    private static Split split(long flexible, long[] year, long... category) {
        long[] basis = category[0] + category[1] + category[2] > 0 ? category : year;
        long sum = basis[0] + basis[1] + basis[2];
        if (sum == 0) {
            return new Split(flexible, 0, 0);
        }
        long debit = share(flexible, basis[1], sum);
        long cash = share(flexible, basis[2], sum);
        // 신용카드 몫의 원 미만도 버린 뒤 남는 원을 모두 신용카드에 더한 값과 같다.
        return new Split(flexible - debit - cash, debit, cash);
    }

    /** flexible × part ÷ sum, 원 미만 버림. 곱이 long을 넘을 수 있다(약 10^26). */
    private static long share(long flexible, long part, long sum) {
        return BigInteger.valueOf(flexible).multiply(BigInteger.valueOf(part))
                .divide(BigInteger.valueOf(sum)).longValueExact();
    }
}
