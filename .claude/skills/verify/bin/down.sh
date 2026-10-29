#!/usr/bin/env bash
# 이 검증 실행이 띄운 것만 내린다(pid 파일과 컨테이너 이름 기준). 증거(.verify-artifacts)는 지우지 않는다.
set -uo pipefail
source "$(dirname "$0")/env.sh"
for svc in web api; do
  pid=$(cat "$STATE/$svc.pid" 2>/dev/null) || continue
  kill "$pid" 2>/dev/null && for _ in $(seq 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  rm -f "$STATE/$svc.pid"
done
docker rm -f $PG_NAME >/dev/null 2>&1
rm -f "$STATE/seed.xlsx"
echo "DOWN (logs kept in $STATE, evidence kept in $ARTIFACTS)"
