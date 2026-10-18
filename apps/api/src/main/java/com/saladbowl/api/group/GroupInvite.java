package com.saladbowl.api.group;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "group_invites")
public class GroupInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected GroupInvite() {
    }

    public GroupInvite(long groupId, String token, long createdBy, OffsetDateTime expiresAt) {
        this.groupId = groupId;
        this.token = token;
        this.createdBy = createdBy;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
    }

    public boolean isExpiredAt(OffsetDateTime now) {
        return !now.isBefore(expiresAt);
    }

    public Long getId() { return id; }
    public Long getGroupId() { return groupId; }
    public String getToken() { return token; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
}
