# Upload

Upload (`/upload`, heading `업로드`) shows yearly monthly upload coverage, accepts one Banksalad .xlsx export of up to 3 months and 512KB, merges it with existing transactions, reports created, updated, and unchanged counts, and lists every past upload.

## Sub-features

- `upload-coverage` shows the 12-month `월별 등록 현황` calendar and year controls `이전 연도` / `다음 연도`.
- `upload-month-dialog` opens `<YYYY년 M월> 데이터 업로드` for an unregistered month, or `<YYYY년 M월> 데이터` for a registered month with `다시 업로드` and delete actions.
- `upload-deeplink` accepts `/upload?month=YYYY-MM`, opens the matching month dialog, then removes `?month=` from the address.
- `upload-form` uses the drop zone `엑셀 파일 업로드` with the button `파일 선택`, then the `업로드` submit. The result status reads `업로드가 끝났습니다.` with 전체/신규/갱신/변경 없음.
- `upload-history` shows `업로드 이력`: file name, time, and 신규/갱신/변경 없음 for every batch.

## How to get to it (user POV)

- Click the menu link `업로드`.
- On home, click `업로드하기` on the `지난달 업로드` card to open that month's dialog.

## Driving it with the built-in browser

Preconditions:

- Baseline seed has one batch, `seed.xlsx`.

- **Coverage and order.** Open `업로드`. The page order is `월별 등록 현황` → `파일 올리기` → `업로드 이력`. The calendar shows the seeded months as registered with 6 rows each.
- **Deep link (missing month).** Open `/upload?month=<YYYY-MM four months before today>` (a month the seed does not cover). The `<YYYY년 M월> 데이터 업로드` dialog opens and the address becomes `/upload`. Reload; no dialog opens.
- **Home link.** Delete last month's data from the calendar, confirming the month in the deletion prompt. Return home and click `업로드하기`; the matching upload dialog opens on `/upload`.
- **History.** `업로드 이력` lists `seed.xlsx` with 신규 18 · 갱신 0 · 변경 없음 0.

## Gotchas

- The built-in browser cannot drive the OS file picker, so UI file selection and submit were not verified. Report the UI submit path as unverified unless a human picks the file.
- Files over 3 months or 512KB are rejected by the API. The form shows the error as an alert.
- Deleting a month changes home status and the dashboard. Restore it before another journey that expects seeded data.
