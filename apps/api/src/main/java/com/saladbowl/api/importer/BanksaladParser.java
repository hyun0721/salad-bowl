package com.saladbowl.api.importer;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 뱅크샐러드 export(.xlsx)의 '가계부 내역' 시트만 읽는다. '뱅샐현황' 시트(개인정보)는 열지 않는다.
 * 컬럼: 날짜, 시간, 타입, 대분류, 소분류, 내용, 금액, 화폐, 결제수단, 메모
 */
@Component
public class BanksaladParser {

    static final String SHEET_NAME = "가계부 내역";
    static final List<String> HEADERS =
            List.of("날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모");

    private static final int SECONDS_PER_DAY = 86_400;

    // V4__create_transactions.sql 컬럼 크기와 같아야 한다.
    static final int MAX_CATEGORY_LENGTH = 100;
    static final int MAX_DESCRIPTION_LENGTH = 500;
    static final int MAX_PAYMENT_METHOD_LENGTH = 100;
    static final int MAX_CURRENCY_LENGTH = 10;
    static final int MAX_MEMO_LENGTH = 1000;
    /** NUMERIC(15, 2): 소수점 앞 13자리. */
    static final int MAX_AMOUNT_PRECISION = 15;

    public List<ParsedRow> parse(InputStream in) {
        try (Workbook workbook = open(in)) {
            Sheet sheet = workbook.getSheet(SHEET_NAME);
            if (sheet == null) {
                throw invalid("sheet '" + SHEET_NAME + "' not found");
            }
            checkHeader(sheet.getRow(0));
            List<ParsedRow> rows = new ArrayList<>();
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isBlank(row)) {
                    continue;
                }
                rows.add(parseRow(row));
            }
            return rows;
        } catch (IOException e) {
            throw invalid("cannot read file");
        }
    }

    private static Workbook open(InputStream in) {
        try {
            return WorkbookFactory.create(in);
        } catch (IOException | RuntimeException e) {
            throw invalid("not a valid .xlsx file");
        }
    }

    private static void checkHeader(Row header) {
        if (header == null) {
            throw invalid("header row is missing");
        }
        for (int i = 0; i < HEADERS.size(); i++) {
            String actual = text(header.getCell(i));
            if (!HEADERS.get(i).equals(actual)) {
                throw invalid("unexpected header in column " + (i + 1) + ": '" + actual + "'");
            }
        }
    }

    private static ParsedRow parseRow(Row row) {
        int rowNumber = row.getRowNum() + 1;
        try {
            LocalDateTime occurredAt = occurredAt(row.getCell(0), row.getCell(1));
            String typeLabel = text(row.getCell(2));
            TransactionType type = TransactionType.fromLabel(typeLabel)
                    .orElseThrow(() -> new IllegalArgumentException("unknown type '" + typeLabel + "'"));
            String categoryMajor = limited("categoryMajor", text(row.getCell(3)), MAX_CATEGORY_LENGTH);
            String categoryMinor = limited("categoryMinor", text(row.getCell(4)), MAX_CATEGORY_LENGTH);
            String description = limited("description", text(row.getCell(5)), MAX_DESCRIPTION_LENGTH);
            BigDecimal amount = amount(row.getCell(6));
            String currency = limited("currency", text(row.getCell(7)), MAX_CURRENCY_LENGTH);
            String paymentMethod = limited("paymentMethod", text(row.getCell(8)), MAX_PAYMENT_METHOD_LENGTH);
            String memo = limited("memo", text(row.getCell(9)), MAX_MEMO_LENGTH);
            TransactionData data = new TransactionData(
                    occurredAt,
                    type,
                    categoryMajor,
                    categoryMinor,
                    description,
                    amount,
                    currency.isEmpty() ? "KRW" : currency,
                    paymentMethod,
                    memo.isEmpty() ? null : memo);
            return new ParsedRow(rowNumber, data);
        } catch (ApiException e) {
            throw e;
        } catch (RuntimeException e) {
            throw invalid("row " + rowNumber + ": " + e.getMessage());
        }
    }

    /** Postgres VARCHAR(n)처럼 코드 포인트 수로 길이를 센다. */
    private static String limited(String field, String value, int max) {
        if (value.codePointCount(0, value.length()) > max) {
            throw new IllegalArgumentException(field + " longer than " + max + " characters");
        }
        return value;
    }

    /** 시간을 초 단위로 반올림한 결과가 24:00:00이면 다음 날 00:00:00으로 넘긴다. */
    private static LocalDateTime occurredAt(Cell dateCell, Cell timeCell) {
        LocalDate date = date(dateCell);
        long seconds = seconds(timeCell);
        return date.atStartOfDay().plusSeconds(seconds);
    }

    private static LocalDate date(Cell cell) {
        if (cell != null && cell.getCellType() == CellType.NUMERIC) {
            LocalDateTime value = DateUtil.getLocalDateTime(cell.getNumericCellValue());
            if (value == null) {
                throw new IllegalArgumentException("date is out of range");
            }
            return value.toLocalDate();
        }
        String value = text(cell);
        if (value.isEmpty()) {
            throw new IllegalArgumentException("date is empty");
        }
        return LocalDate.parse(value);
    }

    private static long seconds(Cell cell) {
        if (cell != null && cell.getCellType() == CellType.NUMERIC) {
            double value = cell.getNumericCellValue();
            double fraction = value - Math.floor(value);
            return Math.round(fraction * SECONDS_PER_DAY);
        }
        String value = text(cell);
        if (value.isEmpty()) {
            throw new IllegalArgumentException("time is empty");
        }
        return LocalTime.parse(value).toSecondOfDay();
    }

    private static BigDecimal amount(Cell cell) {
        BigDecimal value;
        if (cell != null && cell.getCellType() == CellType.NUMERIC) {
            value = BigDecimal.valueOf(cell.getNumericCellValue());
        } else {
            String text = text(cell).replace(",", "");
            if (text.isEmpty()) {
                throw new IllegalArgumentException("amount is empty");
            }
            value = new BigDecimal(text);
        }
        BigDecimal scaled = value.setScale(2, RoundingMode.HALF_UP);
        if (scaled.precision() > MAX_AMOUNT_PRECISION) {
            throw new IllegalArgumentException("amount out of range");
        }
        return scaled;
    }

    private static String text(Cell cell) {
        if (cell == null) {
            return "";
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().strip();
            case NUMERIC -> BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
            case BOOLEAN -> Boolean.toString(cell.getBooleanCellValue());
            default -> "";
        };
    }

    private static boolean isBlank(Row row) {
        for (int i = 0; i < HEADERS.size(); i++) {
            Cell cell = row.getCell(i);
            if (cell != null && cell.getCellType() != CellType.BLANK && !text(cell).isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private static ApiException invalid(String message) {
        return new ApiException(ErrorCode.INVALID_FILE_FORMAT, message);
    }
}
