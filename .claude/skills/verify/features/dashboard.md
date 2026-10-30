# Group dashboard

The dashboard (heading `그룹 대시보드`) combines a month of KRW transactions from group members who turned sharing on. Every sub-screen follows heading → month picker → 수입·지출 → (narrow) 대시보드 메뉴 → sub-screen. The total cards open a per-member dialog. The month applies to both 대분류 and 소분류, and lives in the address as `?month=YYYY-MM`. Both widths show 분포 (share) and 추이 (trend) together on one page.

## Sub-features

- `dash-routes` follows the address table, the same at both widths: `/dashboard` → `/dashboard/major`; `/dashboard/:level` is the screen itself; `/dashboard/:level/:view` (`share`|`trend`) is the same screen scrolled to that card; an unknown `level` or `view` is treated like `/dashboard`. Every redirect is a replace and keeps the search (`?month=`, `?major=`).
- `dash-month` uses the month picker (`이전 달` / `다음 달`). It writes `?month=` with replace, so history does not grow. A missing or malformed month (`2026-13`) falls back to last month.
- `dash-totals` shows the 수입 and 지출 buttons. Each opens a `멤버별 수입` / `멤버별 지출` dialog listing members and a total.
- `dash-category` (대분류 분포) shows `카테고리별 지출` as a donut plus a list with amount and percent per 대분류. Clicking a row opens a dialog of that category's transactions. Its header has two icon-only buttons: `<대분류> 소분류 보기` (bar chart) and `닫기` (X).
- `dash-trend` (대분류 추이) shows `대분류별 추이`: a range segmented control (전월 비교 / 3·6·12개월 / 직접 지정), category chips (top 5 on by default), a line chart, and `표로 보기`.
- `dash-minor` (`/dashboard/minor/*`) temporarily shows the old `소분류 추이·분포` card (pick a 대분류 to see its 소분류) until Plan 16d replaces it with 소분류 분포·추이. It uses the latest six months through `?month=`. `?major=<대분류>` preselects that 대분류 when the card mounts; an unknown name shows the selection hint.
- `dash-drill` is the `<대분류> 소분류 보기` button in the transactions dialog: it closes the dialog and pushes `/dashboard/minor?month=…&major=…` (history grows by one; back returns to the 대분류 screen). Focus lands on the card heading `소분류 추이·분포`. The focus hint lives in history state and is cleared right after use, so a reload does not move focus.
- `dash-menu` shows, on narrow screens only, `navigation "대시보드 메뉴"` with one link row, group `분류` [대분류 | 소분류]. The current one carries `aria-current="page"`. Links replace history, keep the search, and leave focus on the clicked link.
- `dash-scroll` scrolls to the `:view` card when the address has one (`/dashboard/major/trend`), at both widths, after the summary loads. The temporary 소분류 card is one card, so `/dashboard/minor/:view` does not scroll until 16d.
- `dash-title` sets the tab title `그룹 대시보드 · 대분류` / `그룹 대시보드 · 소분류` at both widths.
- `dash-no-group` shows a notice instead of data when the user has no group.

## How to get to it (user POV)

- Click the menu link `그룹 대시보드` (wide) or the tab `대시보드` (narrow). Wide screens also have sidebar sub-links `대분류` and `소분류` under it.
- On narrow screens, switch 대분류/소분류 with `대시보드 메뉴`.
- From a 대분류 row's transactions dialog, the `<대분류> 소분류 보기` button.

## Driving it with the built-in browser

Preconditions:

- Baseline seed, with `검증그룹` selected and sharing on. The seed's last month is the default month.

- **Redirect and title.** At preset `mobile`, go to `/` and then click the tab `대시보드`. The address becomes `/dashboard/major` and the title `그룹 대시보드 · 대분류 · Salad Bowl`. `대시보드 메뉴` has one group `분류` with two links, and both `카테고리별 지출` and `대분류별 추이` show (`#dashboard-share` and `#dashboard-trend` are not `hidden`). Check `history.length` with `javascript_tool`: the redirect does not add an entry.
- **Totals.** 수입 shows `₩ 3,000,000` and 지출 shows `₩ 71,500`. Click `지출 ₩ 71,500`: a dialog `멤버별 지출` opens with one icon button named `닫기` (no visible text). Click it.
- **Category list.** `find "카테고리별 지출"`. The rows are buttons named like `식비 43% ₩ 30,500`, then 쇼핑 41% ₩ 29,000 and 교통 17% ₩ 12,000.
- **Category drill-down.** Click the 식비 row. A dialog titled `식비` shows `3건 · 합계 ₩ 30,500` and lists 치킨 (배달), 커피 (카페), 김밥 (점심). On narrow screens it opens as a bottom sheet. Its header has `식비 소분류 보기` then `닫기`, both icon-only. The list uses the same layout as the transactions list: on wide screens the columns are 일시 · 멤버 · 소분류 · 내용 · 결제수단 · 금액 (일시 and 금액 sortable); on narrow screens each card's second line is `배달 · 검증러`. The 대분류 is left out because it is the dialog title (then ` | 메모` when there is one) with the time on the right. The title row, the `N건 · 합계` line and the column headers stay in place: only the list box (`[data-dialog-list]`) scrolls, so after setting its `scrollTop` to the end their `getBoundingClientRect().top` values are unchanged and the dialog itself does not scroll. The seed has only 3 식비 rows, so add a few fake ones to see the scroll.
- **Drill to 소분류.** Store `history.length`, then click `식비 소분류 보기`. The dialog closes, the address becomes `/dashboard/minor?month=<month>&major=식비` (search is URL-encoded), `history.length` grew by one, `document.activeElement` is the h2 `소분류 추이·분포`, `history.state.usr` is `null`, and the card shows `식비 소분류 월별 추이`. Use `navigate` `back`: you are on `/dashboard/major?month=<month>`. Reloading the 소분류 address leaves focus on `body`.
- **Narrow menu.** Click the link `소분류` in `대시보드 메뉴`. The address becomes `/dashboard/minor…` with the same search, `history.length` stays the same, and `document.activeElement` is the `소분류` link.
- **Month in the address.** Click `이전 달`. The address gains `?month=<previous month>` and `history.length` stays the same. The `대분류` link's `href` now ends with that `?month=`.
- **Back.** From a screen reached only by menu links, use `navigate` `back`. You land on the page you were on before entering the dashboard (`/`), not on a dashboard sub-screen.
- **Wide.** Set width 1280, go to `/dashboard/major/trend?month=<month>`. The sidebar highlights `그룹 대시보드` and `대분류`; only `대분류` has `aria-current="page"` (the parent has `aria-current="true"`), both cards show, and after load `#dashboard-trend` sits near the top of the scrolled area (`getBoundingClientRect().top` well below its unscrolled ~690px).
- **Trend range.** In `대분류별 추이`, pick `3개월`. The chart and `표로 보기` table show 3 months, each with 식비 ₩ 30,500.

## Gotchas

- The 대분류 transactions dialog closes as the drill-down navigates away, so the dialog's own focus return has no target; the 소분류 card heading takes focus instead. A dialog still mounted 1 s after `닫기` is its close animation, not a failure: check again after a moment.
- The trend range follows the page month only when the preset is relative. `직접 지정` keeps its own months.
- A short page cannot scroll the trend card all the way to the top; "scrolled" means it moved up, not that its top is 0.
- The `:view` scroll happens on entry at both widths, and once more when the summary arrives if it was still loading. Changing the month or the width afterwards does not scroll.
