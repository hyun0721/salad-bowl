package com.saladbowl.api.support;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/** 뱅크샐러드 export와 같은 구조의 .xlsx를 테스트 코드에서 만든다. 실제 파일은 저장소에 두지 않는다. */
public final class BanksaladWorkbook {

    public static final List<String> HEADERS =
            List.of("날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모");

    private record RowSpec(double dateSerial, double timeFraction, String type, String major, String minor,
                           String description, long amount, String paymentMethod, String memo) {
    }

    private final List<RowSpec> rows = new ArrayList<>();
    private String sheetName = "가계부 내역";
    private List<String> headers = HEADERS;

    private BanksaladWorkbook() {
    }

    public static BanksaladWorkbook create() {
        return new BanksaladWorkbook();
    }

    /** date: yyyy-MM-dd, time: HH:mm:ss, memo: null이면 셀을 만들지 않는다. */
    public BanksaladWorkbook row(String date, String time, String type, String major, String minor,
                                 String description, long amount, String paymentMethod, String memo) {
        double dateSerial = DateUtil.getExcelDate(LocalDate.parse(date).atStartOfDay());
        double timeFraction = LocalTime.parse(time).toSecondOfDay() / 86400.0;
        return rawRow(dateSerial, timeFraction, type, major, minor, description, amount, paymentMethod, memo);
    }

    /** 날짜·시간 셀에 원시 숫자(일련번호, 하루의 비율)를 그대로 넣는다. 비정상 값 테스트용. */
    public BanksaladWorkbook rawRow(double dateSerial, double timeFraction, String type, String major, String minor,
                                    String description, long amount, String paymentMethod, String memo) {
        rows.add(new RowSpec(dateSerial, timeFraction, type, major, minor, description, amount, paymentMethod, memo));
        return this;
    }

    /** 내용이 하나도 없는 행. */
    public BanksaladWorkbook blankRow() {
        rows.add(null);
        return this;
    }

    public BanksaladWorkbook sheetName(String sheetName) {
        this.sheetName = sheetName;
        return this;
    }

    public BanksaladWorkbook headers(List<String> headers) {
        this.headers = headers;
        return this;
    }

    public byte[] toBytes() {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet profile = wb.createSheet("뱅샐현황");
            profile.createRow(2).createCell(1).setCellValue("1.고객정보");
            Row nameRow = profile.createRow(4);
            nameRow.createCell(1).setCellValue("이름");
            nameRow.createCell(2).setCellValue("테스트");

            CreationHelper helper = wb.getCreationHelper();
            CellStyle dateStyle = wb.createCellStyle();
            dateStyle.setDataFormat(helper.createDataFormat().getFormat("yyyy-mm-dd"));
            CellStyle timeStyle = wb.createCellStyle();
            timeStyle.setDataFormat(helper.createDataFormat().getFormat("hh:mm"));

            Sheet sheet = wb.createSheet(sheetName);
            Row header = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                header.createCell(i).setCellValue(headers.get(i));
            }
            int r = 1;
            for (RowSpec spec : rows) {
                Row row = sheet.createRow(r++);
                if (spec == null) {
                    continue;
                }
                Cell date = row.createCell(0);
                date.setCellValue(spec.dateSerial());
                date.setCellStyle(dateStyle);
                Cell time = row.createCell(1);
                time.setCellValue(spec.timeFraction());
                time.setCellStyle(timeStyle);
                row.createCell(2).setCellValue(spec.type());
                row.createCell(3).setCellValue(spec.major());
                row.createCell(4).setCellValue(spec.minor());
                row.createCell(5).setCellValue(spec.description());
                row.createCell(6).setCellValue(spec.amount());
                row.createCell(7).setCellValue("KRW");
                row.createCell(8).setCellValue(spec.paymentMethod());
                if (spec.memo() != null) {
                    row.createCell(9).setCellValue(spec.memo());
                }
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
