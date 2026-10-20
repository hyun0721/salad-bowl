# Salad Bowl

뱅크샐러드 엑셀을 가져와 그룹과 가계부를 함께 보는 웹 서비스다.

## 구성

```text
브라우저 → Cloudflare Pages(정적 파일 + /api Function)
         → Render(Spring Boot) → Supabase Postgres(세션 풀러)
```

## 저장소 구조

| 경로 | 역할 |
|---|---|
| `apps/api` | Java 21·Spring Boot API와 Dockerfile을 관리한다. |
| `apps/web` | React 웹앱과 Cloudflare Pages Function을 관리한다. |
| `docs/superpowers` | 설계 문서와 구현 계획을 관리한다. |
| `scripts` | 배포 확인용 `smoke.sh` 등을 관리한다. |
| `render.yaml` | Render Blueprint의 서비스와 자동 배포 조건을 정의한다. |

## 로컬 개발

Docker Desktop, JDK 21, Node 22를 준비한다. Node 주 버전은 `apps/web/.nvmrc`를 따르고, `apps/web/package.json`의 최소 버전 조건에 맞춰 22.22 이상을 사용한다.

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

`memoryTest`는 업로드 상한 근처의 대표 파일을 힙 192MB에서 파싱하고 업로드 설정이 512KB인지 확인한다. 모든 파일 구성을 보장하는 검사는 아니므로 한도를 바꿀 때 메모리 검증도 함께 수행한다.

웹 테스트는 `apps/web` 디렉터리에서 수행한다.

```bash
npm test
npm run lint
npm run typecheck
```

## 업로드 한도

한 번에 최대 3개월치·512KB의 `.xlsx` 파일을 허용한다. 기간은 첫 거래일과 마지막 거래일의 차이 92일 이하로 판단한다. 전체 multipart 요청은 1MB로 제한한다. 서버 전체에서 import는 동시에 1건만 처리하며, 20초 안에 처리 차례를 얻지 못하면 503 `IMPORT_BUSY`로 응답한다. 대용량 스트리밍 파싱은 이후 고도화 과제로 관리한다.

## 설정값과 배포

운영 설정값의 원본은 GitHub Environment `production`으로 관리한다. `sync-config` 워크플로가 Render와 Cloudflare Pages에 값을 반영한다. keepalive용 `API_HEALTH_URL`은 예외로 GitHub 저장소 변수에 둔다. 초기 배포, 설정 변경, 점검과 복구는 [배포 절차서](docs/deploy.md)를 참조한다.

## 개인정보 규칙

실제 뱅크샐러드 파일과 개인 데이터를 저장소에 넣지 않는다. 테스트 파일은 코드로 생성한 가짜 데이터만 사용한다. 비밀값은 문서에 `<...>` 자리표시로만 작성한다.
