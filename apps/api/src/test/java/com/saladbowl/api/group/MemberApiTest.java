package com.saladbowl.api.group;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MemberApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    AuthedUser admin;
    AuthedUser member;
    long groupId;

    @BeforeEach
    void setUpGroupWithOneMember() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);
    }

    @Test
    void adminRemovesMember() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/" + member.id()).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/groups/" + groupId).header("Authorization", member.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/groups/" + groupId).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.members", hasSize(1)));
    }

    @Test
    void memberCannotRemoveOthers() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/" + admin.id()).header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminCannotBeRemoved() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/" + admin.id()).header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANNOT_REMOVE_ADMIN"));
    }

    @Test
    void removingNonMemberReturns404() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        mvc.perform(delete("/groups/" + groupId + "/members/" + outsider.id()).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberLeavesGroup() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/me").header("Authorization", member.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/groups").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void adminCannotLeave() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/me").header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ADMIN_CANNOT_LEAVE"));
    }

    @Test
    void removedMemberCannotRejoinWithOldToken() throws Exception {
        String oldToken = TestGroups.issueInvite(mvc, admin, groupId);
        removeMember();

        mvc.perform(get("/invites/" + oldToken).header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("REMOVED_FROM_GROUP"));
        mvc.perform(post("/invites/" + oldToken + "/accept").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("REMOVED_FROM_GROUP"));
    }

    @Test
    void removedMemberCannotRejoinWithFreshToken() throws Exception {
        removeMember();
        String freshToken = TestGroups.issueInvite(mvc, admin, groupId);

        mvc.perform(get("/invites/" + freshToken).header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("REMOVED_FROM_GROUP"));
        mvc.perform(post("/invites/" + freshToken + "/accept").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("REMOVED_FROM_GROUP"));
    }

    @Test
    void otherUsersCanStillAcceptTheOldToken() throws Exception {
        String oldToken = TestGroups.issueInvite(mvc, admin, groupId);
        removeMember();
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@test.com", "다른사람");

        mvc.perform(post("/invites/" + oldToken + "/accept").header("Authorization", other.bearer()))
                .andExpect(status().isOk());
    }

    @Test
    void adminListsBannedMembersWithNickname() throws Exception {
        removeMember();

        mvc.perform(get("/groups/" + groupId + "/bans").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(member.id()))
                .andExpect(jsonPath("$[0].nickname").value("멤버"))
                .andExpect(jsonPath("$[0].bannedAt").exists());
    }

    @Test
    void memberCannotListBans() throws Exception {
        mvc.perform(get("/groups/" + groupId + "/bans").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void outsiderCannotListBans() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        mvc.perform(get("/groups/" + groupId + "/bans").header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void unbannedUserCanAcceptInviteAgain() throws Exception {
        removeMember();

        mvc.perform(delete("/groups/" + groupId + "/bans/" + member.id()).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/groups/" + groupId + "/bans").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));

        String token = TestGroups.issueInvite(mvc, admin, groupId);
        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", member.bearer()))
                .andExpect(status().isOk());
        mvc.perform(get("/groups/" + groupId).header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myRole").value("MEMBER"));
    }

    @Test
    void unbanWithoutBanReturns404() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/bans/" + member.id()).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberCannotUnban() throws Exception {
        removeMember();
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@test.com", "다른사람");
        TestGroups.join(mvc, admin, other, groupId);

        mvc.perform(delete("/groups/" + groupId + "/bans/" + member.id()).header("Authorization", other.bearer()))
                .andExpect(status().isForbidden());
    }

    @Test
    void memberWhoLeftVoluntarilyCanRejoin() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/me").header("Authorization", member.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/groups/" + groupId + "/bans").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));

        String token = TestGroups.issueInvite(mvc, admin, groupId);
        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", member.bearer()))
                .andExpect(status().isOk());
    }

    private void removeMember() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/" + member.id()).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
    }
}
