# Home

Home (`/`, heading `내 가계부`) shows last month's upload status and a summary of the user's income and expenses for that month.

## Sub-features

- `home-upload-status` shows the `지난달 업로드` card as `<YYYY년 M월> 데이터 등록됨 · <count>건`, or `<YYYY년 M월> 데이터가 아직 없습니다.` with `업로드하기`, which opens `/upload?month=<YYYY-MM>` and the upload dialog for that month.
- `home-summary` shows last month's income and expense summary and the link `내 거래 보기`.

## How to get to it (user POV)

- Log in. Home is the landing page.
- Click the menu link `홈`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed: the 3 months before today are registered with 6 rows each.

- **Upload status (registered).** Open `/`. The `지난달 업로드` card reads `<YYYY년 M월> 데이터 등록됨 · 6건` for last month. The home page has no `월별 등록 현황` or `최근 업로드` section.
- **Upload status (missing).** Remove last month's data from the upload calendar, confirming the month in the deletion prompt, then return home. The card reads `<YYYY년 M월> 데이터가 아직 없습니다.` and has the link `업로드하기`. Click it; `/upload` opens with the `<YYYY년 M월> 데이터 업로드` dialog.
- **Summary.** The last-month summary shows income and expense, with `내 거래 보기`.

## Gotchas

- The baseline seed registers the last three months, so the missing state requires deleting last month's data first. Restore it before another journey that expects the seed.
- The `업로드하기` link is a deep link to `/upload?month=YYYY-MM`; after the dialog opens, the address becomes `/upload`.
