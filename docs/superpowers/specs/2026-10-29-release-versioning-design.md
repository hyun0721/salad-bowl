# 웹·PWA·API 자동 버전 관리 설계

- 작성일: 2026-10-29
- 상태: 승인됨. 사용자의 문서 검토 승인 및 구현 시작 요청 반영.
- 기준 main SHA: `78d3063b50bd3e45a9355529d5d6d9dddeebbc00`
- 구현 전 설계 문서다. 아래 기능은 아직 구현하지 않았다.

## 1. 확정한 동작

main에 배포 대상 변경이 반영되면 `0.1.N` 버전을 자동 부여한다.
웹과 설치형 앱은 같은 React PWA이므로 같은 빌드 정보를 사용한다.
API는 별도로 배포되므로 자신이 실행 중인 빌드 정보를 제공한다.
번호와 커밋 SHA는 빌드 결과물에 고정하며 수동으로 기록하지 않는다.

버전은 사용자가 도움말을 열었을 때만 표시한다. 헤더·사이드바·푸터 및
기존 업데이트 알림에는 번호를 표시하지 않는다. PWA 업데이트는 기존처럼
사용자가 새로고침을 선택할 때 적용한다.

별도 배포 이력 DB는 만들지 않는다. 배포 성공·실패·되돌리기 이력은
Cloudflare Pages와 Render의 기존 배포 이력으로 확인한다.

## 2. 현재 코드 근거

- `apps/web/package.json`: 웹 version은 `0.0.0`.
- `apps/web/vite.config.ts`: PWA prompt 업데이트, API 캐시 없음.
- `apps/web/src/app/UpdatePrompt.tsx`: 새 버전 알림과 사용자 새로고침.
- `apps/web/src/app/AppLayout.tsx`: 데스크톱 사용자 영역과 모바일 계정 시트.
- `apps/web/src/app/AccountSheet.tsx`: 모바일 계정 메뉴.
- `apps/web/src/common/Dialog.tsx`: 모달·모바일 시트 공용 구현.
- `render.yaml`: API 경로 필터와 검사 통과 후 자동 배포.
- `.github/workflows/web-ci.yml`, `.github/workflows/api-ci.yml`: 앱별 CI.
- `docs/deploy.md`: main 기반 플랫폼 자동 배포.

## 3. 방식 비교와 선택

1. **Git 이력에서 결정적으로 계산 — 채택.** 같은 SHA는 언제 빌드해도 같은
   번호다. 중앙 카운터·쓰기 권한 없이 두 플랫폼이 같은 규칙을 적용할 수 있다.
   빌드에서 필요한 Git 이력을 확보해야 한다.
2. 중앙 워크플로에서 번호 발급. 순번 발급은 명확하지만 기존 자동 배포와
   발급 완료 사이의 동기화 또는 배포 파이프라인 재구성이 필요하다.
3. 플랫폼별 빌드 번호. 각 플랫폼에서는 간단하지만 공통 번호 체계가 아니며
   같은 커밋을 재시도해도 다른 번호가 될 수 있다.

현재 자동 배포를 유지하고 별도 상태 저장소를 만들지 않는 1번을 선택한다.

## 4. 번호 정책

- 형식은 `0.1.N`. 앞 두 숫자는 이번 범위에서 고정한다.
  N은 호환성을 보장하는 SemVer patch가 아니라 배포 대상 코드의 증가 번호다.
- 위 기준 SHA 이후 main의 first-parent 이력에서 배포 관련 경로를 변경한
  커밋을 센다. merge commit은 첫 부모와의 최종 파일 차이로 한 번 센다.
  PR 내부 작업 커밋 수는 번호 증가량에 영향을 주지 않는다.
- 계산 범위는 `apps/web/`, `apps/api/`, `scripts/release/`,
  `release-version.json`, `render.yaml`, `.dockerignore`다. 문서와 CI 검사만 바꾸면 증가하지 않는다.
- 기준 이후 첫 관련 변경은 `0.1.1`이다. 관련 변경마다 마지막 숫자가 1 증가한다.
- 계산은 빌드 대상 SHA에서 끝내며, 빌드 중 이동하는 최신 main을 쓰지 않는다.
- 같은 SHA 재배포·재시도는 같은 번호다. 빌드 시각은 번호에 쓰지 않는다.
- 웹만 바뀌면 API는 기존 실행 버전을, API만 바뀌면 웹은 기존 버전을 유지한다.
  취소되거나 실패한 중간 빌드 때문에 플랫폼별 실행 버전에 건너뛴 번호가 생길 수 있다.
- 실패하면 기존 서비스 버전이 유지된다. 롤백하면 이전 코드의 번호가 표시된다.
  번호는 성공한 배포 횟수가 아니다.
- PR preview는 `0.1.N-preview.<shortSha>`. N은 main과의 공통 조상까지 센다.
  로컬 개발은 `dev`다. 운영 번호와 혼동하지 않게 한다.
- 운영 SHA·기준 SHA·필요한 이력을 확인할 수 없으면 빌드를 실패시킨다.
  운영에서 임의의 `dev`나 `0.1.0`으로 대체하지 않는다.
- main 이력을 강제로 다시 쓰지 않는 운영 방식에 의존한다.

| main 반영 내용 | 웹 실행 버전 | API 실행 버전 |
|---|---|---|
| 첫 웹·API 변경 | 0.1.1 | 0.1.1 |
| 웹만 변경 | 0.1.2 | 0.1.1 |
| API만 변경 | 0.1.2 | 0.1.3 |
| API 같은 SHA 재배포 | 0.1.2 | 0.1.3 |

## 5. 빌드 연결

공용 계산 코드는 `scripts/release/`, 고정된 기준 SHA·접두어·계산 경로는
`release-version.json`에 둔다. 웹과 API가 다른 계산 규칙을 복제하지 않는다.
메타데이터 계약은 `{ version: string, commit: string }`이며 commit은 전체 SHA다.

Pages는 `CF_PAGES_COMMIT_SHA`, Render는 `RENDER_GIT_COMMIT`을 기준으로
빌드 대상 SHA를 식별한다. SHA와 계산에 사용한 Git 이력의 일치를 검증한다.
런타임에 main을 조회하거나 환경변수 변경만으로 실행 버전을 바꾸지 않는다.

Pages의 shallow checkout은 기준까지 필요한 이력을 확보한다.
API Docker context에 `.git`이 있다고 가정하지 않는다. 빌드 단계에서 고정된
저장소 origin의 대상 SHA와 기준까지 이력을 확보해 번호만 계산한다.
앱 소스는 플랫폼 build context를 사용하며 Git 이력·도구는 최종 JRE에 넣지 않는다.
빌드에서 저장소에 접근할 권한이 없으면 실패시키고 비밀값을 이미지에 넣지 않는다.

공용 스크립트를 읽을 수 있도록 Render build context를 저장소 루트로 조정하고
Docker COPY 경로와 `.dockerignore`를 맞춘다. 환경 파일·로컬 데이터·Git 작업
디렉터리·node_modules·생성물은 제외하고 필요한 파일만 명시적으로 COPY한다.
Gradle 의존성 캐시와 최종 이미지의 비루트 실행은 유지한다.

공용 버전 파일·스크립트 변경은 Pages watch paths, Render build filter와
웹·API CI에서 모두 대상으로 포함한다. 웹/API 전용 변경의 기존 분리는 유지한다.
Pages 대시보드 설정 변경은 운영 문서에 정확히 적고 실제 반영과 코드 수정을 구분한다.

확인한 공식 참조:

- [Pages 빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Render 기본 환경변수](https://render.com/docs/environment-variables)
- [Render Docker build arguments](https://render.com/docs/docker#environment-variable-translation)

## 6. 도움말에서만 표시

데스크톱은 상단 사용자 영역에 도움말 버튼을 둔다.
모바일은 기존 계정 시트에 도움말 항목을 둬 좁은 헤더에 버튼을 추가하지 않는다.
모바일에서는 계정 시트를 닫고 도움말 시트를 연다. 두 시트를 동시에 쌓지 않는다.
도움말을 닫으면 모바일은 계정 트리거, 데스크톱은 도움말 버튼으로 포커스를 돌린다.

기존 공용 Dialog를 재사용해 데스크톱 모달·모바일 시트를 제공한다.
제목은 도움말, 내용은 앱 버전·서버 버전과 각 항목의 짧은 SHA다.
빌드 정보는 이 창 안에서만 보인다. 로그인 후 기존 앱 레이아웃에서 제공하며
별도 설정 페이지와 로그인 화면 전용 진입점은 추가하지 않는다.

앱 버전은 실행 중인 번들의 값을 네트워크 없이 바로 표시한다.
오래된 PWA는 이전 버전을 표시하고 업데이트 후 새 번들이 실행되면 바뀐다.
서버 조회 결과로 앱 버전을 덮어쓰지 않는다. 둘이 다르더라도 강제 업데이트나
오류·경고를 추가하지 않는다.

## 7. 서버 조회와 오류 처리

API는 인증된 `GET /version`으로 빌드 메타데이터만 반환한다.
웹에서는 기존 프록시를 통해 `/api/version`을 호출한다.
기존 JWT·프록시 보호를 유지하고 Actuator 공개 범위를 넓히지 않는다.
내부 경로·환경변수·비밀값·의존성 목록은 반환하지 않는다.
응답은 `Cache-Control: no-store`로 현재 응답한 서버의 정보를 보여준다.

도움말을 열 때만 요청하며 자동 폴링하지 않는다. 닫으면 요청을 취소하거나
결과 반영을 중단한다. 조회 중에는 확인 중, 실패 시에는 확인할 수 없음과
다시 시도를 표시한다. 서버 실패가 앱 버전을 숨기거나 도움말 전체를 막지 않는다.
이 조회는 기존 전역 느린 요청 표시 대신 도움말 안에서 상태를 처리한다.

## 8. 검증과 구현 순서

1. 가짜 Git 저장소로 웹/API/공용/문서 변경과 merge·squash의 번호를 검증한다.
   같은 SHA 재시도, 과거 SHA 롤백, shallow 이력과 누락·불일치 실패를 포함한다.
2. 웹 빌드 주입과 API Docker 빌드 연결을 구현하고 같은 SHA에서 동일 정보가
   생성되는지 검증한다. API 인증·프록시 보호와 no-store를 확인한다.
3. 도움말 UI와 계정 시트를 연결한다. 평상시에는 번호·조회가 없는지,
   열기·닫기·실패·재시도·포커스 복귀와 오래된 PWA 버전 유지를 검증한다.
4. CI·배포 필터·Docker context와 운영 문서를 맞춘다.
   웹은 typecheck, test, lint, build, API는 Gradle test를 수행한다.
   운영 smoke 절차에 로그인 후 도움말, SHA 대조, PWA 업데이트 확인을 추가한다.

실제 운영 배포·대시보드 변경·롤백 결과는 로컬 검증과 구분해 보고한다.
구현 계획은 `docs/superpowers/plans/2026-10-29-release-versioning.md`를 따른다.

## 9. 범위 밖

수동 릴리스 승인, GitHub Release/태그 자동 생성, 변경 이력 화면,
별도 배포 DB, 강제 업데이트, 웹·API 호환 버전 차단,
네이티브 iOS/Android 스토어 버전 관리는 포함하지 않는다.
