package com.saladbowl.api.group;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ShareApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void memberTurnsSharingOffAndOn() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);

        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareEnabled").value(false));

        mvc.perform(get("/groups/" + groupId).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.members[1].userId").value(member.id()))
                .andExpect(jsonPath("$.members[1].shareEnabled").value(false));

        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":true}
                                """))
                .andExpect(jsonPath("$.shareEnabled").value(true));
    }

    @Test
    void missingEnabledReturns400() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");

        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void outsiderGets404() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");

        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", outsider.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isNotFound());
    }
}
