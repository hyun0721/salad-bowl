#!/usr/bin/env bash
# Codex CLI 래퍼. Claude(컨트롤러·서브에이전트)가 Codex에 일을 맡길 때 쓴다.
#
#   codex-run.sh read  <prompt-file> <out-file> [effort]   읽기 전용(검토·진단·계획 리뷰)
#   codex-run.sh write <prompt-file> <out-file> [effort]   작업 폴더 쓰기 허용(구현·수정)
#   codex-run.sh resume <session-id> <prompt-file> <out-file> [effort]   이전 작업 이어 하기(수정 라운드)
#   codex-run.sh review <base-ref> <out-file> [effort]     Codex 기본 리뷰어로 브랜치 리뷰
#
# - 마지막 응답은 <out-file>, 전체 로그는 같은 이름의 .log에 남는다. 세션 id는 표준 출력으로 알려준다.
# - 모델은 호출마다 CODEX_MODEL로 고른다(기본 gpt-6-astra, SKILL.md 3장 표). 가용 모델은 현재 계정에서 확인하고 전역 설정은 변경하지 않는다.
# - effort: none|minimal|low|medium|high|xhigh (기본 medium)
set -euo pipefail

mode=${1:?mode: read|write|resume|review}
shift
repo=$(git rev-parse --show-toplevel)
model=${CODEX_MODEL:-gpt-6-astra}

run() {
  local out=$1
  shift
  local log="${out%.*}.log"
  mkdir -p "$(dirname "$out")"
  if "$@" > "$log" 2>&1; then status=0; else status=$?; fi
  local session
  session=$(grep -m1 '^session id:' "$log" | awk '{print $3}' || true)
  echo "codex exit=$status session=${session:-unknown} out=$out log=$log"
  return "$status"
}

case "$mode" in
  read|write)
    prompt=${1:?prompt file}; out=${2:?out file}; effort=${3:-medium}
    sandbox=read-only
    [ "$mode" = write ] && sandbox=workspace-write
    run "$out" codex exec -m "$model" -c "model_reasoning_effort=$effort" -s "$sandbox" -C "$repo" -o "$out" - < "$prompt"
    ;;
  resume)
    session=${1:?session id}; prompt=${2:?prompt file}; out=${3:?out file}; effort=${4:-medium}
    run "$out" codex exec resume -m "$model" -c "model_reasoning_effort=$effort" \
      -c 'sandbox_mode="workspace-write"' -o "$out" "$session" - < "$prompt"
    ;;
  review)
    base=${1:?base ref}; out=${2:?out file}; effort=${3:-high}
    run "$out" bash -c 'cd "$1" && codex review -c "model=\"$2\"" -c "model_reasoning_effort=$3" --base "$4" > "$5" < /dev/null' \
      _ "$repo" "$model" "$effort" "$base" "$out"
    ;;
  *)
    echo "unknown mode: $mode" >&2
    exit 2
    ;;
esac
