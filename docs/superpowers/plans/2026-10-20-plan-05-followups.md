# Plan 05 후속 과제

Plan 05(배포)의 Task별 리뷰(Claude·Codex 교차), 최종 리뷰(opus + Codex), 로컬 컨테이너 측정에서 나왔지만 넘긴 항목이다. 실제 배포를 진행한 뒤 결과를 이 문서에 덧붙인다.

## 실행 중 바뀐 결정 (기록용)
- **업로드 한도**: 대용량 스트리밍 파서 대신 한 파일 최대 3개월치(첫·마지막 거래 92일 이내)·512KB로 제한했다. 스트리밍은 [잔여 작업](../../backlog.md)으로 넘겼다.
- **설정값**: 원본은 GitHub Environment `production`이고 `sync-config` 워크플로가 Render·Cloudflare에 넣는다. Environment 배포 브랜치는 `main`으로 제한해야 한다(공개 저장소에서 다른 브랜치의 워크플로로 비밀값을 읽을 수 있다).
- **메모리**: 512MB·CPU 0.1 컨테이너 측정 결과에 따라 heap을 50%로, Tomcat 스레드를 20개로 줄이고 import를 서버 전체 1건으로 제한했다(20초 대기 후 503 `IMPORT_BUSY`).
  - 측정(2026-10, `-m 512m --cpus 0.1`): 기동 약 3분 40초, 한도 근처(약 487KiB·1만 행) import 81초·최대 392MiB, 동시 2건 → 201 + 503, OOM 없음.
- **휴면 방지**: 기동이 길어 keepalive를 10분마다로 바꿨다(서비스 1개 약 744시간/월, 무료 750시간 안). 화면 안내를 "최대 4분쯤"으로 고쳤다.
- **Codex 협업**: Codex 샌드박스는 `.git`에 쓰지 못해 커밋할 수 없다. 컨트롤러가 테스트를 다시 돌려 확인한 뒤 Codex 서명으로 커밋했다(`codex-collab` 스킬에 반영).

## 실제 배포에서 확인할 것
- Render 무료 인스턴스에서 기동 시간과 health check 통과(로컬 측정 약 3분 40초).
- 큰 파일 업로드 중 health check 실패·재시작이 없는지(Render Events). 재시작이 보이면 한도를 256KB로 낮추고 `memoryTest`를 다시 확인한다.
- 업로드가 81초 + 대기 20초까지 걸릴 때 Pages Function → Render 경로에서 끊기지 않는지.
- Cloudflare Pages의 `.webmanifest` Content-Type, `_routes.json`·`_headers` 적용(점검 스크립트가 확인).
- keepalive가 Supabase 7일 휴면을 실제로 막는지(풀러를 거친 health의 DB 확인이 "활동"으로 잡히는지).
- GitHub 예약 실행이 늦어 Render가 잠드는 빈도.

## Plan 06 (운영·보안 보강)에 더할 것
- `RefreshCookieProperties`: `same-site`가 없으면 `Set.of(...).contains(null)`이 NPE를 낸다. null 검사를 먼저 하고 테스트를 더한다. → Plan 08에서 처리
- 업로드 중 `SlowServerNotice`가 "서버를 깨우는 중…"을 보여준다(업로드가 3초를 넘으면). `/imports` POST는 느린 요청 집계에서 빼거나 업로드 전용 문구를 쓴다. → Plan 08에서 업로드는 집계에서 뺐다
- 1MB 요청 한도·Tomcat swallow 한도를 넘는 요청은 413 대신 연결이 끊겨 프록시가 502를 낼 수 있다. 웹 사전 검사(512KB)가 일상 사용은 막는다. → Plan 08에서 프록시가 1MB 초과 본문에 413으로 답한다
- import 대기(20초)가 CPU 0.1의 import 시간(약 81초)보다 짧아, 동시 업로드의 두 번째는 대부분 503이다. 사용자가 늘면 대기열·진행 표시를 검토한다. → Plan 08은 문구에 기다릴 시간만 알렸다(Cloudflare 100초 한도 때문에 대기를 늘리지 않음). 대기열은 남긴다

## 나중에 (사소함)
- `FILE_TOO_LARGE` 문구가 `importsApi.ts`와 `errorMessage.ts`에 중복된다.
- 홈 업로드 대화상자의 "여러 달이 들어 있어도 거래 일자에 맞게 반영됩니다."에 3개월 한도가 드러나지 않는다(`HomePage.tsx`).
- 프록시: 스킴 없는 `host:8080` 형태의 `API_ORIGIN`은 503 대신 502가 된다(`sync-config`가 `https://`를 강제하므로 실제로는 막힌다).
- `sync-config`: curl 실패 시 `RUNNER_TEMP`의 요청 본문 파일이 남는다(러너는 일회용). `DB_URL` 검사는 `sslmode=require` 포함 여부만 본다.
- keepalive의 curl 재시도 예산(최대 약 16분)이 job 제한 12분보다 길다(제한으로 끝나므로 문제는 아니다).
- 점검 스크립트는 `/`·`registerSW.js`·workbox 본문이 비었는지, health의 Content-Type은 보지 않는다. JSON은 공백 없는 직렬화(Jackson 기본)를 가정한다.
- `pagesConfig.test.ts`의 정규식 이스케이프가 수작업이다.
- 월 검증 테스트가 반복문이라 첫 실패에서 멈춘다(Plan 04c 후속과 같음).
