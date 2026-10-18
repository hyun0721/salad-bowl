package com.saladbowl.api.importer;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.support.BanksaladWorkbook;
import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BanksaladParserTest {

    private final BanksaladParser parser = new BanksaladParser();

    private List<ParsedRow> parse(BanksaladWorkbook workbook) {
        return parser.parse(new ByteArrayInputStream(workbook.toBytes()));
    }

    @Test
    void parsesLedgerRowsWithSecondsPrecisionAndMissingMemo() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "19:58:25", "지출", "식비", "카페", "스타벅스", -7000, "신한카드", null)
                .row("2026-09-02", "08:00:00", "지출", "교통", "택시", "카카오T", -12300, "현대카드", "출근"));

        assertThat(rows).hasSize(2);
        ParsedRow first = rows.get(0);
        assertThat(first.rowNumber()).isEqualTo(2);
        TransactionData data = first.data();
        assertThat(data.occurredAt()).isEqualTo(LocalDateTime.of(2026, 9, 1, 19, 58, 25));
        assertThat(data.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(data.categoryMajor()).isEqualTo("식비");
        assertThat(data.categoryMinor()).isEqualTo("카페");
        assertThat(data.description()).isEqualTo("스타벅스");
        assertThat(data.amount()).isEqualByComparingTo(new BigDecimal("-7000"));
        assertThat(data.amount().scale()).isEqualTo(2);
        assertThat(data.currency()).isEqualTo("KRW");
        assertThat(data.paymentMethod()).isEqualTo("신한카드");
        assertThat(data.memo()).isNull();
        assertThat(rows.get(1).data().memo()).isEqualTo("출근");
    }

    @Test
    void mapsAllThreeTypes() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "수입", "급여", "월급", "회사", 3000000, "국민은행", null)
                .row("2026-09-01", "10:00:00", "이체", "이체", "내계좌", "적금", -500000, "국민은행", null)
                .row("2026-09-01", "11:00:00", "지출", "쇼핑", "온라인", "환불", 15000, "신한카드", null));

        assertThat(rows).extracting(r -> r.data().type())
                .containsExactly(TransactionType.INCOME, TransactionType.TRANSFER, TransactionType.EXPENSE);
    }

    @Test
    void skipsBlankRows() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .blankRow()
                .row("2026-09-01", "19:00:00", "지출", "식비", "저녁", "국밥", -9000, "현금", null));

        assertThat(rows).extracting(ParsedRow::rowNumber).containsExactly(2, 4);
    }

    @Test
    void rejectsWorkbookWithoutLedgerSheet() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create().sheetName("다른 시트")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void rejectsUnexpectedHeader() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .headers(List.of("날짜", "시간", "구분", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모"))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void unknownTypeReportsRowNumber() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .row("2026-09-01", "10:00:00", "환전", "기타", "기타", "환전", -1000, "현금", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageStartingWith("row 3:");
    }

    @Test
    void rejectsNonExcelContent() {
        assertThatThrownBy(() -> parser.parse(
                new ByteArrayInputStream("not an excel file".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void outOfRangeDateReportsRowNumber() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .rawRow(-5, 0.5, "지출", "식비", "점심", "김밥", -4000, "현금", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageStartingWith("row 2:")
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void timeRoundingPastMidnightCarriesToNextDay() {
        double dateSerial = DateUtil.getExcelDate(LocalDate.of(2026, 9, 1).atStartOfDay());

        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .rawRow(dateSerial, 86399.6 / 86400, "지출", "식비", "야식", "라면", -3000, "현금", null));

        assertThat(rows.get(0).data().occurredAt()).isEqualTo(LocalDateTime.of(2026, 9, 2, 0, 0, 0));
    }

    @Test
    void overLongDescriptionReportsRowNumber() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "가".repeat(501), -4000, "현금", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageStartingWith("row 2:")
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void descriptionAtTheLimitIsAccepted() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "가".repeat(500), -4000, "현금", null));

        assertThat(rows.get(0).data().description()).hasSize(500);
    }

    @Test
    void tooLargeAmountReportsRowNumber() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "김밥", 100_000_000_000_000L, "현금", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageStartingWith("row 2:")
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void largestAllowedAmountIsAccepted() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "수입", "급여", "월급", "회사", 9_999_999_999_999L, "국민은행", null));

        assertThat(rows.get(0).data().amount()).isEqualByComparingTo(new BigDecimal("9999999999999"));
    }

    @Test
    void otherOverLongFieldsReportRowNumber() {
        String longText = "a".repeat(1001);
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "a".repeat(101), "점심", "김밥", -4000, "현금", null)))
                .hasMessageStartingWith("row 2:");
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "a".repeat(101), "김밥", -4000, "현금", null)))
                .hasMessageStartingWith("row 2:");
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "김밥", -4000, "a".repeat(101), null)))
                .hasMessageStartingWith("row 2:");
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", longText)))
                .hasMessageStartingWith("row 2:");
    }
}
