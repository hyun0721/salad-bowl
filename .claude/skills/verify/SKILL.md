---
name: verify
description: Launch an isolated Salad Bowl stack (Postgres + Spring API + Vite web) on side ports, seed four test accounts with 12 months of fake Banksalad data, and drive the web UI in a browser at desktop or mobile width to prove a change works. Use after any change to apps/web or apps/api that a user would see, or to check a menu, page, or flow listed in features/.
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
- Four accounts in `bin/env.sh`, sharing `SEED_PASSWORD`: verify@example.test / 검증러 (owner), verify2@example.test / 검증둘, verify3@example.test / 검증셋, verify4@example.test / 비공개러.
- All join 검증그룹 through invitations. First three share ON, 비공개러 explicitly OFF (membership defaults ON).
- Previous 12 complete months, 45 expense majors × 24 minors, plus salary for each member. Monthly files keep each upload below the API's 92-day limit.
- 식비 신규 starts two months ago; 재등장 returns last month after missing months 2–4; 환불초과 is negative net spending two months ago. Private member adds 문화 공연 ₩ 990,000 monthly, excluded from group totals.
- `python3 -I .claude/skills/verify/bin/make_xlsx.py --expected` computes the relative-month reference in [features/seed-expected.json](features/seed-expected.json). Dashboard recipes use that reference.

Logs and pid files go to `$TMPDIR/salad-verify/`.

## Doctor

```bash
.claude/skills/verify/bin/doctor.sh
```

This check only reads. It confirms the container is running, both pids are alive, each port is owned by the pid this run started, health is UP through the proxy, the seed login works, and which git revision is being served (`+dirty` means the working tree has uncommitted edits). If anything FAILs, read `$TMPDIR/salad-verify/{api,web}.log` before you drive. Vite hot-reloads `apps/web` edits. API edits need `down.sh` then `up.sh`.

## Drive

Use the built-in browser (`mcp__Claude_Browser__*`).

1. Set a width first with `resize_window` (a hidden pane reports a 0×0 viewport and `read_page` returns an empty page). Then `navigate` to `http://localhost:15173/login` and wait about 3 seconds: the SPA renders after its first silent refresh, which logs two expected 401s in the console.
2. Log in: `find "textbox"` returns `이메일` and `비밀번호`. Fill `이메일` with `verify@example.test` and `비밀번호` with `verify-pass-1234`, then press Return. You land on `/` with the heading `홈`.
3. Widths:
   - `resize_window` preset `mobile` (375×812) gives the narrow layout: bottom tab bar and account sheet.
   - preset `desktop` gives the sidebar. Reset to `desktop` when you finish.
   - Reload after switching, because the layout is picked from a media query.
4. Navigate the way a user does: click links inside `navigation "주 메뉴"`. On narrow screens the tabs are labelled 홈/대시보드/거래/업로드/그룹. On wide screens they are 홈/그룹 대시보드/거래 목록/업로드/그룹 관리. The active link has `aria-current="page"`.
5. Money renders as `₩ 2,351,700`. Read the result with `read_page` or `get_page_text`, and use `find` with accessible names. Avoid coordinates and CSS classes: CSS Modules hash the class names.

Per-feature recipes are in [features/README.md](features/README.md).

## Evidence

Put the proof for each run in `.verify-artifacts/<feature-id>-<yyyymmdd-hhmm>/`. That directory is gitignored and cleanup never touches it.
- **Before and after:** save `read_page` output (accessibility tree) or `get_page_text` to `*.txt`, for the state before the action and the state after it.
- **Screenshot** at each width you claim. The built-in browser returns screenshots inline. Save a text note naming what each one shows, plus the URL.
- **Side effects:** confirm with a second, read-only path. Reload the page, or call the API with the seed token (`curl -H "Authorization: Bearer …" http://localhost:15173/api/me/coverage?year=YYYY`). Don't trust a toast alone.
- Drive the real user path: menu links, buttons, dialogs. Don't seed through test-only endpoints. Mock nothing: the stack is real end to end.

## Cleanup

포트가 이미 사용 중이면 다른 세션의 스택이다. 그 스택을 중지하거나 재사용하지 말고 검증 미실행으로 보고한다. `down.sh`는 이번 세션이 띄운 스택에만 실행한다.

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
| `bin/make_xlsx.py <out.xlsx>` | Writes a fake Banksalad export (sheet `가계부 내역`) for one selected month: `--member owner|second|third|private --back 1..12`. |
