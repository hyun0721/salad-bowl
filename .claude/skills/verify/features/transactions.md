# Transactions

Transactions (`/transactions`, heading `거래 목록`) lists my transactions or a group member's shared ones, with search, a detail panel for editing category, memo, and hidden, and a manual add form opened by the `+ 추가` button (accessible name `거래 추가`).

## Sub-features

- `tx-scope` uses the `범위` segmented control: `내 거래` or `그룹 거래` (disabled with no group), plus a `멤버` select for group scope.
- `tx-search` uses the `검색` field to filter by description or category.
- `tx-detail` opens a panel named after the transaction description when you click a row (`거래 상세`).
- `tx-add` uses the button named `거래 추가` (visible text `추가`) to open the panel `거래 추가 (수동)` with 대분류/소분류 suggestions.

## How to get to it (user POV)

- Click the menu link `거래 목록` (wide) or `거래` (narrow).
- On home, click the link `내 거래 보기`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed has 18 of my transactions.

- **List.** Open from the menu. With `내 거래` selected, the list shows seeded rows such as `김밥`.
- **Search.** Type `택시` into `검색`. Only the 3 taxi rows remain.
- **Detail.** Click a row. A panel named after the description opens with the category fields.
- **Narrow layout.** At 375×812 the page fits the viewport: `document.documentElement.scrollHeight` equals `innerHeight`, the list scrolls inside its own box, the list spans the full screen width, and the pager sits just above the tab bar. Other narrow pages keep the page-scroll layout (`main` stays `overflow: visible`); the dashboard is long enough to show it (`scrollHeight` > `innerHeight`).
- **Cards (narrow).** Line 1 is description and amount. Line 2 is `대분류 · 소분류` (plus `· 멤버` in group scope), then ` | 메모` when there is a memo, and the time on the right under the amount. Long text ends with an ellipsis.
- **Pager.** The footer `nav "거래 목록 페이지"` shows only `현재 / 전체` next to icon buttons `이전 페이지` and `다음 페이지`. Its `status` also reads the hidden range such as `1–11 / 11건`.

## Gotchas

- At narrow width the detail panel opens as an overlay instead of a side panel. Check that it closes.
- The seed has 6 transactions a month, which does not overflow the list at 375×812. Add a few fake ones through the add form (or `POST /api/me/transactions` with the seed token) to see the inner scroll.
- If the sidebar view was open on a wide window and the window narrows, the list and the panel stack vertically and each scrolls on its own.
