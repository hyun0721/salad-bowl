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
# 그룹 없는 계정: 가입만 한다.
curl -sf -H "$json" -d "{\"email\":\"$SEED_EMAIL5\",\"password\":\"$SEED_PASSWORD\",\"nickname\":\"$SEED_NICK5\"}" "$WEB/api/auth/signup" >/dev/null

# 소득공제: 소유자를 서비스 관리자로 지정하고(화면 없이 DB에서, PR 2), 올해 귀속 세법(2026 귀속 값)을 적용한 뒤
# 소유자에게 합성 연도 기록을 넣는다. 금액은 와이어프레임 합성값과 같다(PR 7 확인 숫자의 전제).
token=$(curl -sf -H "$json" -d "{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\"}" "$WEB/api/auth/login" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')
auth="Authorization: Bearer $token"
tax_year=$(TZ=Asia/Seoul date +%Y)
# 검증 스택 전용. 운영 절차는 docs/deploy.md 13절이며 구글 전용 계정 조건을 따른다.
docker exec "$PG_NAME" psql -U saladbowl -d saladbowl -qc "UPDATE users SET service_admin = true WHERE email = '$SEED_EMAIL'" >/dev/null
field() { python3 -c "import json,sys; print(json.load(sys.stdin)[\"$1\"])"; }
tax_call() {
  local response status
  response=$(mktemp)
  status=$(curl -sS -o "$response" -w '%{http_code}' "$@") || { cat "$response" >&2; rm -f "$response"; return 1; }
  if (( status >= 400 )); then cat "$response" >&2; rm -f "$response"; return 1; fi
  cat "$response"
  rm -f "$response"
}
law=$(tax_call -H "$auth" -H "$json" -d "{\"taxYear\":$tax_year}" "$WEB/api/tax/admin/law-versions")
law_id=$(field id <<<"$law")
law=$(tax_call -X PUT -H "$auth" -H "$json" "$WEB/api/tax/admin/law-versions/$law_id" -d "{
  \"rowVersion\":$(field rowVersion <<<"$law"), \"minSpendRatePct\":25, \"bracketBoundary\":70000000,
  \"rateCreditPct\":15, \"rateDebitCashPct\":30, \"rateCulturePct\":30, \"rateMarketPct\":40, \"rateTransitPct\":40,
  \"basicLimitLow\":[3000000,3500000,4000000], \"basicLimitHigh\":[2500000,2750000,3000000],
  \"extraLimitLow\":3000000, \"extraLimitHigh\":2000000,
  \"basisLawName\":\"조세특례제한법\", \"basisArticle\":\"제126조의2\", \"basisUrl\":\"https://www.law.go.kr\",
  \"periodStart\":\"$tax_year-01-01\", \"periodEnd\":\"$tax_year-12-31\", \"memo\":\"검증용 합성 세법\"}")
tax_call -H "$auth" -H "$json" -d "{\"rowVersion\":$(field rowVersion <<<"$law")}" "$WEB/api/tax/admin/law-versions/$law_id/apply" >/dev/null
tax="$WEB/api/tax/years/$tax_year"
tax_call -X PUT -H "$auth" -H "$json" -d '{"totalSalary":50000000,"workStartMonth":1,"workEndMonth":12,"childCount":0}' "$tax" >/dev/null
tax_call -H "$auth" -H "$json" "$tax/cards" -d "{\"issuerName\":\"A카드\",\"asOfDate\":\"$tax_year-06-30\",\"memo\":\"주 사용 카드\",
  \"amounts\":{\"creditGeneral\":9000000,\"creditMarket\":300000,\"creditTransit\":200000,\"creditCulture\":100000,
  \"debitGeneral\":0,\"debitMarket\":0,\"debitTransit\":0,\"debitCulture\":0}}" >/dev/null
tax_call -H "$auth" -H "$json" "$tax/cards" -d "{\"issuerName\":\"B카드\",\"asOfDate\":\"$tax_year-06-30\",
  \"amounts\":{\"creditGeneral\":5000000,\"creditMarket\":0,\"creditTransit\":0,\"creditCulture\":0,
  \"debitGeneral\":2000000,\"debitMarket\":200000,\"debitTransit\":300000,\"debitCulture\":100000}}" >/dev/null
tax_call -X PUT -H "$auth" -H "$json" "$tax/cash-receipt" \
  -d "{\"asOfDate\":\"$tax_year-06-30\",\"amounts\":{\"general\":500000,\"market\":100000,\"transit\":0,\"culture\":0}}" >/dev/null
tax_call -X PUT -H "$auth" -H "$json" "$tax/plan" -d '{
  "general":{"creditFixed":500000,"debitFixed":300000,"flexible":1200000},
  "market":{"creditFixed":0,"debitFixed":100000,"flexible":100000},
  "transit":{"creditFixed":100000,"debitFixed":0,"flexible":0},
  "culture":{"creditFixed":0,"debitFixed":0,"flexible":100000}}' >/dev/null
echo "SEEDED group=$gid tax_year=$tax_year"
