package com.saladbowl.api.support;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 통합 테스트용 그룹 준비 헬퍼. */
public final class TestGroups {

    private TestGroups() {
    }

    public static long createGroup(MockMvc mvc, TestAuth.AuthedUser admin, String name) throws Exception {
        String body = mvc.perform(post("/groups").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"%s"}
                                """.formatted(name)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.groupId")).longValue();
    }

    public static String issueInvite(MockMvc mvc, TestAuth.AuthedUser admin, long groupId) throws Exception {
        String body = mvc.perform(post("/groups/" + groupId + "/invites").header("Authorization", admin.bearer()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    public static void join(MockMvc mvc, TestAuth.AuthedUser admin, TestAuth.AuthedUser member, long groupId)
            throws Exception {
        String token = issueInvite(mvc, admin, groupId);
        mvc.perform(post("/invites/" + token + "/accept").header("Authorization", member.bearer()))
                .andExpect(status().isOk());
    }
}
