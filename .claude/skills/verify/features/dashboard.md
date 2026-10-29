# Group dashboard

The dashboard (heading `그룹 대시보드`) combines a month of KRW transactions from group members who turned sharing on. Above every sub-screen it shows the month picker and the 수입·지출 total buttons, which open a per-member dialog. Below that it splits by address into 대분류 (major) and 소분류 (minor), each with 분포 (share) and 추이 (trend). Wide screens show 분포 and 추이 together on one page; narrow screens show one at a time. The month lives in the address as `?month=YYYY-MM`.

## Sub-features

- `dash-routes` follows the address table: `/dashboard` → `/dashboard/major` (wide) or `/dashboard/major/share` (narrow); `/dashboard/:level` → `/dashboard/:level/share` on narrow; an unknown `level` or `view` is treated like `/dashboard`. Every redirect is a replace and keeps `?month=`.
- `dash-month` uses the month picker (`이전 달` / `다음 달`). It writes `?month=` with replace, so history does not grow. A missing or malformed month (`2026-13`) falls back to last month.
- `dash-totals` shows the 수입 and 지출 buttons. Each opens a `멤버별 수입` / `멤버별 지출` dialog listing members and a total.
- `dash-category` (대분류 분포) shows `카테고리별 지출` as a donut plus a list with amount and percent per 대분류. Clicking a row opens a dialog of that category's transactions.
- `dash-trend` (대분류 추이) shows `대분류별 추이`: a range segmented control (전월 비교 / 3·6·12개월 / 직접 지정), category chips (top 5 on by default), a line chart, and `표로 보기`.
- `dash-minor` (`/dashboard/minor/*`) temporarily shows the old `소분류 추이·분포` card (pick a 대분류 to see its 소분류) until Plan 16d replaces it with 소분류 분포·추이.
- `dash-menu` shows, on narrow screens only, `navigation "대시보드 메뉴"` with two link rows: group `분류` [대분류 | 소분류] and group `보기` [분포 | 추이]. The current ones carry `aria-current="page"`. Links replace history, keep `?month=`, and leave focus on the clicked link.
- `dash-scroll` scrolls a wide screen to the `:view` card when the address has one (`/dashboard/major/trend`), after the summary loads.
- `dash-title` sets the tab title: wide `그룹 대시보드 · 대분류`, narrow `그룹 대시보드 · 대분류 분포` (and so on).
- `dash-no-group` shows a notice instead of data when the user has no group.

## How to get to it (user POV)

- Click the menu link `그룹 대시보드` (wide) or the tab `대시보드` (narrow). Wide screens also have sidebar sub-links `대분류` and `소분류` under it.
- On narrow screens, switch sub-screens with `대시보드 메뉴`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed, with `검증그룹` selected and sharing on. The seed's last month is the default month.

- **Redirect and title.** At preset `mobile`, go to `/` and then `/dashboard`. The address becomes `/dashboard/major/share` and the title `그룹 대시보드 · 대분류 분포 · Salad Bowl`. Check `history.length` with `javascript_tool`: it equals the value after `/`, plus one for the `/dashboard` visit, and the redirect does not add another entry.
- **Totals.** 수입 shows `₩ 3,000,000` and 지출 shows `₩ 71,500`. Click `지출 ₩ 71,500`: a dialog `멤버별 지출` opens. Click `닫기`.
- **Category list.** `find "카테고리별 지출"`. The rows are buttons named like `식비 43% ₩ 30,500`, then 쇼핑 41% ₩ 29,000 and 교통 17% ₩ 12,000.
- **Category drill-down.** Click the 식비 row. A dialog titled `식비` shows `3건 · 합계 ₩ 30,500` and lists 치킨 (배달), 커피 (카페), 김밥 (점심). On narrow screens it opens as a bottom sheet. Click `닫기`.
- **Narrow menu.** `find "추이"` and click the link `추이` in `대시보드 메뉴`. The address becomes `/dashboard/major/trend`, `history.length` stays the same, `document.activeElement` is the `추이` link, and `대분류별 추이` shows a sized chart.
- **Month in the address.** Click `이전 달`. The address gains `?month=<previous month>` and `history.length` stays the same. The `소분류` link's `href` now ends with that `?month=`.
- **Minor.** Click `소분류`. The address becomes `/dashboard/minor/trend?month=…` and the card `소분류 추이·분포` shows `대분류(필수)`.
- **Back.** Use `navigate` `back`. You land on the page you were on before entering the dashboard (`/`), not on a dashboard sub-screen.
- **Wide.** Set width 1280, go to `/dashboard/major/trend?month=<month>`. The sidebar marks `그룹 대시보드` and `대분류` current, both cards show, and after load `#dashboard-trend` sits near the top of the scrolled area (`getBoundingClientRect().top` well below its unscrolled ~690px).
- **Trend range.** In `대분류별 추이`, pick `3개월`. The chart and `표로 보기` table show 3 months, each with 식비 ₩ 30,500.

## Gotchas

- Narrow screens keep the unselected card mounted with `hidden`, so `find` can still return its heading even though it is not shown. Use a screenshot or `read_page` to judge what is visible.
- The trend range follows the page month only when the preset is relative. `직접 지정` keeps its own months.
- A short page cannot scroll the trend card all the way to the top; "scrolled" means it moved up, not that its top is 0.
- On a wide screen with a `:view` in the address, changing the month re-scrolls to that card after the new summary arrives.
