# Upload

Upload (`/upload`, heading `뱅크샐러드 엑셀 업로드`) takes one Banksalad .xlsx export of up to 3 months and 512KB, merges it with existing transactions, reports created, updated, and unchanged counts, and lists every past upload.

## Sub-features

- `upload-form` uses the drop zone `엑셀 파일 업로드` with the button `파일 선택`, then the `업로드` submit. The result status reads `업로드가 끝났습니다.` with 전체/신규/갱신/변경 없음.
- `upload-history` shows `업로드 이력`: file name, time, and 신규/갱신/변경 없음 for every batch.
- The same form is reused inside the home dialogs (`home-upload-missing`, `home-month-manage`).

## How to get to it (user POV)

- Click the menu link `업로드`.
- On home, click the link `업로드 이력 전체`.
- On home, click a missing month (opens the dialog version).

## Driving it with the built-in browser

Preconditions:

- Baseline seed has one batch, `seed.xlsx`.

- **History.** Open `업로드`. `업로드 이력` lists `seed.xlsx` with `신규 18 · 갱신 0 · 변경 없음 0`.
- **Re-upload (idempotent merge).** The built-in browser cannot open the OS file picker. Run `bin/make_xlsx.py` to produce a file and upload it with `curl -F file=@… /api/imports` using the seed token, then reload. A second batch appears with `변경 없음 18`.

## Gotchas

- The UI file picker cannot be driven from the built-in browser, so the API upload is the only automated path. Report the UI submit path as unverified unless a human picks the file.
- Files over 3 months or 512KB are rejected by the API. The form shows the error as an alert.
