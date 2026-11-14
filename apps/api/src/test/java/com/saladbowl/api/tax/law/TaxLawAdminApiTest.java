package com.saladbowl.api.tax.law;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestTaxLaws;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxLaws.URL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 세법 초안 만들기·조회·수정·삭제와 회원용 current 조회(TAX-04, 60~62, 67, 72, AC-39, AC-19 일부). */
class TaxLawAdminApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser admin;

    @BeforeEach
    void createAdmin() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());
    }

    @Test
    void firstDraftOfAYearIsBlankAndNumberedOne() throws Exception {
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.taxYear").value(2026))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.algorithmVersion").value(1))
                .andExpect(jsonPath("$.minSpendRatePct").value(nullValue()))
                .andExpect(jsonPath("$.bracketBoundary").value(nullValue()))
                .andExpect(jsonPath("$.basicLimitLow", contains(nullValue(), nullValue(), nullValue())))
                .andExpect(jsonPath("$.basicLimitHigh", contains(nullValue(), nullValue(), nullValue())))
                .andExpect(jsonPath("$.childTiersApply").value(false))
                .andExpect(jsonPath("$.basisLawName").value(nullValue()))
                .andExpect(jsonPath("$.createdByNickname").value("관리자"))
                .andExpect(jsonPath("$.appliedByNickname").value(nullValue()))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.appliedAt").value(nullValue()))
                .andExpect(jsonPath("$.rowVersion").value(0));
    }

    @Test
    void versionNumbersGrowPerYearAndAreNeverReused() throws Exception {
        long first = TestTaxLaws.createDraft(mvc, admin, 2026);
        TestTaxLaws.createDraft(mvc, admin, 2026);
        long third = TestTaxLaws.createDraft(mvc, admin, 2026);

        // 가장 큰 번호(3)를 지워도 다음 초안은 4번이다.
        mvc.perform(delete(URL + "/" + third).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(4));

        // 중간 번호(1)를 지워도 빈 번호를 채우지 않는다.
        mvc.perform(delete(URL + "/" + first).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(5));

        // 번호는 귀속연도마다 따로 센다.
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2025}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(1));

        mvc.perform(get(URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].versionNo", contains(5, 4, 2)));
    }

    @Test
    void updateReplacesDraftValuesAndBumpsRowVersion() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(TestTaxLaws.values2026(0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rowVersion").value(1));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.bracketBoundary").value(70000000))
                .andExpect(jsonPath("$.rateCreditPct").value(15))
                .andExpect(jsonPath("$.rateDebitCashPct").value(30))
                .andExpect(jsonPath("$.rateCulturePct").value(30))
                .andExpect(jsonPath("$.rateMarketPct").value(40))
                .andExpect(jsonPath("$.rateTransitPct").value(40))
                .andExpect(jsonPath("$.basicLimitLow", contains(3000000, 3500000, 4000000)))
                .andExpect(jsonPath("$.basicLimitHigh", contains(2500000, 2750000, 3000000)))
                .andExpect(jsonPath("$.extraLimitLow").value(3000000))
                .andExpect(jsonPath("$.extraLimitHigh").value(2000000))
                .andExpect(jsonPath("$.childTiersApply").value(true))
                .andExpect(jsonPath("$.basisLawName").value("조세특례제한법"))
                .andExpect(jsonPath("$.basisArticle").value("제126조의2"))
                .andExpect(jsonPath("$.basisUrl").value("https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389"))
                .andExpect(jsonPath("$.periodStart").value("2026-01-01"))
                .andExpect(jsonPath("$.periodEnd").value("2026-12-31"))
                .andExpect(jsonPath("$.memo").value("2026 귀속 최초 등록"))
                .andExpect(jsonPath("$.rowVersion").value(1));
    }

    @Test
    void omittedValuesBecomeEmpty() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":1,\"basisLawName\":\"   \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minSpendRatePct").value(nullValue()))
                .andExpect(jsonPath("$.basicLimitLow", contains(nullValue(), nullValue(), nullValue())))
                .andExpect(jsonPath("$.basisLawName").value(nullValue()))
                .andExpect(jsonPath("$.childTiersApply").value(false))
                .andExpect(jsonPath("$.rowVersion").value(2));
    }

    @Test
    void staleRowVersionReturns409AndKeepsStoredValues() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        // 다른 곳에서 먼저 고쳐 rowVersion이 1이 됐는데 0으로 보낸다.
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"minSpendRatePct\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.rowVersion").value(1));
    }

    @Test
    void malformedUpdateReturns400() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        // rowVersion 없음
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"minSpendRatePct\":25}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        // 자녀등 단계가 3칸이 아님
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"basicLimitLow\":[3000000,3500000]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        // 근거 URL이 열 길이(500)를 넘음
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"basisUrl\":\"https://example.com/%s\"}".formatted("a".repeat(500))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        // 숫자 자리에 문자열
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"minSpendRatePct\":\"많이\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.rowVersion").value(0));
    }

    @Test
    void appliedVersionCannotBeUpdatedOrDeleted() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        TestTaxLaws.markApplied(jdbc, id, admin.id());

        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":1,\"minSpendRatePct\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.appliedByNickname").value("관리자"));
    }

    @Test
    void deletedDraftIsGone() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":0}"))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_law_versions", Long.class)).isZero();
    }

    @Test
    void newDraftCopiesCurrentAppliedValuesButNotMemo() throws Exception {
        long appliedId = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        TestTaxLaws.markApplied(jdbc, appliedId, admin.id());
        AuthedUser second = TestAuth.signupAndLogin(mvc, "second@test.com", "둘째관리자");
        TestAdmins.grant(jdbc, second.id());

        mvc.perform(post(URL).header("Authorization", second.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(2))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.bracketBoundary").value(70000000))
                .andExpect(jsonPath("$.rateTransitPct").value(40))
                .andExpect(jsonPath("$.basicLimitLow", contains(3000000, 3500000, 4000000)))
                .andExpect(jsonPath("$.basicLimitHigh", contains(2500000, 2750000, 3000000)))
                .andExpect(jsonPath("$.extraLimitHigh").value(2000000))
                .andExpect(jsonPath("$.basisLawName").value("조세특례제한법"))
                .andExpect(jsonPath("$.periodEnd").value("2026-12-31"))
                .andExpect(jsonPath("$.memo").value(nullValue()))
                .andExpect(jsonPath("$.createdByNickname").value("둘째관리자"))
                .andExpect(jsonPath("$.appliedByNickname").value(nullValue()))
                .andExpect(jsonPath("$.appliedAt").value(nullValue()))
                .andExpect(jsonPath("$.rowVersion").value(0));

        // 다른 귀속연도는 적용 버전이 없으므로 빈 값으로 시작한다.
        mvc.perform(post(URL).header("Authorization", second.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2027}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.minSpendRatePct").value(nullValue()));
    }

    @Test
    void yearMustBeFourDigits() throws Exception {
        for (String body : new String[]{"{\"taxYear\":999}", "{\"taxYear\":10000}", "{}", "{\"taxYear\":\"올해\"}"}) {
            mvc.perform(post(URL).header("Authorization", admin.bearer())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String year : new String[]{"999", "10000", "abc"}) {
            mvc.perform(get(URL).param("year", year).header("Authorization", admin.bearer()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        mvc.perform(get(URL).header("Authorization", admin.bearer()))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_law_year_counters", Long.class)).isZero();
    }

    @Test
    void nonAdminsCannotReadOrChangeVersions() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");

        mvc.perform(get(URL).param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(get(URL + "/" + id).header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(post(URL).header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isForbidden());
        mvc.perform(put(URL + "/" + id).header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":1,\"minSpendRatePct\":99}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete(URL + "/" + id).header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(delete(URL + "/" + id))
                .andExpect(status().isUnauthorized());

        // 거부된 요청은 아무것도 바꾸지 않았다.
        mvc.perform(get(URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].minSpendRatePct").value(25))
                .andExpect(jsonPath("$[0].rowVersion").value(1));
    }

    @Test
    void revokedAdminIsRejectedOnTheNextRequestWithTheSameToken() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        TestAdmins.revoke(jdbc, admin.id());

        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_law_versions", Long.class)).isEqualTo(1);
    }

    @Test
    void currentIsReadableByAnyMemberAndNeverShowsDrafts() throws Exception {
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(get("/tax/law-versions/current").param("year", "2026"))
                .andExpect(status().isUnauthorized());
        // 초안만 있는 연도는 "세법 준비 중"이다.
        mvc.perform(get("/tax/law-versions/current").param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        TestTaxLaws.markApplied(jdbc, id, admin.id());
        TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(get("/tax/law-versions/current").param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.childTiersApply").value(true))
                // 회원에게는 작성자·적용자 닉네임을 내리지 않는다.
                .andExpect(jsonPath("$.createdByNickname").value(nullValue()))
                .andExpect(jsonPath("$.appliedByNickname").value(nullValue()));
        mvc.perform(get("/tax/law-versions/current").param("year", "2025").header("Authorization", member.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/tax/law-versions/current").param("year", "99").header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest());
    }
}
