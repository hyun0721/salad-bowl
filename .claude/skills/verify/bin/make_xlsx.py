"""가짜 뱅크샐러드 엑셀(.xlsx)을 표준 라이브러리만으로 만든다. 지난달부터 3개월치, 대분류·소분류 포함."""
import datetime
import sys
import zipfile
from xml.sax.saxutils import escape

HEADERS = ["날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모"]
# (일, 타입, 대분류, 소분류, 내용, 금액)
ROWS = [
    (3, "지출", "식비", "점심", "김밥", -4000), (5, "지출", "식비", "카페", "커피", -5500),
    (9, "지출", "교통", "택시", "택시", -12000), (12, "지출", "쇼핑", "의류", "티셔츠", -29000),
    (15, "지출", "식비", "배달", "치킨", -21000), (25, "수입", "급여", "월급", "월급", 3000000),
]


def months_back(today, n):
    y, m = today.year, today.month - n
    while m <= 0:
        y, m = y - 1, m + 12
    return y, m


def cell(col, row, value):
    ref = f"{chr(65 + col)}{row}"
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'


def main(path):
    today = datetime.date.today()
    lines = [HEADERS]
    for back in (1, 2, 3):
        y, m = months_back(today, back)
        for day, kind, major, minor, desc, amount in ROWS:
            lines.append([f"{y}-{m:02d}-{day:02d}", "12:00:00", kind, major, minor, desc, amount, "KRW", "현금", ""])
    rows = "".join(
        f'<row r="{r}">' + "".join(cell(c, r, v) for c, v in enumerate(vals) if v != "") + "</row>"
        for r, vals in enumerate(lines, start=1)
    )
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="가계부 내역" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData>{rows}</sheetData></worksheet>",
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, body in files.items():
            z.writestr(name, body)


if __name__ == "__main__":
    main(sys.argv[1])
