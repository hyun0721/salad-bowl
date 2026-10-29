# 배포 절차서

## 0. 배포 설정 머지

이 배포 설정이 들어간 PR을 CI 통과 후 `main`에 머지한다. Render Blueprint는 `main`의 `render.yaml`을, Pages 프로덕션 브랜치는 `main`의 `_routes.json`·`_headers`를 사용한다. `sync-config`의 Run workflow 버튼과 `keepalive` 예약 실행은 기본 브랜치의 워크플로를 사용하므로 기본 브랜치도 `main`인지 확인한다.

## 1. 구성

요청 흐름과 워크플로 구성은 [시스템 아키텍처](architecture.md)를, 무료 티어 조건·콜드스타트·메모리·용량 기준은 [한계점](limits.md)을 참조한다. 무료 티어 조건은 바뀔 수 있으므로 서비스를 만들 때 다시 확인한다. API 첫 기동은 약 3~4분 걸리므로 이를 기준으로 대기한다.

## 2. Supabase

1. 계정을 만들고 새 프로젝트를 생성한다. 지역은 Singapore로 선택하고 DB 비밀번호는 비밀번호 관리자에 저장한다.
2. Connect → **Direct**(Connection string) → Type `JDBC`, Method **Session pooler**에서 host, port `5432`, user `postgres.<project-ref>`, database `postgres`를 확인한다.
3. JDBC URL은 `jdbc:postgresql://<pooler-host>:5432/postgres?sslmode=require` 형식으로 준비한다. 직접 연결이나 트랜잭션 풀러와 혼동하지 않도록 확인한다.
4. Project Settings → **Data API**를 끈다. 앱은 JDBC로만 연결하며, Data API가 켜져 있으면 `public` 스키마의 테이블이 공개 키로 노출될 수 있다.

스키마는 API가 처음 기동할 때 Flyway가 생성한다.

## 3. Render

1. GitHub를 연결해 계정을 생성한다.
2. New → Blueprint에서 이 저장소를 선택한다.
3. `render.yaml`의 서비스 `salad-bowl-api`, 무료 플랜, Singapore 지역, 루트 `.`, Dockerfile `./apps/api/Dockerfile`, Docker context `.`, health 경로 `/actuator/health`를 확인하고 생성한다.
4. 아직 환경변수가 없으므로 첫 배포는 실패하는 것이 정상임을 확인한다. 이후 `sync-config`로 값을 반영하고 다시 배포한다.
5. 서비스 주소 `https://<render-host>`와 서비스 ID `srv-<service-id>`를 확인한다. 서비스 ID는 대시보드 URL 또는 Settings에서 확인한다.
6. Account Settings → API Keys에서 API 키를 생성해 비밀번호 관리자에 보관한다.

컨테이너는 JDK 21로 빌드하고 JRE 21에서 비루트 사용자로 실행한다. `SPRING_PROFILES_ACTIVE=prod`를 사용하며 포트는 `PORT` 환경변수를 읽고, 없으면 8080을 사용한다.

## 4. Cloudflare Pages

1. 계정을 만들고 Workers & Pages → Create application 화면 맨 아래의 "Looking to deploy Pages? Get started" → Import an existing Git repository에서 이 저장소를 선택한다. Deploy command 입력란이 보이면 Workers 화면이므로 되돌아간다.
2. 다음 표대로 설정한다. 환경변수는 이 단계에서 직접 입력하지 않고 `sync-config`로 반영한다.

| 항목 | 값 |
|---|---|
| Production branch | `main` |
| Framework preset | 없음 |
| Root directory | `apps/web` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Build watch paths → Include | `apps/web/*`, `scripts/release/*`, `release-version.json`, `render.yaml`, `.dockerignore` |

3. 첫 배포는 `API_ORIGIN`·`PROXY_SECRET`·`NODE_VERSION`이 아직 없는 상태에서 실행한다. 빌드는 `apps/web/.nvmrc`의 Node 22를 사용하며, `sync-config` 실행과 배포 Retry 전까지 `/api`는 503 `SERVER_UNAVAILABLE`을 반환한다. 배포 후 주소 `https://<project>.pages.dev`, 프로젝트 이름, 계정 ID를 확인한다. 계정 ID는 대시보드 오른쪽 또는 URL에서 확인한다.
4. My Profile → API Tokens에서 토큰을 만든다. 권한은 **Account · Cloudflare Pages · Edit**로 지정하고 이 계정만 대상으로 제한한다.

`VITE_API_BASE_URL`은 설정하지 않는다. 웹은 기본값 `/api`를 사용한다. `apps/web/functions/api/[[path]].ts`는 `API_ORIGIN`을 읽고 `/api` 접두어를 제거해 Render로 전달하며, `PROXY_SECRET`이 있으면 `X-Proxy-Secret`을 붙인다. `apps/web/public/_routes.json`은 `/api`와 `/api/*`에만 Function을 적용해 정적 요청이 Functions 한도를 사용하지 않도록 한다.

`apps/web/public/_headers`는 정적 응답에 기본 보안 헤더를 적용하고 `sw.js`, `registerSW.js`, `manifest.webmanifest`를 `no-cache`로 설정한다. Function 응답에는 `_headers`를 적용하지 않으며 API 응답은 Spring Security의 기본 헤더를 사용한다.

## 5. GitHub 설정값(원본)

저장소 Settings → Environments에서 `production`을 만들고 다음 값을 등록한다. 계정 생성과 실제 비밀값 입력은 사용자가 직접 수행한다. `JWT_SECRET`과 `PROXY_SECRET`은 각각 사용자의 터미널에서 `openssl rand -base64 32`로 생성한 별도의 32자 이상 값을 사용한다. 값은 비밀번호 관리자에도 보관하며 로그나 저장소에 남기지 않는다.

| 종류 | 이름 | 값 |
|---|---|---|
| Secret | `DB_URL` | `jdbc:postgresql://<pooler-host>:5432/postgres?sslmode=require` |
| Secret | `DB_USERNAME` | `postgres.<project-ref>` |
| Secret | `DB_PASSWORD` | `<Supabase DB 비밀번호>` |
| Secret | `JWT_SECRET` | `<openssl rand -base64 32 결과>` |
| Secret | `PROXY_SECRET` | `<별도로 실행한 openssl rand -base64 32 결과>` |
| Secret | `RENDER_API_KEY` | `<Render API 키>` |
| Secret | `CLOUDFLARE_API_TOKEN` | `<Cloudflare API 토큰>` |
| Variable | `RENDER_SERVICE_ID` | `srv-<service-id>` |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | `<계정 ID>` |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | `<Pages 프로젝트 이름>` |
| Variable | `API_ORIGIN` | `https://<render-host>` |
| Variable (선택) | `GOOGLE_CLIENT_ID` | `<Google OAuth 클라이언트 ID>` — 비우면 구글 로그인이 꺼진다. [11. 구글 로그인](#11-구글-로그인) 참고 |

Environment `production` → **Deployment branches and tags**를 **Selected branches: `main`**으로 제한하는 것을 필수로 설정한다. Required reviewers는 두지 않아도 되지만 배포 브랜치는 반드시 `main`으로 제한한다. 쓰기 권한이 있으면 다른 브랜치에서 워크플로를 고쳐 비밀값을 읽을 수 있고, `RENDER_API_KEY`는 Render 계정 전체 권한을 가지므로 이 제한이 필요하다. `sync-config` job도 `main`에서만 실행되도록 두 번째로 확인한다.

Settings → Secrets and variables → Actions → **Variables(저장소)**에 `API_HEALTH_URL`을 `https://<project>.pages.dev/api/actuator/health`로 등록한다. 예약 실행이 Environment 승인에 막히지 않도록 저장소 변수로 관리한다.

아래 1~7단계는 **처음 설치할 때**의 순서다(코드가 이미 `main`에 있다).

1. GitHub Environment `production`에 `PROXY_SECRET`을 비롯한 위 Secret·Variable을 추가한다.
2. Actions → `sync-config` → Run workflow에서 브랜치 `main`을 선택하고 `dry_run=true`로 실행해 필수 값 존재 여부, `DB_URL`의 `jdbc:postgresql://` 시작 및 `sslmode=require` 포함 여부, JWT·프록시 비밀값의 최소 길이 32자, `API_ORIGIN`의 HTTPS 형식을 확인한다. 이 실행은 플랫폼 API 연결 성공까지 검증하지 않는다.
3. `dry_run=false`, `deploy=false`(기본값)로 실행한다. Render에 DB·JWT·프록시 비밀값을 키별로 반영하고, Pages의 production과 preview 모두에 `API_ORIGIN`, 암호화된 `PROXY_SECRET`, `NODE_VERSION=22`를 반영한다. 이 단계에서는 Render 재배포를 요청하지 않는다.
4. Pages의 최신 배포를 Retry해 프록시가 `X-Proxy-Secret`을 붙이도록 적용한다.
5. Render에서 최신 커밋을 Manual Deploy하여 새 API와 `PROXY_SECRET`을 적용한다. Pages 프록시 배포가 먼저 완료됐는지 확인한다.
6. `https://<render-host>/actuator/health`의 본문이 `{"status":"UP"}`인지 확인한다. 첫 기동에는 약 3~4분을 기다린다.
7. Actions → `keepalive`를 수동 실행하고 Pages를 거친 health 응답까지 확인한다.

### 인증 보강(Plan 12)을 이미 운영 중인 서비스에 배포할 때

1. **머지 전에** `openssl rand -base64 32`로 `PROXY_SECRET`(32자 이상, JWT와 다른 값)을 만들어 GitHub Environment `production`에 추가한다.
2. **머지 전에** 같은 값을 플랫폼에 직접 넣는다. 지금 `main`의 `sync-config`에는 아직 `PROXY_SECRET` 단계가 없기 때문이다(이 PR이 더한다).
   - Render: 서비스 → Environment → `PROXY_SECRET` 추가. 저장 때 재배포를 묻으면 **저장만** 한다(옛 API는 이 값을 쓰지 않는다).
   - Cloudflare Pages: 프로젝트 → Settings → Variables and Secrets → production과 preview 모두 `PROXY_SECRET`을 **Secret(암호화)**으로 추가.
   - 머지 뒤부터는 `sync-config`가 두 곳을 GitHub 값으로 맞춘다.
3. PR을 머지한다. Pages는 새 프록시를 빌드하고(이때부터 `X-Proxy-Secret`을 붙인다), Render는 api-ci 통과 뒤 새 API를 자동 배포한다(`autoDeployTrigger: checksPass`). 수동 Retry·Manual Deploy는 필요 없다.
4. Pages 빌드가 먼저 끝나면 옛 API는 헤더를 무시하므로 문제가 없다. Render가 먼저 끝나면 Pages 빌드가 끝날 때까지 1~2분 동안 API 요청이 403이 된다.
5. `PROXY_SECRET`이 없거나 32자 미만이면 새 API는 기동하지 않고 Render는 이전 배포를 유지한다. 이때는 1~2단계를 고친 뒤 Render를 Manual Deploy한다. Pages와 Render의 값이 다르면 health 외 모든 요청이 403이다.

미리보기(PR별 `*.pages.dev`)도 운영 `PROXY_SECRET`을 받아 운영 API를 쓴다. 미리보기는 저장소에 push할 수 있는 사람의 브랜치만 빌드되므로 지금(혼자 쓰는 저장소)은 받아들인다. 쓰기 권한을 가진 사람이 늘면 미리보기용 API·비밀값을 분리한다(이 비밀값으로 얻는 것은 IP 헤더 위조이고, 사용자 인증은 우회하지 못한다).
6. 6장의 확인(health, 로그인)을 한다.

기존 refresh 쿠키에는 `ver`가 없으므로 이 배포 뒤 기존 세션은 한 번 로그아웃된다. 새 로그인 이후 refresh 쿠키의 만료는 로그인 시점부터 14일로 고정되며, refresh 요청은 쿠키를 갱신하지 않는다.

## 6. 배포 확인

저장소 루트에서 다음 명령의 주소 자리표시를 실제 Pages 주소로 바꿔 실행한다.

```bash
scripts/smoke.sh 'https://<project>.pages.dev'
```

모든 항목이 PASS이고 `failures: 0`인지 확인한다. 스크립트는 정적 파일의 상태·형식, workbox, `X-Content-Type-Options: nosniff`, 서비스 워커 관련 파일의 `no-cache`, health의 UP, `/api`·`/api/`·`/api/me`의 401 JSON 응답을 확인한다. Origin을 붙인 refresh도 CORS 403이 아닌 401 JSON인지 확인한다. health는 콜드스타트를 고려해 최대 약 7분 동안 재시도한다. 계정은 생성하지 않는다.

### 큰 파일 업로드 확인

저장소 루트에서 다음 명령으로 코드 기반 가짜 데이터 파일을 생성한다.

```bash
cd apps/api && ./gradlew largeWorkbook -Pout=/tmp/salad-large.xlsx
```

확인용 계정을 따로 만들고, 생성한 파일이 512KB 미만·3개월치인지 확인한 뒤 사용자가 운영 화면에서 업로드한다. 결과의 신규 건수가 표시되는지, Render 대시보드 Metrics의 메모리가 512MB 아래인지, Logs에 OOM이 없는지 확인한다. 확인하는 동안 **Events·Logs에서 health check 실패나 재시작이 있는지도 확인한다**. 2026-10 측정: 한도 근처 import 81초·최대 392MiB. 완료까지 충분히 기다린다.

화면에 “서버를 사용할 수 없습니다”가 표시되어도 업로드 이력에 들어갔는지 먼저 확인한다. 같은 파일을 다시 올려도 거래가 중복으로 들어가지 않는다. 재시작이 보이면 업로드 한도를 **256KB**로 낮추고 `apps/api`에서 `./gradlew memoryTest`를 다시 실행해 확인해야 한다. 이때 `apps/api/src/main/resources/application.yml`의 업로드 한도, 웹 `apps/web/src/imports/importsApi.ts`의 `MAX_UPLOAD_BYTES`, `apps/api/src/test/java/com/saladbowl/api/importer/BanksaladParserMemoryTest.java`의 검증 범위를 함께 바꾼다. 실제 3개월치 파일은 약 65KB이므로 이 한도 근처 검증은 일상 사용과는 다르다. 실제 뱅크샐러드 파일이나 개인 데이터는 테스트에 사용하지 않는다.

### 확인용 데이터 정리

확인용 계정과 그룹은 실제 사용 계정·그룹과 분리한다. 브라우저 확인까지 마친 뒤 Supabase SQL Editor에서 다음 순서로 정리한다.

1. `<확인용 이메일>`을 확인용 계정의 이메일로 바꿔 ID를 조회한다.

   ```sql
   select id from users where email = '<확인용 이메일>';
   ```

2. 아래 `<id>`를 조회한 숫자 ID로 바꿔 그룹을 먼저 삭제하고 회원을 삭제한다. 확인용 계정이 여러 개면 **모든 확인용 계정의 그룹 삭제를 먼저 끝낸 뒤** 각 회원을 삭제한다.

   ```sql
   delete from user_groups where created_by = <id>;
   delete from users where id = <id>;
   ```

그룹 초대·멤버·차단은 그룹에서, 거래·업로드 기록은 회원에서 연쇄 삭제된다. 거래 변경 이력도 연쇄 삭제된다. 스키마상 `group_invites.created_by`와 `group_bans.banned_by`는 회원 삭제에 연쇄 삭제되지 않으므로, 해당 계정이 다른 확인용 계정의 그룹에서 만든 참조도 그룹 삭제로 먼저 정리한다.

### 브라우저 확인

사용자가 다음 순서로 확인한다.

1. 회원가입하고 새로고침해도 로그인이 유지되는지 확인한다.
2. 로그아웃 후 다시 로그인한다.
3. 코드로 생성한 작은 엑셀 파일을 업로드하고 홈 달력을 확인한다.
4. 그룹을 만들고 초대 링크를 생성한다.
5. 다른 테스트 계정으로 합류하고 대시보드를 확인한다.
6. 모바일에서 홈 화면에 추가해 PWA 실행을 확인한다. 오프라인 기능은 제공하지 않는다.

## 7. 이후 배포

`main`에 머지하면 Pages는 `apps/web/**`, Render는 `apps/api/**` 변경을 대상으로 자동 배포한다. 공용 버전 계산기(`scripts/release/**`), `release-version.json`, `render.yaml`, `.dockerignore` 변경은 두 플랫폼 모두 배포 대상이다. Pages 대시보드의 Build watch paths Include에는 4장의 모든 경로를 설정한다. Render는 `render.yaml`의 `autoDeployTrigger: checksPass`로 api-ci 검사가 통과한 커밋만 배포한다.

Pages는 검사를 기다리지 않으므로 **PR의 CI가 통과한 뒤에만 머지한다**. `.github/workflows/api-ci.yml`과 `.github/workflows/web-ci.yml`에는 paths 필터가 있으므로 api-ci·web-ci를 required check로 지정하지 않는다. api-ci는 `./gradlew test memoryTest`, web-ci는 lint·typecheck·test·build를 실행한다.

Pages 빌드 대상 PR마다 미리보기 주소를 확인한다. 미리보기도 같은 Render API를 사용하므로 운영 데이터에 영향을 주는 작업을 주의해서 수행한다.

### 7.1 자동 버전과 도움말

버전은 `release-version.json`의 고정 기준 SHA 이후 main의 배포 대상 변경을
first-parent 순서로 세어 `0.1.N`으로 만든다. PR 내부 작업 커밋 수와 무관하게
한 번의 병합은 최대 한 번 증가한다. 문서·CI 검사만 바꾸면 증가하지 않는다.
버전 번호는 배포 성공 횟수가 아니라 코드 식별자다. 같은 SHA 재배포는 같은 번호이고
실패·취소된 빌드 때문에 중간 번호가 빠질 수 있다. 이전 코드를 배포하면 이전 번호다.
기준 SHA는 이동시키거나 main 이력을 강제로 다시 쓰지 않는다.

웹과 PWA는 같은 번들의 버전이다. 웹만 배포하면 API는 이전 번호를 유지하며,
API만 배포해도 웹·PWA 버전은 그대로다. PWA가 이전 번들을 실행 중이면 도움말에
그 이전 버전이 보이고 사용자가 업데이트한 뒤 새 번호로 바뀐다.
운영은 `0.1.N`, PR 미리보기는 `0.1.N-preview.<shortSha>`, 로컬은 `dev`다.

배포 뒤 로그인하고 데스크톱 상단 **도움말**, 모바일 **계정 → 도움말**을 연다.
앱·서버 버전과 짧은 SHA를 각 플랫폼 배포의 커밋과 대조한다.
서버가 시작 중이면 서버 버전 조회만 실패할 수 있으므로 다시 시도한다.
도움말을 열기 전에는 번호를 표시하거나 버전 API를 조회하지 않는다.
두 버전이 다르다는 이유로 강제 새로고침하거나 오류로 처리하지 않는다.

Pages 빌드는 기본 제공 Python 3와 Git을 사용해 `CF_PAGES_COMMIT_SHA`를 확인한다.
Render Docker 빌드는 `ARG RENDER`, `ARG RENDER_GIT_COMMIT`, `ARG RENDER_GIT_BRANCH`로
플랫폼이 제공하는 값을 받아 Git 이력을 확보하고 JAR에 정보를 고정한다.
런타임 환경변수만 바꿔도 JAR의 버전은 바뀌지 않는다.
SHA·기준 이력이 없거나 조회에 실패하면 운영 빌드는 실패하며 기존 서비스가 유지된다.
공개 저장소의 Git origin 접근에 의존하므로 저장소를 비공개로 바꿀 때는
빌드 접근 방식도 바꿔야 한다. 새 토큰을 Docker ARG에 넣지 않는다.

### 7.2 이 변경을 기존 서비스에 적용할 때

Cloudflare Pages와 Render에 아래 변경이 필요하다. 새 Secret이나 버전 환경변수를
직접 추가할 필요는 없다. 플랫폼이 제공하는 SHA·브랜치 정보를 빌드에서 사용한다.
아래는 적용 안내이며, 이 문서가 대시보드의 실제 설정 변경 완료를 뜻하지 않는다.

**Cloudflare Pages — 머지 전에 설정해도 된다.**

1. Cloudflare Dashboard → Workers & Pages → 해당 Pages 프로젝트 →
   Settings → Build → Build watch paths로 이동한다.
2. Include에 아래 다섯 항목을 각각 입력하고 저장한다. 기존 `*`가 있다면
   이 목록으로 교체한다. Exclude가 이 경로를 막고 있지 않은지도 확인한다.

   ```text
   apps/web/*
   scripts/release/*
   release-version.json
   render.yaml
   .dockerignore
   ```

3. Production branch `main`, Root directory `apps/web`, Build command
   `npm run build`, Output directory `dist`는 유지한다.
   Pages는 단일 `*`로 하위 디렉터리까지 일치시킨다.

**Render — 머지 후 새 render.yaml과 함께 적용한다.**

1. PR의 웹·API CI가 통과한 뒤 main에 머지한다.
2. Blueprint로 관리하면 해당 Blueprint의 Sync 결과에서 아래 값이 적용됐는지
   확인한다. 자동 Sync를 사용하지 않으면 수동 Sync를 실행한다.
3. 대시보드에서 직접 관리하는 서비스라면 `salad-bowl-api` → Settings →
   Build & Deploy에서 아래 세 경로를 함께 수정한다. Root Directory를 저장할 때
   다른 필드의 상대 경로를 확인하는 창이 나오면 아래 값을 맞춘 뒤 Update Fields한다.

   | 항목 | 값 |
   |---|---|
   | Root Directory | 저장소 루트 (`.`; UI가 빈 값으로 루트를 표현하면 비움) |
   | Dockerfile Path | `./apps/api/Dockerfile` |
   | Docker Build Context Directory | `.` |
   | Auto-Deploy | 검사 통과 후 배포 (`After CI Checks Pass`) |

4. Build Filters → Included Paths에 다음 다섯 항목을 설정한다.
   Ignored Paths가 이 경로를 막지 않는지도 확인한다.

   ```text
   apps/api/**
   scripts/release/**
   release-version.json
   render.yaml
   .dockerignore
   ```

5. API CI가 통과한 main 커밋의 배포가 성공했는지 확인한다.
   최초 자동 배포가 이전 경로 설정으로 실패했거나 설정 저장만 했다면,
   경로 수정 후 Manual Deploy → Deploy latest commit으로 다시 배포한다.
   API의 `/actuator/health`와 Pages를 거친 health가 모두 UP인지 확인한다.

**배포 후 확인**

- 로그인 후 데스크톱 도움말 / 모바일 계정 → 도움말에서 앱·서버 버전과
  각 플랫폼 배포의 커밋 SHA를 대조한다. 번호가 항상 같을 필요는 없다.
- 웹이 먼저 배포되고 API가 아직 이전 버전이면 서버 버전 조회가 실패할 수 있다.
  API 배포 완료 후 다시 시도한다.
- 기존 PWA에서 새 버전 알림 후 새로고침해 앱 버전이 바뀌는지 확인한다.

공식 설정 안내: [Pages Build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/),
[Render monorepo 설정](https://render.com/docs/monorepo-support).

로컬 Docker 빌드는 저장소 루트에서 실행한다. 기본값은 `dev`다.

```bash
docker build -f apps/api/Dockerfile -t salad-bowl-api .
python3 -m unittest discover -s scripts/release -p 'test_*.py' -v
```

## 8. 설정값 바꾸기·플랫폼 옮기기

값을 바꿀 때는 GitHub Environment `production`을 수정하고 `sync-config`를 실행한다. `deploy` 기본값이 `false`이므로 Render 값(DB·JWT·프록시 비밀값)을 바로 적용하려면 `deploy=true`로 실행하거나 Render에서 Manual Deploy한다. 플랫폼 대시보드에서 직접 고친 동기화 대상 값은 다음 동기화에서 덮어쓰므로 원본에서 변경한다. `API_HEALTH_URL`은 예외로 저장소 변수를 수정한다. Pages 값은 최신 배포 Retry로 적용한다. `PROXY_SECRET` 교체 시 Render와 Pages에 같은 값을 넣고 Pages를 먼저 재배포한 다음 API를 배포한다.

`JWT_SECRET`을 바꾸면 모든 사용자가 다시 로그인해야 한다. 운영 쿠키는 `Path=/api/auth; SameSite=Lax; Secure`로 고정한다. `CORS_ALLOWED_ORIGINS`는 기본 빈 값이며 같은 출처 프록시를 사용하므로 별도로 설정하지 않는다.

다른 플랫폼으로 옮길 때는 `.github/workflows/sync-config.yml`의 Render·Cloudflare 단계를 새 플랫폼 API 호출로 바꾼다. 앱 코드는 같은 환경변수 이름을 그대로 읽도록 유지한다. 새 서비스 주소와 health 주소도 원본 설정에서 변경한다.

## 9. 되돌리기

Pages는 Deployments에서 이전 배포로 Rollback한다. Render는 이전 커밋을 지정해 Manual Deploy한다. DB 마이그레이션(Flyway)은 앱 배포를 되돌려도 되돌리지 않으므로 스키마 변경 PR은 이전 앱과의 호환성을 따로 확인한다.

이 인증 변경 전 API로 되돌리면 `ver` 검사가 없어져 폐기된 refresh 토큰을 다시 받아들인다. 구 API로 되돌릴 때는 GitHub Secret의 `JWT_SECRET`을 새 값으로 바꾸고 `sync-config`를 **`deploy=true`**로 실행해(또는 실행 뒤 Render Manual Deploy) 모든 세션을 끊는다. `deploy=false`로만 실행하면 Render에 적용되지 않아 세션이 끊기지 않는다.

## 10. 문제 해결

| 증상 | 확인과 조치 |
|---|---|
| keepalive가 멈춤 | 공개 저장소는 60일 활동이 없으면 예약 워크플로가 꺼질 수 있으므로 Actions → keepalive → Enable workflow 후 수동 실행한다. `API_HEALTH_URL`이 없으면 경고만 남기고 성공 종료하므로 저장소 변수와 UP 응답도 확인한다. |
| `/api/*`가 HTML을 반환함 | Function 경로, `_routes.json`, `API_ORIGIN`과 Pages 재배포 여부를 확인한다. 화면에는 “요청을 처리하지 못했습니다.”로 표시될 수 있으므로 응답 형식도 확인한다. |
| health가 계속 실패함 | 약 3~4분의 기동 시간을 기다린 뒤 Render 로그에서 DB 연결, `sslmode=require`, 세션 풀러 사용자 이름을 확인한다. Spring이 빠진 환경변수를 `${DB_USERNAME}` 같은 문자열로 처리할 수 있어 “값 없음” 대신 DB 인증 오류 또는 “app.jwt.secret must be at least 32 bytes”로 나타날 수 있으므로 GitHub Environment 값과 sync-config 실행 여부를 확인한다. |
| 업로드가 503 `IMPORT_BUSY`로 실패함 | 화면에 “다른 업로드를 처리하고 있습니다. 잠시 후 다시 시도해 주세요.”를 표시한다. import는 서버 전체에서 동시에 1건만 처리하고 20초 대기 후 거절한다. CPU 0.1에서 한도 근처 파일은 1분 이상 걸릴 수 있으므로 기존 작업 완료 후 재시도한다. |
| 로그인 후 새로고침하면 로그아웃됨 | 쿠키 `Path=/api/auth`, `Secure`와 HTTPS Pages 주소로 접속했는지 확인한다. 로컬 HTTP에서는 `REFRESH_COOKIE_SECURE=false`로 API를 실행한다. |
| Supabase가 일시정지됨 | Supabase 대시보드에서 Restore하고 keepalive의 실행 기록과 health 응답을 확인한다. |

## 11. 구글 로그인

구글 로그인은 Google Identity Services의 ID 토큰 방식이다. 브라우저가 구글에서 받은 ID 토큰을 `POST /api/auth/google`로 보내면, API가 구글 공개키(`https://www.googleapis.com/oauth2/v3/certs`)로 서명·발급자·대상(aud)·만료를 검증하고 기존 로그인과 같은 access 토큰과 refresh 쿠키를 발급한다. 리디렉션 URI와 클라이언트 보안 비밀은 사용하지 않는다.

`GOOGLE_CLIENT_ID`가 비어 있으면 기능이 꺼진다. 웹은 버튼을 그리지 않고, API는 503 `GOOGLE_LOGIN_UNAVAILABLE`을 반환한다. 그래서 설정 전에 머지·배포해도 기존 로그인은 영향을 받지 않는다.

동작 규칙:

- 이미 연동된 구글 계정(`google_sub`)이면 그 사용자로 로그인한다.
- 같은 이메일의 기존 계정이 있으면 구글이 이메일을 인증한(`email_verified=true`) 경우에만 자동 연동한다. 기존 닉네임은 유지한다.
- 둘 다 아니면 새 계정을 만든다. 닉네임은 구글 이름(최대 50자), 없으면 이메일 앞부분이다.
- 구글로만 가입한 계정은 비밀번호가 없어 이메일·비밀번호 로그인은 할 수 없다.

### 11.1 서비스별 설정과 확인사항

| 서비스 | 설정 | 확인사항 |
|---|---|---|
| Google Cloud Console | API 및 서비스 → OAuth 동의 화면을 만든다(사용자 유형 외부, 범위는 기본 `openid`·`email`·`profile`만). 사용자 인증 정보 → **OAuth 클라이언트 ID**(유형: 웹 애플리케이션)를 만든다. | **승인된 JavaScript 원본**에 `https://<project>.pages.dev`가 슬래시·경로 없이 정확히 들어 있다. 로컬 개발용으로 `http://localhost`와 `http://localhost:5173`도 넣는다. 개인 도메인을 쓰면 그 주소도 넣는다. **승인된 리디렉션 URI**는 비워 둔다. 동의 화면이 "테스트" 상태이면 테스트 사용자로 등록한 계정만 로그인할 수 있으므로, 모두가 쓰려면 "프로덕션"으로 게시한다. 클라이언트 ID는 `….apps.googleusercontent.com` 형태다. 클라이언트 보안 비밀은 쓰지 않는다. |
| GitHub Environment `production` | **Variable** `GOOGLE_CLIENT_ID` = 클라이언트 ID | Secret이 아니라 Variable에 넣었다(클라이언트 ID는 브라우저에 공개되는 값이다). 앞뒤 공백이 없다. |
| Render (`salad-bowl-api`) | Environment에 `GOOGLE_CLIENT_ID`. `sync-config`가 넣는다. | 값이 GitHub Variable과 같다. 값을 바꾼 뒤에는 재배포해야 API가 읽는다. |
| Cloudflare Pages | Settings → Variables and Secrets의 production·preview에 `VITE_GOOGLE_CLIENT_ID`. `sync-config`가 넣는다. | 값이 GitHub Variable과 같다. 빌드할 때 들어가는 값이므로 값을 넣은 **뒤의 배포**에서만 버튼이 보인다. `_headers`에 CSP가 없어 구글 스크립트(`accounts.google.com/gsi/client`)를 따로 허용할 필요가 없다. CSP를 추가하게 되면 이 출처를 허용해야 한다. |
| Supabase | 설정할 것 없음 | API가 기동할 때 Flyway가 `V6__add_google_login.sql`(`google_sub` 컬럼 추가, `password_hash` NULL 허용)을 실행한다. 기존 데이터는 바뀌지 않는다. |

### 11.2 실행 절차

1. Google Cloud Console에서 11.1의 설정을 마치고 클라이언트 ID를 GitHub Variable `GOOGLE_CLIENT_ID`에 넣는다.
2. 구글 로그인 PR을 머지한다. Render는 api-ci가 통과한 커밋을 배포하고(이때 V6 마이그레이션 실행), Pages는 웹을 배포한다. 이 시점에는 값이 아직 없으므로 버튼이 보이지 않는 것이 정상이다.
3. Actions → `sync-config`를 **`main`에서** `dry_run=true`로 먼저 실행해 값 검사가 통과하는지 본다. 머지 전의 `main`에는 구글 단계가 없으므로 반드시 머지 후에 실행한다.
4. `dry_run=false`, `deploy=true`로 실행한다. Render에 `GOOGLE_CLIENT_ID`, Pages에 `VITE_GOOGLE_CLIENT_ID`가 반영되고 Render 재배포가 요청된다.
5. Pages 대시보드 → Deployments에서 최신 production 배포를 **Retry**한다. 새 빌드에 `VITE_GOOGLE_CLIENT_ID`가 들어간다.
6. Render 배포가 Live가 되고 Pages 배포가 끝나면 11.3으로 확인한다.

Render·Pages 대시보드에 값을 직접 넣었다면 3~4단계 대신 Render Manual Deploy와 Pages Retry만 하면 된다. 다만 원본은 GitHub Environment이므로 Variable에도 같은 값을 넣어 둔다.

### 11.3 확인

1. `curl -sS -X POST https://<project>.pages.dev/api/auth/google -H 'Content-Type: application/json' -d '{"idToken":"x"}'`가 401 `INVALID_TOKEN`을 반환한다. 503 `GOOGLE_LOGIN_UNAVAILABLE`이면 Render에 값이 없거나 재배포 전이다.
2. 로그인 화면 아래에 "Google로 계속하기" 버튼이 보인다.
3. 새 구글 계정으로 로그인하면 홈으로 이동하고, 닉네임이 구글 이름으로 보인다.
4. 이메일로 가입해 둔 주소의 구글 계정으로 로그인하면 같은 계정(같은 그룹·거래)으로 들어간다.
5. 새로고침해도 로그인이 유지되고(refresh 쿠키), 로그아웃 후 다시 구글로 로그인할 수 있다.

### 11.4 문제 해결

| 증상 | 원인과 조치 |
|---|---|
| 버튼이 보이지 않음 | Pages에 `VITE_GOOGLE_CLIENT_ID`가 없거나, 값을 넣기 전의 빌드가 떠 있다. Pages 배포를 Retry한다. |
| 구글 창에 `origin_mismatch` 또는 "액세스 차단됨" | 승인된 JavaScript 원본이 실제 주소와 다르다. 반영까지 몇 분 걸릴 수 있다. |
| 특정 계정만 로그인됨 | 동의 화면이 "테스트" 상태다. 테스트 사용자로 추가하거나 프로덕션으로 게시한다. |
| "Google 로그인을 사용할 수 없습니다" (503) | Render에 `GOOGLE_CLIENT_ID`가 없거나 재배포 전이다. |
| "다시 로그인해 주세요" (401 `INVALID_TOKEN`) | Render와 Pages의 클라이언트 ID가 서로 다르거나(aud 불일치), 구글 이메일이 미인증이다. 두 값을 비교한다. |
| "Google 로그인을 불러오지 못했습니다" | 브라우저가 `accounts.google.com` 스크립트를 막았다(광고 차단기 등). |

### 11.5 끄기·되돌리기

- **기능만 끄기:** GitHub Variable `GOOGLE_CLIENT_ID`를 지우고, Render와 Pages에서도 값을 직접 지운 뒤 재배포한다(`sync-config`는 빈 값을 지우지 않고 건너뛴다). 이미 구글로 가입한 계정은 비밀번호가 없어 로그인할 수 없게 된다.
- **코드 되돌리기:** V6 마이그레이션은 컬럼 추가와 NULL 허용뿐이라 그대로 두고 이전 커밋을 배포해도 된다. 이때도 구글 전용 계정은 로그인할 수 없다.

### 11.6 로컬 개발

`apps/web/.env.local`에 `VITE_GOOGLE_CLIENT_ID=<클라이언트 ID>`, API 실행 환경에 `GOOGLE_CLIENT_ID=<같은 값>`을 설정한다. 원본 목록에 `http://localhost:5173`이 있어야 한다.

## 12. 새 API를 사용하는 웹 기능 배포

Pages와 Render의 자동 배포는 동시에 완료되지 않는다. 새 엔드포인트를 사용하는 기능은 서버를 먼저 배포하는 두 단계 변경으로 진행한다. Render에서 해당 커밋의 배포가 Live인지 확인하고, 테스트 계정으로 실제 엔드포인트가 정상 응답하는지 확인한 뒤 웹 변경을 공개한다. `/actuator/health`의 UP만으로 새 엔드포인트 반영을 판단하지 않는다.

서버·웹 변경을 함께 배포했다면 양쪽 완료 후 첫 조회와 오류 화면의 재시도 복구를 확인한다. 2026-10-28 소분류 기능에서는 웹과 API 반영에 약 4분 차이가 있었다. 분석과 UI 조치는 [소분류 초기 조회 분석](superpowers/plans/2026-10-28-subcategory-loading-review.md)에 기록했다.
