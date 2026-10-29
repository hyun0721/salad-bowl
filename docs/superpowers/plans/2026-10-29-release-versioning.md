# 자동 배포 버전 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** main의 배포 대상 변경을 자동으로 번호 매기고 도움말에서만 앱·서버 버전을 확인한다.

**Architecture:** 고정 기준 SHA 이후 first-parent 변경을 세는 Python 표준 라이브러리 스크립트를 두 빌드가 공유한다. Vite define과 API JAR 리소스에 메타데이터를 고정하고 기존 인증 API·Dialog를 재사용한다.

**Tech Stack:** Python 3 + Git, React/TypeScript/Vite/Vitest, Java 21/Spring Boot/Gradle, Docker.

기준 설계: `docs/superpowers/specs/2026-10-29-release-versioning-design.md`.
현재 격리된 워크트리의 `codex/release-versioning-plan` 브랜치에서 직접 실행한다.

### Task 1: 버전 계산

**Files:** `release-version.json`, `scripts/release/version.py`, `scripts/release/test_version.py`.

- [x] 가짜 Git 이력 테스트를 먼저 작성하고 `python3 -m unittest discover -s scripts/release -p 'test_*.py' -v`로 기능 부재 실패를 확인한다.
- [x] JSON 설정은 baseCommit, prefix (`0.1`), repository, paths를 정의한다.
- [x] 기준 SHA가 대상의 first-parent 이력에 있는지 검사한다. 기준 이후 각 커밋을 첫 부모와 diff하여 paths 변경이 있는 커밋만 센다. `{version, commit}`을 JSON 또는 Java properties로 출력한다.
- [x] production/preview/dev를 구별한다. preview는 main 공통 조상 번호와 대상 short SHA를 쓴다. 운영 이력 누락·체크아웃 불일치는 실패시킨다. 필요한 이력이 없으면 고정 origin에서 보충한다.
- [x] 같은 SHA 재시도·롤백, merge·squash·문서 변경, 누락 SHA·shallow·체크아웃 불일치를 검증한다. 기대 결과는 테스트 전부 PASS.

### Task 2: 빌드 주입과 API

**Files:** `apps/web/vite.config.ts`, `apps/web/src/vite-env.d.ts`, `apps/api/build.gradle`, `apps/api/Dockerfile`, `apps/api/src/main/java/com/saladbowl/api/version/VersionController.java`, `apps/api/src/test/java/com/saladbowl/api/version/VersionApiTest.java`, `render.yaml`, `.dockerignore`.

- [x] 인증 조회·no-store·정확한 메타데이터 응답 테스트를 먼저 작성해 실패를 확인한다.
- [x] Vite 설정에서 공용 스크립트를 실행하고 `__APP_VERSION__`에 JSON 메타데이터를 define한다. 테스트·로컬은 dev를 사용한다.
- [x] Gradle processResources로 version.properties를 JAR에 복사한다. 로컬은 dev를 생성하고 운영은 Docker가 생성한 파일을 전달한다.
- [x] API는 classpath의 불변 메타데이터를 읽어 GET /version에서 반환한다. 기존 anyRequest 인증과 프록시 보호를 유지하며 no-store를 설정한다.
- [x] Render context를 저장소 루트로 맞추고 Docker build 단계에서만 Git·Python으로 번호를 계산한다. 최종 JRE에는 JAR만 복사한다. 필요 파일만 COPY하며 비밀값을 빌드 인자로 읽지 않는다.
- [x] `./gradlew test`, `docker build -f apps/api/Dockerfile .`로 API와 Docker 산출물을 검증한다. 운영 메타데이터는 공용 계산기로 생성한 뒤 `bootJar -PreleaseMetadataFile=<생성 파일>`로 실제 JAR에 넣어 검증한다. Render 자체 운영 빌드는 배포 시 별도로 확인한다.

### Task 3: 도움말

**Files:** `apps/web/src/app/HelpDialog.tsx`, `HelpDialog.test.tsx`, `AppLayout.tsx`, `AccountSheet.tsx`, 계정 시트 관련 테스트.

- [x] 도움말에서만 번호가 보이는지와 서버 로딩·실패·재시도 테스트를 먼저 작성해 실패를 확인한다.
- [x] 공용 Dialog에 현재 번들의 앱 버전과 짧은 SHA를 표시한다. 서버 조회는 `apiFetch('/version', {trackSlow:false})`를 쓰고 응답 형식을 검증한다.
- [x] 도움말이 마운트될 때만 서버를 조회한다. 닫으면 취소하며 실패는 도움말 안에서 처리한다. 웹 버전을 서버 응답으로 덮어쓰지 않는다.
- [x] 데스크톱 상단 도움말 버튼, 모바일 계정 메뉴 도움말 항목을 연결한다. 모바일은 계정 시트를 닫은 뒤 도움말을 열고 닫힌 뒤 계정 버튼에 포커스를 복귀한다.
- [x] `npm test -- src/app/HelpDialog.test.tsx` 및 관련 통합 테스트를 실행한다. 기대 결과는 PASS이며 기본 화면에서 /version 요청은 0회다.

### Task 4: CI·운영 문서와 최종 검증

**Files:** `.github/workflows/web-ci.yml`, `.github/workflows/api-ci.yml`, `docs/deploy.md`, `docs/architecture.md`, 설계 문서.

- [x] 공용 버전 파일·스크립트를 두 CI와 Render 필터에 추가하고 CI에서 공용 테스트를 실행한다. Pages watch paths의 대응 설정을 문서화한다.
- [x] production/preview/local과 재시도·실패·롤백 규칙, 도움말 확인과 플랫폼 SHA 대조 절차를 적는다.
- [x] `npm run typecheck && npm test && npm run lint && npm run build`와 `./gradlew test`, 공용 스크립트 테스트를 실행한다.
- [x] Docker 산출물의 버전 리소스를 확인하고 `git diff --check` 및 자체 리뷰를 수행한다. 미실행 운영 작업과 검증 제약을 기록한다.
- [x] 필요한 수정이 끝나면 작업을 커밋한다. 사용자 요청 없이 push·PR·운영 배포·병합하지 않는다.


## 실행 기록 (2026-10-29)

- Python 정책 테스트 10개 통과. main 및 preview shallow clone 보충과 Docker처럼 Git checkout이 없는 빌드 context를 포함한다.
- Node 22.22.0으로 typecheck·Vitest 366개·lint·build 통과. lint 경고를 수정한 뒤 전체 명령을 재실행했다.
- JDK 21로 Gradle test 237개 통과. 인증·프록시·no-store 및 production 리소스 파싱을 포함한다.
- 저장소 루트에서 Docker 이미지 빌드 성공. JAR 내부 version.properties와 최종 실행 사용자 app을 확인했다.
- 이 작업은 업로드·파서·메모리 동작을 바꾸지 않아 별도 memoryTest는 실행하지 않았다. 기존 CI의 memoryTest는 유지했다.
- 실제 Pages·Render 설정 변경, 운영 배포·롤백, iOS 설치형 PWA 실기기 업데이트는 수행하지 않았다.
- 검증은 현재 세션의 자체 점검이다. 독립 리뷰로 표현하지 않는다.

- Playwright 실제 브라우저에서 데스크톱 도움말 모달과 390×844 모바일 계정 → 도움말 전환을 확인했다. 가짜 API 응답만 사용했다.
- Pages 운영 환경변수를 재현한 빌드에서 웹 JS 번들에 `0.1.1`과 구현 커밋 SHA가 포함되는 것을 확인했다. API도 같은 메타데이터를 실제 JAR에 패키징해 동일한 내용을 확인했다.
- 실제 Render의 운영 모드 Docker 빌드는 원격 main에 구현이 반영된 뒤 확인해야 한다. 로컬 Docker 빌드와 운영 메타데이터 패키징 검증을 그 결과로 대신 표현하지 않는다.


## PR 준비 (2026-10-30)

- origin/main `cfe8d64`를 반영했다. BottomSheet 충돌은 main의 ModalOverlay 기반 안드로이드 수정과 이번 buttonRef를 함께 유지해 해결했다. `.gitignore`는 양쪽 항목을 보존했다.
- 병합 상태에서 Node 22.22.0 웹 typecheck·테스트 422개·lint·build와 JDK 21 API 테스트 242개, 공용 정책 테스트 10개를 확인했다.
- 웹 lint는 성공했으며 main에서 반영된 `CoverageSection.tsx:32`의 기존 set-state-in-effect 경고 1개가 남아 있다. 이 PR 변경 밖의 동작은 수정하지 않았다.
- Cloudflare와 Render 공식 문서를 대조해 `docs/deploy.md`의 대시보드 경로·필드값·적용 순서·최초 배포 실패 재시도를 보강했다. 대시보드의 실제 설정 변경과 운영 배포는 수행하지 않았다.
