package com.saladbowl.api.tax.calc;

/**
 * 소득공제액과 그 계산 과정(TAX-35, TAX-71). 금액은 모두 원이다.
 * 과정 값(threshold ~ extraUsed)은 화면 표시용으로 원 미만을 버린 값이고, amount만 계산 결과다.
 *
 * @param highBracket          총급여가 급여구간 경계를 넘는가(문화체육 우대 없음)
 * @param credit               신용카드 일반(높은 구간은 신용카드 문화체육 포함)
 * @param debitCash            체크카드·현금영수증 일반(높은 구간은 문화체육 포함)
 * @param culture              문화체육(높은 구간은 0)
 * @param market               전통시장
 * @param transit              대중교통
 * @param total                위 다섯 구분의 합 = 연도 합계표 12칸의 합
 * @param threshold            최저사용금액
 * @param thresholdReached     total이 최저사용금액을 넘었는가
 * @param remainingToThreshold 최저사용금액까지 남은 금액(넘었으면 0)
 * @param beforeThresholdCut   구분 금액 × 공제율의 합
 * @param thresholdCut         최저사용금액 차감액
 * @param deductible           공제 가능 금액 = beforeThresholdCut − thresholdCut
 * @param basicLimit           기본한도
 * @param basicUsed            기본한도 안에서 인정된 금액
 * @param extraCap             추가한도 상한
 * @param extraEligible        추가한도 대상 공제액(전통시장·대중교통·문화체육의 금액 × 공제율 합)
 * @param extraUsed            추가 인정액
 * @param amount               소득공제액
 */
public record DeductionResult(
        boolean highBracket,
        long credit,
        long debitCash,
        long culture,
        long market,
        long transit,
        long total,
        long threshold,
        boolean thresholdReached,
        long remainingToThreshold,
        long beforeThresholdCut,
        long thresholdCut,
        long deductible,
        long basicLimit,
        long basicUsed,
        long extraCap,
        long extraEligible,
        long extraUsed,
        long amount) {
}
