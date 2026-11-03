"""Offline checks for the reusable synthetic fixtures: python3 -m unittest discover -s scripts."""
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from xml.etree import ElementTree as ET
import zipfile

from test_data import Api, generate, month_shift, rows_for, seed, workbook


class TestDataTest(unittest.TestCase):
    def test_months_cross_year_and_leap_day(self):
        self.assertEqual(month_shift('2026-01', -1), '2025-12')
        self.assertEqual(rows_for('2024-02', 'admin', 0)[-1][:2], ['2024-02-29', '23:59:59'])

    def test_workbook_is_deterministic_and_preserves_text(self):
        rows = rows_for('2026-10', 'member', 11)
        data = workbook(rows)
        self.assertEqual(data, workbook(rows))
        self.assertLess(len(data), 512 * 1024)
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for name in archive.namelist():
                ET.fromstring(archive.read(name))
            root = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        actual = [[cell.text or '' for cell in row.findall('s:c/s:is/s:t', ns)]
                  for row in root.findall('s:sheetData/s:row', ns)]
        self.assertEqual(actual[1:], [[str(value) for value in row] for row in rows])

    def test_scenarios_have_gaps_duplicates_and_reimport_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)
            manifest = generate(out, '2026-01')
            self.assertEqual(manifest['months'][0], '2025-02')
            self.assertEqual(len(manifest['imports']['admin']), 11)
            self.assertEqual(len(manifest['imports']['member']), 9)
            self.assertFalse((out / f'admin-{manifest["emptyMonth"]}.xlsx').exists())
            self.assertEqual(len(list(out.glob('*.xlsx'))), 49)
            for file in out.glob('*.xlsx'):
                self.assertLess(file.stat().st_size, 512 * 1024)
            self.assertEqual(sum(manifest['reimport'].values()), manifest['rowsPerFile'] + 1)
        rows = rows_for('2026-01', 'member', 11)
        self.assertEqual(rows[22], rows[23])
        self.assertEqual(len({row[3] for row in rows}), 10)

    def test_seed_refuses_remote_or_ambiguous_addresses(self):
        for base in ['https://example.com', 'http://example.com', 'file:///tmp/db',
                     'http://localhost@example.com', 'http://localhost?remote=true',
                     'http://localhost/#fragment', 'https://localhost']:
            with self.subTest(base=base), self.assertRaises(ValueError):
                Api(base)
        self.assertEqual(Api('http://127.0.0.1:8080/').base, 'http://127.0.0.1:8080')
        self.assertEqual(Api('http://localhost:5173/api').base, 'http://localhost:5173/api')

    def test_existing_account_stops_before_any_signup(self):
        api = Mock()
        api.request.side_effect = [{'code': 'INVALID_CREDENTIALS'}, {'accessToken': 'secret-token'}]
        with tempfile.TemporaryDirectory() as directory, self.assertRaisesRegex(RuntimeError, '계정이 이미 존재합니다'):
            seed(api, Path(directory), {}, 'qa')
        self.assertEqual([call.args[1] for call in api.request.call_args_list], ['/auth/login', '/auth/login'])

    def test_unexpected_api_response_does_not_print_token(self):
        api = Api('http://localhost:8080')
        response = io.BytesIO(b'{"accessToken":"secret-token"}')
        response.code = 200
        api.opener.open = Mock(return_value=response)
        with self.assertRaises(RuntimeError) as caught:
            api.request('POST', '/auth/login', expected=401)
        self.assertNotIn('secret-token', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
