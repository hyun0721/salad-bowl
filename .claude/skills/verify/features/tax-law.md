# Tax law admin

소득공제 › 연도별 세법 관리 (`/tax/law`, `h1` `연도별 세법 관리` on wide screens) is for service admins only. It lists the law versions of the selected tax year (drafts and applied versions, newest number first), lets an admin create drafts, edit and save them, validate them, apply one, and delete drafts. Applied versions are read-only text with no delete. A member who is not a service admin never sees the menu or the tab, and gets the `권한 없음` screen on the address; the server also answers 403 on every admin request. Every confirm dialog opens centered at every width.

## Sub-features

- `law-menu` adds the third sub-link `연도별 세법 관리` under `소득공제` in the sidebar, for service admins only. On narrow screens a service admin sees the in-page `소득공제 메뉴` with `입력자료`, `분석·지출계획` and `세법 관리`; members see only the first two.
- `law-forbidden` shows `권한 없음`, `이 화면은 서비스 관리자만 볼 수 있어요.`, and the link `입력자료로 가기` to a member who opens `/tax/law`. The page sends no admin request then. A 403 from the version list (for example after the admin flag is revoked) shows the same screen.
- `law-list` shows `YYYY년 버전` with `현재 적용 vN · 초안 n개` (or `적용 버전 없음(회원 화면은 "세법 준비 중")`), and one row per version: `vN · 초안 | 적용 | 현재 적용`, then `작성 <nickname> · YYYY-MM-DD HH:mm` for drafts or `적용 <nickname> · …` for applied versions. `[새 초안 만들기]` stays enabled while drafts exist. Each draft row has `[삭제]` on the right; applied rows have none.
- `law-detail` opens the newest version by default; clicking a row opens it. The heading reads `YYYY년 귀속 vN · 초안` or `… · 적용 · 읽기 전용`, with `계산 알고리즘 버전 1 (고정)` and the creation and apply history. `세법 수치 도움말` explains the salary bracket and the extra limit.
- `law-edit` (drafts) has groups `비율 (%)` (6 rates), `급여구간 (원)`, `기본한도 · 경계 이하 (원)` and `기본한도 · 경계 초과 (원)` (`자녀등 0명`, `자녀등 1명`, `자녀등 2명 이상`), `추가한도 상한 (원)`, and `근거·적용 대상 기간` (법령명, 조문, 근거 URL, two dates, `메모 (선택)`). `[초안 저장]` saves the whole draft. While there are unsaved changes, `[검증]` and `[적용]` are disabled and the bottom line says why.
- `law-validate` lists failures as `<field name>: <message>` under `검증 실패 — 적용할 수 없어요.`, or shows `검증 통과 — 적용할 수 있어요.`.
- `law-apply` asks once in `YYYY년 귀속 vN 적용`, which says other drafts stay drafts. After applying, the row reads `vN · 현재 적용` and the detail becomes read-only.
- `law-delete` asks once in `YYYY년 귀속 vN 초안을 삭제할까요?`. Numbers are never reused.

## How to get to it (user POV)

- As a service admin on wide screens, click `연도별 세법 관리` under `소득공제` in `navigation "주 메뉴"`.
- As a service admin on narrow screens, tap the bottom tab `소득공제`, then `세법 관리` in `navigation "소득공제 메뉴"`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed. `verify@example.test` is a service admin and the `YYYY` law (this Korean year) is applied as v1 with the 2026 values. `verify2@example.test` is a regular member.

- **Member.** Log in as `verify2@example.test`. At `desktop`, the sidebar reads 홈, 소득공제, 입력자료, 분석·지출계획, 대시보드, … with no `연도별 세법 관리`. At `mobile`, the `소득공제 메뉴` reads `입력자료 | 분석·지출계획` with no `세법 관리`. Type `/tax/law`: `권한 없음` shows, and the network panel has no `/api/tax/admin/` request. `입력자료로 가기` opens `/tax/inputs`.
- **Admin menu.** Log in as `verify@example.test`. At `desktop` the sidebar has `연도별 세법 관리` as the third sub-link under `소득공제`; clicking it shows `h1` `연도별 세법 관리` and marks the link `aria-current="page"`. At `mobile` and at 320×700, the in-page menu reads `입력자료 | 분석·지출계획 | 세법 관리`, the header title stays `소득공제`, and switching keeps focus on the tapped link.
- **List and read-only v1.** The list reads `현재 적용 v1 · 초안 0개`. v1 shows as text with `적용된 버전은 고칠 수 없어요. 바꾸려면 새 초안을 만드세요.`, no inputs, and no `[삭제]`.
- **Drafts.** Click `[새 초안 만들기]` twice: v2 and v3 appear as drafts copied from v1, and the button stays enabled. Change `신용카드 공제율` in v3: `[검증]` and `[적용]` turn off with the reason line. Save, then reload the page and confirm the value stayed.
- **Validate.** In v3, set `문화체육 공제율` to 130, clear `기본한도 · 경계 초과 (원)` › `자녀등 1명`, save, and press `[검증]`: the alert lists `문화체육 공제율: 0~100 사이로 입력하세요` and `기본한도 · 경계 초과 · 자녀등 1명: 값을 입력하세요`. Restore the values (30, ₩ 2,750,000), save, validate again: `검증 통과`.
- **Delete.** Delete v2 from its row (one centered confirmation at `mobile`). The list keeps v3 and v1. Creating another draft gives v4, not v2.
- **Apply.** Apply v3 at `mobile`: the dialog is centered and says `다른 초안은 초안으로 남아요.`. After applying, v3 reads `현재 적용` and v1 reads `적용`; v4 stays a draft.
- **Help.** Tap `세법 수치 도움말`, tap again, tap outside, press Esc: it closes each time, focus returns to `?`, and no request is sent.
- **Font sizes.** In the browser, read computed sizes: version name 15px, history line 13px, card titles 16px, section buttons 14px, field labels 13px, input text 16px at `mobile`.
- **States.** Stop the stack's API briefly: the page shows `세법 버전을 불러오지 못했어요.` with `[다시 시도]`. Saving while it is down shows the network message and keeps the input.

## Gotchas

- The admin flag comes from `/me` at sign-in, so the menu changes only after a reload. The server checks every request: a revoked admin sees `권한 없음` on the next list request (page reload, year change, or reload after apply/delete); save and apply requests before that are rejected with an authorization error.
- Validate and apply use the saved draft, not the unsaved form. That is why both turn off while the form has changes.
- A 409 or 404 on save keeps the input and shows `[다시 불러오기]`. On validate, apply, or delete, the list reloads and the line `다른 곳에서 바뀌어 새로 불러왔어요.` appears above it. Validate and apply reopen an existing draft form with the new values; if that draft was deleted, the next available version is selected. Delete closes its confirmation dialog.
- Applying changes what every member's tax screens use. Restore by relaunching the stack for a clean DB; applied versions cannot be deleted.
- The year select offers last, this and next Korean year only, the same as the inputs page.
