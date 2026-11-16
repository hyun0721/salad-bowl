package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.CashAmounts;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import org.springframework.data.domain.Persistable;

import java.time.LocalDate;
import java.util.Objects;
import java.util.stream.Stream;

/** 현금영수증 자료. 연도 기록당 하나이고 따로 삭제하지 않는다(연도 기록과 함께만 지워진다). */
@Entity
@Table(name = "tax_cash_receipts")
public class TaxCashReceipt implements Persistable<Long> {

    @Transient
    private boolean newRecord = true;

    @Override
    public Long getId() { return recordId; }

    @Override
    public boolean isNew() { return newRecord; }

    @PostLoad
    @PostPersist
    void markPersisted() { newRecord = false; }

    @Id
    @Column(name = "record_id")
    private Long recordId;

    @Column(name = "as_of_date", nullable = false)
    private LocalDate asOfDate;

    private String memo;

    private Long general;

    private Long market;

    private Long transit;

    private Long culture;

    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    protected TaxCashReceipt() {
    }

    public static TaxCashReceipt create(long recordId, LocalDate asOfDate, String memo, CashAmounts amounts, long rowVersion) {
        TaxCashReceipt cash = new TaxCashReceipt();
        cash.recordId = recordId;
        cash.edit(asOfDate, memo, amounts, rowVersion);
        return cash;
    }

    /** 새 누계로 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(LocalDate asOfDate, String memo, CashAmounts amounts, long rowVersion) {
        this.rowVersion = rowVersion;
        this.asOfDate = asOfDate;
        this.memo = memo;
        general = amounts.general();
        market = amounts.market();
        transit = amounts.transit();
        culture = amounts.culture();
    }

    public CashAmounts amounts() {
        return new CashAmounts(general, market, transit, culture);
    }

    /** 4칸 가운데 미입력 칸 수. */
    public int blankCount() {
        return (int) Stream.of(general, market, transit, culture).filter(Objects::isNull).count();
    }

    public LocalDate getAsOfDate() { return asOfDate; }
    public String getMemo() { return memo; }
    public long getRowVersion() { return rowVersion; }
}
