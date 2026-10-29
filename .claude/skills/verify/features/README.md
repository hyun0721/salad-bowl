# Salad Bowl verification map

This directory is the maintained source for verifying what a Salad Bowl user sees. Read this index first, then use the matching feature file as the recipe.

## Baseline preconditions

- `bin/up.sh` printed `READY http://localhost:15173`.
- `bin/seed.sh` printed `SEEDED`, and `bin/doctor.sh` exits with code 0.
- You are logged in as `verify@example.test` in the built-in browser.
- Never drive the user's dev stack on 5173/8080.

## Driving conventions

- Every journey runs at **both widths** unless its file says otherwise: `resize_window` preset `mobile` (bottom tabs) and preset `desktop` (sidebar). Reload after each switch.
- Go between pages through `navigation "주 메뉴"` links. Typing a URL is a separate entry point. If you claim deep-link support, check it on its own.
- Use accessible names (`find`, `read_page`) over coordinates.
- Restore anything a journey changes before the next journey, or relaunch for a clean DB.

## Proof and skip reporting

- Capture the action and the resulting state as `read_page` text, plus a screenshot at each width.
- Confirm a mutation through a second read-only view: reload the page or call the API.
- Report a journey you could not complete with the failing step and the unmet precondition. Never report it as passed through another path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then exactly four H2s in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with the built-in browser`, `Gotchas`.

## Features

- [Navigation shell](./navigation.md): sidebar or bottom tabs, account sheet, group selector.
- [Home](./home.md): last month's upload status and summary.
- [Group dashboard](./dashboard.md): monthly totals, category donut, per-member table, category trend.
- [Upload](./upload.md): monthly upload coverage, Banksalad xlsx upload, and upload history.
- [Transactions](./transactions.md): my or group transaction list, search, detail, manual add.
- [Groups](./groups.md): create, rename, invite link, members, bans.
