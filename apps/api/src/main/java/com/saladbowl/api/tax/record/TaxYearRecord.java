package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** 회원 x 귀속연도마다 하나인 소득공제 연도 기록. 카드 자료·현금영수증 자료·지출계획이 이 행에 딸린다. */
@Entity
@Table(name = "tax_year_records")
public class TaxYearRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false, updatable = false)
    private long ownerId;

    @Column(name = "tax_year", nullable = false, updatable = false)
    private int taxYear;

    @Column(name = "total_salary", nullable = false)
    private long totalSalary;

    @Column(name = "work_start_month", nullable = false)
    private int workStartMonth;

    @Column(name = "work_end_month", nullable = false)
    private int workEndMonth;

    @Column(name = "child_count", nullable = false)
    private int childCount;

    // 계산에 쓰는 세법 버전. null이면 그 귀속연도에 적용 버전이 아직 없다.
    @Column(name = "law_version_id")
    private Long lawVersionId;

    // 수정 요청의 rowVersion과 비교해 다른 곳에서 먼저 고친 기본정보를 덮어쓰지 않게 한다.
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected TaxYearRecord() {
    }

    public static TaxYearRecord create(long ownerId, int taxYear, YearRequest request, Long lawVersionId, long rowVersion) {
        TaxYearRecord record = new TaxYearRecord();
        record.ownerId = ownerId;
        record.taxYear = taxYear;
        record.lawVersionId = lawVersionId;
        record.edit(request, rowVersion);
        return record;
    }

    /** 기본정보를 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(YearRequest request, long rowVersion) {
        this.rowVersion = rowVersion;
        totalSalary = request.totalSalary();
        workStartMonth = request.workStartMonth();
        workEndMonth = request.workEndMonth();
        childCount = request.childCount();
    }

    /** 회원이 다시 계산을 눌렀을 때만 기억하는 세법 버전을 바꾼다. */
    public void useLawVersion(Long lawVersionId, long rowVersion) {
        this.rowVersion = rowVersion;
        this.lawVersionId = lawVersionId;
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
    public long getOwnerId() { return ownerId; }
    public int getTaxYear() { return taxYear; }
    public long getTotalSalary() { return totalSalary; }
    public int getWorkStartMonth() { return workStartMonth; }
    public int getWorkEndMonth() { return workEndMonth; }
    public int getChildCount() { return childCount; }
    public Long getLawVersionId() { return lawVersionId; }
    public long getRowVersion() { return rowVersion; }
}
