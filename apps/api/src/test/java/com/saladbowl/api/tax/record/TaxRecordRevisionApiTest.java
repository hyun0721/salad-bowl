package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxRecords.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Import(TestClock.Config.class)
class TaxRecordRevisionApiTest extends IntegrationTest {
    @Autowired MockMvc mvc;
    AuthedUser owner;
    long yearVersion;

    @BeforeEach
    void prepare() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "revision@example.test", "합성 회원");
        yearVersion = createYear(mvc, owner, 2026);
    }

    private static String cash(Long version, long amount) {
        return cashBody("2026-10-31", version, amount, 0L, 0L, 0L);
    }

    private static String plan(Long version, long amount) {
        return planBody(version, amount, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L);
    }

    @Test
    void oldVersionsCannotModifyOrDeleteRecreatedYear() throws Exception {
        long oldCash = version(putCash(mvc, owner, 2026, cash(null, 101)).andExpect(status().isOk()), "$.cashReceipt.rowVersion");
        long oldPlan = version(putPlan(mvc, owner, 2026, plan(null, 101)).andExpect(status().isOk()), "$.plan.rowVersion");
        mvc.perform(delete(URL + "/2026").param("rowVersion", Long.toString(yearVersion))
                .header("Authorization", owner.bearer())).andExpect(status().isNoContent());
        long newYear = createYear(mvc, owner, 2026);
        long newCash = version(putCash(mvc, owner, 2026, cash(null, 999)).andExpect(status().isOk()), "$.cashReceipt.rowVersion");
        long newPlan = version(putPlan(mvc, owner, 2026, plan(null, 999)).andExpect(status().isOk()), "$.plan.rowVersion");
        assertThat(newYear).isNotEqualTo(yearVersion);
        assertThat(newCash).isNotEqualTo(oldCash);
        assertThat(newPlan).isNotEqualTo(oldPlan);

        putYear(mvc, owner, 2026, yearBody(41_000_000L, 1, 12, 0, yearVersion))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
        putCash(mvc, owner, 2026, cash(oldCash, 101))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
        putPlan(mvc, owner, 2026, plan(oldPlan, 101))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(delete(URL + "/2026").param("rowVersion", Long.toString(yearVersion))
                .header("Authorization", owner.bearer()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rowVersion").value(newYear))
                .andExpect(jsonPath("$.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(999))
                .andExpect(jsonPath("$.cashReceipt.rowVersion").value(newCash))
                .andExpect(jsonPath("$.plan.general.creditFixed").value(999))
                .andExpect(jsonPath("$.plan.rowVersion").value(newPlan));
    }

    @Test
    void deleteRequiresAValidMatchingYearVersion() throws Exception {
        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        for (String invalid : new String[]{"", "abc", "1.5", "1e0", "9223372036854775808"}) {
            mvc.perform(delete(URL + "/2026").param("rowVersion", invalid).header("Authorization", owner.bearer()))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        mvc.perform(delete(URL + "/2026").param("rowVersion", "-1").header("Authorization", owner.bearer()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(delete(URL + "/2026").param("rowVersion", Long.toString(yearVersion)).header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(delete(URL + "/2026").param("rowVersion", Long.toString(yearVersion)).header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void identicalSavesStillIssueNewVersions() throws Exception {
        long nextYear = version(putYear(mvc, owner, 2026, yearBody(40_000_000L, 1, 12, 0, yearVersion))
                .andExpect(status().isOk()), "$.rowVersion");
        long firstCash = version(putCash(mvc, owner, 2026, cash(null, 101)).andExpect(status().isOk()), "$.cashReceipt.rowVersion");
        long nextCash = version(putCash(mvc, owner, 2026, cash(firstCash, 101)).andExpect(status().isOk()), "$.cashReceipt.rowVersion");
        long firstPlan = version(putPlan(mvc, owner, 2026, plan(null, 101)).andExpect(status().isOk()), "$.plan.rowVersion");
        long nextPlan = version(putPlan(mvc, owner, 2026, plan(firstPlan, 101)).andExpect(status().isOk()), "$.plan.rowVersion");
        assertThat(nextYear).isNotEqualTo(yearVersion);
        assertThat(nextCash).isNotEqualTo(firstCash);
        assertThat(nextPlan).isNotEqualTo(firstPlan);
    }

    @Test
    void nulInIssuerOrMemoIsRejectedBeforeInsertAndUpdate() throws Exception {
        String valid = cardBody("합성카드", "2026-10-31", null, 101L, 0L, 0L, 0L, 0L, 0L, 0L, 0L);
        // JSON escape가 디코딩된 뒤의 NUL을 검사한다. 앞뒤 NUL도 trim으로 숨기지 않는다.
        for (String nul : new String[]{"\\u0000abc", "ab\\u0000cd", "abc\\u0000"}) {
            for (String bad : new String[]{valid.replace("합성카드", nul), valid.replace("\"issuerName\"", "\"memo\":\"" + nul + "\",\"issuerName\"")}) {
                postCard(mvc, owner, 2026, bad).andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
            }
            putCash(mvc, owner, 2026, cash(null, 101).replace("\"asOfDate\"", "\"memo\":\"" + nul + "\",\"asOfDate\""))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards").isEmpty()).andExpect(jsonPath("$.cashReceipt").isEmpty());
        long card = addCard(mvc, owner, 2026, valid);
        long cardVersion = readVersion(mvc, owner, 2026, "$.cards[0].rowVersion");
        long cashVersion = version(putCash(mvc, owner, 2026, cash(null, 101)).andExpect(status().isOk()), "$.cashReceipt.rowVersion");
        String update = valid.replace("\"rowVersion\": null", "\"rowVersion\": " + cardVersion);
        for (String bad : new String[]{update.replace("합성카드", "ab\\u0000cd"), update.replace("\"issuerName\"", "\"memo\":\"ab\\u0000cd\",\"issuerName\"")}) {
            putCard(mvc, owner, 2026, card, bad).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        putCash(mvc, owner, 2026, cash(cashVersion, 999).replace("\"asOfDate\"", "\"memo\":\"ab\\u0000cd\",\"asOfDate\""))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards[0].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.cards[0].rowVersion").value(cardVersion))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(101))
                .andExpect(jsonPath("$.cashReceipt.rowVersion").value(cashVersion));
    }
}
