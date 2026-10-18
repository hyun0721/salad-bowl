package com.saladbowl.api.group;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.group.InviteDtos.AcceptResponse;
import com.saladbowl.api.group.InviteDtos.InvitePreview;
import com.saladbowl.api.group.InviteDtos.InviteResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;

@Service
public class InviteService {

    static final int MAX_MEMBERS = 6;
    static final Duration INVITE_TTL = Duration.ofDays(7);

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserGroupRepository groups;
    private final GroupMemberRepository members;
    private final GroupInviteRepository invites;
    private final GroupAccess access;

    public InviteService(UserGroupRepository groups, GroupMemberRepository members,
                         GroupInviteRepository invites, GroupAccess access) {
        this.groups = groups;
        this.members = members;
        this.invites = invites;
        this.access = access;
    }

    @Transactional
    public InviteResponse issue(long groupId, long userId) {
        access.requireAdmin(groupId, userId);
        GroupInvite invite = invites.save(
                new GroupInvite(groupId, newToken(), userId, OffsetDateTime.now().plus(INVITE_TTL)));
        return new InviteResponse(invite.getToken(), invite.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public InvitePreview preview(String token, long userId) {
        GroupInvite invite = validInvite(token);
        UserGroup group = groups.findById(invite.getGroupId()).orElseThrow(InviteService::inviteNotFound);
        return new InvitePreview(group.getName(), members.countByGroupId(group.getId()), MAX_MEMBERS,
                invite.getExpiresAt(), members.existsByGroupIdAndUserId(group.getId(), userId));
    }

    @Transactional
    public AcceptResponse accept(String token, long userId) {
        GroupInvite invite = validInvite(token);
        // 그룹 행을 잠가 같은 그룹에 대한 동시 수락이 정원 검사를 동시에 통과하지 못하게 한다.
        UserGroup group = groups.findByIdForUpdate(invite.getGroupId()).orElseThrow(InviteService::inviteNotFound);
        if (members.existsByGroupIdAndUserId(group.getId(), userId)) {
            throw new ApiException(ErrorCode.ALREADY_MEMBER, "already a member of this group");
        }
        if (members.countByGroupId(group.getId()) >= MAX_MEMBERS) {
            throw new ApiException(ErrorCode.GROUP_FULL, "group is full");
        }
        members.save(new GroupMember(group.getId(), userId, GroupRole.MEMBER));
        return new AcceptResponse(group.getId());
    }

    private GroupInvite validInvite(String token) {
        GroupInvite invite = invites.findByToken(token).orElseThrow(InviteService::inviteNotFound);
        if (invite.isExpiredAt(OffsetDateTime.now())) {
            throw new ApiException(ErrorCode.INVITE_EXPIRED, "invite expired");
        }
        return invite;
    }

    private static ApiException inviteNotFound() {
        return new ApiException(ErrorCode.INVITE_NOT_FOUND, "invite not found");
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
