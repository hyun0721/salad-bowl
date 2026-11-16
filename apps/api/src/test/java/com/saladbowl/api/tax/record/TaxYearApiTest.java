package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestGroups;
import com.saladbowl.api.support.TestTaxLaws;
import com.saladbowl.api.tax.law.TaxLawConcurrencyTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.putYear;
import static com.saladbowl.api.support.TestTaxRecords.yearBody;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 연도 기록 만들기·조회·수정·삭제와 소유권
 * (TAX-01, 02, 03, 20, 28, 29, 65, AC-01, 02, 03, 15, 20, 22, 30, 33). 테스트의 올해는 2026이다.
 */
@Import(TestClock.Config.class)
class TaxYearApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TestClock clock;

    AuthedUser owner;

    @BeforeEach
    void signUp() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
    }

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    private int rowCount(long ownerId) {
        return jdbc.queryForObject("SELECT count(*) FROM tax_year_records WHERE owner_id = ?", Integer.class, ownerId);
    }

    private long salaryOf(long ownerId, int year) {
        return jdbc.queryForObject("SELECT total_salary FROM tax_year_records WHERE owner_id = ? AND tax_year = ?",
                Long.class, ownerId, year);
    }

    @Test
    void memberWithoutAGroupCreatesAndReadsOwnYear() throws Exception {
        putYear(mvc, owner, 2026, yearBody(40_000_000L, 3, 12, 1, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.taxYear").value(2026))
                .andExpect(jsonPath("$.rowVersion").value(0))
                .andExpect(jsonPath("$.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.workStartMonth").value(3))
                .andExpect(jsonPath("$.workEndMonth").value(12))
                .andExpect(jsonPath("$.childCount").value(1))
                // 적용된 세법 버전이 없는 연도도 저장된다(TAX-65, AC-20).
                .andExpect(jsonPath("$.lawVersion").value(nullValue()));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.workStartMonth").value(3));
    }

    @Test
    void missingYearIsNotFound() throws Exception {
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void groupMembershipDoesNotChangeAccess() throws Exception {
        createYear(mvc, owner, 2026);
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@example.test", "그룹장");
        long groupId = TestGroups.createGroup(mvc, groupAdmin, "합성 그룹");

        TestGroups.join(mvc, groupAdmin, owner, groupId);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000));

        mvc.perform(delete("/groups/" + groupId + "/members/me").header("Authorization", owner.bearer()))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000));
    }

    @Test
    void sharingMemberGroupAdminAndServiceAdminCannotReachAnotherMembersYear() throws Exception {
        createYear(mvc, owner, 2026);
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@example.test", "그룹장");
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@example.test", "멤버");
        AuthedUser serviceAdmin = TestAuth.signupAndLogin(mvc, "service-admin@example.test", "관리자");
        TestAdmins.grant(jdbc, serviceAdmin.id());
        long groupId = TestGroups.createGroup(mvc, groupAdmin, "합성 그룹");
        TestGroups.join(mvc, groupAdmin, owner, groupId);
        TestGroups.join(mvc, groupAdmin, member, groupId);
        for (AuthedUser sharing : new AuthedUser[]{owner, member}) {
            mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", sharing.bearer())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
                    .andExpect(status().is2xxSuccessful());
        }

        // 경로에 회원 id가 없다. 같은 주소는 항상 요청자의 자료이고, 요청자에게 그 연도 기록이 없으면 404다.
        for (AuthedUser other : new AuthedUser[]{groupAdmin, member, serviceAdmin}) {
            mvc.perform(get(URL + "/2026").header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
            putYear(mvc, other, 2026, yearBody(1L, 1, 1, 0, 0L)).andExpect(status().isNotFound());
            mvc.perform(delete(URL + "/2026").header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound());
        }
        assertThat(salaryOf(owner.id(), 2026)).isEqualTo(40_000_000L);

        // 다른 회원이 같은 연도를 만들면 자기 기록이 따로 생기고 서로의 값이 섞이지 않는다.
        putYear(mvc, serviceAdmin, 2026, yearBody(90_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
        mvc.perform(get(URL + "/2026").header("Authorization", serviceAdmin.bearer()))
                .andExpect(jsonPath("$.totalSalary").value(90_000_000));
        mvc.perform(delete(URL + "/2026").header("Authorization", serviceAdmin.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000));
        assertThat(rowCount(owner.id())).isEqualTo(1);
    }

    @Test
    void savingAgainWithRowVersionUpdatesTheOneRecord() throws Exception {
        createYear(mvc, owner, 2026);

        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 2, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(52_000_000))
                .andExpect(jsonPath("$.childCount").value(2))
                .andExpect(jsonPath("$.rowVersion").value(1));

        assertThat(rowCount(owner.id())).isEqualTo(1);
    }

    @Test
    void creatingAnExistingYearIsConflictAndKeepsTheFirstValues() throws Exception {
        createYear(mvc, owner, 2026);

        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        assertThat(rowCount(owner.id())).isEqualTo(1);
        assertThat(salaryOf(owner.id(), 2026)).isEqualTo(40_000_000L);
    }

    @Test
    void creatingTheSameYearTwiceAtOnceKeepsOneRecord() throws Exception {
        List<Callable<String>> calls = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            long salary = 40_000_000L + i;
            calls.add(() -> Integer.toString(putYear(mvc, owner, 2026, yearBody(salary, 1, 12, 0, null))
                    .andReturn().getResponse().getStatus()));
        }

        List<String> results = TaxLawConcurrencyTest.runTogether(calls);

        // 먼저 만든 요청만 201이고 나머지는 UNIQUE (owner_id, tax_year) 위반 또는 rowVersion 없음으로 409다.
        assertThat(results).containsExactlyInAnyOrder("201", "409", "409", "409");
        assertThat(rowCount(owner.id())).isEqualTo(1);
    }

    @Test
    void staleRowVersionIsConflictAndKeepsTheFirstSave() throws Exception {
        createYear(mvc, owner, 2026);
        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, 0L)).andExpect(status().isOk());

        putYear(mvc, owner, 2026, yearBody(61_000_000L, 1, 12, 0, 0L))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        assertThat(salaryOf(owner.id(), 2026)).isEqualTo(52_000_000L);
    }

    @Test
    void updatingAYearDeletedElsewhereIsNotFoundAndDoesNotRecreateIt() throws Exception {
        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, 0L)).andExpect(status().isNotFound());

        assertThat(rowCount(owner.id())).isZero();
    }

    @Test
    void rejectsInvalidBasicInfo() throws Exception {
        String[] invalid = {
                yearBody(40_000_000L, 7, 6, 0, null),              // 시작월 > 종료월
                yearBody(0L, 1, 12, 0, null),                      // 총급여 0
                yearBody(-1L, 1, 12, 0, null),
                yearBody(10_000_000_000_000L, 1, 12, 0, null),     // 상한 초과
                yearBody(40_000_000L, 0, 12, 0, null),
                yearBody(40_000_000L, 1, 13, 0, null),
                yearBody(40_000_000L, 1, 12, -1, null),
                "{\"workStartMonth\": 1, \"workEndMonth\": 12, \"childCount\": 0}",
                "{\"totalSalary\": 40000000, \"workStartMonth\": 1, \"workEndMonth\": 12}",
                "{\"totalSalary\": 40000000.7, \"workStartMonth\": 1, \"workEndMonth\": 12, \"childCount\": 0}",
                "{\"totalSalary\": 40000000, \"workStartMonth\": 1.9, \"workEndMonth\": 12, \"childCount\": 0}",
                "{\"totalSalary\": 40000000, \"workStartMonth\": 1, \"workEndMonth\": 12.9, \"childCount\": 0}",
                "{\"totalSalary\": 40000000, \"workStartMonth\": 1, \"workEndMonth\": 12, \"childCount\": 1.9}",
                "{\"totalSalary\": 40000000, \"workStartMonth\": 1, \"workEndMonth\": 12, \"childCount\": 0,"
                        + " \"rowVersion\": 0.5}",
                ""
        };
        for (String body : invalid) {
            putYear(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(rowCount(owner.id())).isZero();
    }

    @Test
    void onlyThisYearAndItsNeighborsCanBeCreated() throws Exception {
        for (int year : new int[]{2024, 2028, 1000, 9999}) {
            putYear(mvc, owner, year, yearBody(40_000_000L, 1, 12, 0, null))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String year : new String[]{"999", "10000", "abc", "2026.5"}) {
            mvc.perform(put(URL + "/" + year).header("Authorization", owner.bearer())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(yearBody(40_000_000L, 1, 12, 0, null)))
                    .andExpect(status().isBadRequest());
        }
        for (int year : new int[]{2025, 2026, 2027}) {
            createYear(mvc, owner, year);
        }
        assertThat(rowCount(owner.id())).isEqualTo(3);
    }

    @Test
    void thisYearFollowsKoreanTimeAndOlderRecordsStayEditable() throws Exception {
        createYear(mvc, owner, 2025);
        // UTC로는 2026-12-31 15:30, 한국 시각으로는 2027-01-01 00:30이다.
        clock.set(Instant.parse("2026-12-31T15:30:00Z"));

        createYear(mvc, owner, 2028);
        putYear(mvc, owner, 2024, yearBody(40_000_000L, 1, 12, 0, null)).andExpect(status().isBadRequest());

        // 연도 범위는 만들 때만 본다. 범위를 벗어난 뒤에도 이미 있는 기록은 고치고 지울 수 있다.
        clock.set(Instant.parse("2028-06-15T03:00:00Z"));
        putYear(mvc, owner, 2025, yearBody(45_000_000L, 1, 12, 0, 0L)).andExpect(status().isOk());
        mvc.perform(delete(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteRemovesOnlyThatYear() throws Exception {
        createYear(mvc, owner, 2025);
        createYear(mvc, owner, 2026);

        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taxYear").value(2025));
        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void newYearRemembersTheCurrentLawVersion() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@example.test", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        long lawId = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(post(TestTaxLaws.URL + "/" + lawId + "/apply").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":1}"))
                .andExpect(status().isOk());

        putYear(mvc, owner, 2026, yearBody(40_000_000L, 1, 12, 0, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lawVersion.id").value(lawId))
                .andExpect(jsonPath("$.lawVersion.versionNo").value(1))
                .andExpect(jsonPath("$.lawVersion.appliedAt").isNotEmpty())
                // 2026 값은 자녀등 단계별 기본한도가 서로 다르다.
                .andExpect(jsonPath("$.lawVersion.childTiersApply").value(true));

        // 세법이 없는 다른 연도는 그대로 비어 있다.
        putYear(mvc, owner, 2025, yearBody(40_000_000L, 1, 12, 0, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lawVersion").value(nullValue()));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(URL + "/2026")).andExpect(status().isUnauthorized());
        mvc.perform(put(URL + "/2026").contentType(MediaType.APPLICATION_JSON)
                        .content(yearBody(40_000_000L, 1, 12, 0, null)))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(URL + "/2026")).andExpect(status().isUnauthorized());
    }
}
