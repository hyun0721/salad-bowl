package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.LawVersionRef;

import java.time.LocalDate;

/**
 * 분석 조회 응답. 저장하지 않고 조회할 때마다 입력·세법 버전으로 다시 계산한다(TAX-44).
 *
 * @param blankCount      미입력 칸 수(현금영수증 자료가 없으면 4 포함)
 * @param estimated       자료 기준일이 서로 다르다(TAX-27)
 * @param asOfDateMin     가장 이른 자료 기준일. 자료가 없으면 null
 * @param partialYear     근로기간이 1~12월 전체가 아니다(D03)
 * @param law             연도 기록이 기억하는 세법 버전. 없으면 null(세법 준비 중)
 * @param lawRates        READY일 때 계산에 쓴 세법 수치. 그 외 상태에는 null
 * @param newerLawVersion 기억한 버전과 그 연도의 현재 적용 버전이 다르다
 * @param planSaved       저장된 지출계획이 있다
 * @param deduction       READY일 때만 있다
 * @param recommendation  READY이고 저장된 지출계획이 있을 때만 있다
 */
public record TaxAnalysisView(
        int taxYear,
        Status status,
        int blankCount,
        SpendingTotals totals,
        long totalSalary,
        boolean estimated,
        LocalDate asOfDateMin,
        LocalDate asOfDateMax,
        boolean partialYear,
        LawVersionRef law,
        LawRates lawRates,
        boolean newerLawVersion,
        boolean planSaved,
        DeductionResult deduction,
        Recommendation recommendation) {

    public record LawRates(int minSpendRatePct, long bracketBoundary, int rateCreditPct,
                           int rateDebitCashPct, int rateCulturePct, int rateMarketPct, int rateTransitPct) {
        static LawRates from(TaxLawValues law) {
            return new LawRates(law.minSpendRatePct(), law.bracketBoundary(), law.rateCreditPct(),
                    law.rateDebitCashPct(), law.rateCulturePct(), law.rateMarketPct(), law.rateTransitPct());
        }
    }

    /** 위에서부터 먼저 맞는 상태다. */
    public enum Status {
        /** 입력자료가 없다. */
        NO_INPUT,
        /** 미입력 칸이 있다. */
        INCOMPLETE,
        /** 자료는 완료됐지만 연도 기록에 세법 버전이 없다. */
        LAW_PENDING,
        READY
    }
}
