#!/usr/bin/env python3
"""Generate synthetic Banksalad fixtures; optionally seed a local API. Standard library only."""
import argparse
import calendar
import copy
import datetime as dt
import io
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from xml.sax.saxutils import escape
import zipfile

HEADERS = ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']
PASSWORD = 'SaladTest123!'
ROLES = ['admin', 'member', 'private', 'banned', 'empty', 'outsider', 'extra1', 'extra2', 'extra3']


def month_shift(month, offset):
    year, number = map(int, month.split('-'))
    year, number = divmod(year * 12 + number - 1 + offset, 12)
    return f'{year:04d}-{number + 1:02d}'


def rows_for(month, actor, index):
    """Stable identities, varying amounts, repeated payments and month boundaries."""
    year, number = map(int, month.split('-'))
    last = calendar.monthrange(year, number)[1]
    factor = {'admin': 1, 'member': 2, 'private': 3, 'banned': 4}[actor]
    rows = []

    def add(day, time, kind, major, minor, description, amount, currency='KRW', memo=''):
        rows.append([f'{month}-{day:02d}', time, kind, major, minor,
                     description, amount, currency, '테스트카드', memo])

    add(1, '00:00:00', '수입', '수입', '급여', '가상회사 급여', 3000000 * factor)
    categories = [('식비', '외식'), ('식비', '장보기'), ('교통', '대중교통'), ('주거', '관리비'),
                  ('생활', '생필품'), ('문화', '도서'), ('건강', '병원'), ('식비', '카페')]
    for day in range(2, 23):
        major, minor = categories[(day + index) % len(categories)]
        add(day, '12:30:00', '지출', major, minor, f'가상 {minor} {day}',
            -(1000 + day * 100 + index * 50) * factor)
    add(24, '09:00:00', '지출', '식비', '카페', '동일시각 반복결제', -4500)
    rows.append(rows[-1].copy())
    add(25, '10:00:00', '지출', '식비', '외식', '환불', 2000)
    add(26, '10:00:00', '이체', '이체', '저축', '본인계좌 이체', -500000)
    add(27, '10:00:00', '지출', '여행', '해외', '외화 소수금액', '-12.34', 'USD')
    add(28, '10:00:00', '지출', '기타', '', '0원 & <특수문자> "검증"', 0)
    add(last, '23:59:59', '지출', '생활', '기타', '긴 내용 ' + '가' * 200, -100,
        memo='여러 줄 메모\n' + '메모 ' * 100)
    return rows


def workbook(rows, headers=None, sheet='가계부 내역'):
    """Minimal OOXML, readable by POI and Excel. No real personal data or macros."""
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    xml_rows = []
    for number, row in enumerate([HEADERS if headers is None else headers] + rows, 1):
        cells = []
        for col, value in enumerate(row):
            ref = f'{chr(65 + col)}{number}'
            cells.append(f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">'
                         f'{escape(str(value))}</t></is></c>')
        xml_rows.append(f'<row r="{number}">' + ''.join(cells) + '</row>')
    files = {
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{escape(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': f'<worksheet xmlns="{ns}"><sheetData>' + ''.join(xml_rows) + '</sheetData></worksheet>',
    }
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content.encode())
    return out.getvalue()


def generate(out, month):
    months = [month_shift(month, i) for i in range(-11, 1)]
    imports = {}
    for actor in ['admin', 'member', 'private', 'banned']:
        imports[actor] = []
        for index, current in enumerate(months):
            # A whole missing month and a different member's coverage gap.
            if index == 7 or (actor == 'member' and index in (2, 3)):
                continue
            name = f'{actor}-{current}.xlsx'
            (out / name).write_bytes(workbook(rows_for(current, actor, index)))
            imports[actor].append(name)
    base = rows_for(month, 'member', 11)
    changed = copy.deepcopy(base)
    changed[1][3:5] = ['생활', '재분류']
    changed[1][9] = '재업로드 원본 메모 갱신'
    changed.append([f'{month}-15', '18:00:00', '지출', '식비', '외식', '재업로드 신규 거래', -7000,
                    'KRW', '테스트카드', ''])
    (out / 'member-reimport.xlsx').write_bytes(workbook(changed))
    (out / 'empty.xlsx').write_bytes(workbook([]))
    (out / 'invalid-header.xlsx').write_bytes(workbook(base, headers=['잘못된 헤더'] + HEADERS[1:]))
    (out / 'invalid-sheet.xlsx').write_bytes(workbook(base, sheet='다른 시트'))
    invalid = copy.deepcopy(base)
    invalid[-1][6] = '금액아님'
    (out / 'invalid-last-row.xlsx').write_bytes(workbook(invalid))
    too_long = copy.deepcopy(base[:2])
    too_long[0][0] = f'{month_shift(month, -4)}-01'
    (out / 'period-too-long.xlsx').write_bytes(workbook(too_long))
    (out / 'not-an-excel.xlsx').write_text('synthetic invalid workbook', encoding='utf-8')
    return {'month': month, 'months': months, 'emptyMonth': months[7], 'imports': imports,
            'rowsPerFile': len(base), 'reimport': {'createdRows': 1, 'updatedRows': 1,
                                                 'unchangedRows': len(base) - 1}}


class Api:
    def __init__(self, base):
        url = urllib.parse.urlsplit(base)
        if (url.scheme != 'http' or url.hostname not in ('localhost', '127.0.0.1', '::1')
                or url.username or url.password or url.query or url.fragment):
            raise ValueError('--base-url은 http 로컬 주소만 허용합니다 (예: http://localhost:8080).')
        self.base = base.rstrip('/')
        # Do not follow a local redirect to an external server or use system proxies.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        self.tokens = {}

    def request(self, method, path, actor=None, data=None, upload=None, expected=200):
        headers = {}
        if actor:
            headers['Authorization'] = 'Bearer ' + self.tokens[actor]
        body = None
        if upload:
            boundary = 'saladbowl-synthetic-boundary'
            headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                    f'filename="{upload.name}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n').encode()
            body += upload.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
        elif data is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(data).encode()
        req = urllib.request.Request(self.base + path, body, headers, method=method)
        try:
            response = self.opener.open(req, timeout=60)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            result = json.loads(raw) if raw else None
            statuses = (expected,) if isinstance(expected, int) else expected
            if response.code not in statuses:
                code = result.get('code', 'unexpected response') if isinstance(result, dict) else 'unexpected response'
                raise RuntimeError(f'{method} {path}: expected {expected}, got {response.code}: {code}')
            return result


def check(condition, message):
    if not condition:
        raise RuntimeError(message)


def seed(api, out, manifest, prefix):
    accounts = {actor: {'email': f'{prefix}.{actor}@example.test', 'password': PASSWORD,
                        'nickname': f'테스트 {actor}'} for actor in ROLES}
    # Check every account before writing anything. Never append duplicate groups/transactions on rerun.
    for actor, account in accounts.items():
        result = api.request('POST', '/auth/login', data=account, expected=(200, 401))
        check('accessToken' not in result,
              f'계정이 이미 존재합니다: {account["email"]}. 새 --prefix와 --out을 사용하세요.')
        check(result.get('code') == 'INVALID_CREDENTIALS', 'Unexpected login error code')
    manifest['accounts'] = accounts
    save(out, manifest)
    for actor, account in accounts.items():
        account['userId'] = api.request('POST', '/auth/signup', data=account, expected=201)['userId']
        api.tokens[actor] = api.request('POST', '/auth/login', data=account)['accessToken']
        save(out, manifest)
    groups = {}
    invites = {}
    for key, owner, members in [
        ('shared', 'admin', ['member', 'private', 'banned']),
        ('overlap', 'member', ['admin']),
        ('empty', 'empty', []),
        ('full', 'admin', ['member', 'private', 'extra1', 'extra2', 'extra3']),
    ]:
        group = api.request('POST', '/groups', owner, {'name': f'{prefix} {key}'}, expected=201)
        groups[key] = group['groupId']
        token = api.request('POST', f'/groups/{groups[key]}/invites', owner, expected=201)['token']
        invites[key] = token
        for actor in members:
            api.request('POST', f'/invites/{token}/accept', actor)
    manifest.update(groups=groups, invites=invites)
    save(out, manifest)
    api.request('PUT', f'/groups/{groups["shared"]}/share', 'private', {'enabled': False})
    api.request('PUT', f'/groups/{groups["overlap"]}/share', 'admin', {'enabled': False})
    api.request('DELETE', f'/groups/{groups["shared"]}/members/{accounts["banned"]["userId"]}', 'admin', expected=204)
    for actor, files in manifest['imports'].items():
        for name in files:
            result = api.request('POST', '/imports', actor, upload=out / name, expected=201)
            check(result['createdRows'] == manifest['rowsPerFile'], f'Import counts: {result}')
        print(f'  {actor}: {len(files)}개월 업로드')
    month = manifest['month']
    member_rows = api.request('GET', f'/me/transactions?month={month}', 'member')
    base = rows_for(month, 'member', 11)
    target = next(row for row in member_rows if row['description'] == base[1][5])
    api.request('PATCH', f'/transactions/{target["id"]}', 'admin',
                {'categoryMajor': '사용자수정', 'categoryMinor': '유지확인', 'memo': '관리자 수정 이력'})
    hidden = next(row for row in member_rows if row['description'] == base[2][5])
    api.request('PATCH', f'/transactions/{hidden["id"]}', 'member', {'hidden': True})
    manual = api.request('POST', '/me/transactions', 'admin', {
        'occurredAt': f'{month}-15T15:00:00', 'type': 'EXPENSE', 'categoryMajor': '생활',
        'categoryMinor': '수동', 'description': '수동입력 삭제 연습', 'amount': -12345,
        'paymentMethod': '현금', 'memo': '수동 거래만 삭제 가능'}, expected=201)
    duplicate = api.request('POST', '/imports', 'member', upload=out / f'member-{month}.xlsx', expected=201)
    check(duplicate['unchangedRows'] == manifest['rowsPerFile'], f'Dedup counts: {duplicate}')
    merged = api.request('POST', '/imports', 'member', upload=out / 'member-reimport.xlsx', expected=201)
    for key, value in manifest['reimport'].items():
        check(merged[key] == value, f'Reimport counts: {merged}')
    manifest['transactions'] = {'edited': target['id'], 'hidden': hidden['id'], 'manual': manual['id']}
    verify(api, manifest)
    manifest['seedComplete'] = True
    save(out, manifest)


def verify(api, manifest):
    """Verify the prepared state through public API contracts, including privacy boundaries."""
    month = manifest['month']
    groups, accounts = manifest['groups'], manifest['accounts']
    txs = manifest['transactions']
    rows = api.request('GET', f'/me/transactions?month={month}', 'member')
    edited = next(row for row in rows if row['id'] == txs['edited'])
    check(edited['categoryMajor'] == '사용자수정' and edited['memo'] == '관리자 수정 이력', 'Override lost after import')
    check(next(row for row in rows if row['id'] == txs['hidden'])['hidden'], 'Hidden state lost')
    audits = api.request('GET', f'/transactions/{txs["edited"]}/audits', 'member')
    check(any(row['actorId'] == accounts['admin']['userId'] for row in audits), 'Admin audit missing')
    shared = api.request('GET', f'/groups/{groups["shared"]}/transactions?month={month}', 'admin')
    check({row['ownerId'] for row in shared} == {accounts[a]['userId'] for a in ('admin', 'member')}, 'Share/ban visibility failed')
    check(all(not row['hidden'] for row in shared), 'Hidden transaction leaked')
    check(sum(row['description'] == '동일시각 반복결제' and row['ownerId'] == accounts['member']['userId'] for row in shared) == 2,
          'Repeated payments merged incorrectly')
    overlap = api.request('GET', f'/groups/{groups["overlap"]}/transactions?month={month}', 'member')
    check({row['ownerId'] for row in overlap} == {accounts['member']['userId']}, 'Group-specific sharing failed')
    for key, current in [('empty', month), ('shared', manifest['emptyMonth'])]:
        owner = 'empty' if key == 'empty' else 'admin'
        summary = api.request('GET', f'/groups/{groups[key]}/summary?month={current}', owner)
        check(summary['income'] == 0 and summary['expense'] == 0, 'Empty summary is not zero')
    summary = api.request('GET', f'/groups/{groups["shared"]}/summary?month={month}', 'admin')
    check(summary['income'] == sum(row['amount'] for row in shared if row['type'] == 'INCOME' and row['currency'] == 'KRW'), 'Income total mismatch')
    check(summary['expense'] == -sum(row['amount'] for row in shared if row['type'] == 'EXPENSE' and row['currency'] == 'KRW'), 'Expense total mismatch')
    for key, code in [('shared', 'REMOVED_FROM_GROUP'), ('full', 'GROUP_FULL')]:
        actor = 'banned' if key == 'shared' else 'outsider'
        result = api.request('POST', f'/invites/{manifest["invites"][key]}/accept', actor, expected=409 if key == 'full' else 403)
        check(result['code'] == code, f'Invite guard failed: {result}')
    before = api.request('GET', '/imports', 'member')
    for name, code in [('invalid-header.xlsx', 'INVALID_FILE_FORMAT'),
                       ('invalid-sheet.xlsx', 'INVALID_FILE_FORMAT'),
                       ('invalid-last-row.xlsx', 'INVALID_FILE_FORMAT'),
                       ('not-an-excel.xlsx', 'INVALID_FILE_FORMAT'),
                       ('period-too-long.xlsx', 'IMPORT_PERIOD_TOO_LONG')]:
        result = api.request('POST', '/imports', 'member', upload=Path(manifest['output']) / name, expected=400)
        check(result['code'] == code, f'Upload guard failed: {result}')
    check(before == api.request('GET', '/imports', 'member'), 'Failed import wrote a batch')
    check(rows == api.request('GET', f'/me/transactions?month={month}', 'member'), 'Failed import changed transactions')
    result = api.request('PATCH', f'/transactions/{txs["manual"]}', 'member', {'memo': '허용되지 않는 수정'}, expected=403)
    check(result['code'] == 'FORBIDDEN', 'Member edit guard failed')
    result = api.request('GET', f'/transactions/{txs["hidden"]}/audits', 'admin', expected=404)
    check(result['code'] == 'NOT_FOUND', 'Hidden audit leaked')
    print('  PASS: 재업로드/override/숨김/audit/공개범위/정원/차단/월간합계')


def save(out, manifest):
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--month', default=dt.date.today().strftime('%Y-%m'), help='마지막 월 YYYY-MM (이전 11개월 포함)')
    parser.add_argument('--out', type=Path, default=Path('tmp/test-data'))
    parser.add_argument('--seed', action='store_true', help='로컬 API에 전용 계정/그룹/거래 등록')
    parser.add_argument('--base-url', default='http://localhost:8080', help='Spring 직접 주소 (Vite는 http://localhost:5173/api)')
    parser.add_argument('--prefix', default='qa', help='테스트 계정/그룹 접두어. 재실행 시 새 접두어 사용')
    args = parser.parse_args()
    try:
        if not re.fullmatch(r'[0-9]{4}-(0[1-9]|1[0-2])', args.month) or not 2 <= int(args.month[:4]) <= 9999:
            raise ValueError('--month: 0002-01~9999-12의 YYYY-MM이 필요합니다.')
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,29}', args.prefix):
            raise ValueError('--prefix: 소문자/숫자/하이픈 1~30자만 허용합니다.')
        api = Api(args.base_url) if args.seed else None
        if args.out.exists() and any(args.out.iterdir()):
            raise ValueError(f'출력 폴더가 비어 있지 않습니다: {args.out}. 새 --out을 사용하세요.')
        args.out.mkdir(parents=True, exist_ok=True)
        manifest = generate(args.out, args.month)
        manifest['output'] = str(args.out.resolve())
        save(args.out, manifest)
        print(f'합성 엑셀 생성: {args.out.resolve()} ({manifest["months"][0]}~{args.month})')
        if api:
            seed(api, args.out, manifest, args.prefix)
            print(f'등록 완료: {args.prefix}.admin@example.test / {PASSWORD}')
            print(f'계정·그룹·초대·거래 ID: {args.out / "manifest.json"}')
    except (ValueError, RuntimeError, OSError, urllib.error.URLError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
