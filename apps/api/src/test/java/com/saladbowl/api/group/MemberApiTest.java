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
    void removedMemberCanRejoinWithInvite() throws Exception {
        mvc.perform(delete("/groups/" + groupId + "/members/" + member.id()).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
        String token = TestGroups.issueInvite(mvc, admin, groupId);

        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", member.bearer()))
                .andExpect(status().isOk());
    }
}
