package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.CardAmounts;
import com.saladbowl.api.tax.record.TaxRecordDtos.CashAmounts;

import java.util.List;
import java.util.stream.LongStream;

/**
 * 연도 합계표: 결제수단 3 x 소비구분 4. 그 연도 기록의 모든 카드 자료와 현금영수증 자료를 더한 값이고 저장하지 않는다.
 * 미입력 칸(null)은 0으로 더한다. 합계는 여기 한 곳에서만 만들고 웹은 다시 더하지 않는다.
 */
public record SpendingTotals(
        long creditGeneral, long creditMarket, long creditTransit, long creditCulture,
        long debitGeneral, long debitMarket, long debitTransit, long debitCulture,
        long cashGeneral, long cashMarket, long cashTransit, long cashCulture) {

    /** cashReceipt는 한 번도 입력하지 않았으면 null이다. */
    public static SpendingTotals of(List<TaxCardStatement> cards, TaxCashReceipt cashReceipt) {
        long[] sum = new long[12];
        for (TaxCardStatement card : cards) {
            CardAmounts a = card.amounts();
            add(sum, 0, a.creditGeneral(), a.creditMarket(), a.creditTransit(), a.creditCulture(),
                    a.debitGeneral(), a.debitMarket(), a.debitTransit(), a.debitCulture());
        }
        if (cashReceipt != null) {
            CashAmounts a = cashReceipt.amounts();
            add(sum, 8, a.general(), a.market(), a.transit(), a.culture());
        }
        return new SpendingTotals(sum[0], sum[1], sum[2], sum[3], sum[4], sum[5], sum[6], sum[7],
                sum[8], sum[9], sum[10], sum[11]);
    }

    /** 12칸 가운데 가장 큰 값. 합계 상한 검사에 쓴다. */
    public long max() {
        return LongStream.of(creditGeneral, creditMarket, creditTransit, creditCulture,
                debitGeneral, debitMarket, debitTransit, debitCulture,
                cashGeneral, cashMarket, cashTransit, cashCulture).max().getAsLong();
    }

    private static void add(long[] sum, int offset, Long... amounts) {
        for (int i = 0; i < amounts.length; i++) {
            if (amounts[i] != null) {
                sum[offset + i] += amounts[i];
            }
        }
    }
}
