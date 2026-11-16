package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.addCard;
import static com.saladbowl.api.support.TestTaxRecords.cardBody;
import static com.saladbowl.api.support.TestTaxRecords.cashBody;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.postCard;
import static com.saladbowl.api.support.TestTaxRecords.putCard;
import static com.saladbowl.api.support.TestTaxRecords.putCash;
import static com.saladbowl.api.support.TestTaxRecords.version;
import static org.hamcrest.Matchers.not;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 카드 자료·현금영수증 자료와 연도 합계
 * (TAX-21, 22, 23, 24, 26, 27, 28, 29, AC-01, 14, 15, 22, 28, 31, 33, 37). 금액은 모두 합성값이고 테스트의 올해는 2026이다.
 */
@Import(TestClock.Config.class)
class TaxStatementApiTest extends IntegrationTest {

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

    /** 신용카드 1,000,000 / 200,000 / 50,000 / 30,000, 체크카드 400,000 / 100,000 / 20,000 / 10,000. */
    private static String fullCard(String issuerName, String asOfDate, Long rowVersion) {
        return cardBody(issuerName, asOfDate, rowVersion,
                1_000_000L, 200_000L, 50_000L, 30_000L, 400_000L, 100_000L, 20_000L, 10_000L);
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    private long creditGeneralOf(long cardId) {
        return jdbc.queryForObject("SELECT credit_general FROM tax_card_statements WHERE id = ?", Long.class, cardId);
    }

    @Test
    void yearWithoutStatementsIsIncompleteWithZeroTotals() throws Exception {
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards", hasSize(0)))
                .andExpect(jsonPath("$.cashReceipt").value(nullValue()))
                .andExpect(jsonPath("$.hasInputs").value(false))
                // 현금영수증 자료를 한 번도 입력하지 않았으므로 4칸이 비어 있다(TAX-24).
                .andExpect(jsonPath("$.blankCount").value(4))
                .andExpect(jsonPath("$.asOfDateMismatch").value(false))
                .andExpect(jsonPath("$.totals.creditGeneral").value(0))
                .andExpect(jsonPath("$.totals.cashCulture").value(0));
    }

    @Test
    void addingACardReturnsTheYearViewWithIt() throws Exception {
        postCard(mvc, owner, 2026, """
                {"issuerName": "  합성카드  ", "asOfDate": "2026-10-31", "memo": "  10월 말 누계  ", "amounts": {
                  "creditGeneral": 1000000, "creditMarket": 200000, "creditTransit": 50000, "creditCulture": 30000,
                  "debitGeneral": 400000, "debitMarket": 100000, "debitTransit": 20000, "debitCulture": 10000}}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.cards[0].id").isNumber())
                .andExpect(jsonPath("$.cards[0].rowVersion").value(0))
                .andExpect(jsonPath("$.cards[0].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.cards[0].asOfDate").value("2026-10-31"))
                .andExpect(jsonPath("$.cards[0].memo").value("10월 말 누계"))
                .andExpect(jsonPath("$.cards[0].amounts.creditGeneral").value(1_000_000))
                .andExpect(jsonPath("$.cards[0].amounts.debitCulture").value(10_000))
                .andExpect(jsonPath("$.cards[0].blankCount").value(0))
                .andExpect(jsonPath("$.hasInputs").value(true))
                .andExpect(jsonPath("$.blankCount").value(4))
                // 카드 자료를 더해도 연도 기록(기본정보)의 rowVersion은 그대로다. 비교 단위는 행 하나다.
                .andExpect(jsonPath("$.rowVersion").value(yearVersion));
    }

    @Test
    void sameIssuerNameCanBeSavedTwice() throws Exception {
        addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(2)))
                .andExpect(jsonPath("$.cards[0].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.cards[1].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.totals.creditGeneral").value(2_000_000));
    }

    @Test
    void blankAndZeroAreDifferentAndFillingZerosCompletesTheYear() throws Exception {
        long cardId = addCard(mvc, owner, 2026, cardBody("합성카드", "2026-10-31", null,
                1_000_000L, null, 0L, null, 400_000L, 0L, null, 0L));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards[0].amounts.creditMarket").value(nullValue()))
                .andExpect(jsonPath("$.cards[0].amounts.creditTransit").value(0))
                .andExpect(jsonPath("$.cards[0].blankCount").value(3))
                .andExpect(jsonPath("$.blankCount").value(7))
                // 미입력 칸은 합계에서 0으로 더한다.
                .andExpect(jsonPath("$.totals.creditGeneral").value(1_000_000))
                .andExpect(jsonPath("$.totals.creditMarket").value(0));

        putCard(mvc, owner, 2026, cardId, cardBody("합성카드", "2026-10-31", 0L,
                1_000_000L, 0L, 0L, 0L, 400_000L, 0L, 0L, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[0].blankCount").value(0))
                .andExpect(jsonPath("$.blankCount").value(4));

        var savedCash = putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 0L, null, 0L, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.blankCount").value(1))
                .andExpect(jsonPath("$.blankCount").value(1));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", version(savedCash, "$.cashReceipt.rowVersion"), 0L, 0L, 0L, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.blankCount").value(0))
                .andExpect(jsonPath("$.blankCount").value(0));
    }

    @Test
    void totalsAreTheSumOfThatYearsStatementsOnly() throws Exception {
        createYear(mvc, owner, 2025);
        addCard(mvc, owner, 2025, cardBody("작년카드", "2025-12-31", null,
                7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L));
        putCash(mvc, owner, 2025, cashBody("2025-12-31", null, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L))
                .andExpect(status().isOk());
        long first = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        long second = addCard(mvc, owner, 2026, cardBody("가상카드", "2026-10-31", null,
                500_000L, 0L, 70_000L, 0L, 250_000L, 30_000L, 0L, 5_000L));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 40_000L, 0L, 8_000L))
                .andExpect(status().isOk());

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.totals.creditGeneral").value(1_500_000))
                .andExpect(jsonPath("$.totals.creditMarket").value(200_000))
                .andExpect(jsonPath("$.totals.creditTransit").value(120_000))
                .andExpect(jsonPath("$.totals.creditCulture").value(30_000))
                .andExpect(jsonPath("$.totals.debitGeneral").value(650_000))
                .andExpect(jsonPath("$.totals.debitMarket").value(130_000))
                .andExpect(jsonPath("$.totals.debitTransit").value(20_000))
                .andExpect(jsonPath("$.totals.debitCulture").value(15_000))
                .andExpect(jsonPath("$.totals.cashGeneral").value(120_000))
                .andExpect(jsonPath("$.totals.cashMarket").value(40_000))
                .andExpect(jsonPath("$.totals.cashTransit").value(0))
                .andExpect(jsonPath("$.totals.cashCulture").value(8_000));

        // 수정은 덮어쓰기다. 이전 값에 더하지 않는다.
        putCard(mvc, owner, 2026, second, cardBody("가상카드", "2026-10-31", 0L,
                600_000L, 0L, 70_000L, 0L, 250_000L, 30_000L, 0L, 5_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.creditGeneral").value(1_600_000));

        // 한 건을 지우면 그 자료의 금액만 빠진다(AC-22).
        mvc.perform(delete(URL + "/2026/cards/" + first).param("rowVersion", "0")
                        .header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.totals.creditGeneral").value(600_000))
                .andExpect(jsonPath("$.totals.creditMarket").value(0))
                .andExpect(jsonPath("$.totals.debitGeneral").value(250_000))
                .andExpect(jsonPath("$.totals.cashGeneral").value(120_000));
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.totals.creditGeneral").value(7_000_000));
    }

    @Test
    void cashReceiptIsOnePerYearAndCannotBeDeleted() throws Exception {
        var savedCash = putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 40_000L, 0L, 8_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.rowVersion").isNumber())
                .andExpect(jsonPath("$.cashReceipt.asOfDate").value("2026-10-31"))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(120_000))
                .andExpect(jsonPath("$.hasInputs").value(true));
        putCash(mvc, owner, 2026, cashBody("2026-11-30", version(savedCash, "$.cashReceipt.rowVersion"), 150_000L, 40_000L, 0L, 8_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.rowVersion").value(not(version(savedCash, "$.cashReceipt.rowVersion")), Long.class))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(150_000));
        assertThat(count("tax_cash_receipts")).isEqualTo(1);

        // 삭제 경로가 없다(D19, AC-37).
        mvc.perform(delete(URL + "/2026/cash-receipt").header("Authorization", owner.bearer()))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(post(URL + "/2026/cash-receipt").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashBody("2026-11-30", 1L, 0L, 0L, 0L, 0L)))
                .andExpect(status().isMethodNotAllowed());
        assertThat(count("tax_cash_receipts")).isEqualTo(1);
    }

    @Test
    void staleCashReceiptSaveIsConflictAndKeepsTheFirstSave() throws Exception {
        // 아직 없는 자료를 고치려는 요청(rowVersion 있음)은 만들지 않는다.
        putCash(mvc, owner, 2026, cashBody("2026-10-31", 0L, 1L, 1L, 1L, 1L)).andExpect(status().isConflict());
        assertThat(count("tax_cash_receipts")).isZero();

        var savedCash = putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        putCash(mvc, owner, 2026, cashBody("2026-10-31", version(savedCash, "$.cashReceipt.rowVersion"), 150_000L, 0L, 0L, 0L)).andExpect(status().isOk());

        // 옛 rowVersion, 그리고 이미 있는데 새로 만들려는 요청(rowVersion 없음) 모두 409다.
        for (Long stale : new Long[]{version(savedCash, "$.cashReceipt.rowVersion"), null}) {
            putCash(mvc, owner, 2026, cashBody("2026-10-31", stale, 999_000L, 0L, 0L, 0L))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("CONFLICT"));
        }
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(150_000))
                .andExpect(jsonPath("$.cashReceipt.rowVersion").value(not(version(savedCash, "$.cashReceipt.rowVersion")), Long.class));
    }

    @Test
    void staleCardSaveOrDeleteIsConflictAndKeepsTheFirstSave() throws Exception {
        long cardId = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        putCard(mvc, owner, 2026, cardId, cardBody("합성카드", "2026-11-30", 0L,
                1_300_000L, 200_000L, 50_000L, 30_000L, 400_000L, 100_000L, 20_000L, 10_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[0].rowVersion").value(1));

        for (Long stale : new Long[]{0L, null}) {
            putCard(mvc, owner, 2026, cardId, fullCard("합성카드", "2026-10-31", stale))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("CONFLICT"));
        }
        mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "0")
                        .header("Authorization", owner.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        for (String invalid : new String[]{"", "wrong", "1.5"}) {
            mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", invalid)
                            .header("Authorization", owner.bearer()))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(delete(URL + "/2026/cards/" + cardId).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest());
        assertThat(creditGeneralOf(cardId)).isEqualTo(1_300_000L);

        mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "1")
                        .header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());
        assertThat(count("tax_card_statements")).isZero();
    }

    @Test
    void asOfDateMismatchIsReportedOnlyWhenDatesDiffer() throws Exception {
        addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        long second = addCard(mvc, owner, 2026, fullCard("가상카드", "2026-10-31", null));
        var savedCash = putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 0L, 0L, 0L, 0L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(false));

        putCard(mvc, owner, 2026, second, fullCard("가상카드", "2026-11-30", 0L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(true));
        putCard(mvc, owner, 2026, second, fullCard("가상카드", "2026-10-31", 1L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(false));
        // 현금영수증 자료의 기준일만 달라도 불일치다.
        putCash(mvc, owner, 2026, cashBody("2026-09-30", version(savedCash, "$.cashReceipt.rowVersion"), 0L, 0L, 0L, 0L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(true));
    }

    @Test
    void rejectsInvalidStatements() throws Exception {
        String fifty = "가".repeat(50);
        addCard(mvc, owner, 2026, fullCard("  " + fifty + "  ", "2026-01-01", null));
        addCard(mvc, owner, 2026, fullCard("연말카드", "2026-12-31", null));

        String[] invalidCards = {
                fullCard("   ", "2026-10-31", null),
                fullCard("\u3000\u3000", "2026-10-31", null),
                fullCard(fifty + "가", "2026-10-31", null),
                fullCard("합성카드", "2025-12-31", null),
                fullCard("합성카드", "2027-01-01", null),
                fullCard("합성카드", "2026-02-30", null),
                cardBody("합성카드", "2026-10-31", null, -1L, 0L, 0L, 0L, 0L, 0L, 0L, 0L),
                cardBody("합성카드", "2026-10-31", null, 0L, 0L, 0L, 0L, 0L, 0L, 0L, MAX + 1),
                fullCard("합성카드", "2026-10-31", null).replace("1000000,", "1000000.5,"),
                "{\"asOfDate\": \"2026-10-31\", \"amounts\": {}}",
                "{\"issuerName\": \"합성카드\", \"amounts\": {}}",
                "{\"issuerName\": \"합성카드\", \"asOfDate\": \"2026-10-31\"}",
                "{\"issuerName\": \"합성카드\", \"asOfDate\": \"2026-10-31\", \"amounts\": {}, \"memo\": \""
                        + "가".repeat(201) + "\"}"
        };
        for (String body : invalidCards) {
            postCard(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(count("tax_card_statements")).isEqualTo(2);

        String[] invalidCash = {
                cashBody("2025-12-31", null, 0L, 0L, 0L, 0L),
                cashBody("2026-10-31", null, -1L, 0L, 0L, 0L),
                cashBody("2026-10-31", null, 0L, 0L, 0L, MAX + 1),
                "{\"amounts\": {}}",
                "{\"asOfDate\": \"2026-10-31\"}"
        };
        for (String body : invalidCash) {
            putCash(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(count("tax_cash_receipts")).isZero();

        // 금액 칸은 비워 둘 수 있고(8칸 모두 미입력), 한 칸의 상한은 9,999,999,999,999원이다.
        postCard(mvc, owner, 2026, "{\"issuerName\": \"빈카드\", \"asOfDate\": \"2026-10-31\", \"amounts\": {}}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cards[2].blankCount").value(8));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, MAX, 0L, 0L, 0L)).andExpect(status().isOk());
    }

    @Test
    void yearTotalAboveTheLimitIsRejectedAndRolledBack() throws Exception {
        long first = addCard(mvc, owner, 2026, cardBody("합성카드", "2026-10-31", null,
                MAX, 0L, 0L, 0L, 0L, 0L, 0L, 0L));

        postCard(mvc, owner, 2026, cardBody("가상카드", "2026-10-31", null, 1L, 0L, 0L, 0L, 0L, 0L, 0L, 0L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        assertThat(count("tax_card_statements")).isEqualTo(1);

        long second = addCard(mvc, owner, 2026, cardBody("가상카드", "2026-10-31", null,
                0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));
        putCard(mvc, owner, 2026, second, cardBody("가상카드", "2026-10-31", 0L, 1L, 0L, 0L, 0L, 0L, 0L, 0L, 0L))
                .andExpect(status().isBadRequest());
        assertThat(creditGeneralOf(second)).isZero();
        assertThat(creditGeneralOf(first)).isEqualTo(MAX);
    }

    @Test
    void deletingTheYearDeletesItsStatementsOnly() throws Exception {
        createYear(mvc, owner, 2025);
        long oldCard = addCard(mvc, owner, 2025, fullCard("작년카드", "2025-12-31", null));
        putCash(mvc, owner, 2025, cashBody("2025-12-31", null, 0L, 0L, 0L, 0L)).andExpect(status().isOk());
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@example.test", "다른 회원");
        createYear(mvc, other, 2026);
        long otherCard = addCard(mvc, other, 2026, fullCard("다른카드", "2026-10-31", null));
        putCash(mvc, other, 2026, cashBody("2026-10-31", null, 9L, 0L, 0L, 0L)).andExpect(status().isOk());
        long deletedCard = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        long deletedCard2 = addCard(mvc, owner, 2026, fullCard("가상카드", "2026-10-31", null));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 0L, 0L, 0L, 0L)).andExpect(status().isOk());

        mvc.perform(delete(URL + "/2026").param("rowVersion", Long.toString(yearVersion)).header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());

        assertThat(count("tax_card_statements")).isEqualTo(2);
        assertThat(count("tax_cash_receipts")).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_card_statements WHERE id IN (?, ?)",
                Integer.class, deletedCard, deletedCard2)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_card_statements WHERE id IN (?, ?)",
                Integer.class, oldCard, otherCard)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_card_statements WHERE id = ?",
                Integer.class, otherCard)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_cash_receipts WHERE record_id IN "
                + "(SELECT id FROM tax_year_records WHERE owner_id = ? OR tax_year = 2025)",
                Integer.class, other.id())).isEqualTo(2);
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.cards[0].issuerName").value("작년카드"))
                .andExpect(jsonPath("$.cashReceipt.asOfDate").value("2025-12-31"));
        mvc.perform(get(URL + "/2026").header("Authorization", other.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.cards[0].issuerName").value("다른카드"))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(9));
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void cardLimitIsPerYearAndOwnerAndADeletionFreesOneSlot() throws Exception {
        createYear(mvc, owner, 2025);
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@example.test", "다른 회원");
        createYear(mvc, other, 2026);
        String body = cardBody("합성카드", "2026-10-31", null, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L);
        long first = 0;
        for (int i = 0; i < 50; i++) {
            long id = addCard(mvc, owner, 2026, body);
            if (i == 0) first = id;
        }
        postCard(mvc, owner, 2026, body).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        addCard(mvc, owner, 2025, cardBody("작년카드", "2025-10-31", null,
                0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));
        addCard(mvc, other, 2026, body);
        mvc.perform(delete(URL + "/2026/cards/" + first).param("rowVersion", "0")
                .header("Authorization", owner.bearer())).andExpect(status().isNoContent());
        postCard(mvc, owner, 2026, body).andExpect(status().isCreated())
                .andExpect(jsonPath("$.cards", hasSize(50)));
    }

    @Test
    void anotherMembersStatementsAreNotFoundAndUnchanged() throws Exception {
        long cardId = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@example.test", "그룹장");
        AuthedUser serviceAdmin = TestAuth.signupAndLogin(mvc, "service-admin@example.test", "관리자");
        AuthedUser stranger = TestAuth.signupAndLogin(mvc, "stranger@example.test", "남");
        TestAdmins.grant(jdbc, serviceAdmin.id());
        long groupId = TestGroups.createGroup(mvc, groupAdmin, "합성 그룹");
        TestGroups.join(mvc, groupAdmin, owner, groupId);
        // 같은 연도 기록이 있는 회원과 없는 회원 모두 같은 404여야 한다.
        createYear(mvc, groupAdmin, 2026);
        createYear(mvc, serviceAdmin, 2026);

        for (AuthedUser other : new AuthedUser[]{groupAdmin, serviceAdmin, stranger}) {
            putCard(mvc, other, 2026, cardId, fullCard("남의카드", "2026-10-31", 0L))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
            mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "0")
                            .header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
            // 틀린 rowVersion으로도 409가 아니라 404다(409면 그 id의 자료가 있다는 것이 드러난다).
            putCard(mvc, other, 2026, cardId, fullCard("남의카드", "2026-10-31", 7L))
                    .andExpect(status().isNotFound());
            mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "7")
                            .header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound());
        }
        // 없는 id도 같은 응답이다.
        putCard(mvc, groupAdmin, 2026, cardId + 1000, fullCard("남의카드", "2026-10-31", 0L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        // 연도 기록이 없는 회원은 자료를 더할 수도 없다.
        postCard(mvc, stranger, 2026, fullCard("남의카드", "2026-10-31", null)).andExpect(status().isNotFound());
        putCash(mvc, stranger, 2026, cashBody("2026-10-31", null, 1L, 1L, 1L, 1L)).andExpect(status().isNotFound());
        // 내 자료라도 다른 귀속연도의 주소로는 닿지 않는다.
        createYear(mvc, owner, 2025);
        putCard(mvc, owner, 2025, cardId, fullCard("합성카드", "2025-10-31", 0L)).andExpect(status().isNotFound());

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.cards[0].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.cards[0].rowVersion").value(0))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(120_000));
        // 다른 회원의 연도에는 내 자료가 보이지 않는다.
        mvc.perform(get(URL + "/2026").header("Authorization", groupAdmin.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(0)))
                .andExpect(jsonPath("$.cashReceipt").value(nullValue()))
                .andExpect(jsonPath("$.totals.creditGeneral").value(0));
    }

    @Test
    void cardOwnershipAndVersionPrecedeServiceValidation() throws Exception {
        long ownCard = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@example.test", "다른 회원");
        createYear(mvc, other, 2026);
        long otherCard = addCard(mvc, other, 2026, fullCard("다른카드", "2026-10-31", null));

        putCard(mvc, owner, 2026, otherCard, fullCard("   ", "2025-12-31", 0L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        putCard(mvc, owner, 2026, ownCard, fullCard("합성카드", "2026-11-30", 0L))
                .andExpect(status().isOk());
        putCard(mvc, owner, 2026, ownCard, fullCard("합성카드", "2025-12-31", 0L))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(post(URL + "/2026/cards").contentType(MediaType.APPLICATION_JSON)
                        .content(fullCard("합성카드", "2026-10-31", null)))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(URL + "/2026/cards/1").param("rowVersion", "0")).andExpect(status().isUnauthorized());
        mvc.perform(put(URL + "/2026/cash-receipt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashBody("2026-10-31", null, 0L, 0L, 0L, 0L)))
                .andExpect(status().isUnauthorized());
    }
}
