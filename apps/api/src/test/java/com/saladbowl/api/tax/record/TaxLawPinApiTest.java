package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestTaxLaws;
import com.saladbowl.api.tax.law.TaxLawConcurrencyTest;
import com.saladbowl.api.tax.law.TaxLawService;
import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.putYear;
import static com.saladbowl.api.support.TestTaxRecords.yearBody;
import static com.saladbowl.api.support.TestTaxRecords.version;
import static org.hamcrest.Matchers.not;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 연도 기록이 기억하는 세법 버전과 다시 계산(TAX-66, AC-19, 알려진 제약 7번). 테스트의 올해는 2026이다. */
@Import(TestClock.Config.class)
class TaxLawPinApiTest extends IntegrationTest {

    private static final String REFRESH = "/law-version/refresh";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TaxLawService laws;

    @Autowired
    TaxRecordService records;

    AuthedUser admin;
    AuthedUser owner;

    @BeforeEach
    void signUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@example.test", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
    }

    private Long pinnedLawId(long ownerId, int year) {
        return jdbc.queryForObject("SELECT law_version_id FROM tax_year_records WHERE owner_id = ? AND tax_year = ?",
                Long.class, ownerId, year);
    }

    @Test
    void newerVersionIsOnlyAnnouncedUntilTheMemberRefreshes() throws Exception {
        long first = TestTaxLaws.createApplied(mvc, admin, 2026);
        long initial = createYear(mvc, owner, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.lawVersion.id").value(first))
                .andExpect(jsonPath("$.newerLawVersion").value(false));

        // 초안은 회원에게 영향이 없다.
        long second = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.newerLawVersion").value(false));

        mvc.perform(post(TestTaxLaws.URL + "/" + second + "/apply").header("Authorization", admin.bearer())
                        .contentType("application/json").content("{\"rowVersion\":1}"))
                .andExpect(status().isOk());
        // 새 버전이 적용돼도 연도 기록의 버전은 그대로이고 알림만 켜진다(AC-19).
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.lawVersion.id").value(first))
                .andExpect(jsonPath("$.lawVersion.versionNo").value(1))
                .andExpect(jsonPath("$.newerLawVersion").value(true))
                .andExpect(jsonPath("$.rowVersion").value(initial));
        assertThat(pinnedLawId(owner.id(), 2026)).isEqualTo(first);

        var refreshed = mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion.id").value(second))
                .andExpect(jsonPath("$.lawVersion.versionNo").value(2))
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.rowVersion").value(not(initial), Long.class));
        // 같은 세법을 다시 저장해도 새 rowVersion을 받는다.
        mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion.id").value(second))
                .andExpect(jsonPath("$.rowVersion").value(not(version(refreshed, "$.rowVersion")), Long.class));
    }

    @Test
    void firstAppliedVersionReachesWaitingRecordsOfThatYearOnly() throws Exception {
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@example.test", "다른 회원");
        createYear(mvc, owner, 2025);
        long initial = createYear(mvc, owner, 2026);
        createYear(mvc, other, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.lawVersion").value(nullValue()))
                .andExpect(jsonPath("$.newerLawVersion").value(false));

        long lawId = TestTaxLaws.createApplied(mvc, admin, 2026);

        // 회원이 누르지 않아도 "세법 준비 중"이 풀린다. 다른 귀속연도의 기록은 그대로다.
        for (AuthedUser member : new AuthedUser[]{owner, other}) {
            mvc.perform(get(URL + "/2026").header("Authorization", member.bearer()))
                    .andExpect(jsonPath("$.lawVersion.id").value(lawId))
                    .andExpect(jsonPath("$.newerLawVersion").value(false));
        }
        assertThat(pinnedLawId(owner.id(), 2025)).isNull();
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.rowVersion").value(initial));
        // 세법 버전을 채워도 기본정보의 rowVersion은 오르지 않는다. 열어 둔 화면의 저장이 409가 되지 않는다.
        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, initial))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion.id").value(lawId));
    }

    @Test
    void refreshWithoutAnAppliedVersionKeepsTheRecordWaiting() throws Exception {
        long initial = createYear(mvc, owner, 2026);
        TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion").value(nullValue()))
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.rowVersion").value(not(initial), Long.class));
    }

    @Test
    void refreshReachesOnlyTheRequestersOwnYear() throws Exception {
        long first = TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        TestTaxLaws.createApplied(mvc, admin, 2026);

        // 연도 기록이 없는 회원(서비스 관리자 포함)은 404이고 남의 기록은 바뀌지 않는다.
        mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(post(URL + "/2026" + REFRESH)).andExpect(status().isUnauthorized());

        assertThat(pinnedLawId(owner.id(), 2026)).isEqualTo(first);
    }

    /** 첫 버전 적용과 연도 기록 만들기가 겹쳐도 세법 버전 없이 남는 기록이 없어야 한다. */
    @Test
    void recordsCreatedWhileTheFirstVersionIsBeingAppliedStillGetIt() throws Exception {
        List<AuthedUser> members = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            members.add(TestAuth.signupAndLogin(mvc, "member" + i + "@example.test", "회원" + i));
        }
        YearRequest request = new YearRequest(40_000_000L, 1, 12, 0, null);
        for (int round = 0; round < 10; round++) {
            jdbc.update("DELETE FROM tax_year_records");
            jdbc.update("DELETE FROM tax_law_versions");
            long lawId = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
            List<Callable<String>> calls = new ArrayList<>();
            calls.add(() -> {
                laws.apply(admin.id(), lawId, 1L);
                return "APPLIED";
            });
            for (AuthedUser member : members) {
                calls.add(() -> {
                    records.saveYear(member.id(), 2026, request);
                    return "CREATED";
                });
            }

            List<String> results = TaxLawConcurrencyTest.runTogether(calls);

            assertThat(results).as("round %d", round)
                    .containsExactly("APPLIED", "CREATED", "CREATED", "CREATED", "CREATED");
            assertThat(jdbc.queryForList("SELECT law_version_id FROM tax_year_records", Long.class))
                    .as("round %d", round).containsOnly(lawId).hasSize(4);
        }
    }
}
