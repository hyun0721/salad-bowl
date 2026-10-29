#!/usr/bin/env bash
# 읽기만 한다. 이 검증 실행이 띄운 인스턴스가 살아 있고 쓸 만한지 확인한다.
set -uo pipefail
source "$(dirname "$0")/env.sh"
ok=0
check() { if eval "$2" >/dev/null 2>&1; then echo "OK    $1"; else echo "FAIL  $1"; ok=1; fi; }
check "db container $PG_NAME running" "docker ps --filter name=^$PG_NAME\$ --format '{{.Names}}' | grep -q $PG_NAME"
for svc in api web; do
  pid=$(cat "$STATE/$svc.pid" 2>/dev/null)
  check "$svc pid ${pid:-?} alive" "kill -0 ${pid:-0}"
done
check "port $API_PORT owned by api pid" "lsof -a -p $(cat "$STATE/api.pid" 2>/dev/null || echo 0) -iTCP:$API_PORT -sTCP:LISTEN"
check "port $WEB_PORT owned by web pid" "lsof -a -p $(cat "$STATE/web.pid" 2>/dev/null || echo 0) -iTCP:$WEB_PORT -sTCP:LISTEN"
check "health UP through web proxy" "curl -sf $WEB/api/actuator/health | grep -q UP"
check "seed login works" "curl -sf -H 'Content-Type: application/json' -d '{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\"}' $WEB/api/auth/login"
echo "build: $(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet || echo '+dirty')"
exit $ok
