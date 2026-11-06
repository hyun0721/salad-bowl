# Transactions

Transactions (`/transactions`, heading `거래 목록`) lists my transactions or a group member's shared ones, with search, a detail panel for editing category, memo, and hidden, and a manual add form opened by the `+ 추가` button (accessible name `거래 추가`).

## Sub-features

- `tx-scope` uses the `범위` segmented control: `내 거래` or `그룹 거래` (disabled with no group), plus a `멤버` select for group scope.
- `tx-search` uses the `검색` field to filter by description or category.
- `tx-detail` opens a panel named after the transaction description when you click a row (`거래 상세`).
- `tx-add` uses the button named `거래 추가` (visible text `추가`) to open the panel `거래 추가 (수동)` with side-by-side 대분류/소분류 Select fields. Only existing categories can be selected; custom category input is unavailable. 대분류 is required (placeholder `선택`); 소분류 defaults to `소분류 없음` and resets when 대분류 changes. The major selector is disabled while loading or when no categories exist. An empty list shows `엑셀을 먼저 업로드하면 분류를 고를 수 있습니다.`; a fetch failure shows `분류를 불러오지 못했습니다.` and `분류 다시 시도`.

## How to get to it (user POV)

- Click the menu link `거래 목록` (wide) or `거래` (narrow).
- On home, click the card `수입 ₩ …`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed has 12,960 of my transactions across 12 months (지난달 1,081).

- **List.** Open from the menu. With `내 거래` selected, the list shows seeded rows such as `김밥`.
- **Search.** Type `택시` into `검색`. Only the 3 taxi rows remain.
- **Detail.** Click a row. A panel named after the description opens with the category fields.
- **Narrow layout.** At 375×812 the page fits the viewport: `document.documentElement.scrollHeight` equals `innerHeight`, the list scrolls inside its own box, the list spans the full screen width, and the list extends down to the tab bar without a pager. Other narrow pages keep the page-scroll layout (`main` stays `overflow: visible`); the dashboard is long enough to show it (`scrollHeight` > `innerHeight`).
- **Cards (narrow).** Line 1 is description and amount. Line 2 is `대분류 · 소분류` (plus `· 멤버` in group scope), then ` | 메모` when there is a memo, and the time on the right under the amount. Long text ends with an ellipsis.
- **Progressive rendering.** Start with 300 rows. A sentinel inside the list scroll area renders 300 more when within 600px of the end; it keeps extending while visible and disappears once all rows are rendered. The hidden `status` reads `300 / 1081건 표시`. Sorting resets to 300 rows and scrolls to the top; refetching preserves the rendered count. Select all includes rows not rendered yet.

## Gotchas

- At narrow width the detail panel opens as an overlay instead of a side panel. Check that it closes.
- The seed has 6 transactions a month, which does not overflow the list at 375×812. Add a few fake ones through the add form (or `POST /api/me/transactions` with the seed token) to see the inner scroll.
- If the sidebar view was open on a wide window and the window narrows, the list and the panel stack vertically and each scrolls on its own.
