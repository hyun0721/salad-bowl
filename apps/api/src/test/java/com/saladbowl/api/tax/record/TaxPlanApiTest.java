package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.planBody;
import static com.saladbowl.api.support.TestTaxRecords.putPlan;
import static com.saladbowl.api.support.TestTaxRecords.version;
import static org.hamcrest.Matchers.not;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 지출계획 저장(TAX-51, 70, 29, AC-01, 33, 36). 금액은 모두 합성값이고 테스트의 올해는 2026이다. */
@Import(TestClock.Config.class)
class TaxPlanApiTest extends IntegrationTest {

    private static final long MAX = 9_999_999_999_999L;

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser owner;
    long yearVersion;

    @BeforeEach
    void createOwnerYear() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
        yearVersion = createYear(mvc, owner, 2026);
    }

    /** 일반 300,000 / 200,000 / 900,000, 전통시장 0 / 50,000 / 100,000, 대중교통 0 / 0 / 120,000, 문화체육 40,000 / 0 / 60,000. */
    private static String plan(Long rowVersion) {
        return planBody(rowVersion, 300_000L, 200_000L, 900_000L, 0L, 50_000L, 100_000L,
                0L, 0L, 120_000L, 40_000L, 0L, 60_000L);
    }

    private static String zeroPlanWith(Long rowVersion, long generalFlexible) {
        return planBody(rowVersion, 0L, 0L, generalFlexible, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L);
    }

    private int planCount() {
        return jdbc.queryForObject("SELECT count(*) FROM tax_spending_plans", Integer.class);
    }

    @Test
    void planIsSavedAndReadBackEvenWithoutStatementsOrLaw() throws Exception {
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan").value(nullValue()));

        // 자료가 미완료이고 세법이 없어도 저장된다(TAX-75).
        var saved = putPlan(mvc, owner, 2026, plan(null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.rowVersion").isNumber())
                .andExpect(jsonPath("$.plan.general.creditFixed").value(300_000))
                .andExpect(jsonPath("$.plan.general.debitFixed").value(200_000))
                .andExpect(jsonPath("$.plan.general.flexible").value(900_000))
                .andExpect(jsonPath("$.plan.market.creditFixed").value(0))
                .andExpect(jsonPath("$.plan.market.debitFixed").value(50_000))
                .andExpect(jsonPath("$.plan.market.flexible").value(100_000))
                .andExpect(jsonPath("$.plan.transit.creditFixed").value(0))
                .andExpect(jsonPath("$.plan.transit.debitFixed").value(0))
                .andExpect(jsonPath("$.plan.transit.flexible").value(120_000))
                .andExpect(jsonPath("$.plan.culture.creditFixed").value(40_000))
                .andExpect(jsonPath("$.plan.culture.debitFixed").value(0))
                .andExpect(jsonPath("$.plan.culture.flexible").value(60_000))
                // 지출계획은 연도 합계표(입력자료의 합)에 들어가지 않는다.
                .andExpect(jsonPath("$.totals.creditGeneral").value(0))
                .andExpect(jsonPath("$.rowVersion").value(yearVersion));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(900_000))
                .andExpect(jsonPath("$.plan.culture.flexible").value(60_000));

        putPlan(mvc, owner, 2026, zeroPlanWith(version(saved, "$.plan.rowVersion"), 500_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.rowVersion").value(not(version(saved, "$.plan.rowVersion")), Long.class))
                .andExpect(jsonPath("$.plan.general.flexible").value(500_000))
                .andExpect(jsonPath("$.plan.general.creditFixed").value(0));
        assertThat(planCount()).isEqualTo(1);
    }

    @Test
    void stalePlanSaveIsConflictAndKeepsTheFirstSave() throws Exception {
        // 아직 없는 계획을 고치려는 요청(rowVersion 있음)은 만들지 않는다.
        putPlan(mvc, owner, 2026, plan(0L)).andExpect(status().isConflict());
        assertThat(planCount()).isZero();

        var saved = putPlan(mvc, owner, 2026, plan(null)).andExpect(status().isOk());
        putPlan(mvc, owner, 2026, zeroPlanWith(version(saved, "$.plan.rowVersion"), 500_000L)).andExpect(status().isOk());

        for (Long stale : new Long[]{version(saved, "$.plan.rowVersion"), null}) {
            putPlan(mvc, owner, 2026, zeroPlanWith(stale, 777_000L))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("CONFLICT"));
        }
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(500_000))
                .andExpect(jsonPath("$.plan.rowVersion").value(not(version(saved, "$.plan.rowVersion")), Long.class));
    }

    @Test
    void rejectsInvalidPlan() throws Exception {
        String[] invalid = {
                zeroPlanWith(null, -1L),
                zeroPlanWith(null, MAX + 1),
                planBody(null, 0L, null, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L),
                plan(null).replace("900000}", "900000.5}"),
                "{\"general\": {\"creditFixed\": 0, \"debitFixed\": 0, \"flexible\": 0}}",
                "{}"
        };
        for (String body : invalid) {
            putPlan(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(planCount()).isZero();

        putPlan(mvc, owner, 2026, zeroPlanWith(null, MAX)).andExpect(status().isOk());
    }

    @Test
    void anotherMemberCannotReachMyPlan() throws Exception {
        var saved = putPlan(mvc, owner, 2026, plan(null)).andExpect(status().isOk());
        AuthedUser stranger = TestAuth.signupAndLogin(mvc, "stranger@example.test", "남");

        // 연도 기록이 없는 회원은 404다.
        putPlan(mvc, stranger, 2026, zeroPlanWith(0L, 1L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        putPlan(mvc, stranger, 2026, zeroPlanWith(null, 1L)).andExpect(status().isNotFound());
        // 자기 연도 기록이 있으면 자기 계획이 따로 생기고 내 계획은 그대로다.
        createYear(mvc, stranger, 2026);
        putPlan(mvc, stranger, 2026, zeroPlanWith(null, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.general.flexible").value(1));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(900_000))
                .andExpect(jsonPath("$.plan.rowVersion").value(version(saved, "$.plan.rowVersion")));
        assertThat(planCount()).isEqualTo(2);
    }

    @Test
    void deletingTheYearDeletesItsPlanOnly() throws Exception {
        createYear(mvc, owner, 2025);
        putPlan(mvc, owner, 2025, zeroPlanWith(null, 25_000L)).andExpect(status().isOk());
        putPlan(mvc, owner, 2026, plan(null)).andExpect(status().isOk());

        mvc.perform(delete(URL + "/2026").param("rowVersion", Long.toString(yearVersion)).header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());

        assertThat(planCount()).isEqualTo(1);
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(25_000));
        // 같은 연도를 다시 만들면 계획 없이 시작한다.
        yearVersion = createYear(mvc, owner, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan").value(nullValue()));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(put(URL + "/2026/plan").contentType(MediaType.APPLICATION_JSON).content(plan(null)))
                .andExpect(status().isUnauthorized());
    }
}
