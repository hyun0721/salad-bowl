"""가짜 뱅크샐러드 엑셀(.xlsx)을 표준 라이브러리만으로 만든다. 지난달부터 12개월 중 지정 월, 45개 대분류와 각각 24개 소분류."""
import datetime
import sys
import zipfile
from xml.sax.saxutils import escape

HEADERS = ["날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모"]
MEMBERS = ("owner", "second", "third", "private")
MAJORS = ["식비", "교통", "쇼핑", "생활", "문화"] + [f"검증분류{i:02d}" for i in range(6, 46)]
MINORS = ["점심", "카페", "배달", "신규", "재등장", "환불초과"] + [f"항목{i:02d}" for i in range(7, 25)]


def data(member, back):
    actor = MEMBERS.index(member)
    for major_index, major in enumerate(MAJORS):
        for minor_index, minor in enumerate(MINORS):
            if major == "식비" and minor == "신규" and back >= 3:
                continue
            if major == "식비" and minor == "재등장" and back in (2, 3, 4):
                continue
            trend = (14 - back) if major_index % 3 == 0 else (back + 2) if major_index % 3 == 1 else 8
            weight = 5 if (major == "식비" and minor == "배달" and actor == 1) or (major == "쇼핑" and actor == 2) else actor + 1
            amount = (minor_index + 1) * 100 * trend * weight
            yield (minor_index + 1, "지출", major, minor, f"가상 {major} {minor}", -amount)
            if major == "식비" and minor == "환불초과" and back == 2:
                yield (26, "지출", major, minor, "가상 환불", amount * 2)
    yield (25, "수입", "급여", "월급", "가상 급여", (actor + 1) * 3000000)
    if member == "private":
        yield (27, "지출", "문화", "공연", "비공개 대조군", -990000)


def expected():
    import json
    def totals(back):
        major, minor, members = {}, {}, {}
        for member in MEMBERS[:3]:
            members[member] = 0
            for _, kind, name, sub, _, amount in data(member, back):
                if kind != "지출":
                    continue
                major[name] = major.get(name, 0) - amount
                if name == "식비":
                    minor[sub] = minor.get(sub, 0) - amount
                members[member] -= amount
        return major, minor, members
    major, minor, members = totals(1)
    def shares(values):
        total = sum(max(0, n) for n in values.values())
        return {key: {"amount": value, "percent": round(max(0, value) / total * 100, 1)} for key, value in values.items()}
    def change(current, previous):
        if previous < 0: return "—"
        if previous == 0: return "신규" if current > 0 else "—"
        pct = round((current - previous) / previous * 100)
        return f"{pct:+d}%" if pct else "0%"
    trend = {}
    for category in MAJORS[:3]:
        trend[category] = [change(totals(b)[0][category], totals(b+1)[0][category]) for b in (1,2)] + ["—"]
    print(json.dumps({"소유자 월별 행수 (지난달부터)": [len(list(data("owner", b))) for b in range(1,13)], "지난달 대분류": shares(major), "지난달 식비 소분류": shares(minor),
                      "지난달 멤버별 지출": members, "3개월 증감률 (지난달·두 달 전·세 달 전)": trend}, ensure_ascii=False, indent=2))


def months_back(today, n):
    y, m = today.year, today.month - n
    while m <= 0:
        y, m = y - 1, m + 12
    return y, m


def cell(col, row, value):
    ref = f"{chr(65 + col)}{row}"
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'


def main(path, member, back):
    today = datetime.date.today()
    y, m = months_back(today, back)
    lines = [HEADERS]
    for day, kind, major, minor, desc, amount in data(member, back):
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
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, body)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="결정적인 월별 합성 엑셀. 92일 제한 때문에 월별 업로드한다.")
    parser.add_argument("path", nargs="?")
    parser.add_argument("--member", choices=MEMBERS, default="owner")
    parser.add_argument("--back", type=int, choices=range(1, 13), default=1)
    parser.add_argument("--expected", action="store_true")
    args = parser.parse_args()
    if args.expected:
        expected()
    elif args.path:
        main(args.path, args.member, args.back)
    else:
        parser.error("출력 경로 또는 --expected가 필요합니다")
