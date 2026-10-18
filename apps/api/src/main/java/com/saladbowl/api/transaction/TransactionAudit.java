package com.saladbowl.api.transaction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** 거래 수정 이력 한 줄. 필드 하나의 변경 전후 값을 남긴다. */
@Entity
@Table(name = "transaction_audits")
public class TransactionAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    @Column(nullable = false, length = 30)
    private String field;

    @Column(name = "before_value", length = 1000)
    private String beforeValue;

    @Column(name = "after_value", length = 1000)
    private String afterValue;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    protected TransactionAudit() {
    }

    public TransactionAudit(long transactionId, long actorId, String field, String beforeValue, String afterValue) {
        this.transactionId = transactionId;
        this.actorId = actorId;
        this.field = field;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
    }

    @PrePersist
    void onCreate() {
        changedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public Long getTransactionId() { return transactionId; }
    public Long getActorId() { return actorId; }
    public String getField() { return field; }
    public String getBeforeValue() { return beforeValue; }
    public String getAfterValue() { return afterValue; }
    public OffsetDateTime getChangedAt() { return changedAt; }
}
