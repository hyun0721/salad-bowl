package com.saladbowl.api.group;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** 그룹에서 추방된 회원 기록. 이 회원은 어떤 초대 토큰으로도 그룹에 다시 들어올 수 없다. */
@Entity
@Table(name = "group_bans")
public class GroupBan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "banned_by", nullable = false)
    private Long bannedBy;

    @Column(name = "banned_at", nullable = false)
    private OffsetDateTime bannedAt;

    protected GroupBan() {
    }

    public GroupBan(long groupId, long userId, long bannedBy) {
        this.groupId = groupId;
        this.userId = userId;
        this.bannedBy = bannedBy;
    }

    @PrePersist
    void onCreate() {
        bannedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public Long getGroupId() { return groupId; }
    public Long getUserId() { return userId; }
    public Long getBannedBy() { return bannedBy; }
    public OffsetDateTime getBannedAt() { return bannedAt; }
}
