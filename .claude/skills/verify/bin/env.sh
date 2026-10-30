# 검증 인스턴스 공통 값. 개발 인스턴스(5432/8080/5173)와 겹치지 않는 포트를 쓴다.
ROOT=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
STATE=${VERIFY_STATE:-${TMPDIR:-/tmp}/salad-verify}
ARTIFACTS=${VERIFY_ARTIFACTS:-$ROOT/.verify-artifacts}
PG_PORT=55432 API_PORT=18080 WEB_PORT=15173
PG_NAME=salad-verify-pg
WEB=http://localhost:$WEB_PORT
# 시드 계정(빈 검증 DB에만 존재하는 테스트 계정)
SEED_EMAIL=verify@example.test SEED_PASSWORD=verify-pass-1234 SEED_NICK=검증러 SEED_GROUP=검증그룹
SEED_EMAIL2=verify2@example.test SEED_NICK2=검증둘
SEED_EMAIL3=verify3@example.test SEED_NICK3=검증셋
SEED_EMAIL4=verify4@example.test SEED_NICK4=비공개러
