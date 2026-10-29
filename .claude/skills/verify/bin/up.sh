#!/usr/bin/env bash
# 빈 DB부터 검증 인스턴스를 띄운다: Postgres 컨테이너 → API jar → Vite. 준비되면 READY를 출력한다.
set -euo pipefail
source "$(dirname "$0")/env.sh"
mkdir -p "$STATE" "$ARTIFACTS"
for p in $PG_PORT $API_PORT $WEB_PORT; do
  if lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then echo "port $p is busy: run bin/down.sh or check who owns it" >&2; exit 1; fi
done

docker run -d --rm --name $PG_NAME -e POSTGRES_DB=saladbowl -e POSTGRES_USER=saladbowl -e POSTGRES_PASSWORD=saladbowl \
  -p $PG_PORT:5432 postgres:16-alpine >/dev/null
# 초기화 중인 Postgres는 유닉스 소켓만 열므로 TCP로 확인해야 실제로 쓸 수 있는 상태다.
for attempt in $(seq 60); do
  if docker exec $PG_NAME pg_isready -h 127.0.0.1 -U saladbowl -d saladbowl >/dev/null 2>&1; then break; fi
  if (( attempt == 60 )); then echo "postgres not ready after 60s; see docker logs $PG_NAME" >&2; exit 1; fi
  sleep 1
done

(cd "$ROOT/apps/api" && ./gradlew -q bootJar)
JAR=$(ls "$ROOT"/apps/api/build/libs/*.jar | grep -v -- -plain | head -1)
SERVER_PORT=$API_PORT DB_URL=jdbc:postgresql://localhost:$PG_PORT/saladbowl REFRESH_COOKIE_SECURE=false \
  CORS_ALLOWED_ORIGINS=$WEB nohup java -jar "$JAR" >"$STATE/api.log" 2>&1 &
echo $! >"$STATE/api.pid"

# 서브셸 없이 띄워야 $!가 vite 자신의 pid다(down.sh가 그 pid만 내린다).
cd "$ROOT/apps/web"
API_PROXY_TARGET=http://localhost:$API_PORT nohup node_modules/.bin/vite --port $WEB_PORT --strictPort >"$STATE/web.log" 2>&1 &
echo $! >"$STATE/web.pid"

# 웹 프록시를 거쳐 API health가 UP이면 Flyway 마이그레이션까지 끝난 상태다.
for _ in $(seq 120); do
  curl -sf "$WEB/api/actuator/health" 2>/dev/null | grep -q '"UP"' && { echo "READY $WEB"; exit 0; }
  sleep 1
done
echo "not ready after 120s; see $STATE/api.log and $STATE/web.log" >&2
exit 1
