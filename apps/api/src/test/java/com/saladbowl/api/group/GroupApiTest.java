package com.saladbowl.api.group;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GroupApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    GroupMemberRepository members;

    @Test
    void createMakesCreatorAdminOfOneMemberGroup() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");

        mvc.perform(post("/groups").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"  우리집  "}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.groupId").isNumber())
                .andExpect(jsonPath("$.name").value("우리집"))
                .andExpect(jsonPath("$.myRole").value("ADMIN"))
                .andExpect(jsonPath("$.memberCount").value(1));
    }

    @Test
    void blankNameReturns400() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");

        mvc.perform(post("/groups").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"   "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void listShowsOnlyGroupsIBelongTo() throws Exception {
        AuthedUser a = TestAuth.signupAndLogin(mvc, "a@test.com", "에이");
        AuthedUser b = TestAuth.signupAndLogin(mvc, "b@test.com", "비");
        TestGroups.createGroup(mvc, a, "A네");
        TestGroups.createGroup(mvc, b, "B네");

        mvc.perform(get("/groups").header("Authorization", a.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("A네"))
                .andExpect(jsonPath("$[0].myRole").value("ADMIN"));
    }

    @Test
    void detailListsMembersWithNicknames() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");

        mvc.perform(get("/groups/" + groupId).header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupId").value(groupId))
                .andExpect(jsonPath("$.myRole").value("ADMIN"))
                .andExpect(jsonPath("$.members", hasSize(1)))
                .andExpect(jsonPath("$.members[0].userId").value(admin.id()))
                .andExpect(jsonPath("$.members[0].nickname").value("관리자"))
                .andExpect(jsonPath("$.members[0].role").value("ADMIN"))
                .andExpect(jsonPath("$.members[0].shareEnabled").value(true));
    }

    @Test
    void nonMemberGets404ForExistingGroup() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");

        mvc.perform(get("/groups/" + groupId).header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void nonNumericGroupIdReturns400() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");

        mvc.perform(get("/groups/abc").header("Authorization", admin.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void adminCanRename() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");

        mvc.perform(patch("/groups/" + groupId).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"새 이름"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("새 이름"));
    }

    @Test
    void memberCannotRename() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        members.save(new GroupMember(groupId, member.id(), GroupRole.MEMBER));

        mvc.perform(patch("/groups/" + groupId).header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"새 이름"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
