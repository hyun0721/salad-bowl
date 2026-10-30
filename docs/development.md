# 로컬 개발

## 준비

Docker Desktop, JDK 21, Node 22를 준비한다. Node 주 버전은 `apps/web/.nvmrc`를 따르고, `apps/web/package.json`의 최소 버전 조건에 맞춰 22.22 이상을 사용한다.

## 실행

저장소 루트에서 DB를 실행한다.

```bash
docker compose up -d
```

저장소 루트에서 API를 실행한다.

```bash
cd apps/api && REFRESH_COOKIE_SECURE=false ./gradlew bootRun
```

별도 터미널을 저장소 루트에서 열어 웹앱을 실행한다.

```bash
cd apps/web && npm ci && npm run dev
```

브라우저에서 `http://localhost:5173`에 접속한다. 로컬 HTTP에서 Secure 쿠키가 저장되지 않는 문제를 피하도록 `REFRESH_COOKIE_SECURE=false`를 지정한다. 운영에서는 Secure를 유지한다. Vite는 `/api` 접두어를 떼고 `http://localhost:8080`으로 요청을 전달한다.

## 테스트

API 테스트는 Docker Desktop을 실행한 상태에서 `apps/api` 디렉터리에서 수행한다.

```bash
./gradlew test
./gradlew memoryTest
```

`memoryTest`는 업로드 상한 근처의 대표 파일을 힙 192MB에서 파싱하고 업로드 설정이 512KB인지 확인한다. 모든 파일 구성을 보장하는 검사는 아니므로 한도를 바꿀 때 메모리 검증도 함께 수행한다. 한도는 [한계점](limits.md)을 참조한다.

웹 테스트는 `apps/web` 디렉터리에서 수행한다.

```bash
npm test
npm run lint
npm run typecheck
```

## 개인정보 규칙

실제 뱅크샐러드 파일과 개인 데이터를 저장소에 넣지 않는다. 테스트 파일은 코드로 생성한 가짜 데이터만 사용한다. 비밀값은 문서에 `<...>` 자리표시로만 작성한다.

## 검증 스택과 시드

Docker가 필요하다. `.claude/skills/verify/bin/`에서 `up.sh → seed.sh → doctor.sh → down.sh` 순서로 실행한다. 포트는 DB 55432 / API 18080 / web 15173이다. 이미 쓰이는 포트는 다른 세션의 스택이므로 건드리지 않고 실행을 생략한다.

테스트 계정 값은 `bin/env.sh`에 있다: verify@example.test(검증러·소유자), verify2@example.test(검증둘), verify3@example.test(검증셋)은 공개 ON, verify4@example.test(비공개러)는 OFF다. 모두 같은 SEED_PASSWORD를 쓴다. 이전 12개월의 월별 합성 엑셀 48개를 각자의 토큰으로 올린다. 기대값은 `make_xlsx.py --expected`와 [시드 기대값](../.claude/skills/verify/features/seed-expected.json)을 따른다.
