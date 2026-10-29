---
name: verify
description: Launch an isolated Salad Bowl stack (Postgres + Spring API + Vite web) on side ports, seed a test account with 3 months of fake Banksalad data, and drive the web UI in a browser at desktop or mobile width to prove a change works. Use after any change to apps/web or apps/api that a user would see, or to check a menu, page, or flow listed in features/.
---

# Verify Salad Bowl

The user-facing surface is the web app (React SPA, PWA). It has two layouts split at `(max-width: 820px)`: a left sidebar for wide screens and a bottom tab bar plus account sheet for narrow screens. Always check both widths when a change touches navigation or layout. The API (`apps/api`) is only reached through the web app's `/api` proxy.

The user often has their own dev stack running on 5432/8080/5173. Never drive or kill that one. This skill runs its own copy on **55432 (DB) / 18080 (API) / 15173 (web)**. All helpers live in `.claude/skills/verify/bin/` and are run from the repo root.

## Launch

```bash
.claude/skills/verify/bin/up.sh      # prints "READY http://localhost:15173"; first run builds the API jar (several minutes)
.claude/skills/verify/bin/seed.sh    # prints the import result JSON, then "SEEDED group=<id>"
```

`up.sh` refuses to start if any of the three ports is already in use. It starts a fresh Postgres container with no volume (`salad-verify-pg`), so every launch begins with an empty DB. Flyway migrates it when the API starts. Ready means `GET http://localhost:15173/api/actuator/health` returns `UP` through the Vite proxy. `seed.sh` only works on an empty DB: run it once per launch.

What the seed creates:
- Account `verify@example.test` / `verify-pass-1234`, nickname `검증러`. Both live in `bin/env.sh`.
- Group `검증그룹` with sharing turned on.
- One upload covering the 3 months before today. Each month has 5 expenses and 1 income: 식비(점심·카페·배달), 교통(택시), 쇼핑(의류), 급여(월급).

Logs and pid files go to `$TMPDIR/salad-verify/`.

## Doctor

```bash
.claude/skills/verify/bin/doctor.sh
```

This check only reads. It confirms the container is running, both pids are alive, each port is owned by the pid this run started, health is UP through the proxy, the seed login works, and which git revision is being served (`+dirty` means the working tree has uncommitted edits). If anything FAILs, read `$TMPDIR/salad-verify/{api,web}.log` before you drive. Vite hot-reloads `apps/web` edits. API edits need `down.sh` then `up.sh`.

## Drive

Use the built-in browser (`mcp__Claude_Browser__*`).

1. Set a width first with `resize_window` (a hidden pane reports a 0×0 viewport and `read_page` returns an empty page). Then `navigate` to `http://localhost:15173/login` and wait about 3 seconds: the SPA renders after its first silent refresh, which logs two expected 401s in the console.
2. Log in: `find "textbox"` returns `이메일` and `비밀번호`. Fill `이메일` with `verify@example.test` and `비밀번호` with `verify-pass-1234`, then press Return. You land on `/` with the heading `내 가계부`.
3. Widths:
   - `resize_window` preset `mobile` (375×812) gives the narrow layout: bottom tab bar and account sheet.
   - preset `desktop` gives the sidebar. Reset to `desktop` when you finish.
   - Reload after switching, because the layout is picked from a media query.
4. Navigate the way a user does: click links inside `navigation "주 메뉴"`. On narrow screens the tabs are labelled 홈/대시보드/거래/업로드/그룹. On wide screens they are 홈/그룹 대시보드/거래 목록/업로드/그룹 관리. The active link has `aria-current="page"`.
5. Money renders as `₩ 30,500`. Read the result with `read_page` or `get_page_text`, and use `find` with accessible names. Avoid coordinates and CSS classes: CSS Modules hash the class names.

Per-feature recipes are in [features/README.md](features/README.md).

## Evidence

Put the proof for each run in `.verify-artifacts/<feature-id>-<yyyymmdd-hhmm>/`. That directory is gitignored and cleanup never touches it.
- **Before and after:** save `read_page` output (accessibility tree) or `get_page_text` to `*.txt`, for the state before the action and the state after it.
- **Screenshot** at each width you claim. The built-in browser returns screenshots inline. Save a text note naming what each one shows, plus the URL.
- **Side effects:** confirm with a second, read-only path. Reload the page, or call the API with the seed token (`curl -H "Authorization: Bearer …" http://localhost:15173/api/me/coverage?year=YYYY`). Don't trust a toast alone.
- Drive the real user path: menu links, buttons, dialogs. Don't seed through test-only endpoints. Mock nothing: the stack is real end to end.

## Cleanup

```bash
.claude/skills/verify/bin/down.sh
```

This kills only the pids in `$TMPDIR/salad-verify/*.pid` and removes the `salad-verify-pg` container (taking its data with it). It keeps logs and `.verify-artifacts/`. Never `pkill java` or `pkill node`: the user's own dev stack runs the same binaries. Run `down.sh` after every failed attempt as well.

## Helpers

| Script | What it does |
|---|---|
| `bin/env.sh` | Shared ports, paths, and seed account. Sourced by the other scripts. |
| `bin/up.sh` | Fresh DB, then API jar, then Vite with `API_PROXY_TARGET`. Prints `READY`. |
| `bin/seed.sh` | Signup, group, share on, upload of fake xlsx made by `make_xlsx.py`. |
| `bin/doctor.sh` | Read-only health checks. Exit code 0 means everything passed. |
| `bin/down.sh` | Tears down what this run started. Keeps evidence. |
| `bin/make_xlsx.py <out.xlsx>` | Writes a fake Banksalad export (sheet `가계부 내역`) for the 3 months before today. |
