package com.saladbowl.api.support;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 통합 테스트용 소득공제 연도 기록 준비 헬퍼. 금액은 모두 합성값이다. */
public final class TestTaxRecords {

    public static final String URL = "/tax/years";

    private TestTaxRecords() {
    }

    /** 기본정보 본문. rowVersion이 null이면 새로 만드는 요청이다. */
    public static String yearBody(long totalSalary, int startMonth, int endMonth, int childCount, Long rowVersion) {
        return """
                {"totalSalary": %d, "workStartMonth": %d, "workEndMonth": %d, "childCount": %d, "rowVersion": %s}
                """.formatted(totalSalary, startMonth, endMonth, childCount, rowVersion);
    }

    public static ResultActions putYear(MockMvc mvc, TestAuth.AuthedUser user, int year, String body)
            throws Exception {
        return mvc.perform(put(URL + "/" + year).header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** 총급여 40,000,000원, 1~12월, 자녀등 0명인 연도 기록을 만든다. 만든 뒤의 rowVersion은 0이다. */
    public static void createYear(MockMvc mvc, TestAuth.AuthedUser user, int year) throws Exception {
        putYear(mvc, user, year, yearBody(40_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
    }

    /** amounts는 신용카드 4칸, 체크카드 4칸 순서이고 null은 미입력이다. */
    public static String cardBody(String issuerName, String asOfDate, Long rowVersion, Long... amounts) {
        return """
                {"issuerName": "%s", "asOfDate": "%s", "rowVersion": %s, "amounts": {
                  "creditGeneral": %s, "creditMarket": %s, "creditTransit": %s, "creditCulture": %s,
                  "debitGeneral": %s, "debitMarket": %s, "debitTransit": %s, "debitCulture": %s}}
                """.formatted(issuerName, asOfDate, rowVersion, amounts[0], amounts[1], amounts[2], amounts[3],
                amounts[4], amounts[5], amounts[6], amounts[7]);
    }

    /** amounts는 일반·전통시장·대중교통·문화체육 순서이고 null은 미입력이다. */
    public static String cashBody(String asOfDate, Long rowVersion, Long... amounts) {
        return """
                {"asOfDate": "%s", "rowVersion": %s, "amounts": {
                  "general": %s, "market": %s, "transit": %s, "culture": %s}}
                """.formatted(asOfDate, rowVersion, amounts[0], amounts[1], amounts[2], amounts[3]);
    }

    public static ResultActions postCard(MockMvc mvc, TestAuth.AuthedUser user, int year, String body)
            throws Exception {
        return mvc.perform(post(URL + "/" + year + "/cards").header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    public static long addCard(MockMvc mvc, TestAuth.AuthedUser user, int year, String body) throws Exception {
        String response = postCard(mvc, user, year, body).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.cards[-1].id")).longValue();
    }

    public static ResultActions putCard(MockMvc mvc, TestAuth.AuthedUser user, int year, long cardId, String body)
            throws Exception {
        return mvc.perform(put(URL + "/" + year + "/cards/" + cardId).header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    public static ResultActions putCash(MockMvc mvc, TestAuth.AuthedUser user, int year, String body)
            throws Exception {
        return mvc.perform(put(URL + "/" + year + "/cash-receipt").header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }
}
