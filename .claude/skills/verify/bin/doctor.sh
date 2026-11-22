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
for email in "$SEED_EMAIL" "$SEED_EMAIL2" "$SEED_EMAIL3" "$SEED_EMAIL4" "$SEED_EMAIL5"; do
  check "seed login $email" "curl -sf -H 'Content-Type: application/json' -d '{\"email\":\"$email\",\"password\":\"$SEED_PASSWORD\"}' $WEB/api/auth/login"
done

tax_year=$(TZ=Asia/Seoul date +%Y)
token=$(curl -sf -H 'Content-Type: application/json' -d "{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\"}" "$WEB/api/auth/login" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])' 2>/dev/null)
check "applied tax law $tax_year" "curl -sf -H 'Authorization: Bearer $token' '$WEB/api/tax/law-versions/current?year=$tax_year'"
check "seed tax record $tax_year" "curl -sf -H 'Authorization: Bearer $token' '$WEB/api/tax/years/$tax_year'"
# Analysis journey (tax-analysis.md): wireframe values for current deduction and recommendation difference.
check "seed tax analysis $tax_year" "curl -sf -H 'Authorization: Bearer $token' '$WEB/api/tax/years/$tax_year/analysis' | python3 -c 'import json,sys; a=json.load(sys.stdin); assert a[\"status\"] == \"READY\" and a[\"deduction\"][\"amount\"] == 1475000 and a[\"recommendation\"][\"difference\"] == 152728'"

echo "build: $(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet || echo '+dirty')"
exit $ok
