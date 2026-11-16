package com.saladbowl.api.support;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 통합 테스트용 세법 버전 준비 헬퍼. 값은 2026 귀속 법령 수치(공개 수치)다. */
public final class TestTaxLaws {

    public static final String URL = "/tax/admin/law-versions";

    private TestTaxLaws() {
    }

    /** 2026 귀속 값으로 채운 수정 요청 본문. */
    public static String values2026(long rowVersion) {
        return """
                {
                  "rowVersion": %d,
                  "minSpendRatePct": 25,
                  "bracketBoundary": 70000000,
                  "rateCreditPct": 15,
                  "rateDebitCashPct": 30,
                  "rateCulturePct": 30,
                  "rateMarketPct": 40,
                  "rateTransitPct": 40,
                  "basicLimitLow": [3000000, 3500000, 4000000],
                  "basicLimitHigh": [2500000, 2750000, 3000000],
                  "extraLimitLow": 3000000,
                  "extraLimitHigh": 2000000,
                  "basisLawName": "조세특례제한법",
                  "basisArticle": "제126조의2",
                  "basisUrl": "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389",
                  "periodStart": "2026-01-01",
                  "periodEnd": "2026-12-31",
                  "memo": "2026 귀속 최초 등록"
                }
                """.formatted(rowVersion);
    }

    public static long createDraft(MockMvc mvc, TestAuth.AuthedUser admin, int taxYear) throws Exception {
        String body = mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taxYear\":%d}".formatted(taxYear)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    /** 새 초안을 만들고 2026 값으로 채운다. 채운 뒤의 rowVersion은 1이다. */
    public static long createFilledDraft(MockMvc mvc, TestAuth.AuthedUser admin, int taxYear) throws Exception {
        long id = createDraft(mvc, admin, taxYear);
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(values2026(0)))
                .andExpect(status().isOk());
        return id;
    }

    /** 적용 API(Task 2.3) 없이 적용본을 만든다. 적용본의 수정·삭제 거부와 current 조회 테스트에 쓴다. */
    public static void markApplied(JdbcTemplate jdbc, long id, long adminId) {
        jdbc.update("UPDATE tax_law_versions SET status = 'APPLIED', applied_by = ?, applied_at = now() WHERE id = ?",
                adminId, id);
    }
}
