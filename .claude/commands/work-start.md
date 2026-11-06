---
description: 작업 시작 절차. 최신 main 기준으로 브랜치·코드베이스를 갱신하고, 같은 메시지의 작업을 바로 진행
argument-hint: <작업 설명>
---

작업 설명: $ARGUMENTS

git 명령은 단순하게 실행한다(반복문이나 복잡한 파이프에 넣으면 worktree 격리 검사에 막힐 수 있다).
근거는 `docs/site/workflow.html`이다.

`/clear` 직후 같은 메시지에 작업을 적은 경우, 작업 설명이 곧 첫 요청이다.
이전 대화를 요약하거나 되묻지 않고, 아래 준비를 마친 뒤 바로 작업에 들어간다.

1. `git fetch --prune origin`, `git rev-parse --show-toplevel`, `git worktree list`.
   현재 폴더가 목록의 첫 줄(기본 체크아웃)이거나 없으면 거기서 작업하지 않는다.
2. 이 worktree를 재사용할 수 있는지 본다: `git status -sb`, `git log origin/main..HEAD --oneline`,
   `gh pr list --head <브랜치> --state all`.
   - 미커밋 변경과 열린 PR이 없고, main에 없는 커밋이 없거나 병합된 PR의 `headRefOid`가 HEAD와 같으면 → 같은 worktree에서
     `git switch -c <type>/<작업명> origin/main`. 병합한 브랜치 이름은 다시 쓰지 않는다.
     이전 브랜치는 `/work-end`에서 정리할 대상이므로 이름만 보고한다.
   - 그 밖에는 건드리지 않고 새 worktree를 만든다. 상대 경로면 현재 worktree 안에 중첩되니 절대 경로를 쓴다:
     `git worktree add <기본 체크아웃>/.claude/worktrees/<작업명> -b <type>/<작업명> origin/main`.
     세션은 그 폴더로 옮겨 가지 않고, 현재 worktree에 격리돼 있으면 쓸 수도 없다. 그 사실을 알리고 새 세션에서 시작하도록 안내한다.
3. 기본 체크아웃이 `main`이고 깨끗하면 `git -C <기본 체크아웃> pull --ff-only origin main`으로 맞춘다.
   깨끗하지 않거나 세션 격리로 막히면 건드리지 말고 보고한다. 새 브랜치는 `origin/main` 기준이라 작업에 지장이 없다.
4. 바뀐 점 파악: 이전 HEAD와 `origin/main` 사이 `git log --oneline`을 훑고, 작업과 관련된 스펙·계획·`docs/backlog.md`가
   최신 코드와 맞는지 대조한다. 어긋나면 작업 시작 전에 알린다.
5. 환경 준비는 필요한 것만:
   - `apps/web/node_modules`가 없거나 전환으로 `apps/web/package-lock.json`이 바뀌었으면 `apps/web`에서 `npm ci`(Node는 `.nvmrc`).
   - `graphify-out/`이 없으면 만들지 않고 일반 검색으로 진행한다.
   - 검증 스택 포트(55432/18080/15173)가 사용 중이면 다른 세션의 것이다. 건드리지 않고 UI 검증 불가로 기록한다.
6. 작업 크기를 정한다. 한 세션에서 끝나면 스펙·계획 문서 없이 대화에서 설계 승인을 한 번 받고
   `codex-collab` 역할 표대로 구현·리뷰를 나눈다. 여러 세션·PR에 걸치거나 가져오기 중복 판정·웹 수정 보호·소유권·
   공개 범위·인증·쿠키·삭제를 바꾸면 문서를 쓴다.
7. 작업 설명이 비었으면 준비 상태(브랜치, 기준 커밋, 남은 정리 대상)를 3줄로 보고하고 작업을 묻는다.
