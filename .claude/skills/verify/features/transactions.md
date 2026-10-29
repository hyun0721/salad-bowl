# Transactions

Transactions (`/transactions`, heading `거래 목록`) lists my transactions or a group member's shared ones, with search, a detail panel for editing category, memo, and hidden, and a manual `거래 추가` form.

## Sub-features

- `tx-scope` uses the `범위` segmented control: `내 거래` or `그룹 거래` (disabled with no group), plus a `멤버` select for group scope.
- `tx-search` uses the `검색` field to filter by description or category.
- `tx-detail` opens a panel named after the transaction description when you click a row (`거래 상세`).
- `tx-add` uses `거래 추가` to open the panel `거래 추가 (수동)` with 대분류/소분류 suggestions.

## How to get to it (user POV)

- Click the menu link `거래 목록` (wide) or `거래` (narrow).
- On home, click the link `내 거래 보기`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed has 18 of my transactions.

- **List.** Open from the menu. With `내 거래` selected, the list shows seeded rows such as `김밥`.
- **Search.** Type `택시` into `검색`. Only the 3 taxi rows remain.
- **Detail.** Click a row. A panel named after the description opens with the category fields.

## Gotchas

- At narrow width the detail panel opens as an overlay instead of a side panel. Check that it closes.
