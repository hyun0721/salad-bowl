# Navigation shell

Every signed-in page shares one shell. Wide screens get a left sidebar and a header with the group selector, nickname, and logout. Narrow screens (≤820px) get a bottom tab bar, a one-line header with the logo, the group selector, and an `계정` button that opens a bottom sheet with the nickname and logout. Changing the top-level menu (the first path segment) moves focus to the new page's `h1`; moving within the same segment, such as between dashboard sub-screens, leaves focus on the clicked link. The one exception is the dashboard drill-down button `<대분류> 소분류 보기`, which moves focus to the 소분류 card heading (see dashboard.md).

## Sub-features

- `nav-sidebar` shows five sidebar links on wide screens: 홈, 소득공제, 대시보드, 거래 목록, 그룹 관리. Under 소득공제 sits the indented sub-link `입력자료` (`/tax/inputs`), plus `연도별 세법 관리` (`/tax/law`) for service admins only. Under 대시보드 sit indented sub-links `대분류` (`/dashboard/major`) and `소분류` (`/dashboard/minor`). Inside the dashboard the dashboard sub-links replace history and keep `?month=`; the 소득공제 sub-link never takes `?month=`.
- `nav-tabs` shows five bottom tabs on narrow screens: 홈, 소득공제, 대시보드, 거래, 그룹. The tabs ignore sub-links; the dashboard has its own `대시보드 메뉴` (see dashboard.md). 소득공제 shows the in-page `소득공제 메뉴` (`입력자료 | 세법 관리`) to service admins only; members have one sub-screen and no in-page menu (see tax-law.md).
- `nav-active` marks the current page link with `aria-current="page"`. Home matches `/` exactly. Other links also match sub-paths, so on `/dashboard/major` both `대시보드` and `대분류` are highlighted. Only `대분류` gets `aria-current="page"`; the parent gets `aria-current="true"`. `/tax/inputs` works the same way for `소득공제` and `입력자료`.
- `nav-account` opens the account sheet with the nickname and logout (narrow screens).
- `nav-group` uses the header `그룹` select to change the group that group-scoped pages show.

## How to get to it (user POV)

- It is visible on every page after login.
- On narrow screens, tap `계정` in the header.

## Driving it with the built-in browser

Preconditions:

- Baseline state, logged in, seed group `검증그룹` selected.

- **Wide links.** Use preset `desktop`, then reload. Run `find "주 메뉴"` and click each link. Each click changes the `h1` and moves `aria-current` to the clicked link. As the service admin `verify@example.test` the link list reads 홈, 소득공제, 입력자료, 연도별 세법 관리, 대시보드, 대분류, 소분류, 거래 목록, 그룹 관리. As the member `verify2@example.test` it has no `연도별 세법 관리`.
- **Narrow tabs.** Use preset `mobile`, then reload. The same nav holds 5 tab links with the short labels. The sidebar is gone from the accessibility tree.
- **Account sheet.** In `mobile`, click the button `계정`. A sheet titled `계정` shows `검증러` and a logout button.

## Gotchas

- The layout is picked by a media query at render time, so resizing without a reload can leave the old layout up.
- The tab bar splits its width evenly by the number of tabs (five since 소득공제). Check that `소득공제` and `대시보드` still fit at 320px and 375px.
