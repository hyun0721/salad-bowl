# Dashboard

The dashboard (heading `대시보드`) combines a month of KRW transactions from group members who turned sharing on. Every sub-screen follows heading → month picker → 수입·지출 → (narrow) 대시보드 메뉴 → sub-screen. The total cards open a per-member dialog. The month applies to both 대분류 and 소분류, and lives in the address as `?month=YYYY-MM`. Both widths show 분포 (share) and 추이 (trend) together on one page.

## Sub-features

- `dash-routes` follows the address table, the same at both widths: `/dashboard` → `/dashboard/major`; `/dashboard/:level` is the screen itself; `/dashboard/:level/:view` (`share`|`trend`) is the same screen scrolled to that card; an unknown `level` or `view` is treated like `/dashboard`. Every redirect is a replace and keeps the search (`?month=`, `?major=`).
- `dash-month` uses the month picker (`이전 달` / `다음 달`). It writes `?month=` with replace, so history does not grow. A missing or malformed month (`2026-13`) falls back to last month.
- `dash-totals` shows the 수입 and 지출 buttons. Each opens a `멤버별 수입` / `멤버별 지출` dialog listing members and a total.
- `dash-category` (대분류 분포) has a toggle `대분류 분포 보기 방식` (`차트로 보기` by default / `목록으로 보기`). The chart view shows a donut plus a list with amount and percent per 대분류. The list view uses the member bars described under `dash-member-bars`. In both views, clicking a row opens a dialog of that category's transactions. The view resets to chart when the month changes. Its header has two icon-only buttons: `<대분류> 소분류 보기` (bar chart) and `닫기` (X).
- `dash-trend` (대분류 추이) shows `대분류 추이`: a range segmented control (전월 비교 / 3·6·12개월 / 직접 지정, default 3개월), and a view toggle `대분류 추이 보기 방식` with icon buttons `차트로 보기` / `표로 보기` (chart by default). The chart view has category chips (top 5 on by default) and a line chart. The table view lists every category with a sparkline and, per month (newest first), the change from the previous month: `+12% ↑` / `-8% ↓` / `0%` / `신규` (previous month 0) / `—` (first month of the range, or previous month negative). Each cell's name and `title` carry that month's amount.
- `dash-minor` (`/dashboard/minor/*`) shows one `대분류 (필수)` select above two cards, `소분류 분포` and `소분류 추이`. The select's list comes from the latest six months through `?month=`. The select is driven by `?major=<대분류>`: changing it replaces the address (no new history entry); an unknown name shows the selection hint. `소분류 분포` has a toggle `소분류 분포 보기 방식` (`차트로 보기` donut plus legend, not clickable, negative 소분류 left out / `목록으로 보기` member bars including refunds, rows not clickable). `소분류 추이` works like `dash-trend` for the chosen 대분류 (default 3개월, chips `소분류 선택`).
- `dash-member-bars` is the list view of both 분포 cards. A legend group `멤버 범례` lists sharing members (dot + nickname, in `byMember` order, colors `--chart-1…8` cycling). Each row shows a bold category name, `₩ amount · 37.7%`, a bar (`role="img"`, named like `분류 비율과 각 멤버 금액 (seed-expected.json 참조)`) whose length is the category's share of positive spending, split into member-colored segments, and a member line below it (`● ₩ 금액`, nickname appears once in the legend and remains in screen-reader text and hover titles; a negative member reads `환불 초과`; 0원 members are left out). Clickable 대분류 rows carry the same member amounts in their button name. Member data comes from `GET /groups/{id}/summary/members?month=`, fetched only in list view. While it loads or if it fails, the bar is one brand color with no legend or member line.
- `dash-drill` is the `<대분류> 소분류 보기` button in the transactions dialog: it closes the dialog and pushes `/dashboard/minor?month=…&major=…` (history grows by one; back returns to the 대분류 screen). Focus lands on the card heading `소분류 분포`. The focus hint lives in history state and is cleared right after use, so a reload does not move focus.
- `dash-menu` shows, on narrow screens only, `navigation "대시보드 메뉴"` with one link row, group `분류` [대분류 | 소분류]. The current one carries `aria-current="page"`. Links replace history, keep the search, and leave focus on the clicked link.
- `dash-scroll` scrolls to the `:view` card when the address has one (`/dashboard/major/trend`), at both widths, after the summary loads. The 소분류 screen scrolls the same way (`#dashboard-share`, `#dashboard-trend`).
- `dash-title` sets the tab title `대시보드 · 대분류` / `대시보드 · 소분류` at both widths.
- `dash-no-group` shows a notice instead of data when the user has no group.

## How to get to it (user POV)

- Click the menu link `대시보드` (wide) or the tab `대시보드` (narrow). Wide screens also have sidebar sub-links `대분류` and `소분류` under it.
- On narrow screens, switch 대분류/소분류 with `대시보드 메뉴`.
- From a 대분류 row's transactions dialog, the `<대분류> 소분류 보기` button.

## Driving it with the built-in browser

Preconditions:

- Baseline seed, with `검증그룹` selected and sharing on. The seed's last month is the default month.

- **Redirect and title.** At preset `mobile`, go to `/` and then click the tab `대시보드`. The address becomes `/dashboard/major` and the title `대시보드 · 대분류 · Salad Bowl`. `대시보드 메뉴` has one group `분류` with two links, and both `대분류 분포` and `대분류 추이` show (`#dashboard-share` and `#dashboard-trend` are not `hidden`). Check `history.length` with `javascript_tool`: the redirect does not add an entry.
- **Totals.** 수입 shows `₩ 18,000,000` and 지출 shows `₩ 65,291,700`. Click `지출 ₩ 65,291,700`: a dialog `멤버별 지출` opens with one icon button named `닫기` (no visible text). Click it.
- **Category list.** 지난달 대분류 45개. 식비는 ₩ 2,351,700 (3.6%). 나머지 금액·비율은 [생성 기대값](seed-expected.json)을 참조한다.
- **Member bars.** `목록으로 보기`에서 검증러·검증둘·검증셋이 표시되고 비공개러는 범례와 집계에 없어야 한다. 식비 배달은 검증둘, 쇼핑은 검증셋 비중이 크다. 각 멤버명은 범례에 한 번만 보이고 행에는 같은 색 점과 금액이 남는다. 금액의 title·스크린리더 텍스트에는 멤버명이 남아 있어야 한다. 375px에서 가로 넘침을 확인한다.
- **Category drill-down.** Click the 식비 row. A dialog titled `식비` shows `72건 · 합계 ₩ 2,351,700` and lists synthetic transactions from all three sharing members. On narrow screens it opens as a bottom sheet. Its header has `식비 소분류 보기` then `닫기`, both icon-only. The list uses the same layout as the transactions list: on wide screens the columns are 일시 · 멤버 · 소분류 · 내용 · 결제수단 · 금액 (일시 and 금액 sortable); on narrow screens each card's second line is `배달 · 검증러`. The 대분류 is left out because it is the dialog title (then ` | 메모` when there is one) with the time on the right. The title row, the `N건 · 합계` line and the column headers stay in place: only the list box (`[data-dialog-list]`) scrolls, so after setting its `scrollTop` to the end their `getBoundingClientRect().top` values are unchanged and the dialog itself does not scroll. The seed has 72 식비 rows in 지난달, enough to check scrolling.
- **Drill to 소분류.** Store `history.length`, then click `식비 소분류 보기`. The dialog closes, the address becomes `/dashboard/minor?month=<month>&major=식비` (search is URL-encoded), `history.length` grew by one, `document.activeElement` is the h2 `소분류 분포`, `history.state.usr` is `null`, and the select shows `식비` with a donut of 24개 소분류 (정확한 비율은 seed-expected.json 참조). Use `navigate` `back`: you are on `/dashboard/major?month=<month>`. Reloading the 소분류 address leaves focus on `body`.
- **Narrow menu.** Click the link `소분류` in `대시보드 메뉴`. The address becomes `/dashboard/minor…` with the same search, `history.length` stays the same, and `document.activeElement` is the `소분류` link.
- **Month in the address.** Click `이전 달`. The address gains `?month=<previous month>` and `history.length` stays the same. The `대분류` link's `href` now ends with that `?month=`.
- **Back.** From a screen reached only by menu links, use `navigate` `back`. You land on the page you were on before entering the dashboard (`/`), not on a dashboard sub-screen.
- **Wide.** Set width 1280, go to `/dashboard/major/trend?month=<month>`. The sidebar highlights `대시보드` and `대분류`; only `대분류` has `aria-current="page"` (the parent has `aria-current="true"`), both cards show, and after load `#dashboard-trend` sits near the top of the scrolled area (`getBoundingClientRect().top` well below its unscrolled ~690px).
- **Trend range.** 3개월 표에서 지난달·두 달 전·세 달 전 순서: 식비 +15% / +6% / —, 교통 -25% / -20% / —, 쇼핑 0% / 0% / —. 6·12개월도 데이터가 있다. 식비 소분류에서 신규는 두 달 전에 처음 발생하고, 재등장은 지난달에 다시 발생한다. 두 달 전 환불초과는 순지출 음수라 목록에만 표시된다.


## Gotchas

- The 대분류 transactions dialog closes as the drill-down navigates away, so the dialog's own focus return has no target; the 소분류 card heading takes focus instead. A dialog still mounted 1 s after `닫기` is its close animation, not a failure: check again after a moment.
- The trend range follows the page month only when the preset is relative. `직접 지정` keeps its own months.
- A short page cannot scroll the trend card all the way to the top; "scrolled" means it moved up, not that its top is 0.
- The `:view` scroll happens on entry at both widths, and once more when the summary arrives if it was still loading. Changing the month or the width afterwards does not scroll.
