package com.saladbowl.api.tax.law;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
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

/** 검증·적용·현재 적용 버전(TAX-61, 63, 64, 67, 72, AC-19, AC-21, AC-39). */
class TaxLawApplyApiTest extends IntegrationTest {

    private static final String CURRENT = "/tax/law-versions/current";

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

    /** 2026 값 본문에서 한 필드만 바꾼다. value는 JSON 표기 그대로다(예: "null", "101", "\"글자\""). */
    private static String values2026With(String field, String value) {
        String body = TestTaxLaws.values2026(0);
        String changed = body.replaceAll("\"" + field + "\": [^\\n]*?(,?)\\n", "\"" + field + "\": " + value + "$1\n");
        assertThat(changed).as("field %s replaced", field).isNotEqualTo(body);
        return changed;
    }

    private String statusOf(long id) {
        return jdbc.queryForObject("SELECT status FROM tax_law_versions WHERE id = ?", String.class, id);
    }

    @Test
    void applyRecordsWhoAndWhenAndMakesTheVersionCurrent() throws Exception {
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.createdByNickname").value("관리자"))
                .andExpect(jsonPath("$.appliedByNickname").value("관리자"))
                .andExpect(jsonPath("$.appliedAt").isString())
                .andExpect(jsonPath("$.rowVersion").value(2));

        // 일반 회원도 적용된 기준은 읽는다.
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.basicLimitLow", contains(3000000, 3500000, 4000000)));
    }

    @Test
    void appliedVersionRejectsUpdateDeleteAndSecondApply() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());
        String appliedAt = jdbc.queryForObject(
                "SELECT applied_at::text FROM tax_law_versions WHERE id = ?", String.class, id);

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TestTaxLaws.values2026(2).replace("\"minSpendRatePct\": 25", "\"minSpendRatePct\": 20")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.rowVersion").value(2));
        assertThat(jdbc.queryForObject("SELECT applied_at::text FROM tax_law_versions WHERE id = ?", String.class, id))
                .isEqualTo(appliedAt);
    }

    @Test
    void blankDraftIsNotApplied() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errors", hasSize(20)))
                .andExpect(jsonPath("$.errors[0].field").value("minSpendRatePct"))
                .andExpect(jsonPath("$.errors[0].message").value("값을 입력해야 합니다"));
        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value("minSpendRatePct: 값을 입력해야 합니다"));

        assertThat(statusOf(id)).isEqualTo("DRAFT");
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void draftWithOneBadValueIsNotApplied() throws Exception {
        // {바꿀 필드, JSON 값, 오류가 나는 필드}
        String[][] cases = {
                {"minSpendRatePct", "101", "minSpendRatePct"},
                {"rateCreditPct", "-1", "rateCreditPct"},
                {"rateDebitCashPct", "null", "rateDebitCashPct"},
                {"rateCulturePct", "101", "rateCulturePct"},
                {"rateMarketPct", "-1", "rateMarketPct"},
                {"rateTransitPct", "null", "rateTransitPct"},
                {"bracketBoundary", "-1", "bracketBoundary"},
                {"basicLimitLow", "[3000000, null, 4000000]", "basicLimitLow[1]"},
                {"basicLimitHigh", "[2500000, 2750000, -1]", "basicLimitHigh[2]"},
                {"extraLimitLow", "null", "extraLimitLow"},
                {"extraLimitHigh", "-1", "extraLimitHigh"},
                {"basisLawName", "null", "basisLawName"},
                {"basisArticle", "\"   \"", "basisArticle"},
                {"basisUrl", "null", "basisUrl"},
                {"basisUrl", "\"javascript:alert(1)\"", "basisUrl"},
                {"periodStart", "null", "periodStart"},
                {"periodEnd", "null", "periodEnd"},
                {"periodStart", "\"2027-01-01\"", "periodEnd"},
        };
        for (String[] c : cases) {
            long id = TestTaxLaws.createDraft(mvc, admin, 2026);
            mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                            .contentType(MediaType.APPLICATION_JSON).content(values2026With(c[0], c[1])))
                    .andExpect(status().isOk());

            mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.errors", hasSize(1)))
                    .andExpect(jsonPath("$.errors[0].field").value(c[2]));
            mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
            assertThat(statusOf(id)).as("%s = %s", c[0], c[1]).isEqualTo("DRAFT");
        }
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void memoIsOptional() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(values2026With("memo", "null")))
                .andExpect(status().isOk());

        mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errors").isEmpty());
        // 검증만으로는 상태가 바뀌지 않는다.
        assertThat(statusOf(id)).isEqualTo("DRAFT");

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.memo").value(nullValue()));
    }

    @Test
    void applyingOneDraftLeavesOtherDraftsAsDrafts() throws Exception {
        long first = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        long second = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/" + second + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());

        mvc.perform(get(URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$[*].versionNo", contains(2, 1)))
                .andExpect(jsonPath("$[*].status", contains("APPLIED", "DRAFT")));
        // 남은 초안은 계속 고치고 지울 수 있다.
        mvc.perform(delete(URL + "/" + first).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
    }

    @Test
    void currentIsTheMostRecentlyAppliedRegardlessOfNumber() throws Exception {
        long first = TestTaxLaws.createDraft(mvc, admin, 2026);
        long second = TestTaxLaws.createDraft(mvc, admin, 2026);
        mvc.perform(put(URL + "/" + first).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(values2026With("minSpendRatePct", "20")))
                .andExpect(status().isOk());
        mvc.perform(put(URL + "/" + second).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(TestTaxLaws.values2026(0)))
                .andExpect(status().isOk());

        // 2번을 먼저, 1번을 나중에 적용한다.
        mvc.perform(post(URL + "/" + second + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.versionNo").value(2));
        mvc.perform(post(URL + "/" + first + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());

        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.minSpendRatePct").value(20));
        // 새 초안은 번호가 큰 2번이 아니라 현재 적용 버전(1번)의 값을 복사한다.
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(3))
                .andExpect(jsonPath("$.minSpendRatePct").value(20));
        // 다른 귀속연도의 현재 적용 버전에는 영향이 없다.
        mvc.perform(get(CURRENT).param("year", "2025").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void nonAdminsCannotValidateOrApply() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@test.com", "그룹장");
        TestGroups.createGroup(mvc, groupAdmin, "우리집");

        for (AuthedUser user : new AuthedUser[]{member, groupAdmin}) {
            mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", user.bearer()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", user.bearer()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
        mvc.perform(post(URL + "/" + id + "/apply"))
                .andExpect(status().isUnauthorized());

        assertThat(statusOf(id)).isEqualTo("DRAFT");
    }

    @Test
    void revokedAdminCannotApplyWithTheSameToken() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        TestAdmins.revoke(jdbc, admin.id());

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden());
        assertThat(statusOf(id)).isEqualTo("DRAFT");
    }

    @Test
    void missingOrDeletedVersionReturns404() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(post(URL + "/999999/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }
}
