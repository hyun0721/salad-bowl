package com.saladbowl.api.group;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GroupRepositoryTest extends IntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    UserGroupRepository groups;

    @Autowired
    GroupMemberRepository members;

    @Autowired
    GroupInviteRepository invites;

    private User user(String email, String nickname) {
        return users.save(new User(email, "hash", nickname));
    }

    @Test
    void memberRowsJoinNicknamesInJoinOrder() {
        User admin = user("admin@test.com", "관리자");
        User member = user("member@test.com", "멤버");
        UserGroup group = groups.save(new UserGroup("우리집", admin.getId()));
        members.save(new GroupMember(group.getId(), admin.getId(), GroupRole.ADMIN));
        members.save(new GroupMember(group.getId(), member.getId(), GroupRole.MEMBER));

        List<MemberRow> rows = members.findMemberRows(group.getId());

        assertThat(rows).extracting(MemberRow::nickname).containsExactly("관리자", "멤버");
        assertThat(rows).extracting(MemberRow::role).containsExactly(GroupRole.ADMIN, GroupRole.MEMBER);
        assertThat(rows).allMatch(MemberRow::shareEnabled);
        assertThat(members.countByGroupId(group.getId())).isEqualTo(2);
    }

    @Test
    void sameUserCannotJoinSameGroupTwice() {
        User admin = user("admin2@test.com", "관리자");
        UserGroup group = groups.save(new UserGroup("우리집", admin.getId()));
        members.saveAndFlush(new GroupMember(group.getId(), admin.getId(), GroupRole.ADMIN));

        assertThatThrownBy(() -> members.saveAndFlush(
                new GroupMember(group.getId(), admin.getId(), GroupRole.MEMBER)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void inviteIsFoundByTokenAndKnowsExpiry() {
        User admin = user("admin3@test.com", "관리자");
        UserGroup group = groups.save(new UserGroup("우리집", admin.getId()));
        OffsetDateTime expiresAt = OffsetDateTime.now().plusDays(7);
        invites.save(new GroupInvite(group.getId(), "token-abc", admin.getId(), expiresAt));

        GroupInvite found = invites.findByToken("token-abc").orElseThrow();

        assertThat(found.getGroupId()).isEqualTo(group.getId());
        assertThat(found.isExpiredAt(OffsetDateTime.now())).isFalse();
        assertThat(found.isExpiredAt(expiresAt.plusSeconds(1))).isTrue();
    }
}
