# 시스템 아키텍처

## 요청 흐름

```text
브라우저 → Cloudflare Pages(정적 파일 + /api Function)
         → Render(Spring Boot) → Supabase Postgres(세션 풀러)
```

| 구성 | 서비스 | 역할 |
|---|---|---|
| 웹 | Cloudflare Pages | React 빌드 결과를 정적 파일로 제공한다. |
| API 프록시 | Pages Function | `/api/*` 요청에서 `/api` 접두어를 떼고 `API_ORIGIN`(Render)으로 전달한다. |
| API | Render 무료 Web Service(Docker) | Spring Boot API를 실행한다. |
| DB | Supabase Postgres 무료 | 세션 풀러(포트 5432)로 JDBC 연결한다. Supabase의 Data API·인증 기능은 사용하지 않는다. |

브라우저는 웹과 API를 같은 출처(`https://<project>.pages.dev`)로 호출하므로 CORS 설정이 필요 없고, refresh 쿠키도 같은 사이트 쿠키로 동작한다. `apps/web/public/_routes.json`은 `/api`와 `/api/*`에만 Function을 적용해 정적 요청이 Functions 요청 한도를 쓰지 않게 한다.

## 저장소 구조

| 경로 | 역할 |
|---|---|
| `apps/api` | Java 21·Spring Boot API와 Dockerfile을 관리한다. |
| `apps/web` | React 웹앱과 Cloudflare Pages Function(`functions/api/[[path]].ts`)을 관리한다. |
| `docs` | 이 문서들과 배포 절차서, 잔여 작업을 관리한다. |
| `docs/superpowers` | 설계 문서와 구현 계획을 관리한다. |
| `scripts` | 배포 확인용 `smoke.sh` 등을 관리한다. |
| `render.yaml` | Render Blueprint의 서비스와 자동 배포 조건을 정의한다. |
| `.github/workflows` | CI(`api-ci`, `web-ci`), 설정값 동기화(`sync-config`), 깨우기(`keepalive`)를 정의한다. |

## API (`apps/api`)

- 기능 단위 패키지로 나눈다: `auth`, `user`, `group`, `transaction`, `importer`, `common`.
- 인증은 JWT access 토큰(15분)과 HttpOnly refresh 쿠키(14일)를 사용한다. 운영 쿠키는 `Path=/api/auth; SameSite=Lax; Secure`로 고정한다.
- 엑셀 import는 Apache POI로 `가계부 내역` 시트만 읽고 기존 거래와 병합한다. 원본 파일은 저장하지 않는다.
- 스키마는 Flyway가 관리한다. API가 기동할 때 `src/main/resources/db/migration/V*.sql` 중 아직 실행하지 않은 파일을 순서대로 실행한다. 스키마를 바꿀 때는 기존 파일을 고치지 않고 새 버전 파일을 추가한다.
- 운영 프로필은 `prod`(`application-prod.yml`)이며 포트는 `PORT` 환경변수를 읽는다.

## 웹 (`apps/web`)

- React, Vite, TypeScript를 사용한다.
- `vite-plugin-pwa`로 홈 화면 설치를 지원한다. 오프라인 기능은 제공하지 않는다.
- API 기본 주소는 `/api`다. 로컬에서는 Vite 개발 서버가, 운영에서는 Pages Function이 API로 전달한다.

## 설정값과 배포 자동화

운영 설정값의 원본은 GitHub Environment `production`이다. 수동 실행 워크플로 `sync-config`가 Render와 Cloudflare Pages API로 값을 반영한다. keepalive용 `API_HEALTH_URL`만 예외로 저장소 변수에 둔다.

| 워크플로 | 실행 시점 | 역할 |
|---|---|---|
| `api-ci` | `apps/api/**` 또는 이 워크플로 파일 변경 시 PR·`main` push | 공용 버전 테스트 + `./gradlew test memoryTest` |
| `web-ci` | `apps/web/**` 또는 이 워크플로 파일 변경 시 PR·`main` push | 공용 버전 테스트 + lint·typecheck·test·build |
| `sync-config` | 수동 | 설정값 검증과 Render·Pages 반영, Render 재배포 |
| `keepalive` | 10분마다·수동 | Pages를 거쳐 API health를 호출해 sleep과 DB 일시정지를 줄인다. |

`main`에 머지하면 Pages는 `apps/web` 변경을 바로 배포하고, Render는 api-ci가 통과한 커밋만 배포한다. 절차는 [배포 절차서](deploy.md)를 따른다.


## 실행 버전

`release-version.json`과 `scripts/release/version.py`가 main의 배포 관련
first-parent 변경을 세어 `0.1.N`을 만든다. 공용 파일·스크립트와 Render 빌드 설정은
두 CI 및 배포 필터에 포함한다. 웹은 Vite define으로, API는 JAR의
`version.properties`로 `{version, commit}`을 빌드에 고정한다.
Docker context는 저장소 루트이며 Git·Python은 빌드 단계에서만 쓴다.

웹·PWA는 도움말에서만 현재 번들의 버전을 표시하고, 인증된 `/api/version`으로
API의 현재 버전을 조회한다. 서버 응답은 no-store이고 버전 조회는 도움말을 열 때만
수행한다. 서로 다른 실행 버전은 독립 배포와 PWA 업데이트 지연으로 발생할 수 있다.
번호 정책·초기 플랫폼 설정 변경은 [배포 절차서](deploy.md#71-자동-버전과-도움말)를 따른다.
