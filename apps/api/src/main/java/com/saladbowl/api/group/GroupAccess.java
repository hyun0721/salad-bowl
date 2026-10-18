package com.saladbowl.api.group;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.springframework.stereotype.Component;

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
}
