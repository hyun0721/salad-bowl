# Tax deduction inputs

소득공제 › 입력자료 (`/tax/inputs`, `h1` `소득공제` on wide screens) holds one member's record for one tax year: basic info (expected salary, work months, child count), card statements per issuer (8 amounts = 4 categories × 신용카드/체크카드), one cash-receipt statement (4 amounts), the server's year totals table, and deleting the year record. The data is personal: the header group does not change it, and members without a group can use it. Every input or confirm dialog opens as a centered dialog at every width, including 375px.

## Sub-features

- `tax-entry` opens `/tax`, which redirects to `/tax/inputs` (the analysis rule arrives with PR 7). The sidebar shows `소득공제` with the indented sub-link `입력자료`; narrow screens use the bottom tab `소득공제`.
- `tax-year` uses the `귀속연도` select (last, this, next year in Korean time). The choice lives in memory only: reload or logout returns to this year.
- `tax-basic` shows `기본정보` with `[수정]` (or `[기본정보 입력]` on an empty year). `근로기간 확인 필요` appears when the months are not 1–12. `자녀등 수` appears only when the record's law has child tiers; its rules open from the `자녀등 수 도움말` button.
- `tax-cards` lists `신용·체크 자료` rows: issuer, `완료` or `미완료 · 빈 칸 n개`, `기준일 … · 합계 ₩ … · 메모`, and on the right `[빈 칸 0원으로 채우기]` (incomplete only), `[편집]`, `[삭제]`. Delete asks once. 50 rows per year at most.
- `tax-cash` shows `현금영수증 자료`: `[입력]` and `[4칸 0원으로 채우기]` before the first save, `[편집]` after. There is no delete.
- `tax-totals` shows `연도 합계표` from the server's 12 totals, the blank-cell and different-date warnings, and `—` when the year has no inputs. Narrow screens move the row total under the category name as `계 …`.
- `tax-delete-year` deletes the whole year after the user types the exact year in `확인을 위해 귀속연도(YYYY)를 입력하세요`.
- `tax-mask` follows the amount mask: `수입` hides the salary, `지출` hides card totals and the totals table. Fields being edited never hide.

## How to get to it (user POV)

- Click `소득공제` in `navigation "주 메뉴"` (sidebar or bottom tab). On wide screens, `입력자료` under it opens the same page.

## Driving it with the built-in browser

Preconditions:

- Baseline seed. `seed.sh` printed `SEEDED group=… tax_year=YYYY`. `verify@example.test` is a service admin, the `YYYY` law is applied with child tiers, and the owner's `YYYY` record has salary ₩ 50,000,000, A카드 (₩ 9,600,000), B카드 (₩ 7,600,000), cash ₩ 600,000, all dated `YYYY-06-30`. `verify5@example.test` (그룹없음) has no group and no record.

- **Seeded record.** At `mobile` and `desktop`, open `소득공제`. The totals table reads 일반 14,000,000 / 2,000,000 / 500,000 and 합계 14,600,000 / 2,600,000 / 600,000 (17,800,000 on desktop). No warning shows. No page-level horizontal scroll at 375px and 320px (`resize_window` 320×700).
- **Centered dialogs.** At `desktop`, `mobile` (375px), and 320×700, open `기본정보 수정`, `A카드 자료 편집`, `현금영수증 자료 편집`, `A카드 자료 삭제`, and `YYYY년 기록 삭제`. Each dialog is centered with space above and below; none slides up from the bottom. The 8-cell grid shows two columns (신용카드, 체크카드) per category with no horizontal scroll.
- **Blank vs 0.** Add a card `C카드` with only 일반 신용카드 filled. Its row reads `미완료 · 빈 칸 7개`, the totals card shows the blank warning, then `[빈 칸 0원으로 채우기]` on the row turns it into `완료`. Delete `C카드` (one confirmation) to restore.
- **Long name.** Add a card whose name is 40 characters. At 375px and 320px the name wraps on the left and `[편집] [삭제]` stay right-aligned on the row. Delete it afterwards.
- **Help.** In the 기본정보 dialog, tap `자녀등 수 도움말`, tap it again, tap outside, press Esc: the popover closes each time, focus returns to `?`, the dialog stays open, and the value does not change.
- **Different dates.** Edit B카드 기준일 to `YYYY-05-31`. The totals card warns `자료의 기준일이 서로 다릅니다(…)`. Restore `YYYY-06-30`.
- **No group.** Log out, log in as `verify5@example.test`, open `소득공제`, enter basic info, add one card, then reload: the same data shows.
- **Group switch.** As `verify@example.test`, change the header group and confirm the tax page shows the same numbers without reloading.
- **Delete year.** As `verify5@example.test`, open `YYYY년 기록 삭제`: `삭제` stays disabled for an empty value and for the previous year, enables on the exact year, and the page returns to `YYYY년 귀속 기록이 없습니다`. Reopen the dialog before confirming once to see the input start empty.
  Run this after **No group**, which creates the record to delete.
- **Mask.** Turn on the `수입` mask: the salary shows `₩ •••••` and totals stay visible. Turn on only `지출`: totals and card sums show `•••••`, the salary is visible. Turn masks off afterwards.

## Gotchas

- The seed year follows today's Korean date. The year select only offers last, this and next year; older records exist on the server but have no entry point.
- `rowVersion` values are opaque sequence numbers, not counters. A 409 or 404 on save shows `다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다.` with `[다시 불러오기]`, which closes the dialog and reloads the year.
- Card rows sum their own 8 cells for display; the totals table uses the server's 12 totals, and its row and column totals add those 12 cells.
- The page has no analysis yet. `/tax` always opens the inputs page until PR 7.
