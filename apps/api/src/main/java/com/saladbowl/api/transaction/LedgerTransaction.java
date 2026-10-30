package com.saladbowl.api.transaction;

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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Objects;

/**
 * 회원 소유의 거래 한 건. 원본 필드는 import(또는 수동 추가) 값이고 API로 바꾸지 않는다.
 * 화면 값(타입·카테고리·메모)은 *_override와 hidden으로 바꾸며, 재 import가 이 필드를 덮어쓰지 않는다.
 */
@Entity
@Table(name = "transactions")
public class LedgerTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TransactionSource source;

    @Column(name = "import_batch_id")
    private Long importBatchId;

    @Column(name = "dedup_key", length = 64)
    private String dedupKey;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TransactionType type;

    @Column(name = "category_major", nullable = false, length = 100)
    private String categoryMajor;

    @Column(name = "category_minor", nullable = false, length = 100)
    private String categoryMinor;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(name = "payment_method", nullable = false, length = 100)
    private String paymentMethod;

    @Column(name = "original_memo", length = 1000)
    private String originalMemo;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_override", length = 10)
    private TransactionType typeOverride;

    @Column(name = "category_major_override", length = 100)
    private String categoryMajorOverride;

    @Column(name = "category_minor_override", length = 100)
    private String categoryMinorOverride;

    @Column(name = "memo_override", length = 1000)
    private String memoOverride;

    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected LedgerTransaction() {
    }

    private LedgerTransaction(long ownerId, TransactionSource source, Long importBatchId, String dedupKey,
                              TransactionData data) {
        this.ownerId = ownerId;
        this.source = source;
        this.importBatchId = importBatchId;
        this.dedupKey = dedupKey;
        this.occurredAt = data.occurredAt();
        this.description = data.description();
        this.amount = data.amount();
        this.paymentMethod = data.paymentMethod();
        applyNonKeyFields(data);
    }

    public static LedgerTransaction imported(long ownerId, long importBatchId, String dedupKey, TransactionData data) {
        return new LedgerTransaction(ownerId, TransactionSource.IMPORT, importBatchId, dedupKey, data);
    }

    public static LedgerTransaction manual(long ownerId, TransactionData data) {
        return new LedgerTransaction(ownerId, TransactionSource.MANUAL, null, null, data);
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    /** 재 import: 중복 키에 들어가지 않는 원본 필드만 갱신한다. override와 hidden은 그대로 둔다. */
    public boolean refreshOriginal(TransactionData data) {
        boolean changed = type != data.type()
                || !categoryMajor.equals(data.categoryMajor())
                || !categoryMinor.equals(data.categoryMinor())
                || !currency.equals(data.currency())
                || !Objects.equals(originalMemo, data.memo());
        if (changed) {
            applyNonKeyFields(data);
            // 원본이 바꾼 타입을 따라잡으면 override는 더 할 일이 없다.
            if (typeOverride == type) {
                typeOverride = null;
            }
        }
        return changed;
    }

    private void applyNonKeyFields(TransactionData data) {
        this.type = data.type();
        this.categoryMajor = data.categoryMajor();
        this.categoryMinor = data.categoryMinor();
        this.currency = data.currency();
        this.originalMemo = data.memo();
    }

    public TransactionType displayType() {
        return typeOverride != null ? typeOverride : type;
    }

    public Category displayCategory() {
        return new Category(
                categoryMajorOverride != null ? categoryMajorOverride : categoryMajor,
                categoryMinorOverride != null ? categoryMinorOverride : categoryMinor);
    }

    public String displayMemo() {
        return memoOverride != null ? memoOverride : originalMemo;
    }

    public boolean isEdited() {
        return typeOverride != null || categoryMajorOverride != null || categoryMinorOverride != null || memoOverride != null;
    }

    public void setTypeOverride(TransactionType value) { this.typeOverride = value; }
    public void setCategoryMajorOverride(String value) { this.categoryMajorOverride = value; }
    public void setCategoryMinorOverride(String value) { this.categoryMinorOverride = value; }
    public void setMemoOverride(String value) { this.memoOverride = value; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public TransactionSource getSource() { return source; }
    public String getDedupKey() { return dedupKey; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public TransactionType getType() { return type; }
    public String getDescription() { return description; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public String getPaymentMethod() { return paymentMethod; }
    public TransactionType getTypeOverride() { return typeOverride; }
    public String getCategoryMajorOverride() { return categoryMajorOverride; }
    public String getCategoryMinorOverride() { return categoryMinorOverride; }
    public String getMemoOverride() { return memoOverride; }
    public boolean isHidden() { return hidden; }
}
