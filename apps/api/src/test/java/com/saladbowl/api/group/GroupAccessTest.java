package com.saladbowl.api.group;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GroupAccessTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    GroupAccess access;

    AuthedUser admin;
    AuthedUser sharing;
    AuthedUser hiding;
    long groupId;

    @BeforeEach
    void setUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        sharing = TestAuth.signupAndLogin(mvc, "sharing@test.com", "공개");
        hiding = TestAuth.signupAndLogin(mvc, "hiding@test.com", "비공개");
        groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, sharing, groupId);
        TestGroups.join(mvc, admin, hiding, groupId);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", hiding.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void sharedOwnerIdsExcludesMembersWhoTurnedSharingOff() {
        assertThat(access.sharedOwnerIds(groupId)).containsExactly(admin.id(), sharing.id());
    }

    @Test
    void ownerCanAlwaysEditOwnData() {
        assertThat(access.canEditOwnedBy(hiding.id(), hiding.id())).isTrue();
    }

    @Test
    void adminCanEditDataOfMemberWhoSharesWithTheGroup() {
        assertThat(access.canEditOwnedBy(admin.id(), sharing.id())).isTrue();
    }

    @Test
    void adminCannotEditDataOfMemberWhoTurnedSharingOff() {
        assertThat(access.canEditOwnedBy(admin.id(), hiding.id())).isFalse();
    }

    @Test
    void memberCannotEditAdminData() {
        assertThat(access.canEditOwnedBy(sharing.id(), admin.id())).isFalse();
    }

    @Test
    void adminOfAnotherGroupCannotEdit() throws Exception {
        AuthedUser otherAdmin = TestAuth.signupAndLogin(mvc, "other@test.com", "다른관리자");
        TestGroups.createGroup(mvc, otherAdmin, "다른집");

        assertThat(access.canEditOwnedBy(otherAdmin.id(), sharing.id())).isFalse();
    }

    @Test
    void memberCanViewDataOfMemberWhoShares() {
        assertThat(access.canViewOwnedBy(sharing.id(), admin.id())).isTrue();
    }

    @Test
    void memberCannotViewDataOfMemberWhoTurnedSharingOff() {
        assertThat(access.canViewOwnedBy(sharing.id(), hiding.id())).isFalse();
    }

    @Test
    void outsiderCannotView() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        assertThat(access.canViewOwnedBy(outsider.id(), sharing.id())).isFalse();
    }

    @Test
    void permissionsAreEvaluatedPerGroup() throws Exception {
        // hiding은 이 그룹에서는 비공개지만, 다른 그룹 B에서는 공개(기본값)한다.
        AuthedUser adminB = TestAuth.signupAndLogin(mvc, "adminb@test.com", "B관리자");
        long groupB = TestGroups.createGroup(mvc, adminB, "B네");
        TestGroups.join(mvc, adminB, hiding, groupB);

        assertThat(access.canEditOwnedBy(adminB.id(), hiding.id())).isTrue();
        assertThat(access.canViewOwnedBy(adminB.id(), hiding.id())).isTrue();
        assertThat(access.canEditOwnedBy(admin.id(), hiding.id())).isFalse();
        assertThat(access.canViewOwnedBy(sharing.id(), hiding.id())).isFalse();
    }
}
