package com.saladbowl.api.group;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.group.GroupDtos.GroupDetail;
import com.saladbowl.api.group.GroupDtos.GroupSummary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class GroupService {

    private final UserGroupRepository groups;
    private final GroupMemberRepository members;
    private final GroupAccess access;

    public GroupService(UserGroupRepository groups, GroupMemberRepository members, GroupAccess access) {
        this.groups = groups;
        this.members = members;
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

    private UserGroup findGroup(long groupId) {
        return groups.findById(groupId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "group not found"));
    }
}
