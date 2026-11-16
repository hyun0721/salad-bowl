package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** 귀속연도별 세법 기준의 한 버전. 금액은 원 단위 정수, 비율은 정수 퍼센트다. 초안은 값이 비어 있을 수 있다. */
@Entity
@Table(name = "tax_law_versions")
public class TaxLawVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tax_year", nullable = false)
    private int taxYear;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaxLawStatus status;

    @Column(name = "algorithm_version", nullable = false)
    private int algorithmVersion = 1;

    @Column(name = "min_spend_rate_pct")
    private Integer minSpendRatePct;

    @Column(name = "rate_credit_pct")
    private Integer rateCreditPct;

    @Column(name = "rate_debit_cash_pct")
    private Integer rateDebitCashPct;

    @Column(name = "rate_culture_pct")
    private Integer rateCulturePct;

    @Column(name = "rate_market_pct")
    private Integer rateMarketPct;

    @Column(name = "rate_transit_pct")
    private Integer rateTransitPct;

    @Column(name = "bracket_boundary")
    private Long bracketBoundary;

    @Column(name = "basic_limit_low_0")
    private Long basicLimitLow0;

    @Column(name = "basic_limit_low_1")
    private Long basicLimitLow1;

    @Column(name = "basic_limit_low_2")
    private Long basicLimitLow2;

    @Column(name = "basic_limit_high_0")
    private Long basicLimitHigh0;

    @Column(name = "basic_limit_high_1")
    private Long basicLimitHigh1;

    @Column(name = "basic_limit_high_2")
    private Long basicLimitHigh2;

    @Column(name = "extra_limit_low")
    private Long extraLimitLow;

    @Column(name = "extra_limit_high")
    private Long extraLimitHigh;

    @Column(name = "basis_law_name")
    private String basisLawName;

    @Column(name = "basis_article")
    private String basisArticle;

    @Column(name = "basis_url")
    private String basisUrl;

    @Column(name = "period_start")
    private LocalDate periodStart;

    @Column(name = "period_end")
    private LocalDate periodEnd;

    private String memo;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "applied_by")
    private Long appliedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "applied_at")
    private OffsetDateTime appliedAt;

    // 수정 요청의 rowVersion과 비교해 다른 곳에서 먼저 고친 초안을 덮어쓰지 않게 한다.
    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    protected TaxLawVersion() {
    }

    public static TaxLawVersion draft(int taxYear, int versionNo, long createdBy) {
        TaxLawVersion version = new TaxLawVersion();
        version.taxYear = taxYear;
        version.versionNo = versionNo;
        version.status = TaxLawStatus.DRAFT;
        version.createdBy = createdBy;
        return version;
    }

    /** 새 초안의 시작값. 설정값·근거·적용 대상 기간을 복사한다. 메모는 그 버전에 대한 기록이라 복사하지 않는다. */
    public void copyValuesFrom(TaxLawVersion source) {
        algorithmVersion = source.algorithmVersion;
        minSpendRatePct = source.minSpendRatePct;
        rateCreditPct = source.rateCreditPct;
        rateDebitCashPct = source.rateDebitCashPct;
        rateCulturePct = source.rateCulturePct;
        rateMarketPct = source.rateMarketPct;
        rateTransitPct = source.rateTransitPct;
        bracketBoundary = source.bracketBoundary;
        basicLimitLow0 = source.basicLimitLow0;
        basicLimitLow1 = source.basicLimitLow1;
        basicLimitLow2 = source.basicLimitLow2;
        basicLimitHigh0 = source.basicLimitHigh0;
        basicLimitHigh1 = source.basicLimitHigh1;
        basicLimitHigh2 = source.basicLimitHigh2;
        extraLimitLow = source.extraLimitLow;
        extraLimitHigh = source.extraLimitHigh;
        basisLawName = source.basisLawName;
        basisArticle = source.basisArticle;
        basisUrl = source.basisUrl;
        periodStart = source.periodStart;
        periodEnd = source.periodEnd;
    }

    /** 초안 수정. 요청에 없는 값은 빈 값이 된다(전체 교체). 범위 검사는 적용할 때 한다. */
    public void edit(UpdateRequest request) {
        minSpendRatePct = request.minSpendRatePct();
        rateCreditPct = request.rateCreditPct();
        rateDebitCashPct = request.rateDebitCashPct();
        rateCulturePct = request.rateCulturePct();
        rateMarketPct = request.rateMarketPct();
        rateTransitPct = request.rateTransitPct();
        bracketBoundary = request.bracketBoundary();
        basicLimitLow0 = tier(request.basicLimitLow(), 0);
        basicLimitLow1 = tier(request.basicLimitLow(), 1);
        basicLimitLow2 = tier(request.basicLimitLow(), 2);
        basicLimitHigh0 = tier(request.basicLimitHigh(), 0);
        basicLimitHigh1 = tier(request.basicLimitHigh(), 1);
        basicLimitHigh2 = tier(request.basicLimitHigh(), 2);
        extraLimitLow = request.extraLimitLow();
        extraLimitHigh = request.extraLimitHigh();
        basisLawName = blankToNull(request.basisLawName());
        basisArticle = blankToNull(request.basisArticle());
        basisUrl = blankToNull(request.basisUrl());
        periodStart = request.periodStart();
        periodEnd = request.periodEnd();
        memo = blankToNull(request.memo());
    }

    /** 초안 → 적용. 호출 전에 행 잠금과 검증을 끝낸다(TaxLawService.apply). */
    public void apply(long adminId, OffsetDateTime now) {
        status = TaxLawStatus.APPLIED;
        appliedBy = adminId;
        appliedAt = now;
    }

    private static Long tier(List<Long> tiers, int index) {
        return tiers == null ? null : tiers.get(index);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public int getTaxYear() { return taxYear; }
    public int getVersionNo() { return versionNo; }
    public TaxLawStatus getStatus() { return status; }
    public int getAlgorithmVersion() { return algorithmVersion; }
    public Integer getMinSpendRatePct() { return minSpendRatePct; }
    public Integer getRateCreditPct() { return rateCreditPct; }
    public Integer getRateDebitCashPct() { return rateDebitCashPct; }
    public Integer getRateCulturePct() { return rateCulturePct; }
    public Integer getRateMarketPct() { return rateMarketPct; }
    public Integer getRateTransitPct() { return rateTransitPct; }
    public Long getBracketBoundary() { return bracketBoundary; }
    public Long getBasicLimitLow0() { return basicLimitLow0; }
    public Long getBasicLimitLow1() { return basicLimitLow1; }
    public Long getBasicLimitLow2() { return basicLimitLow2; }
    public Long getBasicLimitHigh0() { return basicLimitHigh0; }
    public Long getBasicLimitHigh1() { return basicLimitHigh1; }
    public Long getBasicLimitHigh2() { return basicLimitHigh2; }
    public Long getExtraLimitLow() { return extraLimitLow; }
    public Long getExtraLimitHigh() { return extraLimitHigh; }
    public String getBasisLawName() { return basisLawName; }
    public String getBasisArticle() { return basisArticle; }
    public String getBasisUrl() { return basisUrl; }
    public LocalDate getPeriodStart() { return periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public String getMemo() { return memo; }
    public Long getCreatedBy() { return createdBy; }
    public Long getAppliedBy() { return appliedBy; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getAppliedAt() { return appliedAt; }
    public long getRowVersion() { return rowVersion; }
}
