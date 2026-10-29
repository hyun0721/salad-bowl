# Home

Home (`/`, heading `내 가계부`) shows which months of the year have uploaded data, a summary of last month's own income and expense, and the 3 most recent uploads. Tapping an unregistered month opens an upload dialog. Tapping a registered month opens a dialog to re-upload or delete that month.

## Sub-features

- `home-coverage` shows the 12-month calendar `월별 등록 현황` with each month as 등록됨 · N건, 미등록 · 업로드하기, or 예정 (future). Year arrows `이전 연도` / `다음 연도` change the year.
- `home-upload-missing` opens the dialog `<YYYY년 M월> 데이터 업로드` with the upload form when you click a missing month.
- `home-month-manage` opens the dialog `<label> 데이터` with `다시 업로드` and delete when you click a registered month.
- `home-summary` shows `지난달 내 요약 (<month>)` with 수입 and 지출, plus the link `내 거래 보기`.
- `home-recent` shows `최근 업로드` (top 3) and the link `업로드 이력 전체` to `/upload`.

## How to get to it (user POV)

- Log in. Home is the landing page.
- Click the menu link `홈`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed: the 3 months before today are registered with 6 rows each.

- **Coverage.** Open `/`. Run `find "등록됨"`. The last 3 months each have a button labelled `<YYYY>년 <M>월 등록됨 6건, 데이터 관리`. Earlier months in that year show `미등록`.
- **Summary.** `get_page_text` contains `지난달 내 요약` with 수입 `₩ 3,000,000` and 지출 `₩ 71,500`.
- **Recent uploads.** The `최근 업로드` section lists `seed.xlsx` with `신규 18`.
- **Missing month.** Click a `미등록, 업로드하기` button. A dialog titled `… 데이터 업로드` opens and contains `파일 선택`. Close it.
- **Manage month.** Click a `등록됨` button. The dialog shows `다시 업로드` and a delete button. Do not confirm the delete unless the journey restores data afterwards.

## Gotchas

- If today is in January or February, some seeded months fall in the previous year. Use `이전 연도` to see them.
- Coverage counts transactions by transaction date, not by upload date.
- Deleting a month changes the summary and the dashboard. Relaunch to restore.
