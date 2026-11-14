package com.saladbowl.api.tax;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /tax/admin/** 접근 제어(TAX-05, TAX-06, AC-04, AC-05). 경로 아래 어떤 주소·메서드든 같은 규칙이다. */
class TaxAdminAccessTest extends IntegrationTest {

    private static final String ADMIN_URL = "/tax/admin/law-versions";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void anonymousGets401() throws Exception {
        mvc.perform(get(ADMIN_URL).param("year", "2026"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void ordinaryMemberGets403OnEveryMethod() throws Exception {
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(post(ADMIN_URL).header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isForbidden());
        mvc.perform(get(ADMIN_URL + "/1").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(put(ADMIN_URL + "/1").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":0}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(ADMIN_URL + "/1/validate").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(post(ADMIN_URL + "/1/apply").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(delete(ADMIN_URL + "/1").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/tax/admin/anything/else").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
    }

    @Test
    void groupAdminIsNotServiceAdmin() throws Exception {
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@test.com", "그룹장");
        TestGroups.createGroup(mvc, groupAdmin, "우리집");

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", groupAdmin.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void serviceAdminPassesTheGate() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());

        // Task 2.1 시점에는 컨트롤러가 없으므로 문을 통과한 요청은 404다. Task 2.2에서 200으로 바꾼다.
        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void revokingTakesEffectOnTheNextRequestWithTheSameToken() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());

        TestAdmins.revoke(jdbc, admin.id());

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
