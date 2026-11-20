package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;

import java.math.BigDecimal;
import java.util.List;

/**
 * 추천 결과(TAX-50, 53, 54). 저장하지 않고 조회할 때마다 만든다.
 * allocation은 지출계획의 "바꿀 수 있는 금액"을 결제수단에 둔 금액이고 고정액은 들어 있지 않다.
 *
 * @param methodShare 연도 합계표 전체의 결제수단 비율. 합계가 0원이면 null
 * @param current     현재 계획(지금까지의 결제수단 비율대로 나눈 배분)과 그 연말 예상 소득공제액
 * @param recommended 공제액이 가장 큰 배분과 그 연말 예상 소득공제액. 공제액이 같은 소비구분은 현재 계획 그대로다
 * @param difference  recommended − current 연말 예상 소득공제액. 0이면 "차이 없음"
 * @param reasons     difference > 0이면 바뀐 소비구분마다 하나, 0이면 차이가 없는 이유 하나
 */
public record Recommendation(
        MethodShare methodShare,
        Scenario<Split> current,
        Scenario<Pair> recommended,
        long difference,
        List<Reason> reasons) {

    /** 퍼센트, 소수 첫째 자리(반올림). 예: 82.0 */
    public record MethodShare(BigDecimal creditPct, BigDecimal debitPct, BigDecimal cashPct) {
    }

    public record Scenario<T>(ByCategory<T> allocation, long yearEndDeduction) {
    }

    /** 추천 배분의 한 소비구분. 체크카드와 현금영수증은 공제율이 같아 한 묶음이다. */
    public record Pair(long credit, long debitCash) {
    }

    /** 문장은 웹이 만든다. category·amount는 코드에 따라 null이다. */
    public record Reason(ReasonCode code, SpendingCategory category, Long amount) {
    }

    public enum ReasonCode {
        /** 그 소비구분의 바꿀 수 있는 금액을 체크카드·현금영수증으로 옮겼다. amount = 현재 계획에서 신용카드에 있던 금액 */
        CREDIT_OVER_THRESHOLD,
        /** 신용카드로 옮겼다(신용카드 공제율이 더 높게 설정된 세법에서만). amount = 현재 계획에서 체크카드·현금영수증에 있던 금액 */
        CREDIT_RATE_HIGHER,
        /** 바꿀 수 있는 금액이 모두 0원이다. */
        NO_FLEXIBLE_AMOUNT,
        /** 연말 예상 사용액이 최저사용금액 이하다. amount = 최저사용금액까지 남은 금액 */
        BELOW_THRESHOLD,
        /** 현재 계획으로 이미 한도(기본한도 + 추가한도)까지 공제된다. */
        LIMIT_REACHED,
        /** 바꿀 수 있는 금액이 결제수단과 무관한 소비구분에만 있다. */
        METHOD_NEUTRAL,
        /** 현재 계획보다 공제액이 큰 배분이 없다. */
        ALREADY_BEST
    }
}
