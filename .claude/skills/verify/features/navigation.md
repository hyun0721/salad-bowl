# Navigation shell

Every signed-in page shares one shell. Wide screens get a left sidebar and a header with the group selector, nickname, and logout. Narrow screens (≤820px) get a bottom tab bar, a one-line header with the logo, the group selector, and an `계정` button that opens a bottom sheet with the nickname and logout. Changing pages moves focus to the new page's `h1`.

## Sub-features

- `nav-sidebar` shows five sidebar links on wide screens: 홈, 그룹 대시보드, 거래 목록, 업로드, 그룹 관리.
- `nav-tabs` shows five bottom tabs on narrow screens: 홈, 대시보드, 거래, 업로드, 그룹.
- `nav-active` marks the current page link with `aria-current="page"`. Home matches `/` exactly. Other links also match sub-paths.
- `nav-account` opens the account sheet with the nickname and logout (narrow screens).
- `nav-group` uses the header `그룹` select to change the group that group-scoped pages show.

## How to get to it (user POV)

- It is visible on every page after login.
- On narrow screens, tap `계정` in the header.

## Driving it with the built-in browser

Preconditions:

- Baseline state, logged in, seed group `검증그룹` selected.

- **Wide links.** Use preset `desktop`, then reload. Run `find "주 메뉴"` and click each link. Each click changes the `h1` and moves `aria-current` to the clicked link.
- **Narrow tabs.** Use preset `mobile`, then reload. The same nav holds 5 tab links with the short labels. The sidebar is gone from the accessibility tree.
- **Account sheet.** In `mobile`, click the button `계정`. A sheet titled `계정` shows `검증러` and a logout button.

## Gotchas

- The layout is picked by a media query at render time, so resizing without a reload can leave the old layout up.
- Five tabs fill the 375px bar. Adding a sixth top-level tab is a design change: check that the labels still fit.
