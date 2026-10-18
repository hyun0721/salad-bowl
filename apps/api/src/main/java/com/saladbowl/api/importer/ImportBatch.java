package com.saladbowl.api.importer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** 업로드 한 번의 결과. 원본 파일은 저장하지 않고 이름과 건수만 남긴다. */
@Entity
@Table(name = "import_batches")
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "total_rows", nullable = false)
    private int totalRows;

    @Column(name = "created_rows", nullable = false)
    private int createdRows;

    @Column(name = "updated_rows", nullable = false)
    private int updatedRows;

    @Column(name = "unchanged_rows", nullable = false)
    private int unchangedRows;

    @Column(name = "imported_at", nullable = false)
    private OffsetDateTime importedAt;

    protected ImportBatch() {
    }

    public ImportBatch(long ownerId, String fileName) {
        this.ownerId = ownerId;
        this.fileName = fileName;
    }

    @PrePersist
    void onCreate() {
        importedAt = OffsetDateTime.now();
    }

    public void record(int total, int created, int updated, int unchanged) {
        this.totalRows = total;
        this.createdRows = created;
        this.updatedRows = updated;
        this.unchangedRows = unchanged;
    }

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public String getFileName() { return fileName; }
    public int getTotalRows() { return totalRows; }
    public int getCreatedRows() { return createdRows; }
    public int getUpdatedRows() { return updatedRows; }
    public int getUnchangedRows() { return unchangedRows; }
    public OffsetDateTime getImportedAt() { return importedAt; }
}
