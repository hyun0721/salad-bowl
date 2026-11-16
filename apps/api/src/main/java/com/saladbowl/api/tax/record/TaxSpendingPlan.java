package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRequest;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * 지출계획. 연도 기록당 하나다. 남은 기간의 예상 공제대상액을 소비구분 4 x
 * (신용카드 고정 / 체크카드·현금영수증 고정 / 변경 가능)으로 받는다. 추천 결과는 저장하지 않는다.
 */
@Entity
@Table(name = "tax_spending_plans")
public class TaxSpendingPlan {

    @Id
    @Column(name = "record_id")
    private Long recordId;

    @Column(name = "general_credit_fixed", nullable = false)
    private long generalCreditFixed;

    @Column(name = "general_debit_fixed", nullable = false)
    private long generalDebitFixed;

    @Column(name = "general_flexible", nullable = false)
    private long generalFlexible;

    @Column(name = "market_credit_fixed", nullable = false)
    private long marketCreditFixed;

    @Column(name = "market_debit_fixed", nullable = false)
    private long marketDebitFixed;

    @Column(name = "market_flexible", nullable = false)
    private long marketFlexible;

    @Column(name = "transit_credit_fixed", nullable = false)
    private long transitCreditFixed;

    @Column(name = "transit_debit_fixed", nullable = false)
    private long transitDebitFixed;

    @Column(name = "transit_flexible", nullable = false)
    private long transitFlexible;

    @Column(name = "culture_credit_fixed", nullable = false)
    private long cultureCreditFixed;

    @Column(name = "culture_debit_fixed", nullable = false)
    private long cultureDebitFixed;

    @Column(name = "culture_flexible", nullable = false)
    private long cultureFlexible;

    // id를 직접 넣는 엔티티라 저장소가 새 행인지를 이 값이 null인지로 판단한다. 그래서 long이 아니라 Long이다.
    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    protected TaxSpendingPlan() {
    }

    public static TaxSpendingPlan create(long recordId, PlanRequest request) {
        TaxSpendingPlan plan = new TaxSpendingPlan();
        plan.recordId = recordId;
        plan.edit(request);
        return plan;
    }

    /** 12칸을 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(PlanRequest request) {
        generalCreditFixed = request.general().creditFixed();
        generalDebitFixed = request.general().debitFixed();
        generalFlexible = request.general().flexible();
        marketCreditFixed = request.market().creditFixed();
        marketDebitFixed = request.market().debitFixed();
        marketFlexible = request.market().flexible();
        transitCreditFixed = request.transit().creditFixed();
        transitDebitFixed = request.transit().debitFixed();
        transitFlexible = request.transit().flexible();
        cultureCreditFixed = request.culture().creditFixed();
        cultureDebitFixed = request.culture().debitFixed();
        cultureFlexible = request.culture().flexible();
    }

    public PlanRow general() { return new PlanRow(generalCreditFixed, generalDebitFixed, generalFlexible); }
    public PlanRow market() { return new PlanRow(marketCreditFixed, marketDebitFixed, marketFlexible); }
    public PlanRow transit() { return new PlanRow(transitCreditFixed, transitDebitFixed, transitFlexible); }
    public PlanRow culture() { return new PlanRow(cultureCreditFixed, cultureDebitFixed, cultureFlexible); }
    public Long getRowVersion() { return rowVersion; }
}
