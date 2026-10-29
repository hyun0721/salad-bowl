#!/usr/bin/env bash
# 시드 계정·그룹을 만들고(공개 켬) 지난 3개월치 가짜 엑셀을 API로 올린다. 빈 DB에서 한 번만 실행한다.
set -euo pipefail
source "$(dirname "$0")/env.sh"
json='Content-Type: application/json'
curl -sf -H "$json" -d "{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\",\"nickname\":\"$SEED_NICK\"}" "$WEB/api/auth/signup" >/dev/null
token=$(curl -sf -H "$json" -d "{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\"}" "$WEB/api/auth/login" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')
auth="Authorization: Bearer $token"
gid=$(curl -sf -H "$auth" -H "$json" -d "{\"name\":\"$SEED_GROUP\"}" "$WEB/api/groups" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["groupId"])')
curl -sf -X PUT -H "$auth" -H "$json" -d '{"enabled":true}' "$WEB/api/groups/$gid/share" >/dev/null
xlsx="$STATE/seed.xlsx"
python3 -I "$(dirname "$0")/make_xlsx.py" "$xlsx"
curl -sf -H "$auth" -F "file=@$xlsx" "$WEB/api/imports"
echo
echo "SEEDED group=$gid"
