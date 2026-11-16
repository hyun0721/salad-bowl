package com.saladbowl.api.tax.calc;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestTaxLaws;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.addCard;
import static com.saladbowl.api.support.TestTaxRecords.cardBody;
import static com.saladbowl.api.support.TestTaxRecords.cashBody;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.planBody;
import static com.saladbowl.api.support.TestTaxRecords.putCard;
import static com.saladbowl.api.support.TestTaxRecords.putCash;
import static com.saladbowl.api.support.TestTaxRecords.putPlan;
import static com.saladbowl.api.support.TestTaxRecords.putYear;
import static com.saladbowl.api.support.TestTaxRecords.readVersion;
import static com.saladbowl.api.support.TestTaxRecords.yearBody;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 분석 조회(TAX-24, 35, 36, 38, 44, 50, 65, 75, AC-01, 13, 19, 20, 30, 31, 43).
 * 금액은 모두 합성값이고 기대 공제액은 PRD 7.1절 식의 손계산이다. 테스트의 올해는 2026이다.
 */
@Import(TestClock.Config.class)
class TaxAnalysisApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser admin;
    AuthedUser owner;

    @BeforeEach
    void signUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@example.test", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
    }

    private ResultActions analysis(AuthedUser user, int year) throws Exception {
        return mvc.perform(get(URL + "/" + year + "/analysis").header("Authorization", user.bearer()));
    }

    /** PRD 합성 예시 1의 입력자료: 신용 일반 1,200만, 체크 일반 200만 + 현금 일반 100만, 전통시장 100만, 대중교통 50만, 문화체육 50만. */
    private void addExample1Statements(AuthedUser user, String cardDate, String cashDate) throws Exception {
        addCard(mvc, user, 2026, cardBody("가나카드", cardDate, null,
                12_000_000L, 1_000_000L, 500_000L, 500_000L, 2_000_000L, 0L, 0L, 0L));
        putCash(mvc, user, 2026, cashBody(cashDate, null, 1_000_000L, 0L, 0L, 0L)).andExpect(status().isOk());
    }

    /** 와이어프레임의 입력자료(총급여 5,000만 기준 소득공제액 1,475,000원). */
    private void addWireframeStatements(AuthedUser user) throws Exception {
        addCard(mvc, user, 2026, cardBody("가나카드", "2026-06-30", null,
                14_000_000L, 300_000L, 200_000L, 100_000L, 2_000_000L, 200_000L, 300_000L, 100_000L));
        putCash(mvc, user, 2026, cashBody("2026-06-30", null, 500_000L, 100_000L, 0L, 0L))
                .andExpect(status().isOk());
    }

    private static String wireframePlan() {
        return planBody(null, 500_000L, 300_000L, 1_200_000L, 0L, 100_000L, 100_000L,
                100_000L, 0L, 0L, 0L, 0L, 100_000L);
    }

    /** 네 테이블 모든 행의 xmin(마지막으로 쓴 트랜잭션). 읽기만 했다면 그대로다. */
    private List<String> rowStamps() {
        return jdbc.queryForList("""
                SELECT 'year' || id || ':' || xmin FROM tax_year_records
                UNION ALL SELECT 'card' || id || ':' || xmin FROM tax_card_statements
                UNION ALL SELECT 'cash' || record_id || ':' || xmin FROM tax_cash_receipts
                UNION ALL SELECT 'plan' || record_id || ':' || xmin FROM tax_spending_plans
                ORDER BY 1""", String.class);
    }

    @Test
    void onlyTheOwnerReadsTheAnalysis() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        addExample1Statements(owner, "2026-06-30", "2026-06-30");
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@example.test", "다른회원");

        analysis(owner, 2026).andExpect(status().isOk());
        // 남의 연도와 없는 연도는 같은 404다. 서비스 관리자도 남의 자료는 읽지 못한다.
        for (AuthedUser stranger : List.of(other, admin)) {
            analysis(stranger, 2026).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("tax record not found"));
        }
        analysis(owner, 2025).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("tax record not found"));
        mvc.perform(get(URL + "/2026/analysis")).andExpect(status().isUnauthorized());
        analysis(owner, 999).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void statusGoesFromNoInputToIncompleteToLawPendingToReady() throws Exception {
        // 적용 버전이 없는 연도의 기록(AC-20)
        createYear(mvc, owner, 2026);
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.taxYear").value(2026))
                .andExpect(jsonPath("$.status").value("NO_INPUT"))
                .andExpect(jsonPath("$.blankCount").value(4))
                .andExpect(jsonPath("$.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.totals.creditGeneral").value(0))
                .andExpect(jsonPath("$.asOfDateMin").value(nullValue()))
                .andExpect(jsonPath("$.asOfDateMax").value(nullValue()))
                .andExpect(jsonPath("$.law").value(nullValue()))
                .andExpect(jsonPath("$.planSaved").value(false))
                .andExpect(jsonPath("$.deduction").value(nullValue()))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        // 카드 자료의 한 칸이 비었고 현금영수증 자료가 없다: 빈 칸 1 + 4
        long cardId = addCard(mvc, owner, 2026, cardBody("가나카드", "2026-06-30", null,
                12_000_000L, 1_000_000L, 500_000L, 500_000L, 2_000_000L, 0L, 0L, null));
        putPlan(mvc, owner, 2026, wireframePlan()).andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INCOMPLETE"))
                .andExpect(jsonPath("$.blankCount").value(5))
                .andExpect(jsonPath("$.totals.creditGeneral").value(12_000_000))
                .andExpect(jsonPath("$.planSaved").value(true))
                .andExpect(jsonPath("$.deduction").value(nullValue()))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        // 빈 칸을 모두 채웠지만 세법이 없다(TAX-65, TAX-75)
        putCard(mvc, owner, 2026, cardId, cardBody("가나카드", "2026-06-30",
                readVersion(mvc, owner, 2026, "$.cards[0].rowVersion"),
                12_000_000L, 1_000_000L, 500_000L, 500_000L, 2_000_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        putCash(mvc, owner, 2026, cashBody("2026-06-30", null, 1_000_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LAW_PENDING"))
                .andExpect(jsonPath("$.blankCount").value(0))
                .andExpect(jsonPath("$.law").value(nullValue()))
                .andExpect(jsonPath("$.planSaved").value(true))
                .andExpect(jsonPath("$.deduction").value(nullValue()))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        // 첫 버전이 적용되면 기다리던 연도 기록이 그 버전을 기억하고 계산된다.
        long lawId = TestTaxLaws.createApplied(mvc, admin, 2026);
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.law.id").value(lawId))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000))
                .andExpect(jsonPath("$.recommendation.difference").isNumber());
    }

    @Test
    void readyAnalysisShowsPrdExample1StepByStep() throws Exception {
        long lawId = TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        addExample1Statements(owner, "2026-06-30", "2026-06-30");

        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.blankCount").value(0))
                .andExpect(jsonPath("$.totals.creditGeneral").value(12_000_000))
                .andExpect(jsonPath("$.totals.cashGeneral").value(1_000_000))
                .andExpect(jsonPath("$.estimated").value(false))
                .andExpect(jsonPath("$.asOfDateMin").value("2026-06-30"))
                .andExpect(jsonPath("$.asOfDateMax").value("2026-06-30"))
                .andExpect(jsonPath("$.partialYear").value(false))
                .andExpect(jsonPath("$.law.id").value(lawId))
                .andExpect(jsonPath("$.law.versionNo").value(1))
                .andExpect(jsonPath("$.law.appliedAt").isString())
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.planSaved").value(false))
                .andExpect(jsonPath("$.recommendation").value(nullValue()))
                .andExpect(jsonPath("$.deduction.highBracket").value(false))
                .andExpect(jsonPath("$.deduction.credit").value(12_000_000))
                .andExpect(jsonPath("$.deduction.debitCash").value(3_000_000))
                .andExpect(jsonPath("$.deduction.culture").value(500_000))
                .andExpect(jsonPath("$.deduction.market").value(1_000_000))
                .andExpect(jsonPath("$.deduction.transit").value(500_000))
                .andExpect(jsonPath("$.deduction.total").value(17_000_000))
                .andExpect(jsonPath("$.deduction.threshold").value(10_000_000))
                .andExpect(jsonPath("$.deduction.thresholdReached").value(true))
                .andExpect(jsonPath("$.deduction.remainingToThreshold").value(0))
                .andExpect(jsonPath("$.deduction.beforeThresholdCut").value(3_450_000))
                .andExpect(jsonPath("$.deduction.thresholdCut").value(1_500_000))
                .andExpect(jsonPath("$.deduction.deductible").value(1_950_000))
                .andExpect(jsonPath("$.deduction.basicLimit").value(3_000_000))
                .andExpect(jsonPath("$.deduction.basicUsed").value(1_950_000))
                .andExpect(jsonPath("$.deduction.extraCap").value(3_000_000))
                .andExpect(jsonPath("$.deduction.extraEligible").value(750_000))
                .andExpect(jsonPath("$.deduction.extraUsed").value(0))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000));
    }

    @Test
    void savedPlanIsRecommendedOnceTheStatementsAreComplete() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        putYear(mvc, owner, 2026, yearBody(50_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
        // 현금영수증 자료가 없어 미완료다. 계획은 저장되지만 추천은 나오지 않는다(AC-43).
        addCard(mvc, owner, 2026, cardBody("가나카드", "2026-06-30", null,
                14_000_000L, 300_000L, 200_000L, 100_000L, 2_000_000L, 200_000L, 300_000L, 100_000L));
        putPlan(mvc, owner, 2026, wireframePlan()).andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INCOMPLETE"))
                .andExpect(jsonPath("$.blankCount").value(4))
                .andExpect(jsonPath("$.planSaved").value(true))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        putCash(mvc, owner, 2026, cashBody("2026-06-30", null, 500_000L, 100_000L, 0L, 0L))
                .andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.deduction.amount").value(1_475_000))
                .andExpect(jsonPath("$.recommendation.methodShare.creditPct").value(82.0))
                .andExpect(jsonPath("$.recommendation.methodShare.debitPct").value(14.6))
                .andExpect(jsonPath("$.recommendation.methodShare.cashPct").value(3.4))
                .andExpect(jsonPath("$.recommendation.current.allocation.general.credit").value(1_018_183))
                .andExpect(jsonPath("$.recommendation.current.allocation.general.debit").value(145_454))
                .andExpect(jsonPath("$.recommendation.current.allocation.general.cash").value(36_363))
                .andExpect(jsonPath("$.recommendation.current.allocation.market.credit").value(50_001))
                .andExpect(jsonPath("$.recommendation.current.allocation.transit.credit").value(0))
                .andExpect(jsonPath("$.recommendation.current.allocation.culture.debit").value(50_000))
                .andExpect(jsonPath("$.recommendation.current.yearEndDeduction").value(1_997_272))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.general.credit").value(0))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.general.debitCash").value(1_200_000))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.market.credit").value(50_001))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.market.debitCash").value(49_999))
                .andExpect(jsonPath("$.recommendation.recommended.yearEndDeduction").value(2_150_000))
                .andExpect(jsonPath("$.recommendation.difference").value(152_728))
                .andExpect(jsonPath("$.recommendation.reasons.length()").value(1))
                .andExpect(jsonPath("$.recommendation.reasons[0].code").value("CREDIT_OVER_THRESHOLD"))
                .andExpect(jsonPath("$.recommendation.reasons[0].category").value("GENERAL"))
                .andExpect(jsonPath("$.recommendation.reasons[0].amount").value(1_018_183));
    }

    @Test
    void partialYearAndMismatchedDatesAreFlaggedWithoutChangingTheAmount() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        putYear(mvc, owner, 2026, yearBody(40_000_000L, 3, 12, 0, null)).andExpect(status().isCreated());
        addExample1Statements(owner, "2026-06-30", "2026-05-31");

        // 근로기간이 전체가 아니고 기준일이 서로 달라도 입력한 금액 그대로 계산한다(AC-30, AC-31).
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.partialYear").value(true))
                .andExpect(jsonPath("$.estimated").value(true))
                .andExpect(jsonPath("$.asOfDateMin").value("2026-05-31"))
                .andExpect(jsonPath("$.asOfDateMax").value("2026-06-30"))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000));
    }

    @Test
    void calculationUsesTheLawVersionTheRecordRemembers() throws Exception {
        long first = TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        addExample1Statements(owner, "2026-06-30", "2026-06-30");

        // 신용카드 공제율만 20%로 올린 두 번째 버전을 적용한다.
        long second = TestTaxLaws.createDraft(mvc, admin, 2026);
        mvc.perform(put(TestTaxLaws.URL + "/" + second).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TestTaxLaws.values2026(0).replace("\"rateCreditPct\": 15", "\"rateCreditPct\": 20")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rateCreditPct").value(20));
        mvc.perform(post(TestTaxLaws.URL + "/" + second + "/apply").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":1}"))
                .andExpect(status().isOk());

        // 회원이 다시 계산하기 전에는 기억한 버전의 결과 그대로다(AC-19).
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.law.id").value(first))
                .andExpect(jsonPath("$.newerLawVersion").value(true))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000));

        mvc.perform(post(URL + "/2026/law-version/refresh").header("Authorization", owner.bearer()))
                .andExpect(status().isOk());
        // 2,400,000 + 900,000 + 150,000 + 400,000 + 200,000 − 1,000만×20% = 2,050,000
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.law.id").value(second))
                .andExpect(jsonPath("$.law.versionNo").value(2))
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.deduction.thresholdCut").value(2_000_000))
                .andExpect(jsonPath("$.deduction.amount").value(2_050_000));
    }

    @Test
    void readingTheAnalysisWritesNothing() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        putYear(mvc, owner, 2026, yearBody(50_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
        addWireframeStatements(owner);
        putPlan(mvc, owner, 2026, wireframePlan()).andExpect(status().isOk());
        String yearBefore = mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andReturn().getResponse().getContentAsString();
        List<String> stampsBefore = rowStamps();
        assertThat(stampsBefore).hasSize(4);

        String first = analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.difference").value(152_728))
                .andReturn().getResponse().getContentAsString();
        String again = analysis(owner, 2026).andReturn().getResponse().getContentAsString();

        // 결과는 저장하지 않고 볼 때마다 같은 값으로 다시 계산한다(TAX-44). rowVersion도 그대로다.
        assertThat(again).isEqualTo(first);
        assertThat(rowStamps()).isEqualTo(stampsBefore);
        assertThat(mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andReturn().getResponse().getContentAsString()).isEqualTo(yearBefore);
    }
}
