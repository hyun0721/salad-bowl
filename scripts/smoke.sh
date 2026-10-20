#!/usr/bin/env bash
# 배포된 Salad Bowl을 계정 없이 점검한다. 사용법: scripts/smoke.sh https://<Pages 주소>
# health는 Render 콜드스타트(CPU 0.1에서 약 4분)를 기다리며 최대 약 7분(요청 15초 + 대기 5초, 20회) 다시 시도한다.
set -uo pipefail

base=${1:?usage: scripts/smoke.sh https://<pages-host>}
base=${base%/}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1${2:+ ($2)}"; failures=$((failures + 1)); }

# fetch NAME [curl 인자...] — 본문·헤더를 $tmp/NAME.*에 저장하고 상태 코드를 출력한다(연결 실패는 000).
fetch() {
  local name=$1
  shift
  curl -sS --max-time 15 -D "$tmp/$name.headers" -o "$tmp/$name.body" -w '%{http_code}' "$@" 2>/dev/null || echo 000
}
header() { grep -i "^$2:" "$tmp/$1.headers" 2>/dev/null | tail -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'; }

# expect_static NAME PATH TYPE_REGEX — 200이고 Content-Type이 맞아야 한다.
expect_static() {
  local name=$1 path=$2 type=$3 status
  status=$(fetch "$name" "$base$path")
  if [ "$status" = 200 ] && header "$name" content-type | grep -Eqi "^($type)"; then
    pass "$path"
  else
    fail "$path" "status=$status type=$(header "$name" content-type)"
  fi
}

# expect_api_error NAME STATUS [curl 인자...] — 상태가 맞고 JSON이며 {code} 본문이어야 한다(SPA HTML이 아님).
expect_api_error() {
  local name=$1 want=$2 status
  shift 2
  status=$(fetch "$name" "$@")
  if [ "$status" = "$want" ] && header "$name" content-type | grep -qi '^application/json' \
      && grep -Eq '"code":"[A-Z_]+"' "$tmp/$name.body"; then
    pass "$name -> $want json"
  else
    fail "$name" "status=$status type=$(header "$name" content-type) body=$(head -c 120 "$tmp/$name.body" 2>/dev/null)"
  fi
}

# 1) 정적 파일: 상태와 형식
expect_static index / 'text/html'
expect_static manifest /manifest.webmanifest 'application/manifest\+json|application/json'
expect_static sw /sw.js 'application/javascript|text/javascript'
expect_static registersw /registerSW.js 'application/javascript|text/javascript'
grep -q '"Salad Bowl"' "$tmp/manifest.body" 2>/dev/null && pass "manifest name" || fail "manifest name"
workbox=$(grep -Eo 'workbox-[A-Za-z0-9_-]+' "$tmp/sw.body" | head -1)
if [ -n "$workbox" ]; then expect_static workbox "/$workbox.js" 'application/javascript|text/javascript'; else fail "workbox file" "not referenced in sw.js"; fi

# 2) 헤더: 보안 헤더, 서비스 워커 파일은 캐시하지 않음
header index x-content-type-options | grep -qi nosniff && pass "x-content-type-options" || fail "x-content-type-options"
for name in sw registersw manifest; do
  header "$name" cache-control | grep -qi 'no-cache' && pass "$name no-cache" || fail "$name no-cache" "$(header "$name" cache-control)"
done

# 3) API health(콜드스타트 대기): 200이고 본문 status가 UP
health=fail
for _ in $(seq 1 20); do
  status=$(fetch health "$base/api/actuator/health")
  if [ "$status" = 200 ] && grep -q '"status":"UP"' "$tmp/health.body"; then health=ok; break; fi
  sleep 5
done
[ "$health" = ok ] && pass "api health UP" || fail "api health" "last status=$status"

# 4) 프록시 경로와 인증: SPA가 아니라 API가 JSON 401로 답해야 한다
expect_api_error me 401 "$base/api/me"
expect_api_error api-root 401 "$base/api"
expect_api_error api-root-slash 401 "$base/api/"
# Origin을 붙여도 CORS 403이 아니라 401 JSON(프록시가 Origin을 지운다)
expect_api_error refresh-with-origin 401 -X POST -H "Origin: $base" "$base/api/auth/refresh"

echo "failures: $failures"
[ "$failures" = 0 ]
