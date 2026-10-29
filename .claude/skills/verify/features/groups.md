# Groups

Groups (`/groups`, heading `그룹 관리`) lists my groups, lets me create one (`그룹 이름`), and for the selected group shows settings (`새 이름`), an invite link (`초대 주소`, `링크 복사`), members, the share toggle, and bans. Invite links open `/invite/:token`.

## Sub-features

- `grp-list` shows `내 그룹`.
- `grp-create` uses `그룹 이름` and submit.
- `grp-rename` uses `새 이름` (owner only).
- `grp-invite` creates an invite link, shows it in `초대 주소`, and offers `링크 복사`. It is disabled when the group is full (6 members).
- `grp-members` lists members and bans.

## How to get to it (user POV)

- Click the menu link `그룹 관리` (wide) or `그룹` (narrow).
- With no group, click the header link `그룹 없음 · 만들기 또는 초대받기`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed has one group, `검증그룹`, with me as owner.

- **List.** Open from the menu. `내 그룹` lists `검증그룹`.
- **Invite.** Create an invite. `초대 주소` holds a URL containing `/invite/`.

## Gotchas

- Accepting an invite needs a second account. Sign it up through the login page's `회원가입` tab in a separate browser tab or profile, because the session cookie is shared.
