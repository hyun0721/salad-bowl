# Group dashboard

The dashboard (`/dashboard`, heading `그룹 대시보드`) combines a month of KRW transactions from group members who turned sharing on. It shows income and expense totals, a donut chart and list of expense by major category (대분류), a per-member table, and a major-category trend line chart over a chosen range. Clicking a category opens that category's transactions.

## Sub-features

- `dash-month` uses the month picker (`이전 달` / `다음 달`) to change the month for totals, donut, and member table. It does not change the trend's own range.
- `dash-totals` shows the 수입 and 지출 cards.
- `dash-category` shows `카테고리별 지출` as a donut plus a list with amount and percent per 대분류. Clicking a row opens a dialog of that category's transactions.
- `dash-member` shows a `멤버별` table of income and expense per member.
- `dash-trend` shows `대분류별 추이`: a `기간` segmented control (전월 비교 / 3·6·12개월 / 직접 지정), category chips (`대분류 선택`, top 5 on by default), a line chart, and `표로 보기`.
- `dash-no-group` shows a notice instead of data when the user has no group.

## How to get to it (user POV)

- Click the menu link `그룹 대시보드` (wide) or `대시보드` (narrow).

## Driving it with the built-in browser

Preconditions:

- Baseline seed, with `검증그룹` selected and sharing on.

- **Totals.** Open the dashboard from the menu. It defaults to last month. 수입 shows `₩ 3,000,000` and 지출 shows `₩ 71,500`.
- **Category list.** `find "카테고리별 지출"`. The rows are buttons named like `식비 43% ₩ 30,500`, then 쇼핑 41% ₩ 29,000 and 교통 17% ₩ 12,000.
- **Category drill-down.** Click the 식비 row. A dialog titled `식비` shows `3건 · 합계 ₩ 30,500` and lists 치킨 (배달), 커피 (카페), 김밥 (점심). On narrow screens it opens as a bottom sheet. Click `닫기`.
- **Trend.** In `대분류별 추이`, pick `3개월`. The chart and `표로 보기` table show 3 months, each with 식비 ₩ 30,500.
- **Narrow.** Repeat at preset `mobile`. The preset labels shorten to 전월/3개월/6개월/12개월/직접.

## Gotchas

- Everything sits on one page today. There are no sub-routes, so a route-level change shows up as new paths, not as new query strings.
- The trend range follows the page month only when the preset is relative. `직접 지정` keeps its own months.
- Neither the summary API nor the trend API breaks down by 소분류 (minor category). The data is stored, but nothing reads it yet.
