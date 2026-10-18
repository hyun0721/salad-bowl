package com.saladbowl.api.group;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.group.GroupDtos.GroupDetail;
import com.saladbowl.api.group.GroupDtos.GroupSummary;
import com.saladbowl.api.group.GroupDtos.ShareResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class GroupService {

    private final UserGroupRepository groups;
    private final GroupMemberRepository members;
    private final GroupBanRepository bans;
    private final GroupAccess access;

    public GroupService(UserGroupRepository groups, GroupMemberRepository members, GroupBanRepository bans,
                        GroupAccess access) {
        this.groups = groups;
        this.members = members;
        this.bans = bans;
        this.access = access;
    }

    @Transactional
    public GroupSummary create(long userId, String name) {
        UserGroup group = groups.save(new UserGroup(name.trim(), userId));
        members.save(new GroupMember(group.getId(), userId, GroupRole.ADMIN));
        return new GroupSummary(group.getId(), group.getName(), GroupRole.ADMIN, 1);
    }

    @Transactional(readOnly = true)
    public List<GroupSummary> listMine(long userId) {
        return members.findByUserIdOrderByJoinedAtAsc(userId).stream()
                .map(membership -> {
                    UserGroup group = findGroup(membership.getGroupId());
                    return new GroupSummary(group.getId(), group.getName(), membership.getRole(),
                            members.countByGroupId(group.getId()));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public GroupDetail detail(long groupId, long userId) {
        GroupMember me = access.requireMember(groupId, userId);
        UserGroup group = findGroup(groupId);
        return new GroupDetail(group.getId(), group.getName(), me.getRole(), members.findMemberRows(groupId));
    }

    @Transactional
    public GroupDetail rename(long groupId, long userId, String name) {
        access.requireAdmin(groupId, userId);
        findGroup(groupId).rename(name.trim());
        return detail(groupId, userId);
    }

    @Transactional
    public void removeMember(long groupId, long adminId, long targetUserId) {
        access.requireAdmin(groupId, adminId);
        GroupMember target = members.findByGroupIdAndUserId(groupId, targetUserId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "member not found"));
        if (target.isAdmin()) {
            throw new ApiException(ErrorCode.CANNOT_REMOVE_ADMIN, "group admin cannot be removed");
        }
        members.delete(target);
        // 추방된 회원은 이미 가진 초대 토큰으로도 돌아오지 못하도록 기록한다.
        if (!bans.existsByGroupIdAndUserId(groupId, targetUserId)) {
            bans.save(new GroupBan(groupId, targetUserId, adminId));
        }
    }

    @Transactional(readOnly = true)
    public List<BanRow> listBans(long groupId, long adminId) {
        access.requireAdmin(groupId, adminId);
        return bans.findBanRows(groupId);
    }

    @Transactional
    public void unban(long groupId, long adminId, long bannedUserId) {
        access.requireAdmin(groupId, adminId);
        GroupBan ban = bans.findByGroupIdAndUserId(groupId, bannedUserId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "ban not found"));
        bans.delete(ban);
    }

    @Transactional
    public void leave(long groupId, long userId) {
        GroupMember me = access.requireMember(groupId, userId);
        if (me.isAdmin()) {
            throw new ApiException(ErrorCode.ADMIN_CANNOT_LEAVE, "group admin cannot leave the group");
        }
        members.delete(me);
    }

    @Transactional
    public ShareResponse setShare(long groupId, long userId, boolean enabled) {
        GroupMember me = access.requireMember(groupId, userId);
        me.setShareEnabled(enabled);
        return new ShareResponse(me.isShareEnabled());
    }

    private UserGroup findGroup(long groupId) {
        return groups.findById(groupId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "group not found"));
    }
}
