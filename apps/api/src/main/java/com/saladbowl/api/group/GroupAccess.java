package com.saladbowl.api.group;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.List;

/** 그룹 권한 검사를 한곳에 모은다. 비멤버에게는 그룹 존재 자체를 숨긴다(404). */
@Component
public class GroupAccess {

    private final GroupMemberRepository members;

    public GroupAccess(GroupMemberRepository members) {
        this.members = members;
    }

    public GroupMember requireMember(long groupId, long userId) {
        return members.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "group not found"));
    }

    public GroupMember requireAdmin(long groupId, long userId) {
        GroupMember member = requireMember(groupId, userId);
        if (!member.isAdmin()) {
            throw new ApiException(ErrorCode.FORBIDDEN, "group admin only");
        }
        return member;
    }

    /**
     * 그룹 화면에 데이터를 보여줄 회원 id. 공개를 끈 멤버는 빠진다.
     * 멤버십을 검사하지 않으므로, 호출 전에 {@link #requireMember}로 호출자가 멤버인지 확인한다.
     */
    public List<Long> sharedOwnerIds(long groupId) {
        return members.findSharedUserIds(groupId);
    }

    /**
     * 거래 수정 권한: 본인이거나, 소유자가 공개 중인 그룹의 ADMIN이어야 한다.
     * 본인이면 멤버십과 무관하게 true이므로 그룹 멤버십 검사 용도로 쓰지 않는다.
     */
    public boolean canEditOwnedBy(long actorId, long ownerId) {
        return actorId == ownerId || members.existsAdminOverSharedMember(actorId, ownerId);
    }

    /** 거래 조회 권한: 본인이거나, 소유자가 공개 중인 그룹에 함께 속해 있어야 한다. */
    public boolean canViewOwnedBy(long viewerId, long ownerId) {
        return viewerId == ownerId || members.existsSharedWith(viewerId, ownerId);
    }
}
