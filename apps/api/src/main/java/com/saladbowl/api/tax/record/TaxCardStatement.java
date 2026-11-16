package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.CardAmounts;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.util.Objects;
import java.util.stream.Stream;

/** 신용·체크 자료 한 건. 금액 8칸은 기준일까지의 누계이고 null은 미입력(모름), 0은 없음이다. */
@Entity
@Table(name = "tax_card_statements")
public class TaxCardStatement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "record_id", nullable = false, updatable = false)
    private long recordId;

    @Column(name = "issuer_name", nullable = false)
    private String issuerName;

    @Column(name = "as_of_date", nullable = false)
    private LocalDate asOfDate;

    private String memo;

    @Column(name = "credit_general")
    private Long creditGeneral;

    @Column(name = "credit_market")
    private Long creditMarket;

    @Column(name = "credit_transit")
    private Long creditTransit;

    @Column(name = "credit_culture")
    private Long creditCulture;

    @Column(name = "debit_general")
    private Long debitGeneral;

    @Column(name = "debit_market")
    private Long debitMarket;

    @Column(name = "debit_transit")
    private Long debitTransit;

    @Column(name = "debit_culture")
    private Long debitCulture;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    protected TaxCardStatement() {
    }

    public static TaxCardStatement create(long recordId, String issuerName, LocalDate asOfDate, String memo,
                                          CardAmounts amounts) {
        TaxCardStatement card = new TaxCardStatement();
        card.recordId = recordId;
        card.edit(issuerName, asOfDate, memo, amounts);
        return card;
    }

    /** 새 누계로 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(String issuerName, LocalDate asOfDate, String memo, CardAmounts amounts) {
        this.issuerName = issuerName;
        this.asOfDate = asOfDate;
        this.memo = memo;
        creditGeneral = amounts.creditGeneral();
        creditMarket = amounts.creditMarket();
        creditTransit = amounts.creditTransit();
        creditCulture = amounts.creditCulture();
        debitGeneral = amounts.debitGeneral();
        debitMarket = amounts.debitMarket();
        debitTransit = amounts.debitTransit();
        debitCulture = amounts.debitCulture();
    }

    public CardAmounts amounts() {
        return new CardAmounts(creditGeneral, creditMarket, creditTransit, creditCulture,
                debitGeneral, debitMarket, debitTransit, debitCulture);
    }

    /** 8칸 가운데 미입력 칸 수. */
    public int blankCount() {
        return (int) Stream.of(creditGeneral, creditMarket, creditTransit, creditCulture,
                debitGeneral, debitMarket, debitTransit, debitCulture).filter(Objects::isNull).count();
    }

    public Long getId() { return id; }
    public String getIssuerName() { return issuerName; }
    public LocalDate getAsOfDate() { return asOfDate; }
    public String getMemo() { return memo; }
    public long getRowVersion() { return rowVersion; }
}
