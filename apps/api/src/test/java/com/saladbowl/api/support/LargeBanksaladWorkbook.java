package com.saladbowl.api.support;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

/**
 * 업로드 상한 근처 크기의 가짜 뱅크샐러드 파일. 실제 export처럼 shared strings 표를 쓰고,
 * 거래일은 90일 안에 퍼뜨려 기간 검사(92일)를 통과한다. SXSSF로 써서 만드는 쪽은 메모리를 적게 쓴다.
 */
public final class LargeBanksaladWorkbook {

    private LargeBanksaladWorkbook() {
    }

    public static void write(Path file, int rows) throws IOException {
        try (SXSSFWorkbook wb = new SXSSFWorkbook(new XSSFWorkbook(), 100, true, true);
             OutputStream out = Files.newOutputStream(file)) {
            CreationHelper helper = wb.getCreationHelper();
            CellStyle dateStyle = wb.createCellStyle();
            dateStyle.setDataFormat(helper.createDataFormat().getFormat("yyyy-mm-dd"));
            CellStyle timeStyle = wb.createCellStyle();
            timeStyle.setDataFormat(helper.createDataFormat().getFormat("hh:mm"));

            wb.createSheet("뱅샐현황").createRow(0).createCell(0).setCellValue("읽지 않는 시트");
            Sheet sheet = wb.createSheet("가계부 내역");
            Row header = sheet.createRow(0);
            for (int i = 0; i < BanksaladWorkbook.HEADERS.size(); i++) {
                header.createCell(i).setCellValue(BanksaladWorkbook.HEADERS.get(i));
            }
            double firstDay = DateUtil.getExcelDate(LocalDate.of(2026, 7, 1).atStartOfDay());
            for (int r = 1; r <= rows; r++) {
                Row row = sheet.createRow(r);
                Cell date = row.createCell(0);
                date.setCellValue(firstDay + (r % 90));
                date.setCellStyle(dateStyle);
                Cell time = row.createCell(1);
                time.setCellValue((r % 86_400) / 86_400.0);
                time.setCellStyle(timeStyle);
                row.createCell(2).setCellValue("지출");
                row.createCell(3).setCellValue("식비");
                row.createCell(4).setCellValue("카페");
                row.createCell(5).setCellValue("가맹점 " + (r % 5_000));
                row.createCell(6).setCellValue(-(1_000 + r % 50_000));
                row.createCell(7).setCellValue("KRW");
                row.createCell(8).setCellValue("카드 " + (r % 20));
                row.createCell(9).setCellValue("메모 " + (r % 1_000));
            }
            wb.write(out);
        }
    }

    /** `./gradlew largeWorkbook -Prows=10000 -Pout=/tmp/salad-large.xlsx` — 배포 확인용 가짜 데이터 파일. */
    public static void main(String[] args) throws IOException {
        int rows = Integer.parseInt(args[0]);
        Path out = Path.of(args[1]);
        write(out, rows);
        System.out.println(out.toAbsolutePath() + " " + Files.size(out) + " bytes");
    }
}
