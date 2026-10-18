package com.saladbowl.api.group;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasLength;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class InviteApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void adminIssuesInviteTokenWithExpiry() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");

        mvc.perform(post("/groups/" + groupId + "/invites").header("Authorization", admin.bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token", hasLength(43)))
                .andExpect(jsonPath("$.expiresAt").isString());
    }

    @Test
    void memberCannotIssueInvite() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);

        mvc.perform(post("/groups/" + groupId + "/invites").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void outsiderCannotIssueInvite() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");

        mvc.perform(post("/groups/" + groupId + "/invites").header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void previewShowsGroupInfoBeforeJoining() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser guest = TestAuth.signupAndLogin(mvc, "guest@test.com", "손님");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        String token = TestGroups.issueInvite(mvc, admin, groupId);

        mvc.perform(get("/invites/" + token).header("Authorization", guest.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupName").value("우리집"))
                .andExpect(jsonPath("$.memberCount").value(1))
                .andExpect(jsonPath("$.maxMembers").value(6))
                .andExpect(jsonPath("$.expiresAt").isString())
                .andExpect(jsonPath("$.alreadyMember").value(false));
    }

    @Test
    void acceptJoinsAsMember() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser guest = TestAuth.signupAndLogin(mvc, "guest@test.com", "손님");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        String token = TestGroups.issueInvite(mvc, admin, groupId);

        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", guest.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupId").value(groupId));

        mvc.perform(get("/groups/" + groupId).header("Authorization", guest.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myRole").value("MEMBER"))
                .andExpect(jsonPath("$.members", hasSize(2)));
    }

    @Test
    void acceptingTwiceReturns409() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser guest = TestAuth.signupAndLogin(mvc, "guest@test.com", "손님");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        String token = TestGroups.issueInvite(mvc, admin, groupId);
        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", guest.bearer()))
                .andExpect(status().isOk());

        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", guest.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_MEMBER"));
    }

    @Test
    void unknownTokenReturns404() throws Exception {
        AuthedUser guest = TestAuth.signupAndLogin(mvc, "guest@test.com", "손님");

        mvc.perform(get("/invites/no-such-token").header("Authorization", guest.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVITE_NOT_FOUND"));
        mvc.perform(post("/invites/no-such-token/accept").header("Authorization", guest.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVITE_NOT_FOUND"));
    }

    @Test
    void expiredInviteReturns410() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser guest = TestAuth.signupAndLogin(mvc, "guest@test.com", "손님");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        String token = TestGroups.issueInvite(mvc, admin, groupId);
        jdbc.update("UPDATE group_invites SET expires_at = now() - interval '1 minute' WHERE token = ?", token);

        mvc.perform(get("/invites/" + token).header("Authorization", guest.bearer()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("INVITE_EXPIRED"));
        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", guest.bearer()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("INVITE_EXPIRED"));
    }

    @Test
    void seventhMemberIsRejectedBecauseGroupHoldsSix() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        String token = TestGroups.issueInvite(mvc, admin, groupId);
        for (int i = 2; i <= 6; i++) {
            AuthedUser member = TestAuth.signupAndLogin(mvc, "m" + i + "@test.com", "멤버" + i);
            mvc.perform(post("/invites/" + token + "/accept").header("Authorization", member.bearer()))
                    .andExpect(status().isOk());
        }
        AuthedUser seventh = TestAuth.signupAndLogin(mvc, "m7@test.com", "멤버7");

        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", seventh.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GROUP_FULL"));
        mvc.perform(get("/groups/" + groupId).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.members", hasSize(6)));
    }
}
