# 한계점

무료 티어 위에서 운영하기 위해 정한 한도와 제약을 모은다. 값을 바꿀 때는 이 문서와 함께 표시한 코드 위치를 같이 고친다.

## 무료 티어 조건

다음은 2026-10에 확인한 조건이다. 무료 티어 조건은 바뀔 수 있으므로 서비스를 만들 때 다시 확인한다.

| 서비스 | 무료 티어 기준 |
|---|---|
| Render | 메모리 512MB·CPU 0.1, 15분 유휴 시 sleep, 월 750시간으로 운영한다. |
| Supabase | DB 500MB를 제공하며 7일 비활성 시 일시정지한다. 직접 연결은 IPv6 전용이므로 IPv4 연결에는 세션 풀러를 사용한다. |
| Cloudflare Pages | Functions는 하루 10만 요청으로 제한하며 정적 요청은 무제한으로 제공한다. |

`keepalive`는 10분마다 Pages를 통해 API health를 요청한다. 서비스 1개를 계속 켜 두면 31일 기준 약 744시간을 사용한다. 무료 서비스를 하나 더 상시 가동하면 월 750시간으로는 부족하므로 함께 계산한다. GitHub 예약 실행은 늦어질 수 있으므로 sleep을 완전히 막는다고 가정하지 않는다.

## 콜드스타트

CPU 0.1에서 API 기동은 약 3~4분 걸린다. 2026-10 측정에서는 약 3분 40초가 걸렸다. sleep 후 첫 요청은 이 시간만큼 기다린다.

## 메모리

운영 메모리는 `apps/api/Dockerfile`의 `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=50 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k`와 `MALLOC_ARENA_MAX=2`로 제한한다. 512MiB 컨테이너의 힙은 약 256MiB로 사용하며 나머지는 네이티브 메모리 등에 배정한다. `application-prod.yml`은 Tomcat 스레드 최대 20개·최소 대기 2개, Hikari 최대 연결 5개로 설정한다.

## 업로드 한도

한 번에 최대 3개월치·512KB의 `.xlsx` 파일을 허용한다. 기간은 첫 거래일과 마지막 거래일의 차이 92일 이하로 판단한다. 전체 multipart 요청은 1MB로 제한한다. 서버 전체에서 import는 동시에 1건만 처리하며, 20초 안에 처리 차례를 얻지 못하면 503 `IMPORT_BUSY`로 응답한다. 2026-10 측정에서 한도 근처 파일 import는 81초, 최대 메모리 392MiB였다. 실제 3개월치 파일은 약 65KB다.

한도를 바꿀 때는 다음 위치를 함께 바꾸고 `apps/api`에서 `./gradlew memoryTest`로 확인한다.

- `apps/api/src/main/resources/application.yml`의 `max-file-size`
- `apps/web/src/imports/importsApi.ts`의 `MAX_UPLOAD_BYTES`
- `apps/api/src/test/java/com/saladbowl/api/importer/BanksaladParserMemoryTest.java`의 검증 범위

대용량 스트리밍 파싱은 [잔여 작업](backlog.md)으로 관리한다.

## 용량

[설계 6.5절](superpowers/specs/2026-10-18-salad-bowl-design.md)의 추정치를 사용한다. 1인 3년 약 5~6MB, 6인 그룹 3년 약 35MB로 계산한다. 500MB에는 약 75~80명분의 3년치를 수용한다고 추정한다. 이용자가 약 50명을 넘으면 상위 플랜이나 다른 DB로 이전하는 방안을 검토한다.

## 기능 제약

- 그룹 인원은 관리자를 포함해 최대 6명이다.
- PWA는 홈 화면 설치만 지원하며 오프라인 기능은 제공하지 않는다.
- Pages 미리보기 배포도 운영 API와 DB를 사용한다.

## 모바일·PWA 배율과 글꼴

- 화면의 초기·최소·최대 배율을 1로 지정한다. 모바일 폭(820px 이하), 기본 터치 입력 환경, 설치형 PWA에서는 `touch-action: pan-x pan-y`로 문서 스크롤은 유지하면서 핀치·더블탭 확대를 제한한다. 데스크톱의 키보드·브라우저 확대를 가로채는 코드는 두지 않는다.
- iOS Safari와 브라우저의 접근성 설정은 배율 제한을 무시할 수 있다. 웹에서 OS 확대까지 고정할 수는 없으며, iOS 설치형 PWA의 핀치·더블탭·키보드 입력은 실기기로 확인해야 한다. [MDN viewport 제약](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)
- 카드 배치 간격은 기본 16→12px, 홈 요약 카드 12→8px로 한 단계 줄였다. 카드 내부 여백은 유지한다.
- 공통 글꼴 크기는 `11 / 12 / 13 / 15 / 18 / 20 / 24px`로 한 단계 낮췄다. 차트 글꼴도 줄이되 기존의 작은 자동 맞춤 글꼴 하한은 유지한다.
- 대분류 추이 범례는 체크 표시를 제거하고 배경·테두리로 선택을 구분한다. 모바일에서는 높이 36px·좌우 여백 8px·내부 간격 4px·범례 선 14px로 줄이며, 글자 굵기를 일정하게 두어 선택 전후 배치가 바뀌지 않게 한다. 다른 버튼의 터치 영역은 유지한다.
- 모바일·PWA의 입력칸과 날짜 입력 세그먼트는 iOS의 입력 시 자동 확대를 피하기 위해 별도 `--text-input: 16px`를 사용한다. 본문을 줄이더라도 입력칸의 이 하한을 함께 줄이지 않는다.

검증: 웹 테스트 381개·타입 검사·린트·빌드 통과. Playwright 모바일 환경에서 본문 13px·제목 24px·입력 16px, 세로 스크롤 유지 및 화면 가로 넘침 없음을 확인했다. 데스크톱에서는 입력 13px·`touch-action: auto`를 확인했다. 자동화 환경의 핀치 입력은 제한을 해제한 비교 화면에서도 배율을 바꾸지 못했으므로, 이 결과만으로 제스처 차단을 검증했다고 보지 않는다. iOS Safari·설치형 PWA의 실기기 검증은 미실행이다.
