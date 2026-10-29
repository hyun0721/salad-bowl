#!/usr/bin/env bash
# 포트 소유권을 확인해 오래된 pid 파일이 다른 프로세스를 죽이지 않게 한다.
set -uo pipefail
source "$(dirname "$0")/env.sh"
for svc in web api; do
  pid=$(cat "$STATE/$svc.pid" 2>/dev/null) || continue
  if [[ $svc == web ]]; then port=$WEB_PORT; else port=$API_PORT; fi
  if [[ $pid =~ ^[0-9]+$ ]] && lsof -a -p "$pid" -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    kill "$pid" 2>/dev/null && for _ in $(seq 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  else
    echo "skip $svc: pid $pid does not own port $port"
  fi
  rm -f "$STATE/$svc.pid"
done
docker rm -f $PG_NAME >/dev/null 2>&1
rm -f "$STATE/seed.xlsx"
echo "DOWN (logs kept in $STATE, evidence kept in $ARTIFACTS)"
