#!/usr/bin/env bash
# main에 병합된 로컬 브랜치와 그 worktree를 정리한다. 기본은 dry-run, 실제 삭제는 RUN=1.
# 병합 여부는 origin/main의 조상인지로 판단하므로 merge commit 방식 병합에만 맞다.
# squash merge로 바꾸면 gh pr list --state merged 기준으로 바꿔야 한다.
# worktree에 미커밋/untracked 파일이 있으면 git이 제거를 거부하고, 그 브랜치는 건너뛴다.
set -u
cd "$(git rev-parse --show-toplevel)"
git fetch -q --prune origin

run() { if [ "${RUN:-0}" = 1 ]; then "$@"; else echo "[dry] $*"; fi; }

for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
  [ "$b" = main ] && continue
  git merge-base --is-ancestor "$b" origin/main || continue
  w=$(git worktree list --porcelain | awk -v r="refs/heads/$b" '/^worktree /{p=$2} $0=="branch "r{print p}')
  if [ -n "$w" ]; then
    run git worktree remove "$w" || { echo "SKIP $b (worktree에 미커밋 파일: $w)"; continue; }
  fi
  run git branch -d "$b"
done
run git worktree prune
