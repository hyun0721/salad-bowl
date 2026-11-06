---
description: 작업 종료 정리. 병합된 브랜치·worktree와 이번 세션이 띄운 서비스를 정리하고, 다음 작업에 쓸 자원은 유지
argument-hint: "[keep]"
---

인자: $ARGUMENTS

세션이 아니라 **작업**을 끝내는 절차다. 미완료 작업은 지우지 않는다.
삭제는 병합된 것과 이번 세션이 만든 것에만 한다. 근거는 `docs/site/workflow.html`이다.
git 명령은 단순하게 실행한다(반복문이나 복잡한 파이프에 넣으면 worktree 격리 검사에 막힐 수 있다).

1. 조회(읽기만): `git fetch --prune origin`, `git status -sb`, `git worktree list`, `git branch -vv`,
   `gh pr list --head <브랜치> --state all --json number,state,headRefOid`.
   미푸시 커밋은 `git log origin/<브랜치>..HEAD`로 본다. `origin/<브랜치>` ref가 없으면(`git rev-parse --verify --quiet`로 확인)
   `git log origin/main..HEAD`로 본다.
2. 판정. 브랜치는 **병합된 PR이 있고 그 `headRefOid`가 브랜치 끝 커밋과 같을 때만** 병합으로 본다.
   - 미커밋·미푸시·열린 PR이 있으면 이 브랜치와 worktree는 유지한다. 필요한 조치(WIP 커밋 푸시 등)만 알리고
     4단계의 서비스 정리만 한다. 열린 PR이면 Auto-fix가 켜졌는지 `get_status`로 확인한다.
   - PR이 없는 브랜치는 커밋이 없어도 유지한다. 다른 세션이 막 시작한 작업일 수 있다.
   - 병합됨 → 3단계.
3. git 정리:
   - `scripts/git-cleanup.sh`는 dry-run으로만 실행해 후보를 본다. 이 스크립트는 PR을 보지 않아서 커밋 없는 새 브랜치도
     후보에 넣으므로 `RUN=1`을 쓰지 않는다. 후보마다 2단계 기준을 확인하고, 통과한 것만 지운다:
     `git worktree remove <절대 경로>`, 이어서 `git branch -d <브랜치>`.
   - squash 병합이면 후보에 나오지 않으니 `gh pr list --state merged`로 찾고, 브랜치 삭제는 2단계 기준을 확인한 뒤 `-D`로 한다.
   - 현재 worktree는 지우지 않는다. 다음 `/work-start`가 재사용하거나 앱의 worktree 정리로 지운다고 보고한다.
   - `--force`는 남은 파일 목록을 보고 일회성 산출물(캡처 등)뿐일 때만 쓴다. 의심스러우면 사용자에게 묻는다.
   - 기본 체크아웃이 `main`이고 깨끗하면 `git -C <기본 체크아웃> pull --ff-only origin main`. 세션 격리로 막히면 보고하고 넘어간다.
     원격 브랜치는 `fetch --prune`만 하고 지우지 않는다.
   - stash는 모든 worktree가 공유한다. 이 세션이 만든 항목만 확인하고 남기지 않는다.
4. 이번 세션이 띄운 것만 내린다. 내가 띄웠는지 모르면 두고 알린다.
   - 검증 스택: 이번 세션의 `up.sh`가 `READY`까지 성공했고, `$TMPDIR/salad-verify/*.pid`가 그 직후 본 값과 같을 때만
     `.claude/skills/verify/bin/down.sh`. `down.sh`는 공유 pid 파일과 고정 컨테이너 이름을 쓰므로, 다르면 다른 세션의 스택이다.
     `pkill java`·`pkill node`는 금지, 사용자의 5432/8080/5173 스택은 건드리지 않는다.
   - 시뮬레이터·에뮬레이터: 이 세션이 부팅한 것만 끈다(`xcrun simctl shutdown <udid>`, `adb -s <id> emu kill`).
     키보드 설정을 바꿨다면 되돌린다: iOS `defaults write`로 넣은 AutomaticMinimizationEnabled 키 삭제,
     Android `~/.android/avd/myAVD.avd/config.ini`는 백업에서 복원.
   - 브라우저: 뷰포트를 `desktop`으로 되돌리고, 연 탭과 `preview_start` 서버(`preview_stop`)를 닫는다.
   - 백그라운드 Bash·Monitor 작업은 `TaskStop`. Docker는 `salad-verify-pg`만.
   - 로그인용으로 만든 임시 `apps/web/public/*.html` 등 추적하지 않는 임시 파일은 삭제한다.
5. 남기는 것(지우지 않는다): 미병합 브랜치와 그 worktree의 `node_modules`·`graphify-out/`·`.superpowers/`,
   패키지·Gradle 캐시, Docker 이미지, 시뮬레이터·AVD 이미지, `pr-assets` 브랜치, 사용자의 개발 스택.
   `keep`을 붙이면 worktree가 살아 있는 경우에 한해 검증 스택·부팅한 시뮬레이터도 그대로 두고 포트를 알린다.
   worktree를 지우면 그 스택은 서빙할 폴더를 잃으므로 `keep`이 있어도 내린다.
6. 보고(한국어, 짧게): 삭제한 브랜치·worktree, 내린 서비스, 일부러 남긴 것과 이유, 못 한 정리와 원인.
   다음 작업이 있으면 `/clear` 후 `/work-start <작업>`을 안내하고, 이번 작업에서 얻은 새 지침이 있으면
   메모리에 남길지 한 줄로 묻는다.
