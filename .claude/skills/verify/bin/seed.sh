#!/usr/bin/env bash
# 시드 계정·그룹을 만들고(공개 켬) 지난 12개월치 가짜 엑셀을 API로 올린다. 빈 DB에서 한 번만 실행한다.
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
invite=$(curl -sf -H "$auth" -X POST "$WEB/api/groups/$gid/invites" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
for member in owner second third private; do
  case "$member" in
    owner) member_auth=$auth ;;
    *)
      case "$member" in
        second) email=$SEED_EMAIL2; nick=$SEED_NICK2 ;;
        third) email=$SEED_EMAIL3; nick=$SEED_NICK3 ;;
        private) email=$SEED_EMAIL4; nick=$SEED_NICK4 ;;
      esac
      curl -sf -H "$json" -d "{\"email\":\"$email\",\"password\":\"$SEED_PASSWORD\",\"nickname\":\"$nick\"}" "$WEB/api/auth/signup" >/dev/null
      member_token=$(curl -sf -H "$json" -d "{\"email\":\"$email\",\"password\":\"$SEED_PASSWORD\"}" "$WEB/api/auth/login" | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')
      member_auth="Authorization: Bearer $member_token"
      curl -sf -X POST -H "$member_auth" "$WEB/api/invites/$invite/accept" >/dev/null
      ;;
  esac
  enabled=true
  [ "$member" != private ] || enabled=false
  curl -sf -X PUT -H "$member_auth" -H "$json" -d "{\"enabled\":$enabled}" "$WEB/api/groups/$gid/share" >/dev/null
  for back in {1..12}; do
    xlsx="$STATE/seed-$member-$back.xlsx"
    python3 -I "$(dirname "$0")/make_xlsx.py" "$xlsx" --member "$member" --back "$back"
    curl -sf -H "$member_auth" -F "file=@$xlsx" "$WEB/api/imports"
    echo
  done
done
echo "SEEDED group=$gid"
