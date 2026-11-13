# Home

Home (`/`, heading `홈`) shows a summary of the user's income and expenses for last month and the yearly monthly upload coverage. Uploading a Banksalad .xlsx export (up to 3 months and 512KB), managing a registered month, and the upload history all start from the coverage calendar.

## Sub-features

- `home-summary` shows last month's income and expense summary and the 수입·지출 cards (`수입 ₩ …`), which open `/transactions`.
- `home-coverage` shows the 12-month `월별 등록 현황` calendar and year controls `이전 연도` / `다음 연도`.
- `home-month-dialog` opens `<YYYY년 M월> 데이터 업로드` for an unregistered month, or `<YYYY년 M월> 데이터` for a registered month with `다시 업로드` and delete actions.
- `home-upload-form` uses the drop zone `엑셀 파일 업로드` with the button `파일 선택`, then the `업로드` submit, inside the month dialog. The result status reads `업로드가 끝났습니다.` with 전체/신규/갱신/변경 없음.
- `home-upload-history` opens the `업로드 이력` dialog from the icon button `업로드 이력` to the right of the year controls: file name, time, and 신규/갱신/변경 없음 for every batch.
- `home-deeplink` accepts `/?month=YYYY-MM`, opens the matching month dialog, then removes `?month=` from the address. The old address `/upload?month=YYYY-MM` redirects here and behaves the same; `/upload` alone lands on home.
- `home-order` stacks `지난달 내 요약` above `월별 등록 현황` on narrow screens. Wide screens put the coverage on the left (wider) and the summary on the right.

## How to get to it (user POV)

- Log in. Home is the landing page.
- Click the menu link `홈`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed: the previous 12 complete months are registered, with 12 monthly batches per member (`seed-owner-1.xlsx` through `seed-owner-12.xlsx` for the owner). Row counts per relative month are in [seed-expected.json](seed-expected.json).

- **Summary.** The last-month summary shows income and expense, with the 수입·지출 cards (`수입 ₩ …`), which open `/transactions`.
- **Order.** At `mobile`, the `h2` order is `지난달 내 요약 (…)` → `월별 등록 현황`. At `desktop`, the coverage card is on the left. There is no `지난달 업로드` card and no `파일 올리기` card.
- **Coverage.** The calendar shows the seeded months as registered with their row counts (see seed-expected.json). `이전 연도` / `다음 연도` change the year.
- **Deep link (missing month).** Open `/?month=<YYYY-MM 13 months before today>` (outside the 12 seeded months; check the calendar shows it as 미등록). The `<YYYY년 M월> 데이터 업로드` dialog opens and the address becomes `/`. Reload; no dialog opens.
- **Old address.** Open `/upload?month=<same month>`. The address becomes `/` and the same dialog opens. Open `/upload`; home shows with no dialog.
- **History.** Click the icon button `업로드 이력`. The dialog lists 12 batches; the row count of `seed-owner-1.xlsx` matches seed-expected.json.
- **Registered month.** Click a registered month. The `<YYYY년 M월> 데이터` dialog shows the counts, `다시 업로드`, and the delete action that needs the month typed.

## Gotchas

- The built-in browser cannot drive the OS file picker, so UI file selection and submit were not verified. Report the UI submit path as unverified unless a human picks the file.
- Files over 3 months or 512KB are rejected by the API. The form shows the error as an alert.
- Deleting a month changes the home summary and the dashboard. Restore it before another journey that expects seeded data.
- The dialogs slide up from the bottom on narrow screens and are centered on wide screens.
