package com.saladbowl.api.group;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "group_members")
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private GroupRole role;

    @Column(name = "share_enabled", nullable = false)
    private boolean shareEnabled;

    @Column(name = "joined_at", nullable = false)
    private OffsetDateTime joinedAt;

    protected GroupMember() {
    }

    public GroupMember(long groupId, long userId, GroupRole role) {
        this.groupId = groupId;
        this.userId = userId;
        this.role = role;
        this.shareEnabled = true;
    }

    @PrePersist
    void onCreate() {
        joinedAt = OffsetDateTime.now();
    }

    public boolean isAdmin() {
        return role == GroupRole.ADMIN;
    }

    public void setShareEnabled(boolean shareEnabled) {
        this.shareEnabled = shareEnabled;
    }

    public Long getId() { return id; }
    public Long getGroupId() { return groupId; }
    public Long getUserId() { return userId; }
    public GroupRole getRole() { return role; }
    public boolean isShareEnabled() { return shareEnabled; }
    public OffsetDateTime getJoinedAt() { return joinedAt; }
}
