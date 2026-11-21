# 소득공제 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Claude 세션은 `.claude/skills/codex-collab/SKILL.md`의 담당·리뷰 표를 따른다. 단 이 작업에서 Claude 쪽 서브에이전트(리뷰어 포함)는 Fable 5.2를 쓴다(사용자 지정).

**Goal:** 회원이 귀속연도별 신용카드·체크카드·현금영수증 누계를 입력해 소득공제액을 확인하고 남은 기간의 결제수단 배분 추천을 받으며, 서비스 관리자가 연도별 세법 수치를 버전으로 관리한다. 그 앞 단계로 업로드 메뉴를 없애고 월별 등록 현황을 홈으로 옮긴다.

**Architecture:** 소득공제 자료는 회원 소유 데이터이고 서버 검사는 "요청자 = 소유자" 하나다(그룹 접근 헬퍼를 쓰지 않는다). 세법 기준은 전역 버전 행이고 서비스 관리자(`users.service_admin`, 요청마다 DB 확인)만 고친다. 소득공제액과 추천은 저장하지 않고 조회할 때 API의 순수 Java 계산기 한 곳에서 정수 연산으로 계산한다. 웹은 `/tax/*` 화면에서 결과를 그리기만 하며 쿼리 키 머리말은 `tax`다.

**Tech Stack:** Spring Boot(JDK 21, Flyway, JPA, MockMvc + Testcontainers), React + Vite + TypeScript + react-aria-components + TanStack Query, Vitest + Testing Library + msw.

**Spec:** `docs/superpowers/specs/2026-11-11-tax-prd.md`(확정본, 남은 사용자 결정 없음), `docs/superpowers/specs/2026-11-11-tax-wireframes.md`·`.html`

**전제:** 기획 문서 브랜치 `claude/2026-11-11-work-planning-781edc`가 먼저 `main`에 병합돼야 한다. 병합 전에는 이 계획과 PRD가 `origin/main`에 없으므로 구현 브랜치를 만들지 않는다.

## Global Constraints

- 브랜치: PR마다 `git fetch` 뒤 최신 `origin/main`에서 새 브랜치·새 worktree를 만든다. 병합한 브랜치 이름은 다시 쓰지 않는다. 기본 체크아웃에서 작업하지 않는다.
- PR 착수 때마다 이 계획의 파일·함수 이름을 그 시점의 `origin/main` 코드와 대조한다. 이 계획은 `167d7fe` 기준으로 썼다.
- 개인정보: 실제 뱅크샐러드 파일·급여·카드 금액·비밀값을 코드·테스트·문서·캡처에 넣지 않는다. 테스트 데이터와 캡처는 코드로 만든 합성값만 쓴다.
- 데이터 소유권: 소득공제 자료(연도 기록·입력자료·금액·지출계획)는 소유 회원만 조회·수정·삭제한다. 서버 검사는 `owner_id = 요청자` 하나이고, 없는 자료와 남의 자료는 똑같이 404 `NOT_FOUND`다. `GroupAccess`를 쓰지 않는다.
- 서비스 관리자: `users.service_admin` 컬럼. 그룹 `ADMIN`과 별개다. 지정·해제는 화면 없이 운영자가 DB에서 직접 한다. 서버는 세법 관리 요청마다 DB에서 확인하고(토큰 claim에 넣지 않는다) 아니면 403 `FORBIDDEN`이다. 서비스 관리자도 남의 소득공제 자료는 404다.
- 세법 적용 버전: 연도 기록이 세법 버전 id를 기억한다. 적용본은 수정·삭제할 수 없다. 새 버전이 적용돼도 연도 기록의 버전은 회원이 [새 버전으로 다시 계산]을 누를 때만 바뀐다. 현재 적용 버전은 그 귀속연도에서 가장 최근에 적용한 버전이다(번호와 무관).
- 금액 계산: 금액은 원 단위 정수(`BIGINT`/`long`), 공제율·비율은 정수 퍼센트(0~100)다. 계산기는 API의 `tax/calc` 한 곳이고, 중간값은 원×10,000 정수로 두고 최종 소득공제액에서 원 미만을 한 번 버린다(TAX-45). 부동소수점을 쓰지 않는다. 웹에 계산을 복제하지 않는다.
- 계산 테스트 기대값은 PRD 7.1·7.2·8.1절 산식의 손계산 표와 합성 예시로 만든다. 계산기 코드를 호출하거나 복제해 기대값을 만들지 않는다(TAX-46).
- 분석·추천 결과는 저장하지 않는다(TAX-44). 저장하는 것은 입력값과 지출계획뿐이다.
- 개인 메뉴의 그룹 독립성: 소득공제 화면과 API는 `useGroups()`의 선택 그룹·`groupId`를 쓰지 않는다. 그룹 미가입·탈퇴·선택 그룹 변경이 접근과 내용에 영향을 주지 않는다.
- 캐시: 소득공제 쿼리 키는 `['tax', ...]`다. `isGroupScopedKey`(`apps/web/src/api/queryClient.ts`)가 보는 머리말(`groups`, `transactions`, `categories`, `summary`, `bans`)을 쓰지 않는다. 로그아웃·세션 만료 때 `ClearCacheOnSignOut`의 `queryClient.clear()`로 지워진다. 총급여·금액·작성 중인 값을 `localStorage`·`sessionStorage` 등 브라우저 저장소에 두지 않는다.
- 창: 소득공제 화면의 입력·확인 창은 모든 폭에서 가운데 창이다(TAX-76). 공용 `Select`·`DateTimePicker`가 안에서 여는 선택 창은 기존 동작을 둔다.
- 화면 문구: 결제수단 명칭은 신용카드 / 체크카드 / 현금영수증. "직불·선불 포함" 같은 안내를 넣지 않는다. 주 결과는 "소득공제액"이고 환급액이 아님을 적는다. 소비를 늘리라는 문구를 쓰지 않는다.
- migration은 `apps/api/src/main/resources/db/migration`의 `V7` 다음인 `V8`부터 추가한다. 기존 파일을 고치지 않는다.
- 새 의존성·범용 수식 엔진을 추가하지 않는다. 필요해 보이면 멈추고 컨트롤러에게 보고한다.
- UI 표준: 소득공제 화면(PR 5~7)은 새 UI이므로 [UI 표준](../../ui-standards.md)(2026-11-14 main 반영)을 처음부터 따른다. 와이어프레임은 정보 구조와 흐름의 근거이고, 배치·글자·도움말은 UI 표준이 우선한다. 상세는 아래 "UI 표준 적용(PR 5~7)" 절.
- UI는 기존 디자인 토큰과 `apps/web/src/common/` 부품을 먼저 쓴다. 금액 입력은 `MoneyField`(`minValue={0}`), 금액 표시는 `useAmountFormatter`(총급여 `'income'`, 공제대상액·공제액 `'expense'`).
- 검증: 웹 변경은 `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`, API 변경은 `cd apps/api && ./gradlew test`(업로드 한도·파서·메모리 변경이 있을 때만 `./gradlew memoryTest`도). 화면이 바뀌면 `.claude/skills/verify` 스킬로 375px와 데스크톱을 확인하고 PR용 이전·이후 캡처를 만든다.
- PR: 제목 `type(scope): 한국어 요약`, 본문 `무엇 / 확인 / 리뷰 / 참고 / 소모값`. 화면이 바뀐 PR은 375px 이전·이후 캡처를 `pr-assets` 브랜치 `pr-<번호>/`에 올린다. 구현하지 않은 쪽의 리뷰 없이 PR을 올리지 않는다. 사용자가 요청하지 않으면 병합하지 않는다.

## PR 분할

| PR | 목적 | 포함 TAX-ID | 의존 PR | 위험 영역(반론 리뷰) | 화면 변화(375px 캡처) |
|---|---|---|---|---|---|
| 1 `feat(web)` | 업로드 메뉴·화면 제거, 월별 등록 현황·업로드 이력을 홈으로 이동, 옛 `/upload` 주소 처리 | TAX-14, 15, 16, 17, 18, 74 (TAX-12 중 "업로드 없음") | 없음 | 아니오. 월 데이터 삭제 창은 위치만 옮기고 코드는 그대로다 | 예 (홈, 하단 탭) |
| 2 `feat(api)` | 서비스 관리자 권한, 세법 버전 저장·관리 API | TAX-04, 05, 06(서버), 60, 61, 62, 63, 64, 67, 72 | 없음 | **예 — 권한(서비스 관리자), 삭제(초안)** | 아니오 |
| 3 `feat(api)` | 연도 기록·입력자료·지출계획 저장 API, 소유권, 동시 수정 409, 세법 버전 기억 | TAX-01, 02, 03, 20~24, 26~29(서버), 51, 65, 66, 70(저장) | 2 | **예 — 소유권(404 숨김), 삭제(연도 기록·카드 자료)** | 아니오 |
| 4 `feat(api)` | 계산기(7.1)·현재 계획 배분·추천(7.2) 순수 로직과 분석 조회 API | TAX-24(빈 칸 수), 35(값), 36(값), 38(상태), 40~46, 50, 52~54, 65(상태), 69, 71(단계 값), 75(상태) | 3 | 아니오 (읽기 전용 조회 하나. 회원 자료는 PR 3의 `TaxRecordService.get`으로만 읽고 새 테이블이 없다) | 아니오 |
| 5 `feat(web)` | 소득공제 메뉴·라우트, 선택 연도, 입력자료 화면 | TAX-07, 10, 12, 13, 19, 20~31, 37, 68(일부), 76 | 3 (자녀등 입력란 판단에 2) | 아니오 (서버 권한·삭제는 PR 2·3에서 검토. 로그아웃 캐시 테스트 포함) | 예 |
| 6 `feat(web)` | 연도별 세법 관리 화면(관리자), 권한 없음 화면, 좁은 화면 안 탭(관리자) | TAX-04, 06(화면), 10, 11, 19(세법 관리 탭), 60~64, 67, 72, 76 | 2, 5 | 아니오 (화면 숨김은 편의이고 권한은 서버가 판단) | 예 |
| 7 `feat(web)` | 분석·지출계획 화면(① 현황 ② 지출계획 ③ 추천), 메뉴 진입 규칙 | TAX-10, 13, 27(추정), 32~38, 43, 50~55, 65, 66, 68, 69, 70, 71, 73, 75 | 4, 5 | 아니오 | 예 |

순서와 묶음의 이유

- PR 1은 소득공제 자료와 무관한 기존 화면 변경이라 먼저 따로 낸다(PRD 4.2절). 이 PR에서 하단 탭은 4칸이 되고, 소득공제 메뉴는 화면이 생기는 PR 5에서 들어와 5칸이 된다. 빈 메뉴를 운영에 내보내지 않기 위해서다(`main` 병합 즉시 Pages가 웹을 배포한다).
- 연도 기록이 세법 버전을 FK로 가리키므로 세법 버전(PR 2)이 연도 기록(PR 3)보다 먼저다. 서비스 관리자 권한은 세법 API의 전제라 PR 2에 묶었다.
- 권한·삭제가 바뀌는 PR 2·3을 계산(PR 4)과 나눠 반론 리뷰 범위를 좁혔다. PR 4는 DB 쓰기가 없는 순수 계산과 조회라 계산 기대값 검토에 집중할 수 있다.
- 웹은 입력자료(PR 5) → 세법 관리(PR 6) → 분석(PR 7) 순이다. 분석 화면이 나가기 전에 운영자가 화면으로 2026 귀속 세법을 등록할 수 있어야 "세법 준비 중"만 보이는 기간이 없다.
- PR 5~7은 병합할 때마다 운영에 보인다. PR 5 병합 뒤 PR 7 병합 전까지 회원은 입력자료 화면만 본다(중간 노출을 받아들이는 것이 이 계획의 기본값이다. "알려진 제약" 참고).

**PR 5~7의 Task 상세는 그 PR에 착수할 때 컨트롤러가 채운다(PR 2는 2026-11-14에, PR 3은 2026-11-16에, PR 4는 2026-11-17에, PR 5는 2026-11-20에, PR 6은 2026-11-21에 채웠다).** 뒤 PR의 코드는 앞 PR 결과(실제 엔티티·응답 필드 이름)에 의존하기 때문이다. 이 문서에는 PR 7의 Task 목록·파일·인터페이스·테스트 대상·검증 명령까지 적었다. PR 1~6은 실행 가능한 상세까지 적었다.

## 요구사항 추적표

PRD의 요구사항 ID는 66개다(08, 09, 39, 47~49, 56~59는 PRD에 없는 번호). 표기 `2.3` = PR 2의 Task 3.

| ID | PR.Task | ID | PR.Task |
|---|---|---|---|
| TAX-01 | 3.1, 3.2, 3.3, 5.3, 5.4 | TAX-40 | 4.1 |
| TAX-02 | 3.1, 3.2, 3.3 | TAX-41 | 4.1 |
| TAX-03 | 3.1(서버), 5.2(웹) | TAX-42 | 4.1 |
| TAX-04 | 2.2, 2.3, 6.1, 6.2 | TAX-43 | 7.2 |
| TAX-05 | 2.1 | TAX-44 | 4.3 |
| TAX-06 | 2.1(403), 6.1(권한 없음 화면) | TAX-45 | 4.1 |
| TAX-07 | 5.2 | TAX-46 | 4.1, 4.2 |
| TAX-10 | 5.2, 6.1, 7.1 | TAX-50 | 4.2, 4.3, 7.4 |
| TAX-11 | 6.1 | TAX-51 | 3.3, 7.3 |
| TAX-12 | 1.3(업로드 제거), 5.2(소득공제 추가) | TAX-52 | 4.2 |
| TAX-13 | 5.2, 7.1 | TAX-53 | 4.2, 7.4 |
| TAX-14 | 1.3 | TAX-54 | 4.2, 7.4 |
| TAX-15 | 1.2 | TAX-55 | 7.2 |
| TAX-16 | 1.2, 1.3 | TAX-60 | 2.2, 2.3, 6.2 |
| TAX-17 | 1.1 | TAX-61 | 2.2, 2.3, 6.2 |
| TAX-18 | 1.2, 1.3 | TAX-62 | 2.2, 6.2 |
| TAX-19 | 5.2, 6.1 | TAX-63 | 2.3, 6.2 |
| TAX-20 | 3.1, 5.3 | TAX-64 | 2.3, 6.2 |
| TAX-21 | 3.2, 5.4 | TAX-65 | 3.1, 4.3, 7.1 |
| TAX-22 | 3.2, 5.4 | TAX-66 | 3.3, 7.1 |
| TAX-23 | 3.2, 5.4 | TAX-67 | 2.2, 2.3, 6.1 |
| TAX-24 | 3.2, 4.3, 5.4 | TAX-68 | 5.2, 7.1 |
| TAX-25 | 5.4 | TAX-69 | 4.2, 7.4 |
| TAX-26 | 3.2, 5.5 | TAX-70 | 3.3, 7.3 |
| TAX-27 | 3.2, 5.5, 7.1 | TAX-71 | 4.1, 7.2 |
| TAX-28 | 3.1, 3.2, 5.3, 5.4 | TAX-72 | 2.2, 2.3, 6.1, 6.2 |
| TAX-29 | 3.1, 3.2, 3.3, 5.4, 7.3 | TAX-73 | 7.1 |
| TAX-30 | 5.4, 5.5 | TAX-74 | 1.2 |
| TAX-31 | 5.3, 5.4, 5.5 | TAX-75 | 4.3, 7.3, 7.4 |
| TAX-32 | 7.2 | TAX-76 | 5.1, 5.3, 5.4, 6.2 |
| TAX-33 | 7.2 | | |
| TAX-34 | 7.2 | | |
| TAX-35 | 4.1, 4.3, 7.2 | | |
| TAX-36 | 4.3, 7.1 | | |
| TAX-37 | 5.3, 5.5, 7.2, 7.4 | | |
| TAX-38 | 4.3, 7.1, 7.2 | | |

| AC | PR.Task | AC | PR.Task |
|---|---|---|---|
| AC-01 | 3.1, 3.2, 3.3 | AC-23 | 5.6, 6.3, 7.5 (375px·데스크톱 확인) |
| AC-02 | 3.1(API), 5.6·7.5(화면) | AC-24 | 4.1, 4.2 |
| AC-03 | 3.1 | AC-25 | 5.2 (업로드 제거는 1.3) |
| AC-04 | 2.1, 2.2, 2.3 | AC-26 | 1.1, 1.2 |
| AC-05 | 2.1 | AC-27 | 1.2, 1.3 |
| AC-06 | 5.2 | AC-28 | 3.2, 5.4 |
| AC-07 | 4.1 | AC-29 | 5.2, 6.1 |
| AC-08 | 4.1 | AC-30 | 3.1, 4.3, 7.1 |
| AC-09 | 4.1 | AC-31 | 3.2, 5.5, 7.1 |
| AC-10 | 4.1 | AC-32 | 5.5, 7.2 |
| AC-11 | 4.1 | AC-33 | 3.1, 3.2, 3.3, 5.4, 7.3 |
| AC-12 | 4.1 | AC-34 | 7.1 |
| AC-13 | 4.1 | AC-35 | 4.2, 7.4 |
| AC-14 | 3.2, 5.4 | AC-36 | 3.3, 7.3 |
| AC-15 | 3.1, 3.2 | AC-37 | 3.2, 5.4 |
| AC-16 | 7.2 | AC-38 | 7.2 |
| AC-17 | 4.2, 7.4 | AC-39 | 2.2, 2.3, 6.2 |
| AC-18 | 4.2 | AC-40 | 5.3, 5.4 |
| AC-19 | 2.3, 3.3 | AC-41 | 7.1 |
| AC-20 | 3.1, 4.3 | AC-42 | 1.2 |
| AC-21 | 2.3 | AC-43 | 4.3, 7.3, 7.4 |
| AC-22 | 3.1, 3.2 | AC-44 | 5.1, 6.2 |

## File Structure

| 파일 | 책임 | PR |
|---|---|---|
| `apps/web/src/imports/UploadHistoryDialog.tsx` (생성) | 업로드 이력 창 | 1 |
| `apps/web/src/imports/CoverageSection.tsx` (수정) | 머리의 업로드 이력 아이콘 버튼 | 1 |
| `apps/web/src/home/HomePage.tsx`, `HomePage.module.css` (수정) | 지난달 요약 + 월별 등록 현황, `?month=` 처리 | 1 |
| `apps/web/src/app/menu.ts`, `AppRoutes.tsx`, `BottomTabBar.module.css` (수정) | 업로드 메뉴 제거, `/upload` → 홈 | 1 |
| `apps/web/src/imports/UploadPage.tsx`, `UploadPage.test.tsx` (삭제) | — | 1 |
| `apps/api/.../db/migration/V8__add_service_admin.sql`, `V9__create_tax_law_versions.sql` (생성) | 관리자 컬럼, 세법 버전·연도별 번호 카운터 | 2 |
| `apps/api/.../user/ServiceAdminGuard.java` (생성), `User.java`·`MeController.java` (수정) | 요청마다 관리자 확인, `/me`에 `serviceAdmin` | 2 |
| `apps/api/.../tax/law/` (생성) | `TaxLawVersion`, 저장소, `TaxLawService`, `TaxLawAdminController`, `TaxLawController`, DTO | 2 |
| `apps/api/.../db/migration/V10__create_tax_records.sql` (생성) | 연도 기록·카드 자료·현금영수증 자료·지출계획 | 3 |
| `apps/api/.../tax/record/` (생성) | 엔티티 4개, 저장소, `TaxRecordService`, `TaxRecordController`, DTO, `SpendingTotals` | 3 |
| `apps/api/.../tax/calc/` (생성) | `TaxLawValues`, `DeductionCalculator`, `PlanAllocator`, `Recommender`, `TaxAnalysisService`, `TaxAnalysisController` | 4 |
| `apps/web/src/common/Dialog.tsx` (수정) | 좁은 화면에서도 가운데 창으로 여는 선택지 | 5 |
| `apps/web/src/tax/taxApi.ts`, `TaxYearProvider.tsx`, `TaxTabs.tsx`, `TaxHeader.tsx` (생성) | API 타입·호출, 선택 연도(메모리), 좁은 화면 안 탭, 연도 선택·개인 자료 표시 | 5 |
| `apps/web/src/tax/inputs/` (생성) | 입력자료 화면과 창 | 5 |
| `apps/web/src/tax/law/` (생성) | 연도별 세법 관리 화면 | 6 |
| `apps/web/src/tax/analysis/` (생성) | 분석·지출계획 단계 화면 | 7 |
| `.claude/skills/verify/features/*.md`, `bin/seed.sh` (수정) | 검증 지도와 시드(서비스 관리자, 2026 세법, 합성 소득공제 자료) | 1, 5, 6, 7 |

`apps/api/...`는 `apps/api/src/main/java/com/saladbowl/api/`와 `apps/api/src/main/resources/`를 줄인 것이다.

---

# PR 1 — 업로드 메뉴를 없애고 월별 등록 현황을 홈으로 옮김

브랜치 예: `feat/home-coverage-merge` (최신 `origin/main`에서 새 worktree). PR 제목 예: `feat(web): 업로드 메뉴를 없애고 월별 등록 현황을 홈으로 옮김`.

작업 공간 준비(컨트롤러): 새 worktree에서 `cd apps/web && npm ci`. SDD 작업 공간은 `.superpowers/sdd/tax-impl/`이고 `constraints.md`가 이미 있다.

이 PR의 코드와 테스트는 계획을 쓸 때 저장소 밖 임시 복사본에서 Task 순서대로 실행해 확인했다(`167d7fe` 기준: RED 확인 → 구현 → `typecheck`·`npm test` 78파일 636건 통과·`lint`·`build`). 화면은 띄워 보지 않았으므로 정렬·간격은 PR 마무리의 화면 확인에서 본다.

### Task 1.1: 업로드 이력 창과 아이콘 버튼 (TAX-17)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `apps/web/src/imports/UploadHistoryDialog.tsx`
- Modify: `apps/web/src/imports/CoverageSection.tsx:12-24, 41-48, 72-76`
- Modify: `apps/web/src/common/Icon.tsx:131` (`'sheet-upload'` 주석 줄 바로 위)
- Test: `apps/web/src/imports/CoverageSection.test.tsx`

**Interfaces:**
- Consumes: `importsApi.history(): Promise<ImportBatchView[]>`(`imports/importsApi.ts`), `Dialog({ title, onClose, closeDisabled?, children })`(`common/Dialog.tsx`), 쿼리 키 `['imports']`(업로드 성공 때 `useUpload`가 무효화한다).
- Produces: `UploadHistoryDialog({ onClose }: { onClose: () => void })` default export. `CoverageSection`의 props는 그대로다(`{ today, initialMonth?, onInitialMonthHandled? }`). 아이콘 이름 `'history'`.

- [ ] **Step 1: 실패하는 테스트 작성** — `CoverageSection.test.tsx`의 `describe('CoverageSection', ...)` 안 맨 끝에 세 개를 더한다. 파일 위쪽 import(`act, screen, waitFor, within`, `delay, http, HttpResponse`)와 `handlers`·`today`는 이미 있다.

```tsx
  it('opens the upload history from the icon button next to the year stepper', async () => {
    handlers([])
    server.use(http.get('*/api/imports', () => HttpResponse.json([
      { batchId: 2, fileName: '2026-09.xlsx', totalRows: 168, createdRows: 168, updatedRows: 0, unchangedRows: 0, importedAt: '2026-10-01T00:00:00Z' },
      { batchId: 1, fileName: '2026-08.xlsx', totalRows: 150, createdRows: 0, updatedRows: 2, unchangedRows: 148, importedAt: '2026-09-01T09:00:00+09:00' },
    ])))
    const { user } = renderPage(<CoverageSection today={today} />)

    const region = await screen.findByRole('region', { name: '월별 등록 현황' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const open = within(region).getByRole('button', { name: '업로드 이력' })
    expect(open.querySelector('svg')).not.toBeNull()
    await user.click(open)

    const dialog = await screen.findByRole('dialog', { name: '업로드 이력' })
    const rows = await within(dialog).findAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('2026-09.xlsx')
    expect(rows[0]).toHaveTextContent('신규 168')
    expect(rows[0]).toHaveTextContent('10-01 09:00') // UTC 자정은 서울 오전 9시
    expect(rows[1]).toHaveTextContent('2026-08.xlsx')
    expect(rows[1]).toHaveTextContent('변경 없음 148')

    await user.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows three history rows while the history loads, then the empty message', async () => {
    handlers([])
    server.use(http.get('*/api/imports', async () => { await delay(400); return HttpResponse.json([]) }))
    const { user } = renderPage(<CoverageSection today={today} />)

    await user.click(await screen.findByRole('button', { name: '업로드 이력' }))

    const dialog = await screen.findByRole('dialog', { name: '업로드 이력' })
    expect(within(dialog).getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(within(dialog).getByRole('status').querySelectorAll('li')).toHaveLength(3)
    expect(await within(dialog).findByText('아직 올린 파일이 없습니다.')).toBeInTheDocument()
  })

  it('retries the upload history inside the dialog', async () => {
    let fail = true
    handlers([])
    server.use(http.get('*/api/imports', () => fail
      ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
      : HttpResponse.json([])))
    const { user } = renderPage(<CoverageSection today={today} />)

    await user.click(await screen.findByRole('button', { name: '업로드 이력' }))

    const dialog = await screen.findByRole('dialog', { name: '업로드 이력' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('업로드 이력을 불러오지 못했습니다.')
    fail = false
    await user.click(within(dialog).getByRole('button', { name: '다시 시도' }))
    expect(await within(dialog).findByText('아직 올린 파일이 없습니다.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/imports/CoverageSection.test.tsx`
Expected: 새 테스트 3개 FAIL — `Unable to find an accessible element with the role "button" and name "업로드 이력"`. 기존 16개는 PASS.

- [ ] **Step 3: 아이콘 추가** — `apps/web/src/common/Icon.tsx`의 `// 도메인: 뱅크샐러드 엑셀 올리기.` 주석 줄 바로 위에 한 줄을 넣는다. Lucide(lucide-static 1.61.0) `history`의 경로다.

```tsx
  history: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>,
```

- [ ] **Step 4: 업로드 이력 창 작성** — `apps/web/src/imports/UploadHistoryDialog.tsx`. 목록 내용은 `UploadPage.tsx:39-61`의 것을 그대로 옮긴다.

```tsx
import { useQuery } from '@tanstack/react-query'
import Dialog from '../common/Dialog'
import Icon from '../common/Icon'
import Skeleton, { SkeletonRegion } from '../common/Skeleton'
import ui from '../common/ui.module.css'
import { formatInstant } from '../common/format'
import { importsApi } from './importsApi'

/** 지금까지 올린 파일 목록. 월별 등록 현황 머리의 아이콘 버튼으로 연다. */
export default function UploadHistoryDialog({ onClose }: { onClose: () => void }) {
  const history = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })

  return (
    <Dialog title="업로드 이력" onClose={onClose}>
      {history.isPending && <SkeletonRegion><ul className={ui.stack}>
        {[0, 1, 2].map((i) => <li key={i} className={ui.row}><Skeleton width="35%" height="1lh" /><Skeleton width="20%" height="1lh" /><Skeleton width="40%" height="1lh" /></li>)}
      </ul></SkeletonRegion>}
      {history.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>업로드 이력을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void history.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
        </div>
      )}
      {history.data && history.data.length === 0 && <p className={ui.status}>아직 올린 파일이 없습니다.</p>}
      {history.data && history.data.length > 0 && (
        <ul className={ui.stack}>
          {history.data.map((batch) => (
            <li key={batch.batchId} className={ui.row}>
              <strong>{batch.fileName}</strong>
              <span className={ui.muted}>{formatInstant(batch.importedAt)}</span>
              <span className={ui.muted}>신규 {batch.createdRows} · 갱신 {batch.updatedRows} · 변경 없음 {batch.unchangedRows}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
```

- [ ] **Step 5: `CoverageSection`에 버튼과 창 연결** — 세 곳을 고친다.

import에 한 줄 추가(`UploadForm` import 아래):

```tsx
import UploadHistoryDialog from './UploadHistoryDialog'
```

`notice` 상태 아래에 상태 추가:

```tsx
  const [historyOpen, setHistoryOpen] = useState(false)
```

머리의 연도 이동(`<div className={stepper.stepper}>…</div>`)을 `ui.row`로 감싸고 오른쪽에 버튼을 둔다. 연도 이동 안의 자식 3개는 그대로 둔다(기존 테스트가 자식 수 3을 확인한다).

```tsx
        <div className={ui.row}>
          <div className={stepper.stepper}>
            <button type="button" className={`${ui.button} ${stepper.step}`} aria-label="이전 연도" onClick={() => { setNotice(null); setYear(year - 1) }}><Icon name="chevron-left" size={18} /></button>
            <span className={`${stepper.value} ${stepper.text} ${stepper.year}`}>{year}년</span>
            <button type="button" className={`${ui.button} ${stepper.step}`} aria-label="다음 연도" onClick={() => { setNotice(null); setYear(year + 1) }}><Icon name="chevron-right" size={18} /></button>
          </div>
          <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label="업로드 이력" onClick={() => setHistoryOpen(true)}><Icon name="history" /></button>
        </div>
```

`MonthDataDialog` 블록(`{managed && (…)}`) 바로 아래, `</section>` 앞에 추가:

```tsx
      {historyOpen && <UploadHistoryDialog onClose={() => setHistoryOpen(false)} />}
```

- [ ] **Step 6: 통과 확인**

Run: `cd apps/web && npx vitest run src/imports/CoverageSection.test.tsx`
Expected: 19 passed.

- [ ] **Step 7: 커밋(컨트롤러)** — Codex는 커밋하지 않는다. 컨트롤러가 보고와 diff를 확인한 뒤 커밋한다.

```bash
git add apps/web/src/common/Icon.tsx apps/web/src/imports/UploadHistoryDialog.tsx apps/web/src/imports/CoverageSection.tsx apps/web/src/imports/CoverageSection.test.tsx
git commit -m "feat(web): 월별 등록 현황에서 업로드 이력 창을 엶" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

### Task 1.2: 홈에 월별 등록 현황을 두고 지난달 업로드 카드를 없앰 (TAX-15, 16, 18, 74)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Modify (전체 교체): `apps/web/src/home/HomePage.tsx`
- Modify (전체 교체): `apps/web/src/home/HomePage.module.css`
- Test (전체 교체): `apps/web/src/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: Task 1.1의 `CoverageSection`(`{ today: Date; initialMonth?: string | null; onInitialMonthHandled?: () => void }`). `initialMonth`가 지난 달 형식(`YYYY-MM`, 이번 달 이하)이면 그 달 창을 열고 `onInitialMonthHandled`를 부른다. 미래·잘못된 값이면 창 없이 `onInitialMonthHandled`만 부른다.
- Produces: 홈 주소 `/?month=YYYY-MM`이 그 달 창을 열고 `month`를 주소에서 지운다(Task 1.3의 `/upload` 리다이렉트가 이 동작에 기댄다). `HomePage`의 props는 그대로 `{ today?: Date }`.

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/src/home/HomePage.test.tsx`를 아래 내용으로 통째로 바꾼다. 주소의 `month` 처리 테스트는 지울 `UploadPage.test.tsx`에서 옮겨 온 것이다.

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { Route, Routes, useLocation } from 'react-router'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import HomePage from './HomePage'

const today = new Date(2026, 9, 19) // 2026-10-19

function Search() {
  return <output aria-label="주소 검색어">{useLocation().search}</output>
}

function handlers({ coverage = {}, transactions = [] }: { coverage?: Record<string, unknown[]>; transactions?: unknown[] } = {}) {
  server.use(
    http.get('*/api/me/coverage', ({ request }) =>
      HttpResponse.json(coverage[new URL(request.url).searchParams.get('year') ?? ''] ?? [])),
    http.get('*/api/me/transactions', () => HttpResponse.json(transactions)),
  )
}

describe('HomePage', () => {
  it('shows summary cards and twelve calendar cells while both requests load', async () => {
    server.use(
      http.get('*/api/me/coverage', async () => { await delay(400); return HttpResponse.json([]) }),
      http.get('*/api/me/transactions', async () => { await delay(400); return HttpResponse.json([]) }),
    )
    renderPage(<HomePage today={today} />)
    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    const coverage = screen.getByRole('region', { name: '월별 등록 현황' })
    expect(within(summary).getByRole('status').querySelectorAll('[class*="total"]')).toHaveLength(3)
    expect(within(coverage).getByRole('status').querySelectorAll('li')).toHaveLength(12)
    await within(summary).findByRole('button', { name: '수입 ₩ 0' })
    await within(coverage).findByRole('button', { name: '2026년 9월 미등록, 업로드하기' })
  })

  it('puts the last month summary above the monthly coverage and drops the old cards', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-09', importedCount: 168, manualCount: 2 }] } })

    renderPage(<HomePage today={today} />)

    const coverage = await screen.findByRole('region', { name: '월별 등록 현황' })
    expect(await within(coverage).findByRole('button', { name: '2026년 9월 등록됨 168건, 데이터 관리' })).toBeInTheDocument()
    expect(within(coverage).getByRole('button', { name: '2026년 8월 미등록, 업로드하기' })).toBeInTheDocument()
    expect(within(coverage).getByRole('button', { name: '업로드 이력' })).toBeInTheDocument()
    // 좁은 화면은 문서 순서대로 쌓인다: 지난달 요약이 위, 월별 등록 현황이 아래.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['지난달 내 요약 (2026년 9월)', '월별 등록 현황'])
    expect(screen.queryByRole('region', { name: '지난달 업로드' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '업로드하기' })).not.toBeInTheDocument()
    expect(screen.queryByText('파일 올리기')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(document.title).toBe('홈 · Salad Bowl')
  })

  it('looks up last year in January', async () => {
    handlers({ coverage: { '2025': [{ month: '2025-12', importedCount: 7, manualCount: 0 }] } })

    renderPage(<HomePage today={new Date(2026, 0, 10)} />)

    expect(await screen.findByRole('region', { name: '지난달 내 요약 (2025년 12월)' })).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '2025년 12월 등록됨 7건, 데이터 관리' })).toBeInTheDocument()
  })

  it('opens the upload dialog for a missing month from the address and clears it', async () => {
    handlers()

    renderPage(<><HomePage today={today} /><Search /></>, { path: '/?month=2026-09' })

    expect(await screen.findByRole('dialog', { name: '2026년 9월 데이터 업로드' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어', hidden: true })).toBeEmptyDOMElement())
  })

  it('keeps the requested month after a coverage failure and opens it on retry', async () => {
    server.use(
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/me/coverage', () => new HttpResponse(null, { status: 500 })),
    )

    const { user } = renderPage(<><HomePage today={today} /><Search /></>, { path: '/?month=2026-09' })
    const coverage = await screen.findByRole('region', { name: '월별 등록 현황' })

    await within(coverage).findByRole('alert')
    expect(screen.getByRole('status', { name: '주소 검색어' })).toHaveTextContent('?month=2026-09')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    server.use(http.get('*/api/me/coverage', () => HttpResponse.json([])))
    await user.click(within(coverage).getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('dialog', { name: '2026년 9월 데이터 업로드' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어', hidden: true })).toBeEmptyDOMElement())
  })

  it('opens the month data dialog for a registered month from the address', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-09', importedCount: 168, manualCount: 0 }] } })

    renderPage(<HomePage today={today} />, { path: '/?month=2026-09' })

    const dialog = await screen.findByRole('dialog', { name: '2026년 9월 데이터' })
    expect(within(dialog).getByRole('button', { name: '다시 업로드' })).toBeInTheDocument()
  })

  it('starts the calendar on the requested year', async () => {
    handlers()

    renderPage(<HomePage today={today} />, { path: '/?month=2025-11' })

    expect(await screen.findByRole('dialog', { name: '2025년 11월 데이터 업로드' })).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
  })

  it.each(['2026-12', '2026-13'])('ignores the future or invalid month %s and clears it', async (month) => {
    handlers()

    renderPage(<><HomePage today={today} /><Search /></>, { path: `/?month=${month}` })

    await screen.findByText('12월')
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어' })).toBeEmptyDOMElement())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('summarizes last month', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', ({ request }) => {
        expect(new URL(request.url).searchParams.get('month')).toBe('2026-09')
        return HttpResponse.json([
          { id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-01T09:00:00', type: 'INCOME', categoryMajor: '급여', categoryMinor: '', description: '월급', amount: 3000000, currency: 'KRW', paymentMethod: '은행', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
          { id: 2, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-02T12:00:00', type: 'EXPENSE', categoryMajor: '식비', categoryMinor: '', description: '점심', amount: -12000, currency: 'KRW', paymentMethod: '카드', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
        ])
      }),
    )

    renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    expect(await within(summary).findByText('₩ 3,000,000')).toBeInTheDocument()
    expect(within(summary).getByText('₩ 12,000')).toBeInTheDocument()
    expect(within(summary).getByRole('button', { name: '수입 ₩ 3,000,000' })).toBeInTheDocument()
    expect(within(summary).getByRole('button', { name: '지출 ₩ 12,000' })).toBeInTheDocument()
  })

  it('opens my transactions from the summary cards', async () => {
    handlers()
    const { user } = renderPage(
      <Routes>
        <Route path="/" element={<HomePage today={today} />} />
        <Route path="/transactions" element={<p>거래 목록 화면</p>} />
      </Routes>,
    )
    await user.click(await screen.findByRole('button', { name: '지출 ₩ 0' }))
    expect(await screen.findByText('거래 목록 화면')).toBeInTheDocument()
  })

  it('retries the summary on its own', async () => {
    let fail = true
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', () => fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json([])),
    )
    const { user } = renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    expect(await within(summary).findByRole('alert')).toHaveTextContent('지난달 거래를 불러오지 못했습니다.')

    fail = false
    await user.click(within(summary).getByRole('button', { name: '요약 다시 시도' }))
    expect(await within(summary).findByText('수입')).toBeInTheDocument()
    expect(within(summary).queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/home/HomePage.test.tsx`
Expected: 12개 중 9개 FAIL(월별 등록 현황 region·창을 찾지 못함). 요약 테스트 3개(`summarizes last month`, `opens my transactions…`, `retries the summary…`)는 PASS.

- [ ] **Step 3: `HomePage.tsx` 교체** — "지난달 업로드" 카드와 홈의 등록 현황 조회를 없애고 `CoverageSection`을 둔다. 문서 순서는 요약 → 등록 현황(375px 순서, TAX-74)이다.

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { menuLabel } from '../app/menu'
import Icon from '../common/Icon'
import PageHeader from '../common/PageHeader'
import { SkeletonRegion } from '../common/Skeleton'
import TotalsCards, { TotalsCardsSkeleton } from '../common/TotalsCards'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatMonthLabel } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import CoverageSection from '../imports/CoverageSection'
import { summarize } from '../transactions/summary'
import { transactionsApi } from '../transactions/transactionsApi'
import styles from './HomePage.module.css'

type Props = { today?: Date }

export default function HomePage({ today: todayProp }: Props) {
  const navigate = useNavigate()
  const title = menuLabel('/')
  usePageTitle(title)
  const [mountedAt] = useState(() => new Date())
  const today = todayProp ?? mountedAt
  const month = defaultYearMonth(today)
  const [params, setParams] = useSearchParams()

  const mine = useQuery({ queryKey: ['transactions', 'mine', month], queryFn: () => transactionsApi.mine(month) })
  const totals = mine.data ? summarize(mine.data) : null

  return (
    <>
      <PageHeader title={title} />

      {/* 문서 순서는 좁은 화면 순서(요약 → 등록 현황)다. 넓은 화면에서는 CSS 격자가 등록 현황을 왼쪽에 둔다. */}
      <div className={styles.twoColumns}>
        <section aria-labelledby="summary-title" className={`${ui.card} ${styles.summary}`}>
          <h2 id="summary-title">지난달 내 요약 ({formatMonthLabel(month)})</h2>
          {mine.isPending && <SkeletonRegion><TotalsCardsSkeleton /></SkeletonRegion>}
          {mine.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>지난달 거래를 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} aria-label="요약 다시 시도" onClick={() => void mine.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
            </div>
          )}
          {totals && <TotalsCards income={totals.income} expense={totals.expense} onSelect={() => navigate('/transactions')} />}
        </section>

        <div className={styles.coverage}>
          <CoverageSection today={today} initialMonth={params.get('month')}
            onInitialMonthHandled={() => setParams((p) => { p.delete('month'); return p }, { replace: true })} />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: `HomePage.module.css` 교체** — 넓은 화면은 등록 현황을 넓게 왼쪽, 요약을 오른쪽에 둔다. 820px 이하에서는 문서 순서대로 쌓는다.

```css
.twoColumns { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--space-3); align-items: start; }
.coverage { grid-column: 1; grid-row: 1; }
.summary { grid-column: 2; grid-row: 1; }
@media (max-width: 820px) {
  .twoColumns { grid-template-columns: minmax(0, 1fr); }
  .coverage, .summary { grid-column: auto; grid-row: auto; }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/web && npx vitest run src/home/HomePage.test.tsx src/imports/CoverageSection.test.tsx`
Expected: 31 passed (12 + 19).

- [ ] **Step 6: 커밋(컨트롤러)**

```bash
git add apps/web/src/home/HomePage.tsx apps/web/src/home/HomePage.module.css apps/web/src/home/HomePage.test.tsx
git commit -m "feat(web): 월별 등록 현황을 홈으로 옮기고 지난달 업로드 카드를 없앰" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

### Task 1.3: 업로드 메뉴·화면 제거와 옛 주소 처리 (TAX-12 일부, 14, 16, 18)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Modify: `apps/web/src/app/menu.ts:15` (줄 삭제)
- Modify: `apps/web/src/app/AppRoutes.tsx:2, 16, 19, 31`
- Modify: `apps/web/src/app/BottomTabBar.module.css:1`
- Modify: `apps/web/src/groups/NoGroupNotice.tsx:4, 11`
- Delete: `apps/web/src/imports/UploadPage.tsx`, `apps/web/src/imports/UploadPage.test.tsx`
- Test: `apps/web/src/app/BottomTabBar.test.tsx`, `apps/web/src/app/AppRoutes.test.tsx`, `apps/web/src/common/PageHeader.test.tsx:26`

**Interfaces:**
- Consumes: Task 1.2의 홈 `/?month=YYYY-MM` 동작, Task 1.1의 "업로드 이력" 버튼.
- Produces: `MENU`는 홈·대시보드·거래 목록·그룹 관리 4개다(소득공제는 PR 5에서 두 번째 자리에 넣는다). `/upload`와 `/upload?month=…`는 같은 쿼리스트링을 가진 `/`로 `replace` 이동한다. 하단 탭 격자는 메뉴 개수와 무관하게 같은 폭으로 나뉜다.

- [ ] **Step 1: 실패하는 테스트로 고치기**

`apps/web/src/app/BottomTabBar.test.tsx` — 업로드를 뺀다.

```tsx
  it('shows four short-named links', () => {
    const nav = renderAt('/')
    const names = within(nav).getAllByRole('link').map((link) => link.textContent)
    expect(names).toEqual(['홈', '대시보드', '거래', '그룹'])
  })

  it('marks only the current screen', () => {
    const nav = renderAt('/transactions')
    expect(within(nav).getByRole('link', { name: '거래' })).toHaveAttribute('aria-current', 'page')
    for (const name of ['홈', '대시보드', '그룹']) {
      expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('moves the current mark and the indicator to the tab the user picks', async () => {
    const user = userEvent.setup()
    const nav = renderAt('/')
    const indicatorOwners = () => within(nav).getAllByRole('link')
      .filter((link) => link.querySelector('[data-indicator]'))
      .map((link) => link.textContent)
    expect(indicatorOwners()).toEqual(['홈'])

    await user.click(within(nav).getByRole('link', { name: '그룹' }))

    expect(within(nav).getByRole('link', { name: '그룹' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current')
    expect(indicatorOwners()).toEqual(['그룹'])
  })
```

`apps/web/src/common/PageHeader.test.tsx:26` — 없어지는 메뉴 대신 남는 메뉴로 확인한다.

```tsx
    expect(menuLabel('/groups')).toBe('그룹 관리')
```

`apps/web/src/app/AppRoutes.test.tsx` — 네 곳을 고치고 테스트 두 개를 더한다.

(1) `shows dashboard sub-links under the dashboard menu`의 기대 목록:

```tsx
      .toEqual(['홈', '대시보드', '대분류', '소분류', '거래 목록', '그룹 관리'])
```

(2) `navigates between menu pages`를 아래로 바꾸고, 바로 뒤에 옛 주소 테스트 두 개를 더한다. `2026-01`은 테스트를 돌리는 날짜와 무관하게 지난 달이다.

```tsx
  it('navigates between menu pages', async () => {
    signedIn([])
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('link', { name: '그룹 관리' }))

    expect(await screen.findByRole('heading', { level: 1, name: '그룹 관리' })).toBeInTheDocument()
  })

  it('sends the old upload address to home and opens that month there', async () => {
    signedIn([])
    renderApp('/upload?month=2026-01')

    expect(await screen.findByRole('dialog', { name: '2026년 1월 데이터 업로드' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '홈', hidden: true })).toBeInTheDocument()
  })

  it('sends the old upload address without a month to home', async () => {
    signedIn([])
    renderApp('/upload')

    expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
```

(3) `clears cached data when the session is lost while using the app`에서 업로드 메뉴 클릭을 홈의 업로드 이력 버튼 클릭으로 바꾼다(같은 `/api/imports` 401 경로를 탄다).

```tsx
    await user.click(screen.getByRole('button', { name: '업로드 이력' }))
```

(4) `AppRoutes on a narrow screen` › `shows the bottom tab bar instead of the sidebar`의 기대 목록:

```tsx
    expect(names).toEqual(['홈', '대시보드', '거래', '그룹'])
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/app/BottomTabBar.test.tsx src/app/AppRoutes.test.tsx src/common/PageHeader.test.tsx`
Expected: 5개 FAIL — `shows four short-named links`, `shows dashboard sub-links under the dashboard menu`, 옛 주소 테스트 2개, `shows the bottom tab bar instead of the sidebar`. `PageHeader.test.tsx`와 세션 만료 테스트는 이미 PASS다(메뉴에 그룹 관리가 있고 Task 1.1의 버튼이 있어서).

- [ ] **Step 3: 메뉴에서 업로드 삭제** — `apps/web/src/app/menu.ts`에서 이 줄을 지운다.

```ts
  { to: '/upload', label: '업로드', shortLabel: '업로드', icon: 'sheet-upload', end: false },
```

`'sheet-upload'` 아이콘은 `UploadForm.tsx`가 계속 쓰므로 `Icon.tsx`에서 지우지 않는다.

- [ ] **Step 4: 라우트 정리** — `apps/web/src/app/AppRoutes.tsx`.

import를 바꾼다:

```tsx
import { Navigate, Route, Routes, useLocation } from 'react-router'
```

`const UploadPage = lazy(() => import('../imports/UploadPage'))` 줄을 지우고, `export default function AppRoutes()` 위에 추가한다:

```tsx
/** 옛 업로드 주소. 홈의 월별 등록 현황이 ?month=를 받아 그 달 창을 연다. */
function UploadRedirect() {
  return <Navigate to={{ pathname: '/', search: useLocation().search }} replace />
}
```

라우트를 바꾼다:

```tsx
            <Route path="upload" element={<UploadRedirect />} />
```

- [ ] **Step 5: 업로드 화면 삭제**

```bash
git rm apps/web/src/imports/UploadPage.tsx apps/web/src/imports/UploadPage.test.tsx
```

- [ ] **Step 6: 하단 탭 격자** — `apps/web/src/app/BottomTabBar.module.css` 1행의 `grid-template-columns: repeat(5, minmax(0, 1fr));`를 아래로 바꾼다. 메뉴가 4개든 5개든 같은 폭으로 나뉜다.

```css
grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr);
```

- [ ] **Step 7: 그룹 미가입 안내 문구** — `apps/web/src/groups/NoGroupNotice.tsx`.

4행 주석:

```tsx
/** 속한 그룹이 없을 때. 그룹이 없어도 홈(업로드 포함)·내 거래는 쓸 수 있다. */
```

11행 문구:

```tsx
        그룹이 없어도 홈의 업로드와 내 거래는 그대로 쓸 수 있습니다.
```

- [ ] **Step 8: 남은 참조 확인**

Run: `cd apps/web && grep -rn "UploadPage\|to=\"/upload\|'/upload'" src`
Expected: 출력 없음.

- [ ] **Step 9: 웹 전체 검증**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Expected: typecheck 오류 없음, 테스트 78파일 636건 통과, lint는 기존 경고 1건(`CoverageSection.tsx`의 `react(set-state-in-effect)`, 이 PR 전부터 있음)만, build 성공.

- [ ] **Step 10: 커밋(컨트롤러)**

```bash
git add -A apps/web/src
git commit -m "feat(web): 업로드 메뉴와 화면을 없애고 옛 주소를 홈으로 보냄" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

### Task 1.4: 검증 지도와 README 갱신

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Modify (전체 교체): `.claude/skills/verify/features/home.md`
- Delete: `.claude/skills/verify/features/upload.md`
- Modify: `.claude/skills/verify/features/README.md:32-34`
- Modify: `.claude/skills/verify/features/navigation.md` (Sub-features의 `nav-sidebar`·`nav-tabs`, Driving의 "Wide links"·"Narrow tabs", Gotchas의 탭 수)
- Modify: `.claude/skills/verify/SKILL.md:48`
- Modify: `README.md:10`

**Interfaces:**
- Consumes: Task 1.1~1.3의 화면 이름(`월별 등록 현황`, `업로드 이력`, `<YYYY년 M월> 데이터 업로드`, `<YYYY년 M월> 데이터`).
- Produces: 없음(문서).

- [ ] **Step 1: `features/home.md` 교체** — 기능 문서 계약(H1 + 한 문단, H2 네 개 순서)을 지킨다.

```markdown
# Home

Home (`/`, heading `홈`) shows a summary of the user's income and expenses for last month and the yearly monthly upload coverage. Uploading a Banksalad .xlsx export (up to 3 months and 512KB), managing a registered month, and the upload history all start from the coverage calendar.

## Sub-features

- `home-summary` shows last month's income and expense summary and the 수입·지출 cards (`수입 ₩ …`), which open `/transactions`.
- `home-coverage` shows the 12-month `월별 등록 현황` calendar and year controls `이전 연도` / `다음 연도`.
- `home-month-dialog` opens `<YYYY년 M월> 데이터 업로드` for an unregistered month, or `<YYYY년 M월> 데이터` for a registered month with `다시 업로드` and delete actions.
- `home-upload-form` uses the drop zone `엑셀 파일 업로드` with the button `파일 선택`, then the `업로드` submit, inside the month dialog. The result status reads `업로드가 끝났습니다.` with 전체/신규/갱신/변경 없음.
- `home-upload-history` opens the `업로드 이력` dialog from the icon button `업로드 이력` to the right of the year controls: file name, time, and 신규/갱신/변경 없음 for every batch.
- `home-deeplink` accepts `/?month=YYYY-MM`, opens the matching month dialog, then removes `?month=` from the address. The old address `/upload?month=YYYY-MM` redirects here and behaves the same; `/upload` alone lands on home.
- `home-order` stacks `지난달 내 요약` above `월별 등록 현황` on narrow screens. Wide screens put the coverage on the left (wider) and the summary on the right.

## How to get to it (user POV)

- Log in. Home is the landing page.
- Click the menu link `홈`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed: the previous 12 complete months are registered, with 12 monthly batches per member (`seed-owner-1.xlsx` through `seed-owner-12.xlsx` for the owner). Row counts per relative month are in [seed-expected.json](seed-expected.json).

- **Summary.** The last-month summary shows income and expense, with the 수입·지출 cards (`수입 ₩ …`), which open `/transactions`.
- **Order.** At `mobile`, the `h2` order is `지난달 내 요약 (…)` → `월별 등록 현황`. At `desktop`, the coverage card is on the left. There is no `지난달 업로드` card and no `파일 올리기` card.
- **Coverage.** The calendar shows the seeded months as registered with their row counts (see seed-expected.json). `이전 연도` / `다음 연도` change the year.
- **Deep link (missing month).** Open `/?month=<YYYY-MM 13 months before today>` (outside the 12 seeded months; check the calendar shows it as 미등록). The `<YYYY년 M월> 데이터 업로드` dialog opens and the address becomes `/`. Reload; no dialog opens.
- **Old address.** Open `/upload?month=<same month>`. The address becomes `/` and the same dialog opens. Open `/upload`; home shows with no dialog.
- **History.** Click the icon button `업로드 이력`. The dialog lists 12 batches; the row count of `seed-owner-1.xlsx` matches seed-expected.json.
- **Registered month.** Click a registered month. The `<YYYY년 M월> 데이터` dialog shows the counts, `다시 업로드`, and the delete action that needs the month typed.

## Gotchas

- The built-in browser cannot drive the OS file picker, so UI file selection and submit were not verified. Report the UI submit path as unverified unless a human picks the file.
- Files over 3 months or 512KB are rejected by the API. The form shows the error as an alert.
- Deleting a month changes the home summary and the dashboard. Restore it before another journey that expects seeded data.
- The dialogs slide up from the bottom on narrow screens and are centered on wide screens.
```

- [ ] **Step 2: `features/upload.md` 삭제와 색인 갱신**

```bash
git rm .claude/skills/verify/features/upload.md
```

`.claude/skills/verify/features/README.md`의 Features 목록에서 Home 줄을 바꾸고 Upload 줄을 지운다.

```markdown
- [Home](./home.md): last month's summary, monthly upload coverage, Banksalad xlsx upload, and upload history.
```

- [ ] **Step 3: `features/navigation.md` 갱신** — 메뉴가 4개가 됐다. 아래 문장으로 바꾼다.

`nav-sidebar`의 첫 문장:

```markdown
- `nav-sidebar` shows four sidebar links on wide screens: 홈, 대시보드, 거래 목록, 그룹 관리. Under 대시보드 sit indented sub-links `대분류` (`/dashboard/major`) and `소분류` (`/dashboard/minor`). Inside the dashboard they replace history and keep `?month=`.
```

`nav-tabs`:

```markdown
- `nav-tabs` shows four bottom tabs on narrow screens: 홈, 대시보드, 거래, 그룹. The tabs ignore the dashboard sub-links; the dashboard has its own `대시보드 메뉴` (see dashboard.md).
```

"Wide links."의 마지막 문장:

```markdown
The link list reads 홈, 대시보드, 대분류, 소분류, 거래 목록, 그룹 관리.
```

"Narrow tabs."의 "5 tab links"를 "4 tab links"로 바꾼다. Gotchas의 마지막 항목:

```markdown
- The tab bar splits its width evenly by the number of tabs (four now). Adding a tab is a design change: check that the labels still fit at 375px.
```

`nav-active`와 그 밖의 문장에 남은 `그룹 대시보드`는 현재 메뉴 이름 `대시보드`로 고친다.

- [ ] **Step 4: `SKILL.md:48` 갱신**

```markdown
4. Navigate the way a user does: click links inside `navigation "주 메뉴"`. On narrow screens the tabs are labelled 홈/대시보드/거래/그룹. On wide screens they are 홈/대시보드/거래 목록/그룹 관리. The active link has `aria-current="page"`.
```

- [ ] **Step 5: 저장소 `README.md:10` 갱신**

```markdown
- **가계부**: 홈에서 월별 등록 현황을 확인하고, 거래 목록에서 거래를 추가·수정한다.
```

- [ ] **Step 6: 링크·참조 확인**

Run: `grep -rn "upload.md\|features/upload" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=superpowers . ; grep -n "업로드" .claude/skills/verify/features/navigation.md .claude/skills/verify/SKILL.md`
Expected: 첫 명령은 출력 없음. 둘째 명령은 메뉴 이름으로서의 "업로드"가 없다(`SKILL.md`의 시드 설명에 있는 upload 관련 문장은 남는다).

- [ ] **Step 7: 커밋(컨트롤러)**

```bash
git add -A .claude/skills/verify README.md
git commit -m "docs: 검증 지도와 README를 홈 개편에 맞춤" -m "Co-Authored-By: Codex (gpt-6-luna) <noreply@openai.com>"
```

### PR 1 마무리 (컨트롤러)

- [ ] `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build` 결과를 구현 보고와 대조한다(이미 통과한 것은 변경 없이 다시 돌리지 않는다).
- [ ] 화면 확인: `.claude/skills/verify` 스킬로 `up.sh → seed.sh → doctor.sh`. `features/home.md`와 `features/navigation.md`의 여정을 375px와 데스크톱에서 돌린다. 볼 것: 375px에서 요약이 위·등록 현황이 아래(AC-42), 데스크톱에서 등록 현황이 왼쪽, 연도 이동과 업로드 이력 아이콘 버튼의 세로 정렬, 하단 탭 4칸의 폭, `/upload?month=…` 이동(AC-27), 업로드 이력·월 창(AC-26). 끝나면 `down.sh`.
- [ ] 이전·이후 캡처: 홈과 하단 탭을 375px에서 이전(`origin/main`)·이후로 찍어 `tmp/`에 두고, PR 번호가 나오면 `pr-assets` 브랜치 `pr-<번호>/`에 올린다. 합성 시드 화면만 쓴다.
- [ ] 브랜치 최종 리뷰: Claude Fable 5.2 서브에이전트 한 번(`review-final`). 위험 영역이 아니므로 Codex 반론 리뷰는 하지 않는다.
- [ ] PR 본문 "무엇"에 남길 것: 하단 탭이 4칸이 되고 소득공제 메뉴는 뒤 PR에서 들어온다는 점, 업로드 화면의 "파일 올리기" 카드와 3단계 안내가 없어졌다는 점. `## 소모값`은 `python3 scripts/pr_usage.py` 출력으로 채운다.

---

# PR 2 — 서비스 관리자 권한과 세법 버전 API

반론 리뷰 대상이다(권한·삭제). 브랜치: `feat/tax-law-api`(최신 `origin/main`에서 만든 worktree). PR 제목 예: `feat(api): 서비스 관리자 권한과 세법 버전 API`.

검증: `cd apps/api && ./gradlew test`. 업로드·파서를 건드리지 않으므로 `memoryTest`는 생략하고 PR 본문에 이유를 적는다(API CI는 둘 다 돌린다). JDK 21과 Docker(Testcontainers)가 필요하다.

이 PR의 코드와 테스트는 계획을 쓸 때 저장소 밖 임시 복사본에서 Task 순서대로 실행해 확인했다(2026-11-14, `6486c90` 기준: Task 2.1 RED 10건 중 6건 실패 확인 → Task별 구현 → 마지막에 `./gradlew test` 전체 320건 통과). Task 2.2·2.3의 RED는 컴파일 실패라 따로 돌리지 않았다. 저장소의 앱 코드는 아직 바꾸지 않았다.

경로 줄임: `main/` = `apps/api/src/main/java/com/saladbowl/api/`, `test/` = `apps/api/src/test/java/com/saladbowl/api/`, `migration/` = `apps/api/src/main/resources/db/migration/`.

## 데이터 설계

- `V8__add_service_admin.sql`: `users.service_admin BOOLEAN NOT NULL DEFAULT FALSE`.
- `V9__create_tax_law_versions.sql`
  - `tax_law_versions`: `id`, `tax_year`, `version_no`, `status`(`DRAFT`/`APPLIED`), `algorithm_version`(기본 1), 설정값 15개(모두 NULL 허용 — 초안은 빈 값으로 시작한다): 비율 6개 `min_spend_rate_pct`, `rate_credit_pct`, `rate_debit_cash_pct`, `rate_culture_pct`, `rate_market_pct`, `rate_transit_pct`(`INTEGER`), 금액 9개 `bracket_boundary`, `basic_limit_low_0~2`, `basic_limit_high_0~2`, `extra_limit_low`, `extra_limit_high`(`BIGINT`), 근거 `basis_law_name`(200)·`basis_article`(200)·`basis_url`(500), 적용 대상 기간 `period_start`·`period_end`(`DATE`), `memo`(1000), `created_by`·`applied_by`(`users` FK, `ON DELETE SET NULL`), `created_at`, `updated_at`, `applied_at`, `row_version`. `UNIQUE (tax_year, version_no)`. `CHECK ((status = 'APPLIED') = (applied_at IS NOT NULL))`.
  - `tax_law_year_counters (tax_year PK, last_version_no)`: 귀속연도별로 지금까지 내준 가장 큰 번호.
- `basic_limit_*_0/1/2`는 자녀등 0명 / 1명 / 2명 이상이다. `low`는 급여구간 경계 이하, `high`는 초과다.

## HTTP 인터페이스 (웹 PR 5·6, API PR 3·4가 쓴다)

| 메서드·경로 | 권한 | 동작 |
|---|---|---|
| `GET /me` | 로그인 | 응답에 `serviceAdmin: boolean` 추가 |
| `GET /tax/law-versions/current?year=YYYY` | 로그인 | 그 연도의 현재 적용 버전(가장 최근 `applied_at`). 없으면 404 `NOT_FOUND`. `createdByNickname`·`appliedByNickname`·`memo`는 항상 `null` |
| `GET /tax/admin/law-versions?year=YYYY` | 서비스 관리자 | 그 연도의 모든 버전(초안·적용), 번호 내림차순 |
| `POST /tax/admin/law-versions` `{taxYear}` | 서비스 관리자 | 새 초안 201. 현재 적용 버전의 설정값·근거·기간을 복사(메모 제외), 없으면 빈 값. 번호는 카운터 + 1 |
| `GET /tax/admin/law-versions/{id}` | 서비스 관리자 | 버전 하나. 없으면 404 |
| `PUT /tax/admin/law-versions/{id}` | 서비스 관리자 | 초안 전체 교체(본문에 `rowVersion` 필수, 없는 값은 빈 값이 된다). 적용본이면 409 `CONFLICT`, `rowVersion`이 다르면 409, 형태 오류(단계가 3칸이 아님, 길이 초과, 숫자 아님)는 400 `VALIDATION_FAILED`. 범위 검사는 하지 않는다(적용할 때 한다) |
| `POST /tax/admin/law-versions/{id}/validate` | 서비스 관리자 | `{errors: [{field, message}]}` (빈 배열이면 통과). 상태를 바꾸지 않는다 |
| `POST /tax/admin/law-versions/{id}/apply` 본문 `{ "rowVersion": <long> }` 필수 | 서비스 관리자 | `rowVersion` 누락·형식 오류는 400, 현재 값과 다르면 409 `CONFLICT`. 검증 통과 시 적용(상태·`applied_by`·`applied_at`) 200. 검증 실패 400 `VALIDATION_FAILED`(메시지는 첫 오류 `필드: 설명`), 이미 적용본이면 409 `CONFLICT`, 없으면 404 |
| `DELETE /tax/admin/law-versions/{id}?rowVersion=<long>` (쿼리 필수) | 서비스 관리자 | `rowVersion` 누락·형식 오류는 400, 현재 값과 다르면 409 `CONFLICT`. 초안이면 204, 적용본이면 409 `CONFLICT`, 없으면 404 |

`/tax/admin/**`은 비로그인 401 `UNAUTHORIZED`, 서비스 관리자가 아니면(일반 회원·그룹 ADMIN) 403 `FORBIDDEN`이다. `year`·`taxYear`는 1000~9999 정수이고 아니면 400 `VALIDATION_FAILED`다.

버전 응답(`VersionResponse`) 필드: `id, taxYear, versionNo, status, algorithmVersion, minSpendRatePct, bracketBoundary, rateCreditPct, rateDebitCashPct, rateCulturePct, rateMarketPct, rateTransitPct, basicLimitLow[3], basicLimitHigh[3], extraLimitLow, extraLimitHigh, childTiersApply, basisLawName, basisArticle, basisUrl, periodStart, periodEnd, memo, createdByNickname, appliedByNickname, createdAt, appliedAt, rowVersion`. `childTiersApply`는 자녀등 단계 값이 서로 다른지이고 웹이 자녀등 입력란을 보일지 판단한다(알려진 제약 8번).

회원용 current는 작성자·적용자 닉네임과 memo를 내리지 않는다.

## 권한과 동시성 설계

- **권한은 경로 한 곳에서 막는다.** `TaxAdminInterceptor`가 `/tax/admin/**`에 걸려 요청마다 `ServiceAdminGuard.require(userId)`로 DB의 `users.service_admin`을 읽는다. 컨트롤러 메서드마다 검사를 넣으면 새 엔드포인트에서 빠질 수 있어서다. 토큰에는 권한 claim이 없고 `JwtAuthenticationFilter`는 회원 id만 꺼내므로, 회수하면 같은 access 토큰의 다음 요청부터 403이다. 비로그인은 그보다 앞선 Spring Security(`anyRequest().authenticated()`)가 401로 끝낸다. `SecurityConfig`는 고치지 않는다.
- **번호 카운터는 한 문장으로 올리고 받는다.** `INSERT … ON CONFLICT (tax_year) DO UPDATE SET last_version_no = last_version_no + 1 RETURNING last_version_no`. 읽고 나서 쓰는 두 문장이면 동시에 만든 초안이 같은 번호를 받을 수 있다. 이 문장이 잡은 카운터 행 잠금은 커밋까지 유지되므로 같은 연도의 초안 만들기는 차례로 실행되고, 초안 저장이 실패해 롤백되면 번호도 되돌아간다. 초안을 지워도 카운터는 줄지 않는다. `UNIQUE (tax_year, version_no)`가 마지막 방어선이다.
- **수정·삭제·적용은 버전 행을 잠그고(`SELECT … FOR UPDATE`) 상태를 본다.** `TaxLawVersionRepository.findByIdForUpdate`(기존 `UserGroupRepository.findByIdForUpdate`와 같은 방식)로 잠근 뒤 초안인지 확인하고 바꾼다. 같은 초안을 동시에 두 번 적용하면 두 번째는 잠금이 풀린 뒤 `APPLIED`를 보고 409다. 적용과 삭제가 겹치면 먼저 잠근 쪽만 성공한다(적용이 먼저면 삭제 409, 삭제가 먼저면 적용 404). 상태를 읽고 나서 잠그지 않고 쓰면 적용된 버전이 지워질 수 있다.
- **`rowVersion`은 화면 사이의 덮어쓰기를 막는다.** `PUT` 본문의 `rowVersion`을 잠금 안에서 저장된 값과 비교해 다르면 409다. 엔티티의 `@Version`이 수정·적용 때마다 값을 올린다.
- **현재 적용 버전**은 저장하지 않고 조회한다: `status = APPLIED` 가운데 `applied_at`이 가장 늦은 것, 같으면 `id`가 큰 것. 서로 다른 초안 두 개를 동시에 적용하면 둘 다 적용본이 되고(TAX-72), 나중 시각인 쪽이 현재 적용 버전이다.
- 연도 기록(PR 3)은 적용본만 가리킨다. 초안은 어디서도 참조하지 않으므로 초안 삭제가 FK를 깨지 않는다.

## 계획 초안에서 달라진 점

- 관리자 검사를 서비스 메서드 안의 `ServiceAdminGuard.require` 호출에서 경로 인터셉터(`main/tax/TaxAdminInterceptor.java`, 새 파일)로 옮겼다. `TaxLawService`의 `adminId` 인자는 작성자·적용자 기록에만 쓰고, `updateDraft`·`deleteDraft`에는 없다.
- 번호 카운터 SQL은 `JdbcTemplate`으로 실행한다(JPA와 같은 트랜잭션·같은 연결). 카운터 테이블에는 엔티티를 두지 않는다.
- 검증 규칙은 `TaxLawService.validate` 대신 `TaxLawValidator`(순수 함수, DB 없는 단위 테스트)로 뺐다.
- `/tax/law-versions/current`와 `TaxLawController`를 Task 2.3에서 2.2로 당겼다(조회와 함께). 적용 API가 없는 Task 2.2의 테스트는 SQL로 적용본을 만든다(`TestTaxLaws.markApplied`).
- `docs/architecture.md` 수정을 Task 2.2에서 2.1로 당겼다(`tax` 패키지가 2.1에서 생긴다).
- 더한 것: `applied_at` CHECK 제약, 근거 URL이 `http://`·`https://`로 시작하는지 검사(화면이 링크로 그리는 값), 회원용 `current` 응답에서 닉네임 제외.

---

### Task 2.1: 서비스 관리자 컬럼과 권한 검사 (TAX-05, 06)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `migration/V8__add_service_admin.sql`
- Create: `main/user/ServiceAdminGuard.java`
- Create: `main/tax/TaxAdminInterceptor.java`
- Modify: `main/user/User.java`, `main/user/UserRepository.java`, `main/user/MeController.java`
- Create: `test/support/TestAdmins.java`
- Test: `test/tax/TaxAdminAccessTest.java`(생성), `test/user/MeApiTest.java`(수정)
- Modify: `docs/deploy.md`(끝에 13절), `docs/architecture.md:35`

**Interfaces:**
- Consumes: `UserRepository`(`JpaRepository<User, Long>`), `ApiException(ErrorCode, String)`, `ErrorCode.FORBIDDEN`·`UNAUTHORIZED`, 인증 principal = 회원 id `Long`(`JwtAuthenticationFilter`가 넣는다), 테스트 헬퍼 `TestAuth.signupAndLogin(mvc, email, nickname): AuthedUser(id, email, token)`·`TestGroups.createGroup(mvc, admin, name)`.
- Produces:
  - `ServiceAdminGuard.require(long userId)`: DB에서 `service_admin`을 읽어 아니면 `ApiException(ErrorCode.FORBIDDEN, "service admin only")`.
  - `UserRepository.existsByIdAndServiceAdminTrue(long id): boolean`, `User.isServiceAdmin(): boolean`.
  - `MeController.MeResponse(long userId, String email, String nickname, boolean serviceAdmin)`.
  - `/tax/admin/**` 아래의 모든 핸들러는 서비스 관리자만 실행된다. Task 2.2·2.3의 컨트롤러는 권한 코드를 쓰지 않는다.
  - 테스트 헬퍼 `TestAdmins.grant(JdbcTemplate, long userId)`, `TestAdmins.revoke(JdbcTemplate, long userId)`.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/support/TestAdmins.java`를 만든다.

```java
package com.saladbowl.api.support;

import org.springframework.jdbc.core.JdbcTemplate;

/** 통합 테스트용: 운영 절차(docs/deploy.md)와 같은 방식으로 DB에서 서비스 관리자를 지정·회수한다. */
public final class TestAdmins {

    private TestAdmins() {
    }

    public static void grant(JdbcTemplate jdbc, long userId) {
        jdbc.update("UPDATE users SET service_admin = TRUE WHERE id = ?", userId);
    }

    public static void revoke(JdbcTemplate jdbc, long userId) {
        jdbc.update("UPDATE users SET service_admin = FALSE WHERE id = ?", userId);
    }
}
```

`test/tax/TaxAdminAccessTest.java`를 만든다. 이 Task에는 `/tax/admin` 컨트롤러가 아직 없으므로, 관리자가 문을 통과했다는 것은 "403이 아니라 404"로 확인한다(Task 2.2에서 200으로 바꾼다).

```java
package com.saladbowl.api.tax;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /tax/admin/** 접근 제어(TAX-05, TAX-06, AC-04, AC-05). 경로 아래 어떤 주소·메서드든 같은 규칙이다. */
class TaxAdminAccessTest extends IntegrationTest {

    private static final String ADMIN_URL = "/tax/admin/law-versions";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void anonymousGets401() throws Exception {
        mvc.perform(get(ADMIN_URL).param("year", "2026"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void ordinaryMemberGets403OnEveryMethod() throws Exception {
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(post(ADMIN_URL).header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isForbidden());
        mvc.perform(get(ADMIN_URL + "/1").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(put(ADMIN_URL + "/1").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":0}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(ADMIN_URL + "/1/validate").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(post(ADMIN_URL + "/1/apply").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(delete(ADMIN_URL + "/1").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/tax/admin/anything/else").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
    }

    @Test
    void groupAdminIsNotServiceAdmin() throws Exception {
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@test.com", "그룹장");
        TestGroups.createGroup(mvc, groupAdmin, "우리집");

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", groupAdmin.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void serviceAdminPassesTheGate() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());

        // Task 2.1 시점에는 컨트롤러가 없으므로 문을 통과한 요청은 404다. Task 2.2에서 200으로 바꾼다.
        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void revokingTakesEffectOnTheNextRequestWithTheSameToken() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());

        TestAdmins.revoke(jdbc, admin.id());

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
```

`test/user/MeApiTest.java`를 세 곳 고친다.

import에 한 줄을 더한다.

```java
import org.springframework.jdbc.core.JdbcTemplate;
```

`MockMvc mvc;` 필드 아래에 더한다.

```java
    @Autowired
    JdbcTemplate jdbc;
```

`meReturnsCurrentUserWithValidToken`을 아래로 바꾸고, 그 아래에 테스트 하나를 더한다.

```java
    @Test
    void meReturnsCurrentUserWithValidToken() throws Exception {
        String token = accessTokenFor("me@test.com");

        mvc.perform(get("/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("me@test.com"))
                .andExpect(jsonPath("$.nickname").value("me"))
                .andExpect(jsonPath("$.serviceAdmin").value(false));
    }

    @Test
    void meReportsServiceAdminFromTheDatabase() throws Exception {
        String token = accessTokenFor("admin@test.com");
        jdbc.update("UPDATE users SET service_admin = TRUE WHERE email = ?", "admin@test.com");

        mvc.perform(get("/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceAdmin").value(true));
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxAdminAccessTest' --tests '*MeApiTest'`
Expected: `10 tests completed, 6 failed`. `TaxAdminAccessTest`는 `anonymousGets401`만 PASS이고 4개 FAIL(일반 회원·그룹 ADMIN이 403 대신 404 → `AssertionError`, 관리자 지정 SQL이 `BadSqlGrammarException` — `service_admin` 열 없음). `MeApiTest`는 2개 FAIL(`PathNotFoundException: $.serviceAdmin`, `BadSqlGrammarException`).

- [ ] **Step 3: migration** — `migration/V8__add_service_admin.sql`

```sql
-- 서비스 관리자(세법 관리 권한). 그룹 ADMIN과 별개이며 지정·해제는 운영자가 DB에서 직접 한다(docs/deploy.md).
ALTER TABLE users ADD COLUMN service_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 4: `User`·`UserRepository`·`MeController`**

`main/user/User.java` — `tokenVersion` 필드 아래에 필드를, getter 줄들 끝(`getGoogleSub` 아래)에 getter를 더한다. setter는 만들지 않는다(화면·API로 바꾸는 길이 없어야 한다).

```java
    // 세법 관리 권한. 그룹 ADMIN과 별개다. 화면 없이 운영자가 DB에서만 바꾼다.
    @Column(name = "service_admin", nullable = false)
    private boolean serviceAdmin;
```

```java
    public boolean isServiceAdmin() { return serviceAdmin; }
```

`main/user/UserRepository.java` — `existsByEmail` 아래에 더한다.

```java
    boolean existsByIdAndServiceAdminTrue(long id);
```

`main/user/MeController.java` — 레코드와 반환 줄을 바꾼다.

```java
    public record MeResponse(long userId, String email, String nickname, boolean serviceAdmin) {
    }
```

```java
        return new MeResponse(user.getId(), user.getEmail(), user.getNickname(), user.isServiceAdmin());
```

- [ ] **Step 5: 가드** — `main/user/ServiceAdminGuard.java`

```java
package com.saladbowl.api.user;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import org.springframework.stereotype.Component;

/** 서비스 관리자 검사. 토큰에 권한을 넣지 않고 요청마다 DB를 읽으므로 회수하면 다음 요청부터 막힌다. */
@Component
public class ServiceAdminGuard {

    private final UserRepository users;

    public ServiceAdminGuard(UserRepository users) {
        this.users = users;
    }

    public void require(long userId) {
        if (!users.existsByIdAndServiceAdminTrue(userId)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "service admin only");
        }
    }
}
```

- [ ] **Step 6: 경로 인터셉터** — `main/tax/TaxAdminInterceptor.java`. `ApiException`은 `GlobalExceptionHandler`가 403 `FORBIDDEN` JSON으로 바꾼다. 핸들러가 없는 주소도 정적 자원 핸들러를 거치므로 인터셉터가 먼저 돈다(없는 `/tax/admin/…` 주소도 비관리자에게는 403).

```java
package com.saladbowl.api.tax;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.user.ServiceAdminGuard;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * /tax/admin/** 전체를 서비스 관리자에게만 연다. 컨트롤러 메서드마다 검사를 넣으면 새 엔드포인트에서
 * 빠질 수 있으므로 경로 한 곳에서 막는다. 비로그인은 이보다 앞선 Spring Security가 401로 끝낸다.
 */
@Component
public class TaxAdminInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    private final ServiceAdminGuard guard;

    public TaxAdminInterceptor(ServiceAdminGuard guard) {
        this.guard = guard;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/tax/admin/**");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(request.getUserPrincipal() instanceof Authentication auth)
                || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "authentication required");
        }
        guard.require(userId);
        return true;
    }
}
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxAdminAccessTest' --tests '*MeApiTest'`
Expected: `BUILD SUCCESSFUL`. `TaxAdminAccessTest` 5건, `MeApiTest` 5건 통과.

- [ ] **Step 8: 문서**

`docs/deploy.md` 맨 끝에 절을 더한다.

````markdown
## 13. 서비스 관리자 지정·해제

"연도별 세법 관리"는 서비스 관리자만 쓴다. 그룹 ADMIN과 별개의 권한이고 지정·해제 화면이 없다. 운영자가 Supabase SQL Editor에서 직접 바꾼다.

```sql
-- 지정
UPDATE users SET service_admin = TRUE WHERE email = '<관리자 이메일>';
-- 해제
UPDATE users SET service_admin = FALSE WHERE email = '<관리자 이메일>';
-- 확인
SELECT id, email, service_admin FROM users WHERE service_admin;
```

- `UPDATE` 결과가 1행인지 확인한다. 0행이면 이메일이 틀렸거나 아직 가입하지 않은 계정이다.
- API는 세법 관리 요청마다 DB의 이 값을 읽는다. 다시 로그인하지 않아도 다음 요청부터 반영된다.
- 웹은 `/me`의 `serviceAdmin`으로 메뉴를 보인다. 화면의 메뉴는 새로 고친 뒤에 바뀐다.
````

`docs/architecture.md:35`의 패키지 목록 줄을 바꾼다.

```markdown
- 기능 단위 패키지로 나눈다: `auth`, `user`, `group`, `transaction`, `importer`, `tax`, `common`. `tax`는 소득공제이며 `/tax/admin/**`은 서비스 관리자(`users.service_admin`)만 쓴다.
```

- [ ] **Step 9: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(기존 테스트 포함. `User`에 열이 늘었으므로 `ddl-auto: validate`와 V8이 맞는지 여기서 확인된다).

- [ ] **Step 10: 커밋(컨트롤러)** — Codex는 커밋하지 않는다. 컨트롤러가 보고와 diff를 확인한 뒤 커밋한다.

```bash
git add apps/api/src/main/resources/db/migration/V8__add_service_admin.sql apps/api/src/main/java/com/saladbowl/api/user apps/api/src/main/java/com/saladbowl/api/tax apps/api/src/test/java/com/saladbowl/api/support/TestAdmins.java apps/api/src/test/java/com/saladbowl/api/tax apps/api/src/test/java/com/saladbowl/api/user/MeApiTest.java docs/deploy.md docs/architecture.md
git commit -m "feat(api): 서비스 관리자 컬럼과 세법 관리 경로 권한 검사" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

---

### Task 2.2: 세법 버전 저장소와 초안 만들기·조회·수정·삭제 (TAX-04, 60, 61, 62, 67, 72)

**담당:** Codex `gpt-6-astra` / `medium` (`api`, 설계 판단이 큼), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `migration/V9__create_tax_law_versions.sql`
- Create: `main/tax/law/TaxLawStatus.java`, `TaxLawVersion.java`, `TaxLawVersionRepository.java`, `TaxLawDtos.java`, `TaxLawService.java`, `TaxLawAdminController.java`, `TaxLawController.java`
- Create: `test/support/TestTaxLaws.java`
- Test: `test/tax/law/TaxLawAdminApiTest.java`(생성), `test/tax/law/TaxLawConcurrencyTest.java`(생성), `test/tax/TaxAdminAccessTest.java`(수정)

**Interfaces:**
- Consumes: Task 2.1의 `/tax/admin/**` 권한 검사(컨트롤러에 권한 코드를 쓰지 않는다), `TestAdmins.grant/revoke`, `@CurrentUser Long userId`, `UserRepository.findById`, `User.getNickname()`, `ApiException`, `ErrorCode.NOT_FOUND`·`CONFLICT`·`VALIDATION_FAILED`.
- Produces:
  - `TaxLawStatus { DRAFT, APPLIED }`
  - `TaxLawVersion`(엔티티): `static draft(int taxYear, int versionNo, long createdBy)`, `copyValuesFrom(TaxLawVersion)`, `edit(TaxLawDtos.UpdateRequest)`, getter(`getMinSpendRatePct(): Integer`, `getBracketBoundary(): Long`, `getBasicLimitLow0()`~`getBasicLimitHigh2(): Long` 등 — PR 4의 `TaxLawValues`가 읽는다).
  - `TaxLawVersionRepository`: `findByTaxYearOrderByVersionNoDesc(int)`, `findFirstByTaxYearAndStatusOrderByAppliedAtDescIdDesc(int, TaxLawStatus)`, `findByIdForUpdate(long): Optional<TaxLawVersion>`.
  - `TaxLawDtos.CreateRequest(Integer taxYear)`, `UpdateRequest(Long rowVersion, Integer minSpendRatePct, Long bracketBoundary, Integer rateCreditPct, Integer rateDebitCashPct, Integer rateCulturePct, Integer rateMarketPct, Integer rateTransitPct, List<Long> basicLimitLow, List<Long> basicLimitHigh, Long extraLimitLow, Long extraLimitHigh, String basisLawName, String basisArticle, String basisUrl, LocalDate periodStart, LocalDate periodEnd, String memo)`, `VersionResponse`(위 "HTTP 인터페이스"의 필드, `static of(TaxLawVersion, String createdByNickname, String appliedByNickname)`).
  - `TaxLawService`: `createDraft(long adminId, int taxYear): VersionResponse`, `list(int taxYear): List<VersionResponse>`, `get(long id): VersionResponse`, `updateDraft(long id, UpdateRequest): VersionResponse`, `deleteDraft(long id): void`, `current(int taxYear): VersionResponse`(없으면 404), `currentApplied(int taxYear): Optional<TaxLawVersion>`(PR 3이 연도 기록의 세법 버전을 정할 때 쓴다), 비공개 `lockDraft(long id): TaxLawVersion`(행 잠금 + 초안 확인. Task 2.3의 `apply`가 쓴다).
  - HTTP: 위 표의 `GET(list)`, `POST`, `GET(one)`, `PUT`, `DELETE`, `GET /tax/law-versions/current`.
  - 테스트 헬퍼 `TestTaxLaws.URL`, `values2026(long rowVersion): String`, `createDraft(mvc, admin, taxYear): long`, `createFilledDraft(mvc, admin, taxYear): long`(끝난 뒤 `rowVersion` 1), `markApplied(jdbc, id, adminId)`; `TaxLawConcurrencyTest.runTogether(List<Callable<String>>): List<String>`.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/support/TestTaxLaws.java`를 만든다. 값은 2026 귀속 법령 수치다(최저사용금액 25%, 경계 70,000,000, 공제율 15/30/30/40/40, 기본한도 이하 3,000,000/3,500,000/4,000,000·초과 2,500,000/2,750,000/3,000,000, 추가한도 3,000,000/2,000,000).

```java
package com.saladbowl.api.support;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 통합 테스트용 세법 버전 준비 헬퍼. 값은 2026 귀속 법령 수치(공개 수치)다. */
public final class TestTaxLaws {

    public static final String URL = "/tax/admin/law-versions";

    private TestTaxLaws() {
    }

    /** 2026 귀속 값으로 채운 수정 요청 본문. */
    public static String values2026(long rowVersion) {
        return """
                {
                  "rowVersion": %d,
                  "minSpendRatePct": 25,
                  "bracketBoundary": 70000000,
                  "rateCreditPct": 15,
                  "rateDebitCashPct": 30,
                  "rateCulturePct": 30,
                  "rateMarketPct": 40,
                  "rateTransitPct": 40,
                  "basicLimitLow": [3000000, 3500000, 4000000],
                  "basicLimitHigh": [2500000, 2750000, 3000000],
                  "extraLimitLow": 3000000,
                  "extraLimitHigh": 2000000,
                  "basisLawName": "조세특례제한법",
                  "basisArticle": "제126조의2",
                  "basisUrl": "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389",
                  "periodStart": "2026-01-01",
                  "periodEnd": "2026-12-31",
                  "memo": "2026 귀속 최초 등록"
                }
                """.formatted(rowVersion);
    }

    public static long createDraft(MockMvc mvc, TestAuth.AuthedUser admin, int taxYear) throws Exception {
        String body = mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taxYear\":%d}".formatted(taxYear)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    /** 새 초안을 만들고 2026 값으로 채운다. 채운 뒤의 rowVersion은 1이다. */
    public static long createFilledDraft(MockMvc mvc, TestAuth.AuthedUser admin, int taxYear) throws Exception {
        long id = createDraft(mvc, admin, taxYear);
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(values2026(0)))
                .andExpect(status().isOk());
        return id;
    }

    /** 적용 API(Task 2.3) 없이 적용본을 만든다. 적용본의 수정·삭제 거부와 current 조회 테스트에 쓴다. */
    public static void markApplied(JdbcTemplate jdbc, long id, long adminId) {
        jdbc.update("UPDATE tax_law_versions SET status = 'APPLIED', applied_by = ?, applied_at = now() WHERE id = ?",
                adminId, id);
    }
}
```

`test/tax/law/TaxLawAdminApiTest.java`를 만든다.

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestTaxLaws;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxLaws.URL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 세법 초안 만들기·조회·수정·삭제와 회원용 current 조회(TAX-04, 60~62, 67, 72, AC-39, AC-19 일부). */
class TaxLawAdminApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser admin;

    @BeforeEach
    void createAdmin() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());
    }

    @Test
    void firstDraftOfAYearIsBlankAndNumberedOne() throws Exception {
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.taxYear").value(2026))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.algorithmVersion").value(1))
                .andExpect(jsonPath("$.minSpendRatePct").value(nullValue()))
                .andExpect(jsonPath("$.bracketBoundary").value(nullValue()))
                .andExpect(jsonPath("$.basicLimitLow", contains(nullValue(), nullValue(), nullValue())))
                .andExpect(jsonPath("$.basicLimitHigh", contains(nullValue(), nullValue(), nullValue())))
                .andExpect(jsonPath("$.childTiersApply").value(false))
                .andExpect(jsonPath("$.basisLawName").value(nullValue()))
                .andExpect(jsonPath("$.createdByNickname").value("관리자"))
                .andExpect(jsonPath("$.appliedByNickname").value(nullValue()))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.appliedAt").value(nullValue()))
                .andExpect(jsonPath("$.rowVersion").value(0));
    }

    @Test
    void versionNumbersGrowPerYearAndAreNeverReused() throws Exception {
        long first = TestTaxLaws.createDraft(mvc, admin, 2026);
        TestTaxLaws.createDraft(mvc, admin, 2026);
        long third = TestTaxLaws.createDraft(mvc, admin, 2026);

        // 가장 큰 번호(3)를 지워도 다음 초안은 4번이다.
        mvc.perform(delete(URL + "/" + third).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(4));

        // 중간 번호(1)를 지워도 빈 번호를 채우지 않는다.
        mvc.perform(delete(URL + "/" + first).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(5));

        // 번호는 귀속연도마다 따로 센다.
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2025}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(1));

        mvc.perform(get(URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].versionNo", contains(5, 4, 2)));
    }

    @Test
    void updateReplacesDraftValuesAndBumpsRowVersion() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(TestTaxLaws.values2026(0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rowVersion").value(1));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.bracketBoundary").value(70000000))
                .andExpect(jsonPath("$.rateCreditPct").value(15))
                .andExpect(jsonPath("$.rateDebitCashPct").value(30))
                .andExpect(jsonPath("$.rateCulturePct").value(30))
                .andExpect(jsonPath("$.rateMarketPct").value(40))
                .andExpect(jsonPath("$.rateTransitPct").value(40))
                .andExpect(jsonPath("$.basicLimitLow", contains(3000000, 3500000, 4000000)))
                .andExpect(jsonPath("$.basicLimitHigh", contains(2500000, 2750000, 3000000)))
                .andExpect(jsonPath("$.extraLimitLow").value(3000000))
                .andExpect(jsonPath("$.extraLimitHigh").value(2000000))
                .andExpect(jsonPath("$.childTiersApply").value(true))
                .andExpect(jsonPath("$.basisLawName").value("조세특례제한법"))
                .andExpect(jsonPath("$.basisArticle").value("제126조의2"))
                .andExpect(jsonPath("$.basisUrl").value("https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389"))
                .andExpect(jsonPath("$.periodStart").value("2026-01-01"))
                .andExpect(jsonPath("$.periodEnd").value("2026-12-31"))
                .andExpect(jsonPath("$.memo").value("2026 귀속 최초 등록"))
                .andExpect(jsonPath("$.rowVersion").value(1));
    }

    @Test
    void omittedValuesBecomeEmpty() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":1,\"basisLawName\":\"   \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minSpendRatePct").value(nullValue()))
                .andExpect(jsonPath("$.basicLimitLow", contains(nullValue(), nullValue(), nullValue())))
                .andExpect(jsonPath("$.basisLawName").value(nullValue()))
                .andExpect(jsonPath("$.childTiersApply").value(false))
                .andExpect(jsonPath("$.rowVersion").value(2));
    }

    @Test
    void staleRowVersionReturns409AndKeepsStoredValues() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        // 다른 곳에서 먼저 고쳐 rowVersion이 1이 됐는데 0으로 보낸다.
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"minSpendRatePct\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.rowVersion").value(1));
    }

    @Test
    void malformedUpdateReturns400() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        // rowVersion 없음
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"minSpendRatePct\":25}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        // 자녀등 단계가 3칸이 아님
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"basicLimitLow\":[3000000,3500000]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        // 근거 URL이 열 길이(500)를 넘음
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"basisUrl\":\"https://example.com/%s\"}".formatted("a".repeat(500))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        // 숫자 자리에 문자열
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":0,\"minSpendRatePct\":\"많이\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.rowVersion").value(0));
    }

    @Test
    void appliedVersionCannotBeUpdatedOrDeleted() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        TestTaxLaws.markApplied(jdbc, id, admin.id());

        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":1,\"minSpendRatePct\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.appliedByNickname").value("관리자"));
    }

    @Test
    void deletedDraftIsGone() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":0}"))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_law_versions", Long.class)).isZero();
    }

    @Test
    void newDraftCopiesCurrentAppliedValuesButNotMemo() throws Exception {
        long appliedId = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        TestTaxLaws.markApplied(jdbc, appliedId, admin.id());
        AuthedUser second = TestAuth.signupAndLogin(mvc, "second@test.com", "둘째관리자");
        TestAdmins.grant(jdbc, second.id());

        mvc.perform(post(URL).header("Authorization", second.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(2))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.bracketBoundary").value(70000000))
                .andExpect(jsonPath("$.rateTransitPct").value(40))
                .andExpect(jsonPath("$.basicLimitLow", contains(3000000, 3500000, 4000000)))
                .andExpect(jsonPath("$.basicLimitHigh", contains(2500000, 2750000, 3000000)))
                .andExpect(jsonPath("$.extraLimitHigh").value(2000000))
                .andExpect(jsonPath("$.basisLawName").value("조세특례제한법"))
                .andExpect(jsonPath("$.periodEnd").value("2026-12-31"))
                .andExpect(jsonPath("$.memo").value(nullValue()))
                .andExpect(jsonPath("$.createdByNickname").value("둘째관리자"))
                .andExpect(jsonPath("$.appliedByNickname").value(nullValue()))
                .andExpect(jsonPath("$.appliedAt").value(nullValue()))
                .andExpect(jsonPath("$.rowVersion").value(0));

        // 다른 귀속연도는 적용 버전이 없으므로 빈 값으로 시작한다.
        mvc.perform(post(URL).header("Authorization", second.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2027}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.minSpendRatePct").value(nullValue()));
    }

    @Test
    void yearMustBeFourDigits() throws Exception {
        for (String body : new String[]{"{\"taxYear\":999}", "{\"taxYear\":10000}", "{}", "{\"taxYear\":\"올해\"}"}) {
            mvc.perform(post(URL).header("Authorization", admin.bearer())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String year : new String[]{"999", "10000", "abc"}) {
            mvc.perform(get(URL).param("year", year).header("Authorization", admin.bearer()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        mvc.perform(get(URL).header("Authorization", admin.bearer()))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_law_year_counters", Long.class)).isZero();
    }

    @Test
    void nonAdminsCannotReadOrChangeVersions() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");

        mvc.perform(get(URL).param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(get(URL + "/" + id).header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(post(URL).header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isForbidden());
        mvc.perform(put(URL + "/" + id).header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":1,\"minSpendRatePct\":99}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete(URL + "/" + id).header("Authorization", member.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(delete(URL + "/" + id))
                .andExpect(status().isUnauthorized());

        // 거부된 요청은 아무것도 바꾸지 않았다.
        mvc.perform(get(URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].minSpendRatePct").value(25))
                .andExpect(jsonPath("$[0].rowVersion").value(1));
    }

    @Test
    void revokedAdminIsRejectedOnTheNextRequestWithTheSameToken() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        TestAdmins.revoke(jdbc, admin.id());

        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tax_law_versions", Long.class)).isEqualTo(1);
    }

    @Test
    void currentIsReadableByAnyMemberAndNeverShowsDrafts() throws Exception {
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(get("/tax/law-versions/current").param("year", "2026"))
                .andExpect(status().isUnauthorized());
        // 초안만 있는 연도는 "세법 준비 중"이다.
        mvc.perform(get("/tax/law-versions/current").param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        TestTaxLaws.markApplied(jdbc, id, admin.id());
        TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(get("/tax/law-versions/current").param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.childTiersApply").value(true))
                // 회원에게는 작성자·적용자 닉네임을 내리지 않는다.
                .andExpect(jsonPath("$.createdByNickname").value(nullValue()))
                .andExpect(jsonPath("$.appliedByNickname").value(nullValue()));
        mvc.perform(get("/tax/law-versions/current").param("year", "2025").header("Authorization", member.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/tax/law-versions/current").param("year", "99").header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest());
    }
}
```

`test/tax/law/TaxLawConcurrencyTest.java`를 만든다. 기존 `group/ConcurrentAcceptTest`와 같은 방식으로 서비스를 여러 스레드에서 직접 부른다.

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 동시에 들어온 요청이 번호를 겹쳐 쓰지 않는지 실제 트랜잭션으로 확인한다. */
class TaxLawConcurrencyTest extends IntegrationTest {

    private static final int THREADS = 8;

    @Autowired
    UserRepository users;
    @Autowired
    TaxLawService service;
    @Autowired
    TaxLawVersionRepository versions;

    @Test
    void concurrentDraftsGetDistinctConsecutiveNumbers() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        List<Callable<String>> calls = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            calls.add(() -> Integer.toString(service.createDraft(adminId, 2026).versionNo()));
        }

        List<String> results = runTogether(calls);

        assertThat(results).containsExactlyInAnyOrder("1", "2", "3", "4", "5", "6", "7", "8");
        assertThat(versions.findByTaxYearOrderByVersionNoDesc(2026)).hasSize(THREADS);
    }

    /** 모든 호출을 같은 순간에 시작한다. 결과는 반환값, ApiException이면 오류 코드 이름이다. */
    static List<String> runTogether(List<Callable<String>> calls) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(calls.size());
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<String>> futures = new ArrayList<>();
            for (Callable<String> call : calls) {
                futures.add(pool.submit(() -> {
                    if (!start.await(30, TimeUnit.SECONDS)) {
                        return "NOT_STARTED";
                    }
                    try {
                        return call.call();
                    } catch (ApiException e) {
                        return e.code().name();
                    } catch (Exception e) {
                        return e.getClass().getName();
                    }
                }));
            }
            start.countDown();
            List<String> results = new ArrayList<>();
            for (Future<String> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
```

`test/tax/TaxAdminAccessTest.java`의 두 테스트를 고친다. 컨트롤러가 생겼으므로 관리자는 404가 아니라 200이다.

```java
    @Test
    void serviceAdminPassesTheGate() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void revokingTakesEffectOnTheNextRequestWithTheSameToken() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());

        TestAdmins.revoke(jdbc, admin.id());

        mvc.perform(get(ADMIN_URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxLaw*' --tests '*TaxAdminAccessTest'`
Expected: `compileTestJava FAILED` — `TaxLawConcurrencyTest`에서 `cannot find symbol: class TaxLawService`, `class TaxLawVersionRepository`.

- [ ] **Step 3: migration** — `migration/V9__create_tax_law_versions.sql`

```sql
-- 연도별 세법 기준. 전역 데이터이며 회원 소유가 아니다. 초안(DRAFT)은 값이 비어 있을 수 있어 설정값은 NULL을 허용한다.
CREATE TABLE tax_law_versions (
    id                  BIGSERIAL PRIMARY KEY,
    tax_year            INTEGER      NOT NULL,
    version_no          INTEGER      NOT NULL,
    status              VARCHAR(10)  NOT NULL CHECK (status IN ('DRAFT', 'APPLIED')),
    algorithm_version   INTEGER      NOT NULL DEFAULT 1,
    min_spend_rate_pct  INTEGER,
    rate_credit_pct     INTEGER,
    rate_debit_cash_pct INTEGER,
    rate_culture_pct    INTEGER,
    rate_market_pct     INTEGER,
    rate_transit_pct    INTEGER,
    bracket_boundary    BIGINT,
    basic_limit_low_0   BIGINT,
    basic_limit_low_1   BIGINT,
    basic_limit_low_2   BIGINT,
    basic_limit_high_0  BIGINT,
    basic_limit_high_1  BIGINT,
    basic_limit_high_2  BIGINT,
    extra_limit_low     BIGINT,
    extra_limit_high    BIGINT,
    basis_law_name      VARCHAR(200),
    basis_article       VARCHAR(200),
    basis_url           VARCHAR(500),
    period_start        DATE,
    period_end          DATE,
    memo                VARCHAR(1000),
    created_by          BIGINT REFERENCES users (id) ON DELETE SET NULL,
    applied_by          BIGINT REFERENCES users (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    applied_at          TIMESTAMPTZ,
    row_version         BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_tax_law_versions_year_no UNIQUE (tax_year, version_no),
    -- 적용본에는 적용 시각이 있고 초안에는 없다. 현재 적용 버전을 applied_at으로 고르므로 DB에서도 지킨다.
    CONSTRAINT ck_tax_law_versions_applied_at CHECK ((status = 'APPLIED') = (applied_at IS NOT NULL))
);

-- 귀속연도별로 지금까지 내준 가장 큰 버전 번호. 초안을 지워도 줄지 않으므로 번호를 다시 쓰지 않는다.
CREATE TABLE tax_law_year_counters (
    tax_year        INTEGER PRIMARY KEY,
    last_version_no INTEGER NOT NULL
);
```

- [ ] **Step 4: 상태와 엔티티** — `main/tax/law/TaxLawStatus.java`, `main/tax/law/TaxLawVersion.java`

```java
package com.saladbowl.api.tax.law;

public enum TaxLawStatus {
    DRAFT,
    APPLIED
}
```

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** 귀속연도별 세법 기준의 한 버전. 금액은 원 단위 정수, 비율은 정수 퍼센트다. 초안은 값이 비어 있을 수 있다. */
@Entity
@Table(name = "tax_law_versions")
public class TaxLawVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tax_year", nullable = false)
    private int taxYear;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaxLawStatus status;

    @Column(name = "algorithm_version", nullable = false)
    private int algorithmVersion = 1;

    @Column(name = "min_spend_rate_pct")
    private Integer minSpendRatePct;

    @Column(name = "rate_credit_pct")
    private Integer rateCreditPct;

    @Column(name = "rate_debit_cash_pct")
    private Integer rateDebitCashPct;

    @Column(name = "rate_culture_pct")
    private Integer rateCulturePct;

    @Column(name = "rate_market_pct")
    private Integer rateMarketPct;

    @Column(name = "rate_transit_pct")
    private Integer rateTransitPct;

    @Column(name = "bracket_boundary")
    private Long bracketBoundary;

    @Column(name = "basic_limit_low_0")
    private Long basicLimitLow0;

    @Column(name = "basic_limit_low_1")
    private Long basicLimitLow1;

    @Column(name = "basic_limit_low_2")
    private Long basicLimitLow2;

    @Column(name = "basic_limit_high_0")
    private Long basicLimitHigh0;

    @Column(name = "basic_limit_high_1")
    private Long basicLimitHigh1;

    @Column(name = "basic_limit_high_2")
    private Long basicLimitHigh2;

    @Column(name = "extra_limit_low")
    private Long extraLimitLow;

    @Column(name = "extra_limit_high")
    private Long extraLimitHigh;

    @Column(name = "basis_law_name")
    private String basisLawName;

    @Column(name = "basis_article")
    private String basisArticle;

    @Column(name = "basis_url")
    private String basisUrl;

    @Column(name = "period_start")
    private LocalDate periodStart;

    @Column(name = "period_end")
    private LocalDate periodEnd;

    private String memo;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "applied_by")
    private Long appliedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "applied_at")
    private OffsetDateTime appliedAt;

    // 수정 요청의 rowVersion과 비교해 다른 곳에서 먼저 고친 초안을 덮어쓰지 않게 한다.
    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    protected TaxLawVersion() {
    }

    public static TaxLawVersion draft(int taxYear, int versionNo, long createdBy) {
        TaxLawVersion version = new TaxLawVersion();
        version.taxYear = taxYear;
        version.versionNo = versionNo;
        version.status = TaxLawStatus.DRAFT;
        version.createdBy = createdBy;
        return version;
    }

    /** 새 초안의 시작값. 설정값·근거·적용 대상 기간을 복사한다. 메모는 그 버전에 대한 기록이라 복사하지 않는다. */
    public void copyValuesFrom(TaxLawVersion source) {
        algorithmVersion = source.algorithmVersion;
        minSpendRatePct = source.minSpendRatePct;
        rateCreditPct = source.rateCreditPct;
        rateDebitCashPct = source.rateDebitCashPct;
        rateCulturePct = source.rateCulturePct;
        rateMarketPct = source.rateMarketPct;
        rateTransitPct = source.rateTransitPct;
        bracketBoundary = source.bracketBoundary;
        basicLimitLow0 = source.basicLimitLow0;
        basicLimitLow1 = source.basicLimitLow1;
        basicLimitLow2 = source.basicLimitLow2;
        basicLimitHigh0 = source.basicLimitHigh0;
        basicLimitHigh1 = source.basicLimitHigh1;
        basicLimitHigh2 = source.basicLimitHigh2;
        extraLimitLow = source.extraLimitLow;
        extraLimitHigh = source.extraLimitHigh;
        basisLawName = source.basisLawName;
        basisArticle = source.basisArticle;
        basisUrl = source.basisUrl;
        periodStart = source.periodStart;
        periodEnd = source.periodEnd;
    }

    /** 초안 수정. 요청에 없는 값은 빈 값이 된다(전체 교체). 범위 검사는 적용할 때 한다. */
    public void edit(UpdateRequest request) {
        minSpendRatePct = request.minSpendRatePct();
        rateCreditPct = request.rateCreditPct();
        rateDebitCashPct = request.rateDebitCashPct();
        rateCulturePct = request.rateCulturePct();
        rateMarketPct = request.rateMarketPct();
        rateTransitPct = request.rateTransitPct();
        bracketBoundary = request.bracketBoundary();
        basicLimitLow0 = tier(request.basicLimitLow(), 0);
        basicLimitLow1 = tier(request.basicLimitLow(), 1);
        basicLimitLow2 = tier(request.basicLimitLow(), 2);
        basicLimitHigh0 = tier(request.basicLimitHigh(), 0);
        basicLimitHigh1 = tier(request.basicLimitHigh(), 1);
        basicLimitHigh2 = tier(request.basicLimitHigh(), 2);
        extraLimitLow = request.extraLimitLow();
        extraLimitHigh = request.extraLimitHigh();
        basisLawName = blankToNull(request.basisLawName());
        basisArticle = blankToNull(request.basisArticle());
        basisUrl = blankToNull(request.basisUrl());
        periodStart = request.periodStart();
        periodEnd = request.periodEnd();
        memo = blankToNull(request.memo());
    }

    private static Long tier(List<Long> tiers, int index) {
        return tiers == null ? null : tiers.get(index);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public int getTaxYear() { return taxYear; }
    public int getVersionNo() { return versionNo; }
    public TaxLawStatus getStatus() { return status; }
    public int getAlgorithmVersion() { return algorithmVersion; }
    public Integer getMinSpendRatePct() { return minSpendRatePct; }
    public Integer getRateCreditPct() { return rateCreditPct; }
    public Integer getRateDebitCashPct() { return rateDebitCashPct; }
    public Integer getRateCulturePct() { return rateCulturePct; }
    public Integer getRateMarketPct() { return rateMarketPct; }
    public Integer getRateTransitPct() { return rateTransitPct; }
    public Long getBracketBoundary() { return bracketBoundary; }
    public Long getBasicLimitLow0() { return basicLimitLow0; }
    public Long getBasicLimitLow1() { return basicLimitLow1; }
    public Long getBasicLimitLow2() { return basicLimitLow2; }
    public Long getBasicLimitHigh0() { return basicLimitHigh0; }
    public Long getBasicLimitHigh1() { return basicLimitHigh1; }
    public Long getBasicLimitHigh2() { return basicLimitHigh2; }
    public Long getExtraLimitLow() { return extraLimitLow; }
    public Long getExtraLimitHigh() { return extraLimitHigh; }
    public String getBasisLawName() { return basisLawName; }
    public String getBasisArticle() { return basisArticle; }
    public String getBasisUrl() { return basisUrl; }
    public LocalDate getPeriodStart() { return periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public String getMemo() { return memo; }
    public Long getCreatedBy() { return createdBy; }
    public Long getAppliedBy() { return appliedBy; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getAppliedAt() { return appliedAt; }
    public long getRowVersion() { return rowVersion; }
}
```

- [ ] **Step 5: 저장소** — `main/tax/law/TaxLawVersionRepository.java`

```java
package com.saladbowl.api.tax.law;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaxLawVersionRepository extends JpaRepository<TaxLawVersion, Long> {

    List<TaxLawVersion> findByTaxYearOrderByVersionNoDesc(int taxYear);

    /** 현재 적용 버전: 번호와 무관하게 가장 최근에 적용한 것. 적용 시각이 같으면 나중에 만든 것. */
    Optional<TaxLawVersion> findFirstByTaxYearAndStatusOrderByAppliedAtDescIdDesc(int taxYear, TaxLawStatus status);

    /** 수정·삭제·적용이 같은 버전에서 겹칠 때 한 번에 하나만 상태를 보고 바꾸도록 행을 잠근다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from TaxLawVersion v where v.id = :id")
    Optional<TaxLawVersion> findByIdForUpdate(@Param("id") long id);
}
```

- [ ] **Step 6: DTO** — `main/tax/law/TaxLawDtos.java`. `UpdateRequest`의 Bean Validation은 형태만 본다. 초안은 범위를 벗어난 값도 저장할 수 있어야 한다(AC-21은 "범위를 벗어난 초안은 적용되지 않는다").

```java
package com.saladbowl.api.tax.law;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

public final class TaxLawDtos {

    private TaxLawDtos() {
    }

    public record CreateRequest(@NotNull @Min(1000) @Max(9999) Integer taxYear) {
    }

    /**
     * 초안 전체 교체. 설정값은 비워 둘 수 있고(null) 범위 검사는 적용할 때 한다.
     * 여기서는 DB 열에 들어갈 수 있는 형태(길이, 단계 3칸)만 본다.
     */
    public record UpdateRequest(
            @NotNull Long rowVersion,
            Integer minSpendRatePct,
            Long bracketBoundary,
            Integer rateCreditPct,
            Integer rateDebitCashPct,
            Integer rateCulturePct,
            Integer rateMarketPct,
            Integer rateTransitPct,
            @Size(min = 3, max = 3) List<Long> basicLimitLow,
            @Size(min = 3, max = 3) List<Long> basicLimitHigh,
            Long extraLimitLow,
            Long extraLimitHigh,
            @Size(max = 200) String basisLawName,
            @Size(max = 200) String basisArticle,
            @Size(max = 500) String basisUrl,
            LocalDate periodStart,
            LocalDate periodEnd,
            @Size(max = 1000) String memo) {
    }

    /** basicLimitLow·basicLimitHigh는 자녀등 0명 / 1명 / 2명 이상 순서의 3칸이다. */
    public record VersionResponse(
            long id,
            int taxYear,
            int versionNo,
            TaxLawStatus status,
            int algorithmVersion,
            Integer minSpendRatePct,
            Long bracketBoundary,
            Integer rateCreditPct,
            Integer rateDebitCashPct,
            Integer rateCulturePct,
            Integer rateMarketPct,
            Integer rateTransitPct,
            List<Long> basicLimitLow,
            List<Long> basicLimitHigh,
            Long extraLimitLow,
            Long extraLimitHigh,
            boolean childTiersApply,
            String basisLawName,
            String basisArticle,
            String basisUrl,
            LocalDate periodStart,
            LocalDate periodEnd,
            String memo,
            String createdByNickname,
            String appliedByNickname,
            OffsetDateTime createdAt,
            OffsetDateTime appliedAt,
            long rowVersion) {

        public static VersionResponse of(TaxLawVersion v, String createdByNickname, String appliedByNickname) {
            // List.of는 null을 받지 않는다. 초안의 빈 칸을 null로 내려야 한다.
            List<Long> low = Arrays.asList(v.getBasicLimitLow0(), v.getBasicLimitLow1(), v.getBasicLimitLow2());
            List<Long> high = Arrays.asList(v.getBasicLimitHigh0(), v.getBasicLimitHigh1(), v.getBasicLimitHigh2());
            return new VersionResponse(v.getId(), v.getTaxYear(), v.getVersionNo(), v.getStatus(),
                    v.getAlgorithmVersion(), v.getMinSpendRatePct(), v.getBracketBoundary(), v.getRateCreditPct(),
                    v.getRateDebitCashPct(), v.getRateCulturePct(), v.getRateMarketPct(), v.getRateTransitPct(),
                    low, high, v.getExtraLimitLow(), v.getExtraLimitHigh(), differs(low) || differs(high),
                    v.getBasisLawName(), v.getBasisArticle(), v.getBasisUrl(), v.getPeriodStart(), v.getPeriodEnd(),
                    v.getMemo(), createdByNickname, appliedByNickname, v.getCreatedAt(), v.getAppliedAt(),
                    v.getRowVersion());
        }

        private static boolean differs(List<Long> tiers) {
            return !Objects.equals(tiers.get(0), tiers.get(1)) || !Objects.equals(tiers.get(1), tiers.get(2));
        }
    }
}
```

- [ ] **Step 7: 서비스** — `main/tax/law/TaxLawService.java`

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/** 세법 버전 관리. 서비스 관리자 검사는 TaxAdminInterceptor가 /tax/admin/** 경로에서 한다. */
@Service
public class TaxLawService {

    // 한 문장으로 올리고 받는다. 카운터 행의 잠금이 커밋까지 유지되므로 동시에 만든 초안도 번호가 겹치지 않고,
    // 초안 저장이 실패해 롤백되면 번호도 함께 되돌아간다.
    private static final String NEXT_VERSION_NO = """
            INSERT INTO tax_law_year_counters (tax_year, last_version_no) VALUES (?, 1)
            ON CONFLICT (tax_year) DO UPDATE SET last_version_no = tax_law_year_counters.last_version_no + 1
            RETURNING last_version_no
            """;

    private final TaxLawVersionRepository versions;
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    public TaxLawService(TaxLawVersionRepository versions, UserRepository users, JdbcTemplate jdbc) {
        this.versions = versions;
        this.users = users;
        this.jdbc = jdbc;
    }

    @Transactional
    public VersionResponse createDraft(long adminId, int taxYear) {
        Integer versionNo = jdbc.queryForObject(NEXT_VERSION_NO, Integer.class, taxYear);
        TaxLawVersion draft = TaxLawVersion.draft(taxYear, versionNo, adminId);
        currentApplied(taxYear).ifPresent(draft::copyValuesFrom);
        return toAdminResponse(versions.save(draft));
    }

    @Transactional(readOnly = true)
    public List<VersionResponse> list(int taxYear) {
        return versions.findByTaxYearOrderByVersionNoDesc(taxYear).stream().map(this::toAdminResponse).toList();
    }

    @Transactional(readOnly = true)
    public VersionResponse get(long id) {
        return toAdminResponse(versions.findById(id).orElseThrow(TaxLawService::notFound));
    }

    @Transactional
    public VersionResponse updateDraft(long id, UpdateRequest request) {
        TaxLawVersion draft = lockDraft(id);
        if (draft.getRowVersion() != request.rowVersion()) {
            throw new ApiException(ErrorCode.CONFLICT, "tax law version was modified elsewhere");
        }
        draft.edit(request);
        // 응답에 올라간 rowVersion을 싣기 위해 여기서 반영한다.
        return toAdminResponse(versions.saveAndFlush(draft));
    }

    @Transactional
    public void deleteDraft(long id) {
        versions.delete(lockDraft(id));
    }

    /** 회원용: 그 귀속연도의 현재 적용 버전. 작성자·적용자 닉네임은 내리지 않는다. */
    @Transactional(readOnly = true)
    public VersionResponse current(int taxYear) {
        return currentApplied(taxYear).map(v -> VersionResponse.of(v, null, null))
                .orElseThrow(TaxLawService::notFound);
    }

    public Optional<TaxLawVersion> currentApplied(int taxYear) {
        return versions.findFirstByTaxYearAndStatusOrderByAppliedAtDescIdDesc(taxYear, TaxLawStatus.APPLIED);
    }

    /** 행을 잠그고 초안인지 확인한다. 잠금 뒤에 상태를 보므로 동시에 적용된 버전은 여기서 409가 된다. */
    private TaxLawVersion lockDraft(long id) {
        TaxLawVersion version = versions.findByIdForUpdate(id).orElseThrow(TaxLawService::notFound);
        if (version.getStatus() == TaxLawStatus.APPLIED) {
            throw new ApiException(ErrorCode.CONFLICT, "applied tax law version cannot be changed");
        }
        return version;
    }

    private VersionResponse toAdminResponse(TaxLawVersion version) {
        return VersionResponse.of(version, nickname(version.getCreatedBy()), nickname(version.getAppliedBy()));
    }

    // shortcut: 버전마다 회원을 따로 읽는다(연도당 버전이 몇 개뿐이다). 목록이 느려지면 한 번에 읽도록 바꾼다.
    private String nickname(Long userId) {
        return userId == null ? null : users.findById(userId).map(User::getNickname).orElse(null);
    }

    private static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "tax law version not found");
    }
}
```

- [ ] **Step 8: 컨트롤러** — `main/tax/law/TaxLawAdminController.java`, `main/tax/law/TaxLawController.java`. `@RequestParam`의 `@Min`·`@Max` 위반은 `HandlerMethodValidationException`이고 `GlobalExceptionHandler`가 400 `VALIDATION_FAILED`로 바꾼다.

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.tax.law.TaxLawDtos.CreateRequest;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 서비스 관리자 전용. 권한은 TaxAdminInterceptor가 /tax/admin/** 에서 요청마다 DB로 확인한다. */
@RestController
@RequestMapping("/tax/admin/law-versions")
public class TaxLawAdminController {

    private final TaxLawService service;

    public TaxLawAdminController(TaxLawService service) {
        this.service = service;
    }

    @GetMapping
    public List<VersionResponse> list(@RequestParam @Min(1000) @Max(9999) int year) {
        return service.list(year);
    }

    @PostMapping
    public ResponseEntity<VersionResponse> create(@CurrentUser Long userId,
                                                  @Valid @RequestBody CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDraft(userId, request.taxYear()));
    }

    @GetMapping("/{id}")
    public VersionResponse get(@PathVariable long id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public VersionResponse update(@PathVariable long id, @Valid @RequestBody UpdateRequest request) {
        return service.updateDraft(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.deleteDraft(id);
        return ResponseEntity.noContent().build();
    }
}
```

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 회원 누구나 읽는 적용된 세법 기준. 초안은 이 경로로 나가지 않는다. */
@RestController
public class TaxLawController {

    private final TaxLawService service;

    public TaxLawController(TaxLawService service) {
        this.service = service;
    }

    @GetMapping("/tax/law-versions/current")
    public VersionResponse current(@RequestParam @Min(1000) @Max(9999) int year) {
        return service.current(year);
    }
}
```

- [ ] **Step 9: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxLaw*' --tests '*TaxAdminAccessTest'`
Expected: `BUILD SUCCESSFUL`. `TaxLawAdminApiTest` 13건, `TaxLawConcurrencyTest` 1건, `TaxAdminAccessTest` 5건 통과.

- [ ] **Step 10: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 11: 커밋(컨트롤러)**

```bash
git add apps/api/src/main/resources/db/migration/V9__create_tax_law_versions.sql apps/api/src/main/java/com/saladbowl/api/tax/law apps/api/src/test/java/com/saladbowl/api/support/TestTaxLaws.java apps/api/src/test/java/com/saladbowl/api/tax
git commit -m "feat(api): 세법 버전 초안 만들기·조회·수정·삭제와 현재 적용 버전 조회" -m "Co-Authored-By: Codex (gpt-6-astra) <noreply@openai.com>"
```

---

### Task 2.3: 검증·적용·현재 적용 버전 (TAX-63, 64, 61, 72)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `main/tax/law/TaxLawValidator.java`
- Modify: `main/tax/law/TaxLawDtos.java`, `TaxLawVersion.java`, `TaxLawService.java`, `TaxLawAdminController.java`
- Test: `test/tax/law/TaxLawValidatorTest.java`(생성), `test/tax/law/TaxLawApplyApiTest.java`(생성), `test/tax/law/TaxLawConcurrencyTest.java`(교체)

**Interfaces:**
- Consumes: Task 2.2의 `TaxLawVersion`(getter, `draft`, `edit`), `TaxLawService.lockDraft(long id)`(행 잠금 + 초안이 아니면 409), `TaxLawService.currentApplied`, `TaxLawDtos.UpdateRequest`·`VersionResponse`, `TestTaxLaws`, `TaxLawConcurrencyTest.runTogether`.
- Produces:
  - `TaxLawDtos.FieldError(String field, String message)`, `TaxLawDtos.ValidationResponse(List<FieldError> errors)`.
  - `TaxLawValidator.validate(TaxLawVersion): List<FieldError>`(패키지 안에서만 쓴다).
  - `TaxLawVersion.apply(long adminId, OffsetDateTime now)`.
  - `TaxLawService.validate(long id): ValidationResponse`, `TaxLawService.apply(long adminId, long id): VersionResponse`.
  - HTTP: `POST /tax/admin/law-versions/{id}/validate`, `POST /tax/admin/law-versions/{id}/apply`.

검증 규칙(PRD 9장, TAX-63·64, 메모는 선택 — 2026-11-13 확정). 오류의 `field`는 응답 필드 이름이고 단계는 `basicLimitLow[1]`처럼 쓴다. 오류 순서는 아래 표 순서다.

| 대상 | 규칙 | 메시지 |
|---|---|---|
| 비율 6개 `minSpendRatePct`, `rateCreditPct`, `rateDebitCashPct`, `rateCulturePct`, `rateMarketPct`, `rateTransitPct` | 빈 값 없음 | `값을 입력해야 합니다` |
| | 0~100(정수 열이라 정수다) | `0~100 사이여야 합니다` |
| 금액 9개 `bracketBoundary`, `basicLimitLow[0..2]`, `basicLimitHigh[0..2]`, `extraLimitLow`, `extraLimitHigh` | 빈 값 없음(급여구간 경계·자녀등 단계 포함) | `값을 입력해야 합니다` |
| | 0 이상 | `0 이상이어야 합니다` |
| | 9,999,999,999,999 이하 | `9,999,999,999,999원 이하로 입력하세요` |
| `basisLawName`, `basisArticle`, `basisUrl` | 빈 값·공백만 있는 값 없음 | `값을 입력해야 합니다` |
| `basisUrl` | `http://` 또는 `https://`로 시작 | `http:// 또는 https://로 시작해야 합니다` |
| `periodStart`, `periodEnd` | 빈 값 없음 | `값을 입력해야 합니다` |
| `periodEnd` | `periodStart` ≤ `periodEnd` | `종료일이 시작일보다 빠릅니다` |
| `memo` | 검사하지 않음 | — |

- [ ] **Step 1: 실패하는 테스트 작성**

`test/tax/law/TaxLawValidatorTest.java`를 만든다(DB 없이 규칙만).

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.FieldError;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 적용 전 검증 규칙(TAX-63, TAX-64, AC-21). DB 없이 규칙만 본다. */
class TaxLawValidatorTest {

    private static final LocalDate START = LocalDate.of(2026, 1, 1);
    private static final LocalDate END = LocalDate.of(2026, 12, 31);

    /** 2026 귀속 값으로 채운 초안. */
    private static TaxLawVersion draft(UpdateRequest request) {
        TaxLawVersion version = TaxLawVersion.draft(2026, 1, 1L);
        version.edit(request);
        return version;
    }

    private static UpdateRequest request(Integer minSpend, Integer credit, Integer debitCash, Integer culture,
                                         Integer market, Integer transit, Long boundary, List<Long> low,
                                         List<Long> high, Long extraLow, Long extraHigh, String lawName,
                                         String article, String url, LocalDate start, LocalDate end, String memo) {
        return new UpdateRequest(0L, minSpend, boundary, credit, debitCash, culture, market, transit, low, high,
                extraLow, extraHigh, lawName, article, url, start, end, memo);
    }

    private static UpdateRequest valid2026() {
        return request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2",
                "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389", START, END, null);
    }

    private static List<String> fields(TaxLawVersion version) {
        return TaxLawValidator.validate(version).stream().map(FieldError::field).toList();
    }

    @Test
    void values2026PassWithoutMemo() {
        assertThat(TaxLawValidator.validate(draft(valid2026()))).isEmpty();
    }

    @Test
    void blankDraftReportsEveryRequiredFieldButNotMemo() {
        assertThat(fields(TaxLawVersion.draft(2026, 1, 1L))).containsExactly(
                "minSpendRatePct", "rateCreditPct", "rateDebitCashPct", "rateCulturePct", "rateMarketPct",
                "rateTransitPct", "bracketBoundary", "basicLimitLow[0]", "basicLimitLow[1]", "basicLimitLow[2]",
                "basicLimitHigh[0]", "basicLimitHigh[1]", "basicLimitHigh[2]", "extraLimitLow", "extraLimitHigh",
                "basisLawName", "basisArticle", "basisUrl", "periodStart", "periodEnd");
    }

    @Test
    void ratesMustBeBetween0And100() {
        TaxLawVersion outOfRange = draft(request(101, -1, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(outOfRange)).containsExactly(
                new FieldError("minSpendRatePct", "0~100 사이여야 합니다"),
                new FieldError("rateCreditPct", "0~100 사이여야 합니다"));

        TaxLawVersion edges = draft(request(0, 100, 0, 100, 0, 100, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(edges)).isEmpty();
    }

    @Test
    void amountsMustBeZeroOrMore() {
        TaxLawVersion negative = draft(request(25, 15, 30, 30, 40, 40, -1L,
                List.of(3_000_000L, -1L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, -1L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(negative)).containsExactly(
                new FieldError("bracketBoundary", "0 이상이어야 합니다"),
                new FieldError("basicLimitLow[1]", "0 이상이어야 합니다"),
                new FieldError("extraLimitHigh", "0 이상이어야 합니다"));

        TaxLawVersion zeros = draft(request(25, 15, 30, 30, 40, 40, 0L,
                List.of(0L, 0L, 0L), List.of(0L, 0L, 0L), 0L, 0L,
                "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(TaxLawValidator.validate(zeros)).isEmpty();
    }

    @Test
    void childTiersMustAllBeFilled() {
        TaxLawVersion missingTier = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                Arrays.asList(3_000_000L, null, 4_000_000L), Arrays.asList(2_500_000L, 2_750_000L, null),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, END, null));
        assertThat(fields(missingTier)).containsExactly("basicLimitLow[1]", "basicLimitHigh[2]");
    }

    @Test
    void basisAndPeriodAreRequired() {
        TaxLawVersion missing = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "   ", null, "", null, null, "메모만 있음"));
        assertThat(fields(missing))
                .containsExactly("basisLawName", "basisArticle", "basisUrl", "periodStart", "periodEnd");
    }

    @Test
    void basisUrlMustBeHttp() {
        TaxLawVersion script = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "javascript:alert(1)", START, END, null));
        assertThat(TaxLawValidator.validate(script))
                .containsExactly(new FieldError("basisUrl", "http:// 또는 https://로 시작해야 합니다"));
    }

    @Test
    void periodStartMustNotBeAfterEnd() {
        TaxLawVersion reversed = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", END, START, null));
        assertThat(TaxLawValidator.validate(reversed))
                .containsExactly(new FieldError("periodEnd", "종료일이 시작일보다 빠릅니다"));

        TaxLawVersion sameDay = draft(request(25, 15, 30, 30, 40, 40, 70_000_000L,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2", "https://www.law.go.kr/", START, START, null));
        assertThat(TaxLawValidator.validate(sameDay)).isEmpty();
    }
}
```

`test/tax/law/TaxLawApplyApiTest.java`를 만든다. 권한·삭제 경계(비관리자, 그룹 ADMIN, 회수된 관리자, 지운 초안, 적용본의 수정·삭제·재적용)를 모두 API로 확인한다.

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import com.saladbowl.api.support.TestTaxLaws;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxLaws.URL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 검증·적용·현재 적용 버전(TAX-61, 63, 64, 67, 72, AC-19, AC-21, AC-39). */
class TaxLawApplyApiTest extends IntegrationTest {

    private static final String CURRENT = "/tax/law-versions/current";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser admin;

    @BeforeEach
    void createAdmin() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        TestAdmins.grant(jdbc, admin.id());
    }

    /** 2026 값 본문에서 한 필드만 바꾼다. value는 JSON 표기 그대로다(예: "null", "101", "\"글자\""). */
    private static String values2026With(String field, String value) {
        String body = TestTaxLaws.values2026(0);
        String changed = body.replaceAll("\"" + field + "\": [^\\n]*?(,?)\\n", "\"" + field + "\": " + value + "$1\n");
        assertThat(changed).as("field %s replaced", field).isNotEqualTo(body);
        return changed;
    }

    private String statusOf(long id) {
        return jdbc.queryForObject("SELECT status FROM tax_law_versions WHERE id = ?", String.class, id);
    }

    @Test
    void applyRecordsWhoAndWhenAndMakesTheVersionCurrent() throws Exception {
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.createdByNickname").value("관리자"))
                .andExpect(jsonPath("$.appliedByNickname").value("관리자"))
                .andExpect(jsonPath("$.appliedAt").isString())
                .andExpect(jsonPath("$.rowVersion").value(2));

        // 일반 회원도 적용된 기준은 읽는다.
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.basicLimitLow", contains(3000000, 3500000, 4000000)));
    }

    @Test
    void appliedVersionRejectsUpdateDeleteAndSecondApply() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());
        String appliedAt = jdbc.queryForObject(
                "SELECT applied_at::text FROM tax_law_versions WHERE id = ?", String.class, id);

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TestTaxLaws.values2026(2).replace("\"minSpendRatePct\": 25", "\"minSpendRatePct\": 20")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        mvc.perform(get(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.minSpendRatePct").value(25))
                .andExpect(jsonPath("$.rowVersion").value(2));
        assertThat(jdbc.queryForObject("SELECT applied_at::text FROM tax_law_versions WHERE id = ?", String.class, id))
                .isEqualTo(appliedAt);
    }

    @Test
    void blankDraftIsNotApplied() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errors", hasSize(20)))
                .andExpect(jsonPath("$.errors[0].field").value("minSpendRatePct"))
                .andExpect(jsonPath("$.errors[0].message").value("값을 입력해야 합니다"));
        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value("minSpendRatePct: 값을 입력해야 합니다"));

        assertThat(statusOf(id)).isEqualTo("DRAFT");
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void draftWithOneBadValueIsNotApplied() throws Exception {
        // {바꿀 필드, JSON 값, 오류가 나는 필드}
        String[][] cases = {
                {"minSpendRatePct", "101", "minSpendRatePct"},
                {"rateCreditPct", "-1", "rateCreditPct"},
                {"rateDebitCashPct", "null", "rateDebitCashPct"},
                {"rateCulturePct", "101", "rateCulturePct"},
                {"rateMarketPct", "-1", "rateMarketPct"},
                {"rateTransitPct", "null", "rateTransitPct"},
                {"bracketBoundary", "-1", "bracketBoundary"},
                {"basicLimitLow", "[3000000, null, 4000000]", "basicLimitLow[1]"},
                {"basicLimitHigh", "[2500000, 2750000, -1]", "basicLimitHigh[2]"},
                {"extraLimitLow", "null", "extraLimitLow"},
                {"extraLimitHigh", "-1", "extraLimitHigh"},
                {"basisLawName", "null", "basisLawName"},
                {"basisArticle", "\"   \"", "basisArticle"},
                {"basisUrl", "null", "basisUrl"},
                {"basisUrl", "\"javascript:alert(1)\"", "basisUrl"},
                {"periodStart", "null", "periodStart"},
                {"periodEnd", "null", "periodEnd"},
                {"periodStart", "\"2027-01-01\"", "periodEnd"},
        };
        for (String[] c : cases) {
            long id = TestTaxLaws.createDraft(mvc, admin, 2026);
            mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                            .contentType(MediaType.APPLICATION_JSON).content(values2026With(c[0], c[1])))
                    .andExpect(status().isOk());

            mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.errors", hasSize(1)))
                    .andExpect(jsonPath("$.errors[0].field").value(c[2]));
            mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
            assertThat(statusOf(id)).as("%s = %s", c[0], c[1]).isEqualTo("DRAFT");
        }
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void memoIsOptional() throws Exception {
        long id = TestTaxLaws.createDraft(mvc, admin, 2026);
        mvc.perform(put(URL + "/" + id).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(values2026With("memo", "null")))
                .andExpect(status().isOk());

        mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errors").isEmpty());
        // 검증만으로는 상태가 바뀌지 않는다.
        assertThat(statusOf(id)).isEqualTo("DRAFT");

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.memo").value(nullValue()));
    }

    @Test
    void applyingOneDraftLeavesOtherDraftsAsDrafts() throws Exception {
        long first = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        long second = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/" + second + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());

        mvc.perform(get(URL).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$[*].versionNo", contains(2, 1)))
                .andExpect(jsonPath("$[*].status", contains("APPLIED", "DRAFT")));
        // 남은 초안은 계속 고치고 지울 수 있다.
        mvc.perform(delete(URL + "/" + first).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());
    }

    @Test
    void currentIsTheMostRecentlyAppliedRegardlessOfNumber() throws Exception {
        long first = TestTaxLaws.createDraft(mvc, admin, 2026);
        long second = TestTaxLaws.createDraft(mvc, admin, 2026);
        mvc.perform(put(URL + "/" + first).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(values2026With("minSpendRatePct", "20")))
                .andExpect(status().isOk());
        mvc.perform(put(URL + "/" + second).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(TestTaxLaws.values2026(0)))
                .andExpect(status().isOk());

        // 2번을 먼저, 1번을 나중에 적용한다.
        mvc.perform(post(URL + "/" + second + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());
        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.versionNo").value(2));
        mvc.perform(post(URL + "/" + first + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());

        mvc.perform(get(CURRENT).param("year", "2026").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.minSpendRatePct").value(20));
        // 새 초안은 번호가 큰 2번이 아니라 현재 적용 버전(1번)의 값을 복사한다.
        mvc.perform(post(URL).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"taxYear\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNo").value(3))
                .andExpect(jsonPath("$.minSpendRatePct").value(20));
        // 다른 귀속연도의 현재 적용 버전에는 영향이 없다.
        mvc.perform(get(CURRENT).param("year", "2025").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void nonAdminsCannotValidateOrApply() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@test.com", "회원");
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@test.com", "그룹장");
        TestGroups.createGroup(mvc, groupAdmin, "우리집");

        for (AuthedUser user : new AuthedUser[]{member, groupAdmin}) {
            mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", user.bearer()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", user.bearer()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
        mvc.perform(post(URL + "/" + id + "/apply"))
                .andExpect(status().isUnauthorized());

        assertThat(statusOf(id)).isEqualTo("DRAFT");
    }

    @Test
    void revokedAdminCannotApplyWithTheSameToken() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        TestAdmins.revoke(jdbc, admin.id());

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden());
        assertThat(statusOf(id)).isEqualTo("DRAFT");
    }

    @Test
    void missingOrDeletedVersionReturns404() throws Exception {
        long id = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(delete(URL + "/" + id).header("Authorization", admin.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(post(URL + "/" + id + "/validate").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(post(URL + "/999999/apply").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }
}
```

`test/tax/law/TaxLawConcurrencyTest.java`를 아래 내용으로 통째로 바꾼다(테스트 두 개와 `filledDraft`가 늘었다).

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 동시에 들어온 요청이 번호를 겹쳐 쓰거나 한 버전을 두 번 바꾸지 않는지 실제 트랜잭션으로 확인한다. */
class TaxLawConcurrencyTest extends IntegrationTest {

    private static final int THREADS = 8;
    private static final int ROUNDS = 10;

    @Autowired
    UserRepository users;
    @Autowired
    TaxLawService service;
    @Autowired
    TaxLawVersionRepository versions;

    @Test
    void concurrentDraftsGetDistinctConsecutiveNumbers() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        List<Callable<String>> calls = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            calls.add(() -> Integer.toString(service.createDraft(adminId, 2026).versionNo()));
        }

        List<String> results = runTogether(calls);

        assertThat(results).containsExactlyInAnyOrder("1", "2", "3", "4", "5", "6", "7", "8");
        assertThat(versions.findByTaxYearOrderByVersionNoDesc(2026)).hasSize(THREADS);
    }

    @Test
    void concurrentAppliesOfOneDraftSucceedOnce() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        long id = filledDraft(adminId);
        List<Callable<String>> calls = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            calls.add(() -> {
                service.apply(adminId, id);
                return "OK";
            });
        }

        List<String> results = runTogether(calls);

        assertThat(results).filteredOn("OK"::equals).hasSize(1);
        assertThat(results).filteredOn("CONFLICT"::equals).hasSize(THREADS - 1);
        assertThat(versions.findById(id).orElseThrow().getStatus()).isEqualTo(TaxLawStatus.APPLIED);
    }

    @Test
    void applyRacingDeleteNeverLosesAnAppliedVersion() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        for (int round = 0; round < ROUNDS; round++) {
            long id = filledDraft(adminId);

            List<String> results = runTogether(List.of(
                    () -> {
                        service.apply(adminId, id);
                        return "APPLIED";
                    },
                    () -> {
                        service.deleteDraft(id);
                        return "DELETED";
                    }));

            // 둘 중 하나만 이긴다. 적용이 이기면 삭제는 409이고 행이 남는다. 삭제가 이기면 적용은 404다.
            if (results.contains("APPLIED")) {
                assertThat(results).as("round %d", round).containsExactly("APPLIED", "CONFLICT");
                assertThat(versions.findById(id).orElseThrow().getStatus()).isEqualTo(TaxLawStatus.APPLIED);
            } else {
                assertThat(results).as("round %d", round).containsExactly("NOT_FOUND", "DELETED");
                assertThat(versions.findById(id)).isEmpty();
            }
        }
    }

    private long filledDraft(long adminId) {
        long id = service.createDraft(adminId, 2026).id();
        service.updateDraft(id, new UpdateRequest(0L, 25, 70_000_000L, 15, 30, 30, 40, 40,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2",
                "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31), null));
        return id;
    }

    /** 모든 호출을 같은 순간에 시작한다. 결과는 반환값, ApiException이면 오류 코드 이름이다. */
    static List<String> runTogether(List<Callable<String>> calls) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(calls.size());
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<String>> futures = new ArrayList<>();
            for (Callable<String> call : calls) {
                futures.add(pool.submit(() -> {
                    if (!start.await(30, TimeUnit.SECONDS)) {
                        return "NOT_STARTED";
                    }
                    try {
                        return call.call();
                    } catch (ApiException e) {
                        return e.code().name();
                    } catch (Exception e) {
                        return e.getClass().getName();
                    }
                }));
            }
            start.countDown();
            List<String> results = new ArrayList<>();
            for (Future<String> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxLaw*'`
Expected: `compileTestJava FAILED` — `cannot find symbol: variable TaxLawValidator`, `class FieldError`, `method apply(long,long)`.

- [ ] **Step 3: DTO 추가** — `main/tax/law/TaxLawDtos.java`의 `UpdateRequest`와 `VersionResponse` 사이에 더한다.

```java
    public record FieldError(String field, String message) {
    }

    /** errors가 비어 있으면 적용할 수 있다. */
    public record ValidationResponse(List<FieldError> errors) {
    }
```

- [ ] **Step 4: 검증기** — `main/tax/law/TaxLawValidator.java`

```java
package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.FieldError;

import java.util.ArrayList;
import java.util.List;

/** 적용 전 검증(TAX-63, TAX-64). 필드 이름은 응답(VersionResponse)의 이름과 같다. 메모는 선택이라 보지 않는다. */
final class TaxLawValidator {

    private static final String REQUIRED = "값을 입력해야 합니다";

    private TaxLawValidator() {
    }

    static List<FieldError> validate(TaxLawVersion v) {
        List<FieldError> errors = new ArrayList<>();
        percent(errors, "minSpendRatePct", v.getMinSpendRatePct());
        percent(errors, "rateCreditPct", v.getRateCreditPct());
        percent(errors, "rateDebitCashPct", v.getRateDebitCashPct());
        percent(errors, "rateCulturePct", v.getRateCulturePct());
        percent(errors, "rateMarketPct", v.getRateMarketPct());
        percent(errors, "rateTransitPct", v.getRateTransitPct());
        amount(errors, "bracketBoundary", v.getBracketBoundary());
        amount(errors, "basicLimitLow[0]", v.getBasicLimitLow0());
        amount(errors, "basicLimitLow[1]", v.getBasicLimitLow1());
        amount(errors, "basicLimitLow[2]", v.getBasicLimitLow2());
        amount(errors, "basicLimitHigh[0]", v.getBasicLimitHigh0());
        amount(errors, "basicLimitHigh[1]", v.getBasicLimitHigh1());
        amount(errors, "basicLimitHigh[2]", v.getBasicLimitHigh2());
        amount(errors, "extraLimitLow", v.getExtraLimitLow());
        amount(errors, "extraLimitHigh", v.getExtraLimitHigh());
        required(errors, "basisLawName", v.getBasisLawName());
        required(errors, "basisArticle", v.getBasisArticle());
        if (required(errors, "basisUrl", v.getBasisUrl()) && !v.getBasisUrl().matches("(?i)https?://.+")) {
            // 화면이 링크로 그리는 값이다. javascript: 같은 주소를 막는다.
            errors.add(new FieldError("basisUrl", "http:// 또는 https://로 시작해야 합니다"));
        }
        boolean hasStart = required(errors, "periodStart", v.getPeriodStart());
        boolean hasEnd = required(errors, "periodEnd", v.getPeriodEnd());
        if (hasStart && hasEnd && v.getPeriodStart().isAfter(v.getPeriodEnd())) {
            errors.add(new FieldError("periodEnd", "종료일이 시작일보다 빠릅니다"));
        }
        return errors;
    }

    private static void percent(List<FieldError> errors, String field, Integer value) {
        if (required(errors, field, value) && (value < 0 || value > 100)) {
            errors.add(new FieldError(field, "0~100 사이여야 합니다"));
        }
    }

    private static void amount(List<FieldError> errors, String field, Long value) {
        if (required(errors, field, value) && value < 0) {
            errors.add(new FieldError(field, "0 이상이어야 합니다"));
        }
    }

    /** 값이 있으면 true. 없으면 오류를 더하고 false. */
    private static boolean required(List<FieldError> errors, String field, Object value) {
        if (value == null || (value instanceof String text && text.isBlank())) {
            errors.add(new FieldError(field, REQUIRED));
            return false;
        }
        return true;
    }
}
```

- [ ] **Step 5: 엔티티에 적용 메서드** — `main/tax/law/TaxLawVersion.java`의 `edit` 메서드 아래에 더한다.

```java
    /** 초안 → 적용. 호출 전에 행 잠금과 검증을 끝낸다(TaxLawService.apply). */
    public void apply(long adminId, OffsetDateTime now) {
        status = TaxLawStatus.APPLIED;
        appliedBy = adminId;
        appliedAt = now;
    }
```

- [ ] **Step 6: 서비스에 검증·적용** — `main/tax/law/TaxLawService.java`. import 세 줄을 더하고, `deleteDraft` 아래에 메서드 두 개를 더한다.

```java
import com.saladbowl.api.tax.law.TaxLawDtos.FieldError;
import com.saladbowl.api.tax.law.TaxLawDtos.ValidationResponse;
import java.time.OffsetDateTime;
```

```java
    @Transactional(readOnly = true)
    public ValidationResponse validate(long id) {
        return new ValidationResponse(
                TaxLawValidator.validate(versions.findById(id).orElseThrow(TaxLawService::notFound)));
    }

    /**
     * 검증을 통과한 초안을 적용한다. 행 잠금 안에서 상태 확인·검증·변경을 하므로 같은 버전에 대한
     * 동시 적용은 한 번만 성공하고, 동시에 온 삭제·수정과도 순서가 정해진다.
     */
    @Transactional
    public VersionResponse apply(long adminId, long id) {
        TaxLawVersion draft = lockDraft(id);
        List<FieldError> errors = TaxLawValidator.validate(draft);
        if (!errors.isEmpty()) {
            FieldError first = errors.get(0);
            throw new ApiException(ErrorCode.VALIDATION_FAILED, first.field() + ": " + first.message());
        }
        draft.apply(adminId, OffsetDateTime.now());
        return toAdminResponse(versions.saveAndFlush(draft));
    }
```

- [ ] **Step 7: 컨트롤러에 두 경로** — `main/tax/law/TaxLawAdminController.java`. import 한 줄을 더하고, `update`와 `delete` 사이에 더한다.

```java
import com.saladbowl.api.tax.law.TaxLawDtos.ValidationResponse;
```

```java
    @PostMapping("/{id}/validate")
    public ValidationResponse validate(@PathVariable long id) {
        return service.validate(id);
    }

    @PostMapping("/{id}/apply")
    public VersionResponse apply(@CurrentUser Long userId, @PathVariable long id) {
        return service.apply(userId, id);
    }
```

- [ ] **Step 8: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxLaw*' --tests '*TaxAdminAccessTest'`
Expected: `BUILD SUCCESSFUL`. `TaxLawValidatorTest` 8건, `TaxLawApplyApiTest` 10건, `TaxLawConcurrencyTest` 3건, `TaxLawAdminApiTest` 13건, `TaxAdminAccessTest` 5건 통과.

- [ ] **Step 9: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(임시 복사본에서는 전체 320건 통과).

- [ ] **Step 10: 커밋(컨트롤러)**

```bash
git add apps/api/src/main/java/com/saladbowl/api/tax/law apps/api/src/test/java/com/saladbowl/api/tax/law
git commit -m "feat(api): 세법 초안 검증과 적용" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

---

### PR 2 마무리 (컨트롤러)

- [ ] `cd apps/api && ./gradlew test` 결과를 구현 보고와 대조한다(이미 통과한 것은 변경 없이 다시 돌리지 않는다). `memoryTest`는 생략하고 PR 본문 "확인"에 이유(업로드 한도·파서·메모리 변경 없음)를 적는다.
- [ ] `api` 모드 뒤처리: `git status`에 `apps/api`·`docs/deploy.md`·`docs/architecture.md` 밖의 변경이 없는지, `~/.gradle/init.d`·`~/.gradle/gradle.properties`가 바뀌지 않았는지 확인한다.
- [ ] 브랜치 최종 리뷰: Claude Fable 5.2 서브에이전트 한 번(`review-final`). 볼 것: 요구사항 추적표의 PR 2 항목(TAX-04·05·06·60~64·67·72, AC-04·05·19·21·39)이 테스트로 덮였는지, "HTTP 인터페이스" 표와 실제 응답 필드가 같은지.
- [ ] **반론 리뷰: Codex `gpt-6-astra` / `xhigh` (`read`, 템플릿 F, 태그 `review-risk`)**. 대상은 `origin/main..HEAD`의 `apps/api` 변경이다. 깨 보라고 요청할 것:
  - 권한 우회
    - `/tax/admin/**` 인터셉터가 걸리지 않는 주소 표기가 있는가: 끝 슬래시(`/tax/admin/law-versions/`), 이중 슬래시, 대소문자(`/TAX/admin`), 퍼센트 인코딩(`%61dmin`), `;` 경로 매개변수, `/tax/admin`(뒤에 아무것도 없는 주소). 인터셉터의 경로 매칭과 `@RequestMapping`의 매칭이 같은 규칙인지.
    - ERROR dispatch·`OPTIONS` 프리플라이트·`HEAD`로 핸들러가 실행되는 길이 있는가.
    - 토큰만으로 권한이 유지되는 길: access 토큰 claim, refresh로 다시 받은 토큰, 응답 캐시. 회수 직후 같은 토큰의 요청이 403인지(테스트 `revokedAdminCannotApplyWithTheSameToken`).
    - 그룹 ADMIN·그룹 멤버 자격이 어디선가 세법 권한으로 쓰이는가(`GroupAccess` 참조가 `tax` 패키지에 없어야 한다).
    - `service_admin`을 API로 바꾸는 길이 있는가: 가입·구글 로그인·`/me`·요청 본문 바인딩으로 `User.serviceAdmin`이 채워질 수 있는가.
    - 회원용 `GET /tax/law-versions/current`가 초안이나 관리자 정보(닉네임)를 내보내는가.
  - 초안 삭제·적용 경합
    - 같은 초안에 적용과 삭제가 동시에 오면 "적용됐는데 행이 없는" 결과가 나오는가. `findByIdForUpdate` 뒤에 상태를 다시 읽는지, 잠금 없이 상태를 읽는 쓰기 경로가 있는지(`lockDraft`를 거치지 않는 `save`·`delete`).
    - 같은 초안을 동시에 두 번 적용하면 `applied_by`·`applied_at`이 두 번 쓰이는가.
    - 적용과 수정(`PUT`)이 겹칠 때 검증을 통과하지 않은 값이 적용본에 남는가(검증과 상태 변경이 같은 잠금·같은 트랜잭션인지).
    - 적용본을 `PUT`·`DELETE`로 바꿀 수 있는 다른 길(`rowVersion` 맞추기, 상태를 본문으로 보내기)이 있는가.
    - 번호 카운터: 동시에 만든 초안의 번호가 겹치거나, 삭제·롤백 뒤 번호가 다시 쓰이는가. 카운터와 초안 INSERT가 같은 트랜잭션인지.
    - 서로 다른 초안 둘을 동시에 적용했을 때 현재 적용 버전이 하나로 정해지는가(`applied_at` 같을 때 `id`).
    - 초안을 지울 때 다른 테이블이 그 행을 가리킬 수 있는가(PR 3의 연도 기록은 적용본만 가리켜야 한다 — 이 PR에서는 참조가 없음을 확인).
- [ ] 반론 리뷰의 발견은 원래 구현자(`resume-api`)가 고치고, 고친 범위만 Claude가 다시 본다. 이중 리뷰를 하지 않는다.
- [ ] PR 본문 "무엇"에 남길 것: 서비스 관리자 지정은 `docs/deploy.md` 13절의 SQL로만 한다는 점, 권한 검사가 경로 인터셉터 한 곳이라는 점, 번호 카운터·행 잠금 방식, "계획 초안에서 달라진 점" 목록, 이 PR은 화면이 없어 캡처가 없다는 점. `## 소모값`은 `python3 scripts/pr_usage.py` 출력으로 채운다.
- [ ] 배포 순서(`docs/deploy.md` 12절): 이 PR은 API만 바꾼다. 병합 뒤 Render 배포가 Live가 되면 V8·V9가 실행된다. 운영자는 PR 6 병합 전에 13절 SQL로 서비스 관리자를 지정한다.

---

# PR 3 — 연도 기록·입력자료·지출계획 API

반론 리뷰 대상이다(소유권·삭제). 브랜치: `feat/tax-year-api`(최신 `origin/main` `2987768`에서 만든 worktree). PR 제목 예: `feat(api): 소득공제 연도 기록·입력자료·지출계획 API`.

검증: `cd apps/api && ./gradlew test`. 업로드·파서를 건드리지 않으므로 `memoryTest`는 생략하고 PR 본문에 이유를 적는다(API CI는 둘 다 돌린다). JDK 21과 Docker(Testcontainers)가 필요하다.

이 PR의 코드와 테스트는 계획을 쓸 때 저장소 밖 임시 복사본에서 Task 순서대로 실행해 확인했다(2026-11-16, `2987768` 기준). Task마다 테스트만 먼저 넣어 실패를 보고(3.1: 15건 중 13건, 3.2: 14건 중 13건, 3.3: 11건 중 9건 실패) 구현을 넣은 뒤 `./gradlew cleanTest test` 전체를 돌렸다(3.1 뒤 344건, 3.2 뒤 358건, 3.3 뒤 369건 통과). 저장소의 앱 코드는 아직 바꾸지 않았다.

경로 줄임: `main/` = `apps/api/src/main/java/com/saladbowl/api/`, `test/` = `apps/api/src/test/java/com/saladbowl/api/`, `migration/` = `apps/api/src/main/resources/db/migration/`. 고치는 파일은 ` ```diff ` 블록으로 적었다. 저장소 루트에서 `git apply`로 넣을 수 있고, 줄 번호가 어긋나면 내용을 보고 손으로 넣는다.

> **구현 뒤 주의(2026-11-17):** 반론 리뷰로 `rowVersion` 설계가 바뀌었다. 연도 기록·현금영수증 자료·지출계획의 `row_version`은 `DEFAULT 0`·`@Version` +1이 아니라 저장할 때마다 시퀀스(`tax_row_version_seq`)에서 받는 값이고, 연도 `DELETE`는 `?rowVersion=`을 받는다. 아래 Task의 코드 블록 중 이와 다른 부분(예: 만든 뒤 `rowVersion` 0, `rowVersion` 없는 연도 `DELETE`, `DEFAULT 0`)은 구현 전 초안이고, 위 설계 문단과 실제 코드가 우선한다.

## 데이터 설계 (`V10__create_tax_records.sql`)

- `tax_year_records`: `id BIGSERIAL PK`, `owner_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE`, `tax_year INTEGER NOT NULL`, `total_salary BIGINT NOT NULL`(1~9,999,999,999,999), `work_start_month`·`work_end_month`(`INTEGER NOT NULL`, 1~12, 시작 ≤ 종료), `child_count INTEGER NOT NULL DEFAULT 0`(0 이상), `law_version_id BIGINT`(NULL = 그 연도에 적용 버전이 아직 없음), `row_version BIGINT NOT NULL DEFAULT 0`, `created_at`, `updated_at`, `UNIQUE (owner_id, tax_year)`.
- 세법 버전 FK는 `(law_version_id, tax_year) → tax_law_versions (id, tax_year)` 복합 FK다. PRD 9장의 "세법 버전의 귀속연도와 일치"를 DB가 지킨다. 이를 위해 V10이 `tax_law_versions`에 `UNIQUE (id, tax_year)`를 더한다(기존 migration 파일은 고치지 않는다). `ON DELETE` 동작은 두지 않는다: 연도 기록이 가리키는 버전은 적용본뿐이고 적용본은 지울 수 없다.
- `tax_card_statements`: `id`, `record_id BIGINT NOT NULL REFERENCES tax_year_records (id) ON DELETE CASCADE`, `issuer_name VARCHAR(50) NOT NULL`, `as_of_date DATE NOT NULL`, `memo VARCHAR(200)`, 금액 8칸 `credit_general`, `credit_market`, `credit_transit`, `credit_culture`, `debit_general`, `debit_market`, `debit_transit`, `debit_culture`(`BIGINT`, NULL = 미입력, 0~9,999,999,999,999), `row_version`, 인덱스 `(record_id)`.
- `tax_cash_receipts`: `record_id BIGINT PRIMARY KEY REFERENCES tax_year_records (id) ON DELETE CASCADE`, `as_of_date DATE NOT NULL`, `memo VARCHAR(200)`, 금액 4칸 `general`, `market`, `transit`, `culture`(NULL 허용, 0~상한), `row_version`. 행이 없으면 "한 번도 입력하지 않음 = 4칸 빈 미완료"다.
- `tax_spending_plans`: `record_id BIGINT PRIMARY KEY … ON DELETE CASCADE`, 소비구분 4 × (`_credit_fixed`, `_debit_fixed`, `_flexible`) 12칸(`BIGINT NOT NULL DEFAULT 0`, 0~상한), `row_version`.
- PRD 9장의 "소비금액" 개념은 별도 행이 아니라 자료 행의 칸(컬럼)으로 둔다. 결제수단·소비구분 종류가 바뀌면 어차피 코드 변경이기 때문이다(PRD 8.2절).
- 금액 한 칸의 상한은 `MoneyField`·세법 금액 검증(PR 2)과 같은 9,999,999,999,999원이다. 연도 합계표의 각 칸(자료를 더한 값)도 같은 상한을 넘으면 저장을 400으로 막는다. PR 4의 계산기가 "금액 ≤ 약 10^13"을 전제로 `long` 정수 연산을 하기 때문이다.

## HTTP 인터페이스 (웹 PR 5·7, API PR 4가 쓴다)

모두 로그인 회원 본인의 자료다. 경로에 회원 id가 없다. `/tax/admin/**`이 아니므로 `TaxAdminInterceptor`가 걸리지 않고 서비스 관리자 권한과 무관하다.

| 메서드·경로 | 동작 |
|---|---|
| `GET /tax/years/{year}` | 연도 기록 묶음(`TaxYearView`) 200. 요청자의 그 연도 기록이 없으면 404 |
| `PUT /tax/years/{year}` `{totalSalary, workStartMonth, workEndMonth, childCount, rowVersion?}` | `rowVersion` 없음 = 만들기 201. 연도가 한국 시각 기준 올해·전년도·다음 해가 아니면 400, 이미 있으면 409. `rowVersion` 있음 = 기본정보 수정 200. 저장된 값과 다르면 409, 기록이 없으면(다른 곳에서 삭제됨) 404이고 다시 만들지 않는다 |
| `DELETE /tax/years/{year}?rowVersion=<long>` (쿼리 필수) | 연도 기록과 딸린 카드 자료·현금영수증 자료·지출계획 삭제 204. 버전 누락·형식 오류 400, 연도 기록 없음 404, 저장된 버전과 불일치 409 순서로 판정 |
| `POST /tax/years/{year}/cards` `{issuerName, asOfDate, memo?, amounts: {8칸}}` | 카드 자료 추가 201(`TaxYearView`). 연도 기록당 50건을 넘으면 400 |
| `PUT /tax/years/{year}/cards/{cardId}` 같은 본문 + `rowVersion` | 카드 자료 수정 200. `rowVersion`이 없거나 다르면 409 |
| `DELETE /tax/years/{year}/cards/{cardId}?rowVersion=<long>` (쿼리 필수) | 카드 자료 삭제 204. `rowVersion` 누락·형식 오류는 400, 저장된 값과 다르면 409 |
| `PUT /tax/years/{year}/cash-receipt` `{asOfDate, memo?, amounts: {4칸}, rowVersion?}` | 현금영수증 자료 저장 200. 없으면 만들고(`rowVersion` 없이), 있으면 고친다(`rowVersion` 필수). 어긋나면 409. 삭제 경로는 없다(D19) — `DELETE`는 405 |
| `PUT /tax/years/{year}/plan` `{general, market, transit, culture: {creditFixed, debitFixed, flexible}, rowVersion?}` | 지출계획 저장 200. `rowVersion` 규칙은 현금영수증 자료와 같다. 자료가 미완료이거나 세법이 없어도 저장된다(TAX-75) |
| `POST /tax/years/{year}/law-version/refresh` (본문 없음) | 연도 기록의 세법 버전을 그 연도의 현재 적용 버전으로 바꿈 200. 적용 버전이 없으면 세법 참조를 유지한다. 매 저장마다 새 `rowVersion`을 받는다 |

- 공통: 비로그인 401 `UNAUTHORIZED`. `year`는 1000~9999 정수이고 아니면 400 `VALIDATION_FAILED`. 요청자에게 그 연도 기록이 없으면 딸린 경로도 모두 404 `NOT_FOUND`다. 남의 `cardId`와 없는 `cardId`는 같은 404다(403·409를 쓰지 않는다).
- 판정 순서: 본문 형식(400) → 요청자의 연도 기록(404) → 카드 자료(404) → `rowVersion`(409) → 기준일·카드사명·합계 상한(400). 400은 요청 본문만 보고 정해지므로 남의 자료가 있는지에 따라 달라지는 응답이 없다.
- 입력 규칙: 금액은 정수 토큰만 받는다(소수 `1000.5`는 400). 카드·현금영수증 금액 칸은 `null`(미입력) 또는 0~9,999,999,999,999, 지출계획 12칸은 필수이고 같은 범위다. `issuerName`은 앞뒤 공백을 뺀 뒤 1~50자, `memo`는 200자 이하(공백만 있으면 `null`), 카드사명·메모의 NUL은 저장 전 400 `VALIDATION_FAILED`, `asOfDate`는 귀속연도 안의 날짜, `childCount`는 0~99.
- 연도를 지우는 것 말고는 모든 쓰기가 `TaxYearView` 전체를 돌려준다. 웹은 응답으로 캐시를 바꾸면 되고 합계를 다시 더하지 않는다. 카드 자료 삭제는 204이므로 웹이 연도를 다시 읽는다.

`TaxYearView`: `taxYear, rowVersion, totalSalary, workStartMonth, workEndMonth, childCount, lawVersion: {id, versionNo, appliedAt, childTiersApply} | null, newerLawVersion, cards: [{id, rowVersion, issuerName, asOfDate, memo, amounts: {creditGeneral, creditMarket, creditTransit, creditCulture, debitGeneral, debitMarket, debitTransit, debitCulture}(null 가능), blankCount}](id 오름차순), cashReceipt: {rowVersion, asOfDate, memo, amounts: {general, market, transit, culture}, blankCount} | null, plan: {rowVersion, general, market, transit, culture: {creditFixed, debitFixed, flexible}} | null, totals: {creditGeneral … debitCulture, cashGeneral, cashMarket, cashTransit, cashCulture}(12칸, 미입력은 0으로 더함), blankCount(현금영수증 미입력이면 4 포함), hasInputs, asOfDateMismatch`. Task 3.1은 `lawVersion`까지, 3.2가 `cards`·`cashReceipt`·`totals`·`blankCount`·`hasInputs`·`asOfDateMismatch`를, 3.3이 `newerLawVersion`·`plan`을 더한다.

## 소유권·동시성 설계

- **소유권은 조회 조건이다.** 모든 접근은 `(owner_id = 요청자, tax_year)`로 연도 기록을 찾는 데서 시작한다(`requireOwned`·`lockOwned`). 카드 자료는 `(id, record_id = 소유한 연도 기록)`로, 현금영수증 자료·지출계획은 소유한 연도 기록의 id(기본 키)로 읽는다. 연도 기록·카드 자료를 id만으로 읽는 호출(`records.findById`, `cards.findById`)을 쓰지 않는다. 남의 자료는 "없는 것"과 같은 쿼리 결과이므로 응답도 같다. `GroupAccess`와 `ServiceAdminGuard`를 쓰지 않는다 — 그룹 ADMIN·공개 중인 같은 그룹 회원·서비스 관리자 모두 남의 자료에 닿는 길이 없다.
- **동시 수정(TAX-29)은 PR 2와 같은 방식이다: 행 잠금 + 요청의 `rowVersion` 비교.** 기존 코드에 낙관적 잠금 예외를 처리하는 선례가 없고 PR 2(`TaxLawService.lockDraft`·`requireRowVersion`)가 이 방식으로 병합됐으므로 통일한다. 쓰기는 모두 연도 기록 행을 `SELECT … FOR UPDATE`로 잠근 뒤(`TaxYearRecordRepository.findOwnedForUpdate`) 시작하므로 한 연도 기록과 딸린 자료의 쓰기는 차례로 실행된다. 잠금 안에서 고치려는 행의 `row_version`을 요청 값과 비교해 다르면 409 `CONFLICT`다. 비교 단위는 행 하나다(기본정보 / 카드 자료 한 건 / 현금영수증 자료 / 지출계획). 카드 자료를 고쳐도 기본정보의 `rowVersion`은 그대로다.
- `rowVersion`은 클라이언트가 다음 요청에 그대로 돌려보내는 불투명한 값이다. 연도 기록·현금영수증·지출계획은 생성 및 매 저장(`edit`·`refresh`, 같은 값 저장 포함)마다 공용 BIGINT 시퀀스 `tax_row_version_seq`의 `nextval`을 `row_version BIGINT`에 넣는다. V10에서 `MAXVALUE 9007199254740991 NO CYCLE`로 만들어 JS 안전 정수를 넘거나 삭제·재생성 후 값을 재사용하지 않는다. 세 엔티티의 `@Version`을 제거하고 서비스가 시퀀스를 조회해 값을 전달한다. 카드는 매번 새 id를 사용하므로 기존 `@Version` +1을 유지하며 PR 2 `TaxLawVersion`은 바꾸지 않는다. 쓰기는 부모 행 잠금 안에서 비교·저장한다. 동시 연도 생성의 UNIQUE 위반은 기존 핸들러가 409로 변환한다.
- `tax_cash_receipts`·`tax_spending_plans`는 기본 키(`record_id`)를 직접 넣으므로 `Persistable<Long>`의 새 행 플래그로 INSERT 여부를 판정한다. `@PostPersist`·`@PostLoad`에서 플래그를 끈다. `rowVersion`은 새 행 판정에 쓰지 않는다.
- **삭제.** 연도 기록과 카드 자료 모두 `?rowVersion=<long>` 쿼리가 필수이며 같은 파서를 사용한다. 누락·형식 오류는 400, 소유한 연도 기록이 없으면 404, 카드 삭제는 이어서 소유 카드가 없으면 404, 저장된 행 버전과 다르면 409다. 연도 삭제는 부모 행 잠금 안에서 연도 기록의 버전을 비교하므로 기본정보 수정·삭제 후 재생성된 기록의 오래된 삭제를 거부한다. 이 버전은 딸린 자료의 변경을 감지하지 않는 한계가 있다. 귀속연도 직접 입력 확인(D22)은 유지하며 딸린 행은 DB `ON DELETE CASCADE`로 삭제한다. 다른 귀속연도·다른 회원 자료에는 닿지 않는다.
- **세법 버전 기억(TAX-66).** 연도 기록을 만들 때 그 연도의 현재 적용 버전을 `law_version_id`에 넣는다. 없으면 NULL이고, 관리자가 그 연도의 버전을 적용하는 트랜잭션(`TaxLawService.apply`)이 같은 행 잠금 안에서 `tax_year = ? AND law_version_id IS NULL`인 연도 기록에 그 버전을 넣는다. 이미 버전이 있는 연도 기록은 회원이 `refresh`를 부를 때만 바뀐다. 자동으로 채울 때는 기본정보의 `row_version`을 올리지 않는다(회원이 열어 둔 기본정보 화면의 저장이 409가 되지 않게). `refresh`는 적용본이 없거나 같은 적용본이어도 저장할 때 새 시퀀스 값을 받는다. `TaxLawService.apply`의 NULL 채우기 UPDATE SQL은 그대로 유지한다.
- **적용과 연도 기록 만들기의 경합.** 만드는 중(커밋 전)인 연도 기록은 `apply`의 UPDATE에 보이지 않고, 그 트랜잭션은 아직 커밋되지 않은 적용 버전을 보지 못한다. 그대로 두면 적용 버전이 있는데도 `law_version_id`가 NULL로 남는다(임시 복사본에서 advisory lock을 빼고 돌려 재현했다). 그래서 귀속연도별 Postgres advisory lock(`pg_advisory_xact_lock`, 키 `'TAXL'` + 연도. 기존 `transaction/LedgerLock`과 같은 방식)을 쓴다: 연도 기록 만들기는 공유 잠금(`TaxLawService.currentAppliedForNewRecord`), `apply`는 배타 잠금을 잡는다. 만들기끼리는 서로 기다리지 않는다.
- `newerLawVersion`은 "연도 기록의 버전 ≠ 그 연도의 현재 적용 버전"이다. 둘 다 없으면 false다.
- **"올해"는 한국 시각 기준이다.** `Clock` 빈(`auth/SecurityConfig`, UTC)을 주입받아 `Asia/Seoul`로 연도를 읽는다. UTC 그대로면 1월 1일 0~9시에 전년도가 올해가 된다. 연도 범위는 만들 때만 검사한다. 범위를 벗어난 뒤에도 이미 있는 기록은 조회·수정·삭제된다. 테스트는 `TestClock`으로 올해를 2026으로 고정한다.

## 계획 초안에서 달라진 점

- 동시 수정: "JPA `@Version` + `ObjectOptimisticLockingFailureException`을 `GlobalExceptionHandler`에서 409로"를 "연도 기록 행 잠금 + 요청 `rowVersion` 비교"로 바꿨다. `GlobalExceptionHandler`를 고치지 않는다.
- 카드 자료 삭제에 `?rowVersion=`(필수)을 더했다. HTTP 표의 `PUT /tax/years/{year}`는 "있으면 수정"에서 "`rowVersion`이 없으면 만들기, 있으면 수정"으로 분명히 했다(이미 있는 연도에 `rowVersion` 없이 보내면 409).
- `TaxLawService.apply`에 NULL 채우기뿐 아니라 advisory lock을 더했고, `TaxLawService.currentAppliedForNewRecord(int)`를 더했다.
- 더한 것: 복합 FK `(law_version_id, tax_year)`와 `tax_law_versions`의 `UNIQUE (id, tax_year)`, 금액·`rowVersion`의 정수 토큰 검사(`@WholeNumber` — 기본 설정은 `40000000.7`을 40000000으로 잘라 저장한다. PR 2의 `RowVersionDeserializer`를 다시 쓴다), 연도 합계 상한 검사, 한국 시각 기준 연도, 테스트용 `TestClock`.
- 지출계획 JSON을 12칸 나열 대신 소비구분 4행 × 3칸(`general.creditFixed` …)으로 했다.
- `test/tax/law/TaxLawConcurrencyTest`와 그 `runTogether`를 `public`으로 바꿔 `tax/record` 테스트가 쓴다.
- 브랜치 이름은 예시(`feat/tax-records-api`)가 아니라 실제 브랜치 `feat/tax-year-api`다.

## 결정이 필요한 점 (기본값으로 썼다)

1. **확정: 연도 기록 삭제는 `?rowVersion=<long>` 필수.** 누락·형식 오류 400 → 기록 없음 404 → 버전 불일치 409 → 일치 204. 비교 값은 연도 기록 행의 버전이며 딸린 자료의 변경은 감지하지 않는다.
2. **카드 자료 삭제는 `?rowVersion=` 필수.** 다른 선택: 확인 한 번(D05)만 믿고 받지 않는다.
3. **이미 있는 연도에 `rowVersion` 없는 `PUT`은 409**(두 탭에서 동시에 만들기). 다른 선택: 수정으로 처리(나중 요청이 먼저 만든 값을 말없이 덮는다).
4. **`rowVersion`을 보냈는데 연도 기록이 없으면 404**이고 다시 만들지 않는다. 현금영수증 자료·지출계획은 따로 지워지지 않으므로 같은 경우 409다.
5. **연도 합계표의 한 칸이 9,999,999,999,999원을 넘는 저장은 400이고, 카드 자료는 연도 기록당 50건까지(2026-11-16 확정).** 51번째 `POST`는 400 `VALIDATION_FAILED`(판정 순서에서 합계 상한과 같은 단계). 수정·삭제는 건수와 무관하다.
6. **"올해"는 한국 시각(`Asia/Seoul`) 기준.**
7. **`childCount` 상한 99, `issuerName` 50자, `memo` 200자**(PRD는 "개발 설계에서 결정").
8. **적용 버전이 없는 상태에서 `refresh`는 세법 참조를 유지하고 200을 돌려준다**(오류가 아니다). 저장의 `rowVersion`은 새 시퀀스 값이다.

---
### Task 3.1: 연도 기록 만들기·조회·수정·삭제와 소유권 (TAX-01, 02, 03, 20, 28, 29, 65)

**담당:** Codex `gpt-6-astra` / `medium` (`api`, 소유권·잠금 설계), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `migration/V10__create_tax_records.sql`(네 테이블 모두)
- Create: `main/tax/record/TaxYearRecord.java`, `TaxYearRecordRepository.java`, `TaxRecordDtos.java`, `TaxRecordService.java`, `TaxRecordController.java`
- Create: `test/support/TestClock.java`, `test/support/TestTaxRecords.java`
- Test: `test/tax/record/TaxYearApiTest.java`(생성), `test/tax/law/TaxLawConcurrencyTest.java`(수정: `public`)

**Interfaces:**
- Consumes: `TaxLawService.currentApplied(int taxYear): Optional<TaxLawVersion>`, `TaxLawVersionRepository.findById`, `TaxLawVersion.getId()`·`getVersionNo()`·`getAppliedAt()`, `TaxLawDtos.VersionResponse.of(v, null, null, null).childTiersApply()`, `TaxLawDtos.RowVersionDeserializer`, `Clock` 빈(`auth/SecurityConfig`), `@CurrentUser Long userId`, `ApiException`, `ErrorCode.NOT_FOUND`·`CONFLICT`·`VALIDATION_FAILED`, 테스트 헬퍼 `TestAuth.signupAndLogin`, `TestGroups.createGroup`·`join`, `TestAdmins.grant`, `TestTaxLaws.createFilledDraft`·`URL`, `TaxLawConcurrencyTest.runTogether`.
- Produces:
  - `TaxYearRecord`(엔티티): `static create(long ownerId, int taxYear, YearRequest, Long lawVersionId)`, `edit(YearRequest)`, `getId(): Long`, `getOwnerId()`, `getTaxYear()`, `getTotalSalary(): long`, `getWorkStartMonth()`, `getWorkEndMonth()`, `getChildCount(): int`, `getLawVersionId(): Long`, `getRowVersion(): long`.
  - `TaxYearRecordRepository`: `findByOwnerIdAndTaxYear(long ownerId, int taxYear): Optional<TaxYearRecord>`, `findOwnedForUpdate(long ownerId, int taxYear): Optional<TaxYearRecord>`(행 잠금).
  - `TaxRecordDtos`: `MAX_AMOUNT = 9_999_999_999_999L`, `@WholeNumber`, `YearRequest(Long totalSalary, Integer workStartMonth, Integer workEndMonth, Integer childCount, Long rowVersion)`, `LawVersionRef(long id, int versionNo, OffsetDateTime appliedAt, boolean childTiersApply)`, `TaxYearView(int taxYear, long rowVersion, long totalSalary, int workStartMonth, int workEndMonth, int childCount, LawVersionRef lawVersion)`, `SavedYear(boolean created, TaxYearView view)`.
  - `TaxRecordService`: `get(long userId, int year): TaxYearView`, `saveYear(long userId, int year, YearRequest): SavedYear`, `deleteYear(long userId, int year): void`, `requireOwned(long userId, int year): TaxYearRecord`(읽기용, 없으면 `NOT_FOUND` — PR 4의 분석이 쓴다), 패키지 전용 `lockOwned(long userId, int year): TaxYearRecord`(쓰기용 행 잠금 — Task 3.2·3.3의 모든 쓰기가 이것으로 시작한다), `static requireRowVersion(long stored, Long requested)`(없거나 다르면 `CONFLICT`), `static invalid(String)`, `static notFound()`, 비공개 `view(TaxYearRecord): TaxYearView`(Task 3.2·3.3이 고친다).
  - HTTP: `GET`·`PUT`·`DELETE /tax/years/{year}`.
  - 테스트 헬퍼 `TestClock`(`set(Instant)`, `reset()`, `TestClock.Config` — 올해 2026), `TestTaxRecords.URL`, `yearBody(long totalSalary, int startMonth, int endMonth, int childCount, Long rowVersion): String`, `putYear(mvc, user, year, body): ResultActions`, `createYear(mvc, user, year)`(총급여 40,000,000원·1~12월·자녀등 0명, 끝난 뒤 `rowVersion` 0).

- [ ] **Step 1: 실패하는 테스트 작성**

테스트용 고정 시계와 준비 헬퍼를 만든다. `AuthHardeningTest.ClockConfig`와 같은 방식(`@Primary` `Clock` 빈)이다.

`test/support/TestClock.java`

```java
package com.saladbowl.api.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * 통합 테스트용 고정 시계. 연도 기록은 "올해·전년도·다음 해"만 만들 수 있으므로 테스트의 올해를 2026으로 고정한다.
 * 쓰는 테스트 클래스에 {@code @Import(TestClock.Config.class)}를 붙인다.
 */
public final class TestClock extends Clock {

    /** 한국 시각 2026-06-15 12:00. */
    public static final Instant DEFAULT = Instant.parse("2026-06-15T03:00:00Z");

    private volatile Instant now = DEFAULT;

    public void set(Instant instant) {
        now = instant;
    }

    public void reset() {
        now = DEFAULT;
    }

    @Override public ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(ZoneId zone) { return Clock.fixed(now, zone); }
    @Override public Instant instant() { return now; }

    @TestConfiguration
    public static class Config {
        @Bean
        @Primary
        TestClock testClock() {
            return new TestClock();
        }
    }
}
```

`test/support/TestTaxRecords.java`

```java
package com.saladbowl.api.support;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 통합 테스트용 소득공제 연도 기록 준비 헬퍼. 금액은 모두 합성값이다. */
public final class TestTaxRecords {

    public static final String URL = "/tax/years";

    private TestTaxRecords() {
    }

    /** 기본정보 본문. rowVersion이 null이면 새로 만드는 요청이다. */
    public static String yearBody(long totalSalary, int startMonth, int endMonth, int childCount, Long rowVersion) {
        return """
                {"totalSalary": %d, "workStartMonth": %d, "workEndMonth": %d, "childCount": %d, "rowVersion": %s}
                """.formatted(totalSalary, startMonth, endMonth, childCount, rowVersion);
    }

    public static ResultActions putYear(MockMvc mvc, TestAuth.AuthedUser user, int year, String body)
            throws Exception {
        return mvc.perform(put(URL + "/" + year).header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** 총급여 40,000,000원, 1~12월, 자녀등 0명인 연도 기록을 만든다. 만든 뒤의 rowVersion은 0이다. */
    public static void createYear(MockMvc mvc, TestAuth.AuthedUser user, int year) throws Exception {
        putYear(mvc, user, year, yearBody(40_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
    }
}
```

동시 요청 헬퍼를 다른 패키지의 테스트가 쓸 수 있게 연다.

`test/tax/law/TaxLawConcurrencyTest.java`

```diff
--- a/apps/api/src/test/java/com/saladbowl/api/tax/law/TaxLawConcurrencyTest.java
+++ b/apps/api/src/test/java/com/saladbowl/api/tax/law/TaxLawConcurrencyTest.java
@@ -21,7 +21,7 @@
 import static org.assertj.core.api.Assertions.assertThat;
 
 /** 동시에 들어온 요청이 번호를 겹쳐 쓰거나 한 버전을 두 번 바꾸지 않는지 실제 트랜잭션으로 확인한다. */
-class TaxLawConcurrencyTest extends IntegrationTest {
+public class TaxLawConcurrencyTest extends IntegrationTest {
 
     private static final int THREADS = 8;
     private static final int ROUNDS = 10;
@@ -141,7 +141,7 @@
     }
 
     /** 모든 호출을 같은 순간에 시작한다. 결과는 반환값, ApiException이면 오류 코드 이름이다. */
-    static List<String> runTogether(List<Callable<String>> calls) throws Exception {
+    public static List<String> runTogether(List<Callable<String>> calls) throws Exception {
         ExecutorService pool = Executors.newFixedThreadPool(calls.size());
         try {
             CountDownLatch start = new CountDownLatch(1);
```

테스트를 만든다. 경로에 회원 id가 없으므로 "남의 연도를 요청"은 "같은 주소가 요청자 자신의 자료만 준다"로 확인한다(그룹 ADMIN·같은 그룹에서 공개 중인 회원·서비스 관리자 모두).

`test/tax/record/TaxYearApiTest.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestGroups;
import com.saladbowl.api.support.TestTaxLaws;
import com.saladbowl.api.tax.law.TaxLawConcurrencyTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.putYear;
import static com.saladbowl.api.support.TestTaxRecords.yearBody;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 연도 기록 만들기·조회·수정·삭제와 소유권
 * (TAX-01, 02, 03, 20, 28, 29, 65, AC-01, 02, 03, 15, 20, 22, 30, 33). 테스트의 올해는 2026이다.
 */
@Import(TestClock.Config.class)
class TaxYearApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TestClock clock;

    AuthedUser owner;

    @BeforeEach
    void signUp() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
    }

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    private int rowCount(long ownerId) {
        return jdbc.queryForObject("SELECT count(*) FROM tax_year_records WHERE owner_id = ?", Integer.class, ownerId);
    }

    private long salaryOf(long ownerId, int year) {
        return jdbc.queryForObject("SELECT total_salary FROM tax_year_records WHERE owner_id = ? AND tax_year = ?",
                Long.class, ownerId, year);
    }

    @Test
    void memberWithoutAGroupCreatesAndReadsOwnYear() throws Exception {
        putYear(mvc, owner, 2026, yearBody(40_000_000L, 3, 12, 1, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.taxYear").value(2026))
                .andExpect(jsonPath("$.rowVersion").value(0))
                .andExpect(jsonPath("$.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.workStartMonth").value(3))
                .andExpect(jsonPath("$.workEndMonth").value(12))
                .andExpect(jsonPath("$.childCount").value(1))
                // 적용된 세법 버전이 없는 연도도 저장된다(TAX-65, AC-20).
                .andExpect(jsonPath("$.lawVersion").value(nullValue()));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.workStartMonth").value(3));
    }

    @Test
    void missingYearIsNotFound() throws Exception {
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void groupMembershipDoesNotChangeAccess() throws Exception {
        createYear(mvc, owner, 2026);
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@example.test", "그룹장");
        long groupId = TestGroups.createGroup(mvc, groupAdmin, "합성 그룹");

        TestGroups.join(mvc, groupAdmin, owner, groupId);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000));

        mvc.perform(delete("/groups/" + groupId + "/members/me").header("Authorization", owner.bearer()))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000));
    }

    @Test
    void sharingMemberGroupAdminAndServiceAdminCannotReachAnotherMembersYear() throws Exception {
        createYear(mvc, owner, 2026);
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@example.test", "그룹장");
        AuthedUser member = TestAuth.signupAndLogin(mvc, "member@example.test", "멤버");
        AuthedUser serviceAdmin = TestAuth.signupAndLogin(mvc, "service-admin@example.test", "관리자");
        TestAdmins.grant(jdbc, serviceAdmin.id());
        long groupId = TestGroups.createGroup(mvc, groupAdmin, "합성 그룹");
        TestGroups.join(mvc, groupAdmin, owner, groupId);
        TestGroups.join(mvc, groupAdmin, member, groupId);
        for (AuthedUser sharing : new AuthedUser[]{owner, member}) {
            mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", sharing.bearer())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
                    .andExpect(status().is2xxSuccessful());
        }

        // 경로에 회원 id가 없다. 같은 주소는 항상 요청자의 자료이고, 요청자에게 그 연도 기록이 없으면 404다.
        for (AuthedUser other : new AuthedUser[]{groupAdmin, member, serviceAdmin}) {
            mvc.perform(get(URL + "/2026").header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
            putYear(mvc, other, 2026, yearBody(1L, 1, 1, 0, 0L)).andExpect(status().isNotFound());
            mvc.perform(delete(URL + "/2026").header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound());
        }
        assertThat(salaryOf(owner.id(), 2026)).isEqualTo(40_000_000L);

        // 다른 회원이 같은 연도를 만들면 자기 기록이 따로 생기고 서로의 값이 섞이지 않는다.
        putYear(mvc, serviceAdmin, 2026, yearBody(90_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
        mvc.perform(get(URL + "/2026").header("Authorization", serviceAdmin.bearer()))
                .andExpect(jsonPath("$.totalSalary").value(90_000_000));
        mvc.perform(delete(URL + "/2026").header("Authorization", serviceAdmin.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(40_000_000));
        assertThat(rowCount(owner.id())).isEqualTo(1);
    }

    @Test
    void savingAgainWithRowVersionUpdatesTheOneRecord() throws Exception {
        createYear(mvc, owner, 2026);

        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 2, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSalary").value(52_000_000))
                .andExpect(jsonPath("$.childCount").value(2))
                .andExpect(jsonPath("$.rowVersion").value(1));

        assertThat(rowCount(owner.id())).isEqualTo(1);
    }

    @Test
    void creatingAnExistingYearIsConflictAndKeepsTheFirstValues() throws Exception {
        createYear(mvc, owner, 2026);

        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        assertThat(rowCount(owner.id())).isEqualTo(1);
        assertThat(salaryOf(owner.id(), 2026)).isEqualTo(40_000_000L);
    }

    @Test
    void creatingTheSameYearTwiceAtOnceKeepsOneRecord() throws Exception {
        List<Callable<String>> calls = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            long salary = 40_000_000L + i;
            calls.add(() -> Integer.toString(putYear(mvc, owner, 2026, yearBody(salary, 1, 12, 0, null))
                    .andReturn().getResponse().getStatus()));
        }

        List<String> results = TaxLawConcurrencyTest.runTogether(calls);

        // 먼저 만든 요청만 201이고 나머지는 UNIQUE (owner_id, tax_year) 위반 또는 rowVersion 없음으로 409다.
        assertThat(results).containsExactlyInAnyOrder("201", "409", "409", "409");
        assertThat(rowCount(owner.id())).isEqualTo(1);
    }

    @Test
    void staleRowVersionIsConflictAndKeepsTheFirstSave() throws Exception {
        createYear(mvc, owner, 2026);
        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, 0L)).andExpect(status().isOk());

        putYear(mvc, owner, 2026, yearBody(61_000_000L, 1, 12, 0, 0L))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        assertThat(salaryOf(owner.id(), 2026)).isEqualTo(52_000_000L);
    }

    @Test
    void updatingAYearDeletedElsewhereIsNotFoundAndDoesNotRecreateIt() throws Exception {
        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, 0L)).andExpect(status().isNotFound());

        assertThat(rowCount(owner.id())).isZero();
    }

    @Test
    void rejectsInvalidBasicInfo() throws Exception {
        String[] invalid = {
                yearBody(40_000_000L, 7, 6, 0, null),              // 시작월 > 종료월
                yearBody(0L, 1, 12, 0, null),                      // 총급여 0
                yearBody(-1L, 1, 12, 0, null),
                yearBody(10_000_000_000_000L, 1, 12, 0, null),     // 상한 초과
                yearBody(40_000_000L, 0, 12, 0, null),
                yearBody(40_000_000L, 1, 13, 0, null),
                yearBody(40_000_000L, 1, 12, -1, null),
                "{\"workStartMonth\": 1, \"workEndMonth\": 12, \"childCount\": 0}",
                "{\"totalSalary\": 40000000, \"workStartMonth\": 1, \"workEndMonth\": 12}",
                "{\"totalSalary\": 40000000.7, \"workStartMonth\": 1, \"workEndMonth\": 12, \"childCount\": 0}",
                "{\"totalSalary\": 40000000, \"workStartMonth\": 1, \"workEndMonth\": 12, \"childCount\": 0,"
                        + " \"rowVersion\": 0.5}",
                ""
        };
        for (String body : invalid) {
            putYear(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(rowCount(owner.id())).isZero();
    }

    @Test
    void onlyThisYearAndItsNeighborsCanBeCreated() throws Exception {
        for (int year : new int[]{2024, 2028, 1000, 9999}) {
            putYear(mvc, owner, year, yearBody(40_000_000L, 1, 12, 0, null))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String year : new String[]{"999", "10000", "abc", "2026.5"}) {
            mvc.perform(put(URL + "/" + year).header("Authorization", owner.bearer())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(yearBody(40_000_000L, 1, 12, 0, null)))
                    .andExpect(status().isBadRequest());
        }
        for (int year : new int[]{2025, 2026, 2027}) {
            createYear(mvc, owner, year);
        }
        assertThat(rowCount(owner.id())).isEqualTo(3);
    }

    @Test
    void thisYearFollowsKoreanTimeAndOlderRecordsStayEditable() throws Exception {
        createYear(mvc, owner, 2025);
        // UTC로는 2026-12-31 15:30, 한국 시각으로는 2027-01-01 00:30이다.
        clock.set(Instant.parse("2026-12-31T15:30:00Z"));

        createYear(mvc, owner, 2028);
        putYear(mvc, owner, 2024, yearBody(40_000_000L, 1, 12, 0, null)).andExpect(status().isBadRequest());

        // 연도 범위는 만들 때만 본다. 범위를 벗어난 뒤에도 이미 있는 기록은 고치고 지울 수 있다.
        clock.set(Instant.parse("2028-06-15T03:00:00Z"));
        putYear(mvc, owner, 2025, yearBody(45_000_000L, 1, 12, 0, 0L)).andExpect(status().isOk());
        mvc.perform(delete(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteRemovesOnlyThatYear() throws Exception {
        createYear(mvc, owner, 2025);
        createYear(mvc, owner, 2026);

        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taxYear").value(2025));
        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void newYearRemembersTheCurrentLawVersion() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@example.test", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        long lawId = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(post(TestTaxLaws.URL + "/" + lawId + "/apply").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":1}"))
                .andExpect(status().isOk());

        putYear(mvc, owner, 2026, yearBody(40_000_000L, 1, 12, 0, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lawVersion.id").value(lawId))
                .andExpect(jsonPath("$.lawVersion.versionNo").value(1))
                .andExpect(jsonPath("$.lawVersion.appliedAt").isNotEmpty())
                // 2026 값은 자녀등 단계별 기본한도가 서로 다르다.
                .andExpect(jsonPath("$.lawVersion.childTiersApply").value(true));

        // 세법이 없는 다른 연도는 그대로 비어 있다.
        putYear(mvc, owner, 2025, yearBody(40_000_000L, 1, 12, 0, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lawVersion").value(nullValue()));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get(URL + "/2026")).andExpect(status().isUnauthorized());
        mvc.perform(put(URL + "/2026").contentType(MediaType.APPLICATION_JSON)
                        .content(yearBody(40_000_000L, 1, 12, 0, null)))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(URL + "/2026")).andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxYearApiTest'`
Expected: `15 tests completed, 13 failed`. 경로가 아직 없어 모든 요청이 404(비로그인은 401)다. `missingYearIsNotFound`와 `requiresLogin`만 그 응답이 기대와 같아 통과한다.

- [ ] **Step 3: migration**

`migration/V10__create_tax_records.sql`

```sql
-- 소득공제 자료. 회원 소유이며 연도 기록 아래에 카드 자료·현금영수증 자료·지출계획이 딸린다.
-- 금액은 원 단위 정수이고 상한은 화면의 금액 입력과 같은 9,999,999,999,999원이다.

-- 연도 기록의 세법 버전은 같은 귀속연도의 버전만 가리킨다(아래 복합 FK가 쓴다).
ALTER TABLE tax_law_versions ADD CONSTRAINT uq_tax_law_versions_id_year UNIQUE (id, tax_year);

CREATE TABLE tax_year_records (
    id               BIGSERIAL PRIMARY KEY,
    owner_id         BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    tax_year         INTEGER     NOT NULL,
    total_salary     BIGINT      NOT NULL CHECK (total_salary BETWEEN 1 AND 9999999999999),
    work_start_month INTEGER     NOT NULL CHECK (work_start_month BETWEEN 1 AND 12),
    work_end_month   INTEGER     NOT NULL CHECK (work_end_month BETWEEN work_start_month AND 12),
    child_count      INTEGER     NOT NULL DEFAULT 0 CHECK (child_count >= 0),
    -- NULL이면 그 귀속연도에 적용된 세법 버전이 아직 없다. 첫 버전이 적용될 때 채운다.
    law_version_id   BIGINT,
    row_version      BIGINT      NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tax_year_records_owner_year UNIQUE (owner_id, tax_year),
    CONSTRAINT fk_tax_year_records_law_version FOREIGN KEY (law_version_id, tax_year)
        REFERENCES tax_law_versions (id, tax_year)
);

-- 신용·체크 자료. 카드사별로 여러 건이고 금액 칸의 NULL은 미입력(모름), 0은 없음이다.
CREATE TABLE tax_card_statements (
    id             BIGSERIAL PRIMARY KEY,
    record_id      BIGINT      NOT NULL REFERENCES tax_year_records (id) ON DELETE CASCADE,
    issuer_name    VARCHAR(50) NOT NULL,
    as_of_date     DATE        NOT NULL,
    memo           VARCHAR(200),
    credit_general BIGINT CHECK (credit_general BETWEEN 0 AND 9999999999999),
    credit_market  BIGINT CHECK (credit_market BETWEEN 0 AND 9999999999999),
    credit_transit BIGINT CHECK (credit_transit BETWEEN 0 AND 9999999999999),
    credit_culture BIGINT CHECK (credit_culture BETWEEN 0 AND 9999999999999),
    debit_general  BIGINT CHECK (debit_general BETWEEN 0 AND 9999999999999),
    debit_market   BIGINT CHECK (debit_market BETWEEN 0 AND 9999999999999),
    debit_transit  BIGINT CHECK (debit_transit BETWEEN 0 AND 9999999999999),
    debit_culture  BIGINT CHECK (debit_culture BETWEEN 0 AND 9999999999999),
    row_version    BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX idx_tax_card_statements_record ON tax_card_statements (record_id);

-- 현금영수증 자료. 연도 기록당 하나다. 행이 없으면 한 번도 입력하지 않은 것(4칸이 빈 미완료)이다.
CREATE TABLE tax_cash_receipts (
    record_id   BIGINT PRIMARY KEY REFERENCES tax_year_records (id) ON DELETE CASCADE,
    as_of_date  DATE   NOT NULL,
    memo        VARCHAR(200),
    general     BIGINT CHECK (general BETWEEN 0 AND 9999999999999),
    market      BIGINT CHECK (market BETWEEN 0 AND 9999999999999),
    transit     BIGINT CHECK (transit BETWEEN 0 AND 9999999999999),
    culture     BIGINT CHECK (culture BETWEEN 0 AND 9999999999999),
    row_version BIGINT NOT NULL DEFAULT 0
);

-- 지출계획. 연도 기록당 하나다. 소비구분 4 x (신용카드 고정 / 체크카드·현금영수증 고정 / 변경 가능).
CREATE TABLE tax_spending_plans (
    record_id            BIGINT PRIMARY KEY REFERENCES tax_year_records (id) ON DELETE CASCADE,
    general_credit_fixed BIGINT NOT NULL DEFAULT 0 CHECK (general_credit_fixed BETWEEN 0 AND 9999999999999),
    general_debit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (general_debit_fixed BETWEEN 0 AND 9999999999999),
    general_flexible     BIGINT NOT NULL DEFAULT 0 CHECK (general_flexible BETWEEN 0 AND 9999999999999),
    market_credit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (market_credit_fixed BETWEEN 0 AND 9999999999999),
    market_debit_fixed   BIGINT NOT NULL DEFAULT 0 CHECK (market_debit_fixed BETWEEN 0 AND 9999999999999),
    market_flexible      BIGINT NOT NULL DEFAULT 0 CHECK (market_flexible BETWEEN 0 AND 9999999999999),
    transit_credit_fixed BIGINT NOT NULL DEFAULT 0 CHECK (transit_credit_fixed BETWEEN 0 AND 9999999999999),
    transit_debit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (transit_debit_fixed BETWEEN 0 AND 9999999999999),
    transit_flexible     BIGINT NOT NULL DEFAULT 0 CHECK (transit_flexible BETWEEN 0 AND 9999999999999),
    culture_credit_fixed BIGINT NOT NULL DEFAULT 0 CHECK (culture_credit_fixed BETWEEN 0 AND 9999999999999),
    culture_debit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (culture_debit_fixed BETWEEN 0 AND 9999999999999),
    culture_flexible     BIGINT NOT NULL DEFAULT 0 CHECK (culture_flexible BETWEEN 0 AND 9999999999999),
    row_version          BIGINT NOT NULL DEFAULT 0
);
```

- [ ] **Step 4: 엔티티와 저장소**

소유 회원·귀속연도는 만든 뒤 바뀌지 않는다(`updatable = false`). 저장소에는 소유 회원 조건이 있는 조회만 더한다.

`main/tax/record/TaxYearRecord.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.OffsetDateTime;

/** 회원 x 귀속연도마다 하나인 소득공제 연도 기록. 카드 자료·현금영수증 자료·지출계획이 이 행에 딸린다. */
@Entity
@Table(name = "tax_year_records")
public class TaxYearRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false, updatable = false)
    private long ownerId;

    @Column(name = "tax_year", nullable = false, updatable = false)
    private int taxYear;

    @Column(name = "total_salary", nullable = false)
    private long totalSalary;

    @Column(name = "work_start_month", nullable = false)
    private int workStartMonth;

    @Column(name = "work_end_month", nullable = false)
    private int workEndMonth;

    @Column(name = "child_count", nullable = false)
    private int childCount;

    // 계산에 쓰는 세법 버전. null이면 그 귀속연도에 적용 버전이 아직 없다.
    @Column(name = "law_version_id")
    private Long lawVersionId;

    // 수정 요청의 rowVersion과 비교해 다른 곳에서 먼저 고친 기본정보를 덮어쓰지 않게 한다.
    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected TaxYearRecord() {
    }

    public static TaxYearRecord create(long ownerId, int taxYear, YearRequest request, Long lawVersionId) {
        TaxYearRecord record = new TaxYearRecord();
        record.ownerId = ownerId;
        record.taxYear = taxYear;
        record.lawVersionId = lawVersionId;
        record.edit(request);
        return record;
    }

    /** 기본정보를 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(YearRequest request) {
        totalSalary = request.totalSalary();
        workStartMonth = request.workStartMonth();
        workEndMonth = request.workEndMonth();
        childCount = request.childCount();
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public long getOwnerId() { return ownerId; }
    public int getTaxYear() { return taxYear; }
    public long getTotalSalary() { return totalSalary; }
    public int getWorkStartMonth() { return workStartMonth; }
    public int getWorkEndMonth() { return workEndMonth; }
    public int getChildCount() { return childCount; }
    public Long getLawVersionId() { return lawVersionId; }
    public long getRowVersion() { return rowVersion; }
}
```

`main/tax/record/TaxYearRecordRepository.java`

```java
package com.saladbowl.api.tax.record;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/** 연도 기록은 항상 소유 회원 조건으로 읽는다. id만으로 읽는 메서드(findById 등)를 서비스에서 쓰지 않는다. */
public interface TaxYearRecordRepository extends JpaRepository<TaxYearRecord, Long> {

    Optional<TaxYearRecord> findByOwnerIdAndTaxYear(long ownerId, int taxYear);

    /** 연도 기록과 딸린 자료의 쓰기를 한 번에 하나만 실행하도록 연도 기록 행을 잠근다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from TaxYearRecord r where r.ownerId = :ownerId and r.taxYear = :taxYear")
    Optional<TaxYearRecord> findOwnedForUpdate(@Param("ownerId") long ownerId, @Param("taxYear") int taxYear);
}
```

- [ ] **Step 5: DTO**

`@WholeNumber`는 PR 2의 `RowVersionDeserializer`를 금액에도 쓰기 위한 표시다. 붙이지 않으면 `40000000.7`이 40000000으로 잘려 저장된다(임시 복사본에서 확인).

`main/tax/record/TaxRecordDtos.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.law.TaxLawDtos.RowVersionDeserializer;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.OffsetDateTime;

public final class TaxRecordDtos {

    /** 금액 한 칸의 상한. 화면의 금액 입력(MoneyField), 세법 금액 검증과 같은 값이다. */
    public static final long MAX_AMOUNT = 9_999_999_999_999L;

    private TaxRecordDtos() {
    }

    /** 정수 토큰만 받는다. 기본 설정은 1000.7 같은 소수를 말없이 1000으로 잘라 저장한다. */
    @Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
    @Retention(RetentionPolicy.RUNTIME)
    @JacksonAnnotationsInside
    @JsonDeserialize(using = RowVersionDeserializer.class)
    public @interface WholeNumber {
    }

    /** 기본정보. rowVersion이 없으면 새로 만들고, 있으면 그 버전의 기록을 고친다. */
    public record YearRequest(
            @NotNull @Min(1) @Max(MAX_AMOUNT) @WholeNumber Long totalSalary,
            @NotNull @Min(1) @Max(12) Integer workStartMonth,
            @NotNull @Min(1) @Max(12) Integer workEndMonth,
            @NotNull @Min(0) @Max(99) Integer childCount,
            @WholeNumber Long rowVersion) {
    }

    /** 연도 기록이 기억하는 세법 버전. childTiersApply는 웹이 자녀등 입력란을 보일지 판단하는 값이다. */
    public record LawVersionRef(long id, int versionNo, OffsetDateTime appliedAt, boolean childTiersApply) {
    }

    /** 연도 기록 묶음. 모든 조회·저장 응답이 이 모양이다. */
    public record TaxYearView(
            int taxYear,
            long rowVersion,
            long totalSalary,
            int workStartMonth,
            int workEndMonth,
            int childCount,
            LawVersionRef lawVersion) {
    }

    /** 저장 결과. created가 true면 새로 만든 것(201)이다. */
    public record SavedYear(boolean created, TaxYearView view) {
    }
}
```

- [ ] **Step 6: 서비스**

`main/tax/record/TaxRecordService.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import com.saladbowl.api.tax.law.TaxLawService;
import com.saladbowl.api.tax.law.TaxLawVersion;
import com.saladbowl.api.tax.law.TaxLawVersionRepository;
import com.saladbowl.api.tax.record.TaxRecordDtos.LawVersionRef;
import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

/**
 * 회원 본인의 소득공제 자료. 서버 검사는 "요청자 = 소유자" 하나이고 그룹과 무관하다(GroupAccess를 쓰지 않는다).
 * 모든 접근은 (요청자, 귀속연도)로 연도 기록을 찾는 데서 시작하므로 남의 자료와 없는 자료는 똑같이 404다.
 */
@Service
public class TaxRecordService {

    // "올해"는 한국 시각 기준이다. 서버 시계는 UTC라 그대로 쓰면 1월 1일 0~9시에 전년도가 올해가 된다.
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final TaxYearRecordRepository records;
    private final TaxLawService laws;
    private final TaxLawVersionRepository lawVersions;
    private final Clock clock;

    public TaxRecordService(TaxYearRecordRepository records, TaxLawService laws,
                            TaxLawVersionRepository lawVersions, Clock clock) {
        this.records = records;
        this.laws = laws;
        this.lawVersions = lawVersions;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public TaxYearView get(long userId, int year) {
        return view(requireOwned(userId, year));
    }

    /** 없으면 만들고(rowVersion 없이), 있으면 기본정보를 고친다(rowVersion 필수). */
    @Transactional
    public SavedYear saveYear(long userId, int year, YearRequest request) {
        if (request.workStartMonth() > request.workEndMonth()) {
            throw invalid("workEndMonth: 종료월이 시작월보다 빠릅니다");
        }
        Optional<TaxYearRecord> existing = records.findOwnedForUpdate(userId, year);
        if (existing.isEmpty()) {
            if (request.rowVersion() != null) {
                // 고치려던 기록이 다른 곳에서 삭제됐다. 말없이 다시 만들지 않는다.
                throw notFound();
            }
            requireCreatableYear(year);
            Long lawVersionId = laws.currentApplied(year).map(TaxLawVersion::getId).orElse(null);
            // 같은 회원이 동시에 두 번 만들면 UNIQUE (owner_id, tax_year)가 한쪽을 409로 만든다.
            TaxYearRecord created = records.saveAndFlush(TaxYearRecord.create(userId, year, request, lawVersionId));
            return new SavedYear(true, view(created));
        }
        TaxYearRecord record = existing.get();
        requireRowVersion(record.getRowVersion(), request.rowVersion());
        record.edit(request);
        // 응답에 올라간 rowVersion을 싣기 위해 여기서 반영한다.
        return new SavedYear(false, view(records.saveAndFlush(record)));
    }

    /** 연도 기록과 딸린 카드 자료·현금영수증 자료·지출계획을 지운다(딸린 행은 DB의 ON DELETE CASCADE). */
    @Transactional
    public void deleteYear(long userId, int year) {
        records.delete(lockOwned(userId, year));
    }

    /** 읽기용. 요청자의 그 귀속연도 기록이 없으면 404다. 조회(이 클래스와 PR 4의 분석)가 쓴다. */
    public TaxYearRecord requireOwned(long userId, int year) {
        return records.findByOwnerIdAndTaxYear(userId, year).orElseThrow(TaxRecordService::notFound);
    }

    /** 쓰기용. 연도 기록 행을 잠근다. 딸린 자료의 쓰기도 이 잠금 뒤에서 하므로 한 연도의 쓰기는 차례로 실행된다. */
    TaxYearRecord lockOwned(long userId, int year) {
        return records.findOwnedForUpdate(userId, year).orElseThrow(TaxRecordService::notFound);
    }

    private void requireCreatableYear(int year) {
        int thisYear = LocalDate.now(clock.withZone(KST)).getYear();
        if (year < thisYear - 1 || year > thisYear + 1) {
            throw invalid("year: 올해·전년도·다음 해만 만들 수 있습니다");
        }
    }

    private TaxYearView view(TaxYearRecord record) {
        LawVersionRef lawVersion = record.getLawVersionId() == null ? null
                : lawVersions.findById(record.getLawVersionId()).map(TaxRecordService::toRef).orElse(null);
        return new TaxYearView(record.getTaxYear(), record.getRowVersion(), record.getTotalSalary(),
                record.getWorkStartMonth(), record.getWorkEndMonth(), record.getChildCount(), lawVersion);
    }

    private static LawVersionRef toRef(TaxLawVersion version) {
        boolean childTiersApply = VersionResponse.of(version, null, null, null).childTiersApply();
        return new LawVersionRef(version.getId(), version.getVersionNo(), version.getAppliedAt(), childTiersApply);
    }

    /** 저장된 값과 요청의 rowVersion이 다르면(없는 것 포함) 다른 곳에서 먼저 바뀐 것이다. */
    static void requireRowVersion(long stored, Long requested) {
        if (requested == null || stored != requested) {
            throw new ApiException(ErrorCode.CONFLICT, "tax record was modified elsewhere");
        }
    }

    static ApiException invalid(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message);
    }

    static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "tax record not found");
    }
}
```

- [ ] **Step 7: 컨트롤러** — `@PathVariable`의 `@Min`·`@Max` 위반은 `HandlerMethodValidationException`, 숫자가 아닌 연도는 `MethodArgumentTypeMismatchException`이고 둘 다 기존 `GlobalExceptionHandler`가 400 `VALIDATION_FAILED`로 바꾼다. `GlobalExceptionHandler`·`SecurityConfig`·`TaxAdminInterceptor`는 고치지 않는다.

`main/tax/record/TaxRecordController.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 회원 본인의 소득공제 자료. 경로에 회원 id가 없고 항상 요청자의 자료만 다룬다. */
@RestController
@RequestMapping("/tax/years/{year}")
public class TaxRecordController {

    private final TaxRecordService service;

    public TaxRecordController(TaxRecordService service) {
        this.service = service;
    }

    @GetMapping
    public TaxYearView get(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
        return service.get(userId, year);
    }

    @PutMapping
    public ResponseEntity<TaxYearView> save(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
                                            @Valid @RequestBody YearRequest request) {
        SavedYear saved = service.saveYear(userId, year, request);
        return ResponseEntity.status(saved.created() ? HttpStatus.CREATED : HttpStatus.OK).body(saved.view());
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
        service.deleteYear(userId, year);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 8: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxYearApiTest'`
Expected: `BUILD SUCCESSFUL`. `TaxYearApiTest` 15건 통과.

- [ ] **Step 9: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(임시 복사본에서는 전체 344건 통과. `ddl-auto: validate`와 V10이 맞는지 여기서 확인된다).

- [ ] **Step 10: 커밋(컨트롤러)** — Codex는 커밋하지 않는다. 컨트롤러가 보고와 diff를 확인한 뒤 커밋한다.

```bash
git add apps/api/src/main/resources/db/migration/V10__create_tax_records.sql apps/api/src/main/java/com/saladbowl/api/tax/record apps/api/src/test/java/com/saladbowl/api/support/TestClock.java apps/api/src/test/java/com/saladbowl/api/support/TestTaxRecords.java apps/api/src/test/java/com/saladbowl/api/tax/record apps/api/src/test/java/com/saladbowl/api/tax/law/TaxLawConcurrencyTest.java
git commit -m "feat(api): 소득공제 연도 기록 만들기·조회·수정·삭제와 소유권" -m "Co-Authored-By: Codex (gpt-6-astra) <noreply@openai.com>"
```

---

### Task 3.2: 카드 자료·현금영수증 자료와 연도 합계 (TAX-21, 22, 23, 24, 26, 27, 28)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `main/tax/record/TaxCardStatement.java`, `TaxCashReceipt.java`, `TaxCardStatementRepository.java`, `TaxCashReceiptRepository.java`, `SpendingTotals.java`
- Modify: `main/tax/record/TaxRecordDtos.java`, `TaxRecordService.java`, `TaxRecordController.java`
- Modify: `test/support/TestTaxRecords.java`
- Test: `test/tax/record/TaxStatementApiTest.java`(생성)

**Interfaces:**
- Consumes: Task 3.1의 `TaxRecordService.lockOwned(long userId, int year): TaxYearRecord`, `requireRowVersion(long stored, Long requested)`, `invalid(String)`, `notFound()`, `view(TaxYearRecord)`, `TaxRecordDtos.MAX_AMOUNT`·`@WholeNumber`·`TaxYearView`, `TestClock.Config`, `TestTaxRecords.URL`·`createYear`.
- Produces:
  - `TaxRecordDtos.CardAmounts(Long creditGeneral, Long creditMarket, Long creditTransit, Long creditCulture, Long debitGeneral, Long debitMarket, Long debitTransit, Long debitCulture)`, `CashAmounts(Long general, Long market, Long transit, Long culture)`, `CardRequest(String issuerName, LocalDate asOfDate, String memo, CardAmounts amounts, Long rowVersion)`, `CashRequest(LocalDate asOfDate, String memo, CashAmounts amounts, Long rowVersion)`, `CardView(long id, long rowVersion, String issuerName, LocalDate asOfDate, String memo, CardAmounts amounts, int blankCount)`, `CashView(long rowVersion, LocalDate asOfDate, String memo, CashAmounts amounts, int blankCount)`.
  - `TaxYearView`에 `List<CardView> cards, CashView cashReceipt, SpendingTotals totals, int blankCount, boolean hasInputs, boolean asOfDateMismatch`가 `lawVersion` 뒤에 붙는다.
  - `record SpendingTotals(long creditGeneral, long creditMarket, long creditTransit, long creditCulture, long debitGeneral, long debitMarket, long debitTransit, long debitCulture, long cashGeneral, long cashMarket, long cashTransit, long cashCulture)`, `static SpendingTotals.of(List<TaxCardStatement> cards, TaxCashReceipt cashReceiptOrNull)`, `max(): long`. PR 4의 계산기 입력이다.
  - `TaxCardStatement`: `static create(long recordId, String issuerName, LocalDate asOfDate, String memo, CardAmounts)`, `edit(...)`, `amounts(): CardAmounts`, `blankCount(): int`, `getId()`, `getIssuerName()`, `getAsOfDate()`, `getMemo()`, `getRowVersion(): long`. `TaxCashReceipt`: `static create(long recordId, LocalDate asOfDate, String memo, CashAmounts)`, `edit(...)`, `amounts()`, `blankCount()`, `getAsOfDate()`, `getMemo()`, `getRowVersion(): Long`.
  - `TaxCardStatementRepository.findByRecordIdOrderByIdAsc(long recordId)`, `findByIdAndRecordId(long id, long recordId)`. `TaxCashReceiptRepository`(기본 키 = 연도 기록 id).
  - `TaxRecordService`: `addCard(long userId, int year, CardRequest): TaxYearView`, `updateCard(long userId, int year, long cardId, CardRequest): TaxYearView`, `deleteCard(long userId, int year, long cardId, long rowVersion): void`, `saveCashReceipt(long userId, int year, CashRequest): TaxYearView`, `static conflict()`.
  - HTTP: `POST /tax/years/{year}/cards`, `PUT`·`DELETE /tax/years/{year}/cards/{cardId}`, `PUT /tax/years/{year}/cash-receipt`.
  - 테스트 헬퍼 `TestTaxRecords.cardBody(String issuerName, String asOfDate, Long rowVersion, Long... amounts8)`, `cashBody(String asOfDate, Long rowVersion, Long... amounts4)`, `postCard`, `addCard(mvc, user, year, body): long`(id), `putCard(mvc, user, year, cardId, body)`, `putCash(mvc, user, year, body)`.

건수 상한: `TaxRecordDtos.MAX_CARDS = 50`. `addCard`는 `lockOwned` 안에서 그 연도 기록의 카드 자료 수가 이미 50이면 `invalid`(400)를 던진다(테스트: 50건 추가 후 51번째 400, 한 건 삭제 뒤 다시 추가 201, 다른 연도·다른 회원의 건수와 무관).

합계 규칙: `totals`는 그 연도 기록의 카드 자료 행과 현금영수증 자료 행에서 `SpendingTotals.of`가 더한다. 미입력(`null`)은 0으로 더하고 `blankCount`에 따로 센다. 현금영수증 자료 행이 없으면 4칸이 빈 것으로 센다. `asOfDateMismatch`는 카드 자료와 현금영수증 자료의 기준일이 두 가지 이상인지다. 테스트의 합계 기대값은 합성 금액을 손으로 더한 값이다(예: 신용카드 일반 1,000,000 + 500,000 = 1,500,000).

- [ ] **Step 1: 실패하는 테스트 작성**

헬퍼를 더한다.

`test/support/TestTaxRecords.java`

```diff
--- a/apps/api/src/test/java/com/saladbowl/api/support/TestTaxRecords.java
+++ b/apps/api/src/test/java/com/saladbowl/api/support/TestTaxRecords.java
@@ -1,9 +1,11 @@
 package com.saladbowl.api.support;
 
+import com.jayway.jsonpath.JsonPath;
 import org.springframework.http.MediaType;
 import org.springframework.test.web.servlet.MockMvc;
 import org.springframework.test.web.servlet.ResultActions;
 
+import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
 import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
 import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
 
@@ -32,4 +34,50 @@
     public static void createYear(MockMvc mvc, TestAuth.AuthedUser user, int year) throws Exception {
         putYear(mvc, user, year, yearBody(40_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
     }
+
+    /**
+     * 카드 자료 본문. amounts는 신용카드 일반·전통시장·대중교통·문화체육, 체크카드 일반·전통시장·대중교통·문화체육
+     * 순서의 8칸이고 null은 미입력이다.
+     */
+    public static String cardBody(String issuerName, String asOfDate, Long rowVersion, Long... amounts) {
+        return """
+                {"issuerName": "%s", "asOfDate": "%s", "rowVersion": %s, "amounts": {
+                  "creditGeneral": %s, "creditMarket": %s, "creditTransit": %s, "creditCulture": %s,
+                  "debitGeneral": %s, "debitMarket": %s, "debitTransit": %s, "debitCulture": %s}}
+                """.formatted(issuerName, asOfDate, rowVersion, amounts[0], amounts[1], amounts[2], amounts[3],
+                amounts[4], amounts[5], amounts[6], amounts[7]);
+    }
+
+    /** 현금영수증 자료 본문. amounts는 일반·전통시장·대중교통·문화체육 순서의 4칸이고 null은 미입력이다. */
+    public static String cashBody(String asOfDate, Long rowVersion, Long... amounts) {
+        return """
+                {"asOfDate": "%s", "rowVersion": %s, "amounts": {
+                  "general": %s, "market": %s, "transit": %s, "culture": %s}}
+                """.formatted(asOfDate, rowVersion, amounts[0], amounts[1], amounts[2], amounts[3]);
+    }
+
+    public static ResultActions postCard(MockMvc mvc, TestAuth.AuthedUser user, int year, String body)
+            throws Exception {
+        return mvc.perform(post(URL + "/" + year + "/cards").header("Authorization", user.bearer())
+                .contentType(MediaType.APPLICATION_JSON).content(body));
+    }
+
+    /** 카드 자료를 추가하고 그 id를 돌려준다. 만든 뒤의 rowVersion은 0이다. */
+    public static long addCard(MockMvc mvc, TestAuth.AuthedUser user, int year, String body) throws Exception {
+        String response = postCard(mvc, user, year, body).andExpect(status().isCreated())
+                .andReturn().getResponse().getContentAsString();
+        return ((Number) JsonPath.read(response, "$.cards[-1].id")).longValue();
+    }
+
+    public static ResultActions putCard(MockMvc mvc, TestAuth.AuthedUser user, int year, long cardId, String body)
+            throws Exception {
+        return mvc.perform(put(URL + "/" + year + "/cards/" + cardId).header("Authorization", user.bearer())
+                .contentType(MediaType.APPLICATION_JSON).content(body));
+    }
+
+    public static ResultActions putCash(MockMvc mvc, TestAuth.AuthedUser user, int year, String body)
+            throws Exception {
+        return mvc.perform(put(URL + "/" + year + "/cash-receipt").header("Authorization", user.bearer())
+                .contentType(MediaType.APPLICATION_JSON).content(body));
+    }
 }
```

`test/tax/record/TaxStatementApiTest.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.addCard;
import static com.saladbowl.api.support.TestTaxRecords.cardBody;
import static com.saladbowl.api.support.TestTaxRecords.cashBody;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.postCard;
import static com.saladbowl.api.support.TestTaxRecords.putCard;
import static com.saladbowl.api.support.TestTaxRecords.putCash;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 카드 자료·현금영수증 자료와 연도 합계
 * (TAX-21, 22, 23, 24, 26, 27, 28, 29, AC-01, 14, 15, 22, 28, 31, 33, 37). 금액은 모두 합성값이고 테스트의 올해는 2026이다.
 */
@Import(TestClock.Config.class)
class TaxStatementApiTest extends IntegrationTest {

    private static final long MAX = 9_999_999_999_999L;

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser owner;

    @BeforeEach
    void createOwnerYear() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
        createYear(mvc, owner, 2026);
    }

    /** 신용카드 1,000,000 / 200,000 / 50,000 / 30,000, 체크카드 400,000 / 100,000 / 20,000 / 10,000. */
    private static String fullCard(String issuerName, String asOfDate, Long rowVersion) {
        return cardBody(issuerName, asOfDate, rowVersion,
                1_000_000L, 200_000L, 50_000L, 30_000L, 400_000L, 100_000L, 20_000L, 10_000L);
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    private long creditGeneralOf(long cardId) {
        return jdbc.queryForObject("SELECT credit_general FROM tax_card_statements WHERE id = ?", Long.class, cardId);
    }

    @Test
    void yearWithoutStatementsIsIncompleteWithZeroTotals() throws Exception {
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards", hasSize(0)))
                .andExpect(jsonPath("$.cashReceipt").value(nullValue()))
                .andExpect(jsonPath("$.hasInputs").value(false))
                // 현금영수증 자료를 한 번도 입력하지 않았으므로 4칸이 비어 있다(TAX-24).
                .andExpect(jsonPath("$.blankCount").value(4))
                .andExpect(jsonPath("$.asOfDateMismatch").value(false))
                .andExpect(jsonPath("$.totals.creditGeneral").value(0))
                .andExpect(jsonPath("$.totals.cashCulture").value(0));
    }

    @Test
    void addingACardReturnsTheYearViewWithIt() throws Exception {
        postCard(mvc, owner, 2026, """
                {"issuerName": "  합성카드  ", "asOfDate": "2026-10-31", "memo": "  10월 말 누계  ", "amounts": {
                  "creditGeneral": 1000000, "creditMarket": 200000, "creditTransit": 50000, "creditCulture": 30000,
                  "debitGeneral": 400000, "debitMarket": 100000, "debitTransit": 20000, "debitCulture": 10000}}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.cards[0].id").isNumber())
                .andExpect(jsonPath("$.cards[0].rowVersion").value(0))
                .andExpect(jsonPath("$.cards[0].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.cards[0].asOfDate").value("2026-10-31"))
                .andExpect(jsonPath("$.cards[0].memo").value("10월 말 누계"))
                .andExpect(jsonPath("$.cards[0].amounts.creditGeneral").value(1_000_000))
                .andExpect(jsonPath("$.cards[0].amounts.debitCulture").value(10_000))
                .andExpect(jsonPath("$.cards[0].blankCount").value(0))
                .andExpect(jsonPath("$.hasInputs").value(true))
                .andExpect(jsonPath("$.blankCount").value(4))
                // 카드 자료를 더해도 연도 기록(기본정보)의 rowVersion은 그대로다. 비교 단위는 행 하나다.
                .andExpect(jsonPath("$.rowVersion").value(0));
    }

    @Test
    void sameIssuerNameCanBeSavedTwice() throws Exception {
        addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(2)))
                .andExpect(jsonPath("$.cards[0].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.cards[1].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.totals.creditGeneral").value(2_000_000));
    }

    @Test
    void blankAndZeroAreDifferentAndFillingZerosCompletesTheYear() throws Exception {
        long cardId = addCard(mvc, owner, 2026, cardBody("합성카드", "2026-10-31", null,
                1_000_000L, null, 0L, null, 400_000L, 0L, null, 0L));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards[0].amounts.creditMarket").value(nullValue()))
                .andExpect(jsonPath("$.cards[0].amounts.creditTransit").value(0))
                .andExpect(jsonPath("$.cards[0].blankCount").value(3))
                .andExpect(jsonPath("$.blankCount").value(7))
                // 미입력 칸은 합계에서 0으로 더한다.
                .andExpect(jsonPath("$.totals.creditGeneral").value(1_000_000))
                .andExpect(jsonPath("$.totals.creditMarket").value(0));

        putCard(mvc, owner, 2026, cardId, cardBody("합성카드", "2026-10-31", 0L,
                1_000_000L, 0L, 0L, 0L, 400_000L, 0L, 0L, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[0].blankCount").value(0))
                .andExpect(jsonPath("$.blankCount").value(4));

        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 0L, null, 0L, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.blankCount").value(1))
                .andExpect(jsonPath("$.blankCount").value(1));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", 0L, 0L, 0L, 0L, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.blankCount").value(0))
                .andExpect(jsonPath("$.blankCount").value(0));
    }

    @Test
    void totalsAreTheSumOfThatYearsStatementsOnly() throws Exception {
        createYear(mvc, owner, 2025);
        addCard(mvc, owner, 2025, cardBody("작년카드", "2025-12-31", null,
                7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L));
        putCash(mvc, owner, 2025, cashBody("2025-12-31", null, 7_000_000L, 7_000_000L, 7_000_000L, 7_000_000L))
                .andExpect(status().isOk());
        long first = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        long second = addCard(mvc, owner, 2026, cardBody("가상카드", "2026-10-31", null,
                500_000L, 0L, 70_000L, 0L, 250_000L, 30_000L, 0L, 5_000L));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 40_000L, 0L, 8_000L))
                .andExpect(status().isOk());

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.totals.creditGeneral").value(1_500_000))
                .andExpect(jsonPath("$.totals.creditMarket").value(200_000))
                .andExpect(jsonPath("$.totals.creditTransit").value(120_000))
                .andExpect(jsonPath("$.totals.creditCulture").value(30_000))
                .andExpect(jsonPath("$.totals.debitGeneral").value(650_000))
                .andExpect(jsonPath("$.totals.debitMarket").value(130_000))
                .andExpect(jsonPath("$.totals.debitTransit").value(20_000))
                .andExpect(jsonPath("$.totals.debitCulture").value(15_000))
                .andExpect(jsonPath("$.totals.cashGeneral").value(120_000))
                .andExpect(jsonPath("$.totals.cashMarket").value(40_000))
                .andExpect(jsonPath("$.totals.cashTransit").value(0))
                .andExpect(jsonPath("$.totals.cashCulture").value(8_000));

        // 수정은 덮어쓰기다. 이전 값에 더하지 않는다.
        putCard(mvc, owner, 2026, second, cardBody("가상카드", "2026-10-31", 0L,
                600_000L, 0L, 70_000L, 0L, 250_000L, 30_000L, 0L, 5_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.creditGeneral").value(1_600_000));

        // 한 건을 지우면 그 자료의 금액만 빠진다(AC-22).
        mvc.perform(delete(URL + "/2026/cards/" + first).param("rowVersion", "0")
                        .header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.totals.creditGeneral").value(600_000))
                .andExpect(jsonPath("$.totals.creditMarket").value(0))
                .andExpect(jsonPath("$.totals.debitGeneral").value(250_000))
                .andExpect(jsonPath("$.totals.cashGeneral").value(120_000));
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.totals.creditGeneral").value(7_000_000));
    }

    @Test
    void cashReceiptIsOnePerYearAndCannotBeDeleted() throws Exception {
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 40_000L, 0L, 8_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.rowVersion").value(0))
                .andExpect(jsonPath("$.cashReceipt.asOfDate").value("2026-10-31"))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(120_000))
                .andExpect(jsonPath("$.hasInputs").value(true));
        putCash(mvc, owner, 2026, cashBody("2026-11-30", 0L, 150_000L, 40_000L, 0L, 8_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashReceipt.rowVersion").value(1))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(150_000));
        assertThat(count("tax_cash_receipts")).isEqualTo(1);

        // 삭제 경로가 없다(D19, AC-37).
        mvc.perform(delete(URL + "/2026/cash-receipt").header("Authorization", owner.bearer()))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(post(URL + "/2026/cash-receipt").header("Authorization", owner.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashBody("2026-11-30", 1L, 0L, 0L, 0L, 0L)))
                .andExpect(status().isMethodNotAllowed());
        assertThat(count("tax_cash_receipts")).isEqualTo(1);
    }

    @Test
    void staleCashReceiptSaveIsConflictAndKeepsTheFirstSave() throws Exception {
        // 아직 없는 자료를 고치려는 요청(rowVersion 있음)은 만들지 않는다.
        putCash(mvc, owner, 2026, cashBody("2026-10-31", 0L, 1L, 1L, 1L, 1L)).andExpect(status().isConflict());
        assertThat(count("tax_cash_receipts")).isZero();

        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        putCash(mvc, owner, 2026, cashBody("2026-10-31", 0L, 150_000L, 0L, 0L, 0L)).andExpect(status().isOk());

        // 옛 rowVersion, 그리고 이미 있는데 새로 만들려는 요청(rowVersion 없음) 모두 409다.
        for (Long stale : new Long[]{0L, null}) {
            putCash(mvc, owner, 2026, cashBody("2026-10-31", stale, 999_000L, 0L, 0L, 0L))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("CONFLICT"));
        }
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(150_000))
                .andExpect(jsonPath("$.cashReceipt.rowVersion").value(1));
    }

    @Test
    void staleCardSaveOrDeleteIsConflictAndKeepsTheFirstSave() throws Exception {
        long cardId = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        putCard(mvc, owner, 2026, cardId, cardBody("합성카드", "2026-11-30", 0L,
                1_300_000L, 200_000L, 50_000L, 30_000L, 400_000L, 100_000L, 20_000L, 10_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[0].rowVersion").value(1));

        for (Long stale : new Long[]{0L, null}) {
            putCard(mvc, owner, 2026, cardId, fullCard("합성카드", "2026-10-31", stale))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("CONFLICT"));
        }
        mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "0")
                        .header("Authorization", owner.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        for (String invalid : new String[]{"", "wrong", "1.5"}) {
            mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", invalid)
                            .header("Authorization", owner.bearer()))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(delete(URL + "/2026/cards/" + cardId).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest());
        assertThat(creditGeneralOf(cardId)).isEqualTo(1_300_000L);

        mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "1")
                        .header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());
        assertThat(count("tax_card_statements")).isZero();
    }

    @Test
    void asOfDateMismatchIsReportedOnlyWhenDatesDiffer() throws Exception {
        addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        long second = addCard(mvc, owner, 2026, fullCard("가상카드", "2026-10-31", null));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 0L, 0L, 0L, 0L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(false));

        putCard(mvc, owner, 2026, second, fullCard("가상카드", "2026-11-30", 0L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(true));
        putCard(mvc, owner, 2026, second, fullCard("가상카드", "2026-10-31", 1L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(false));
        // 현금영수증 자료의 기준일만 달라도 불일치다.
        putCash(mvc, owner, 2026, cashBody("2026-09-30", 0L, 0L, 0L, 0L, 0L))
                .andExpect(jsonPath("$.asOfDateMismatch").value(true));
    }

    @Test
    void rejectsInvalidStatements() throws Exception {
        String fifty = "가".repeat(50);
        addCard(mvc, owner, 2026, fullCard("  " + fifty + "  ", "2026-01-01", null));
        addCard(mvc, owner, 2026, fullCard("연말카드", "2026-12-31", null));

        String[] invalidCards = {
                fullCard("   ", "2026-10-31", null),
                fullCard(fifty + "가", "2026-10-31", null),
                fullCard("합성카드", "2025-12-31", null),
                fullCard("합성카드", "2027-01-01", null),
                fullCard("합성카드", "2026-02-30", null),
                cardBody("합성카드", "2026-10-31", null, -1L, 0L, 0L, 0L, 0L, 0L, 0L, 0L),
                cardBody("합성카드", "2026-10-31", null, 0L, 0L, 0L, 0L, 0L, 0L, 0L, MAX + 1),
                fullCard("합성카드", "2026-10-31", null).replace("1000000,", "1000000.5,"),
                "{\"asOfDate\": \"2026-10-31\", \"amounts\": {}}",
                "{\"issuerName\": \"합성카드\", \"amounts\": {}}",
                "{\"issuerName\": \"합성카드\", \"asOfDate\": \"2026-10-31\"}",
                "{\"issuerName\": \"합성카드\", \"asOfDate\": \"2026-10-31\", \"amounts\": {}, \"memo\": \""
                        + "가".repeat(201) + "\"}"
        };
        for (String body : invalidCards) {
            postCard(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(count("tax_card_statements")).isEqualTo(2);

        String[] invalidCash = {
                cashBody("2025-12-31", null, 0L, 0L, 0L, 0L),
                cashBody("2026-10-31", null, -1L, 0L, 0L, 0L),
                cashBody("2026-10-31", null, 0L, 0L, 0L, MAX + 1),
                "{\"amounts\": {}}",
                "{\"asOfDate\": \"2026-10-31\"}"
        };
        for (String body : invalidCash) {
            putCash(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(count("tax_cash_receipts")).isZero();

        // 금액 칸은 비워 둘 수 있고(8칸 모두 미입력), 한 칸의 상한은 9,999,999,999,999원이다.
        postCard(mvc, owner, 2026, "{\"issuerName\": \"빈카드\", \"asOfDate\": \"2026-10-31\", \"amounts\": {}}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cards[2].blankCount").value(8));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, MAX, 0L, 0L, 0L)).andExpect(status().isOk());
    }

    @Test
    void yearTotalAboveTheLimitIsRejectedAndRolledBack() throws Exception {
        long first = addCard(mvc, owner, 2026, cardBody("합성카드", "2026-10-31", null,
                MAX, 0L, 0L, 0L, 0L, 0L, 0L, 0L));

        postCard(mvc, owner, 2026, cardBody("가상카드", "2026-10-31", null, 1L, 0L, 0L, 0L, 0L, 0L, 0L, 0L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        assertThat(count("tax_card_statements")).isEqualTo(1);

        long second = addCard(mvc, owner, 2026, cardBody("가상카드", "2026-10-31", null,
                0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));
        putCard(mvc, owner, 2026, second, cardBody("가상카드", "2026-10-31", 0L, 1L, 0L, 0L, 0L, 0L, 0L, 0L, 0L))
                .andExpect(status().isBadRequest());
        assertThat(creditGeneralOf(second)).isZero();
        assertThat(creditGeneralOf(first)).isEqualTo(MAX);
    }

    @Test
    void deletingTheYearDeletesItsStatementsOnly() throws Exception {
        createYear(mvc, owner, 2025);
        addCard(mvc, owner, 2025, fullCard("작년카드", "2025-12-31", null));
        putCash(mvc, owner, 2025, cashBody("2025-12-31", null, 0L, 0L, 0L, 0L)).andExpect(status().isOk());
        addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        addCard(mvc, owner, 2026, fullCard("가상카드", "2026-10-31", null));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 0L, 0L, 0L, 0L)).andExpect(status().isOk());

        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());

        assertThat(count("tax_card_statements")).isEqualTo(1);
        assertThat(count("tax_cash_receipts")).isEqualTo(1);
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.cards[0].issuerName").value("작년카드"))
                .andExpect(jsonPath("$.cashReceipt.asOfDate").value("2025-12-31"));
    }

    @Test
    void anotherMembersStatementsAreNotFoundAndUnchanged() throws Exception {
        long cardId = addCard(mvc, owner, 2026, fullCard("합성카드", "2026-10-31", null));
        putCash(mvc, owner, 2026, cashBody("2026-10-31", null, 120_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        AuthedUser groupAdmin = TestAuth.signupAndLogin(mvc, "group-admin@example.test", "그룹장");
        AuthedUser serviceAdmin = TestAuth.signupAndLogin(mvc, "service-admin@example.test", "관리자");
        AuthedUser stranger = TestAuth.signupAndLogin(mvc, "stranger@example.test", "남");
        TestAdmins.grant(jdbc, serviceAdmin.id());
        long groupId = TestGroups.createGroup(mvc, groupAdmin, "합성 그룹");
        TestGroups.join(mvc, groupAdmin, owner, groupId);
        // 같은 연도 기록이 있는 회원과 없는 회원 모두 같은 404여야 한다.
        createYear(mvc, groupAdmin, 2026);
        createYear(mvc, serviceAdmin, 2026);

        for (AuthedUser other : new AuthedUser[]{groupAdmin, serviceAdmin, stranger}) {
            putCard(mvc, other, 2026, cardId, fullCard("남의카드", "2026-10-31", 0L))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
            mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "0")
                            .header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"));
            // 틀린 rowVersion으로도 409가 아니라 404다(409면 그 id의 자료가 있다는 것이 드러난다).
            putCard(mvc, other, 2026, cardId, fullCard("남의카드", "2026-10-31", 7L))
                    .andExpect(status().isNotFound());
            mvc.perform(delete(URL + "/2026/cards/" + cardId).param("rowVersion", "7")
                            .header("Authorization", other.bearer()))
                    .andExpect(status().isNotFound());
        }
        // 없는 id도 같은 응답이다.
        putCard(mvc, groupAdmin, 2026, cardId + 1000, fullCard("남의카드", "2026-10-31", 0L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        // 연도 기록이 없는 회원은 자료를 더할 수도 없다.
        postCard(mvc, stranger, 2026, fullCard("남의카드", "2026-10-31", null)).andExpect(status().isNotFound());
        putCash(mvc, stranger, 2026, cashBody("2026-10-31", null, 1L, 1L, 1L, 1L)).andExpect(status().isNotFound());
        // 내 자료라도 다른 귀속연도의 주소로는 닿지 않는다.
        createYear(mvc, owner, 2025);
        putCard(mvc, owner, 2025, cardId, fullCard("합성카드", "2025-10-31", 0L)).andExpect(status().isNotFound());

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(1)))
                .andExpect(jsonPath("$.cards[0].issuerName").value("합성카드"))
                .andExpect(jsonPath("$.cards[0].rowVersion").value(0))
                .andExpect(jsonPath("$.cashReceipt.amounts.general").value(120_000));
        // 다른 회원의 연도에는 내 자료가 보이지 않는다.
        mvc.perform(get(URL + "/2026").header("Authorization", groupAdmin.bearer()))
                .andExpect(jsonPath("$.cards", hasSize(0)))
                .andExpect(jsonPath("$.cashReceipt").value(nullValue()))
                .andExpect(jsonPath("$.totals.creditGeneral").value(0));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(post(URL + "/2026/cards").contentType(MediaType.APPLICATION_JSON)
                        .content(fullCard("합성카드", "2026-10-31", null)))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(URL + "/2026/cards/1").param("rowVersion", "0")).andExpect(status().isUnauthorized());
        mvc.perform(put(URL + "/2026/cash-receipt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashBody("2026-10-31", null, 0L, 0L, 0L, 0L)))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxStatementApiTest'`
Expected: `14 tests completed, 13 failed`. 카드·현금영수증 경로가 없어 404이고 `TaxYearView`에 `cards`·`totals`가 없다. `requiresLogin`만 통과한다.

- [ ] **Step 3: DTO**

`main/tax/record/TaxRecordDtos.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordDtos.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordDtos.java
@@ -3,7 +3,9 @@
 import com.saladbowl.api.tax.law.TaxLawDtos.RowVersionDeserializer;
 import jakarta.validation.constraints.Max;
 import jakarta.validation.constraints.Min;
+import jakarta.validation.Valid;
 import jakarta.validation.constraints.NotNull;
+import jakarta.validation.constraints.Size;
 import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
 import tools.jackson.databind.annotation.JsonDeserialize;
 
@@ -11,7 +13,9 @@
 import java.lang.annotation.Retention;
 import java.lang.annotation.RetentionPolicy;
 import java.lang.annotation.Target;
+import java.time.LocalDate;
 import java.time.OffsetDateTime;
+import java.util.List;
 
 public final class TaxRecordDtos {
 
@@ -38,11 +42,59 @@
             @WholeNumber Long rowVersion) {
     }
 
+    /** 신용·체크 자료의 금액 8칸. null은 미입력이다. */
+    public record CardAmounts(
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditGeneral,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditMarket,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditTransit,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditCulture,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitGeneral,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitMarket,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitTransit,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitCulture) {
+    }
+
+    /** 현금영수증 자료의 금액 4칸. null은 미입력이다. */
+    public record CashAmounts(
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long general,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long market,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long transit,
+            @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long culture) {
+    }
+
+    /** 카드 자료 추가·수정. 추가는 rowVersion을 보내지 않고, 수정은 읽을 때 받은 rowVersion을 보낸다. */
+    public record CardRequest(
+            @NotNull String issuerName,
+            @NotNull LocalDate asOfDate,
+            @Size(max = 200) String memo,
+            @NotNull @Valid CardAmounts amounts,
+            @WholeNumber Long rowVersion) {
+    }
+
+    /** 현금영수증 자료 저장. 처음 저장은 rowVersion을 보내지 않고, 그 뒤로는 읽을 때 받은 rowVersion을 보낸다. */
+    public record CashRequest(
+            @NotNull LocalDate asOfDate,
+            @Size(max = 200) String memo,
+            @NotNull @Valid CashAmounts amounts,
+            @WholeNumber Long rowVersion) {
+    }
+
+    public record CardView(long id, long rowVersion, String issuerName, LocalDate asOfDate, String memo,
+                           CardAmounts amounts, int blankCount) {
+    }
+
+    public record CashView(long rowVersion, LocalDate asOfDate, String memo, CashAmounts amounts, int blankCount) {
+    }
+
     /** 연도 기록이 기억하는 세법 버전. childTiersApply는 웹이 자녀등 입력란을 보일지 판단하는 값이다. */
     public record LawVersionRef(long id, int versionNo, OffsetDateTime appliedAt, boolean childTiersApply) {
     }
 
-    /** 연도 기록 묶음. 모든 조회·저장 응답이 이 모양이다. */
+    /**
+     * 연도 기록 묶음. 모든 조회·저장 응답이 이 모양이다.
+     * cashReceipt가 null이면 한 번도 입력하지 않은 것이고 blankCount에 4칸으로 센다.
+     * totals는 미입력 칸을 0으로 더한 연도 합계표다. asOfDateMismatch는 자료끼리 기준일이 서로 다른지다.
+     */
     public record TaxYearView(
             int taxYear,
             long rowVersion,
@@ -50,7 +102,13 @@
             int workStartMonth,
             int workEndMonth,
             int childCount,
-            LawVersionRef lawVersion) {
+            LawVersionRef lawVersion,
+            List<CardView> cards,
+            CashView cashReceipt,
+            SpendingTotals totals,
+            int blankCount,
+            boolean hasInputs,
+            boolean asOfDateMismatch) {
     }
 
     /** 저장 결과. created가 true면 새로 만든 것(201)이다. */
```

- [ ] **Step 4: 엔티티와 저장소**

`main/tax/record/TaxCardStatement.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.CardAmounts;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.util.Objects;
import java.util.stream.Stream;

/** 신용·체크 자료 한 건. 금액 8칸은 기준일까지의 누계이고 null은 미입력(모름), 0은 없음이다. */
@Entity
@Table(name = "tax_card_statements")
public class TaxCardStatement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "record_id", nullable = false, updatable = false)
    private long recordId;

    @Column(name = "issuer_name", nullable = false)
    private String issuerName;

    @Column(name = "as_of_date", nullable = false)
    private LocalDate asOfDate;

    private String memo;

    @Column(name = "credit_general")
    private Long creditGeneral;

    @Column(name = "credit_market")
    private Long creditMarket;

    @Column(name = "credit_transit")
    private Long creditTransit;

    @Column(name = "credit_culture")
    private Long creditCulture;

    @Column(name = "debit_general")
    private Long debitGeneral;

    @Column(name = "debit_market")
    private Long debitMarket;

    @Column(name = "debit_transit")
    private Long debitTransit;

    @Column(name = "debit_culture")
    private Long debitCulture;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    protected TaxCardStatement() {
    }

    public static TaxCardStatement create(long recordId, String issuerName, LocalDate asOfDate, String memo,
                                          CardAmounts amounts) {
        TaxCardStatement card = new TaxCardStatement();
        card.recordId = recordId;
        card.edit(issuerName, asOfDate, memo, amounts);
        return card;
    }

    /** 새 누계로 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(String issuerName, LocalDate asOfDate, String memo, CardAmounts amounts) {
        this.issuerName = issuerName;
        this.asOfDate = asOfDate;
        this.memo = memo;
        creditGeneral = amounts.creditGeneral();
        creditMarket = amounts.creditMarket();
        creditTransit = amounts.creditTransit();
        creditCulture = amounts.creditCulture();
        debitGeneral = amounts.debitGeneral();
        debitMarket = amounts.debitMarket();
        debitTransit = amounts.debitTransit();
        debitCulture = amounts.debitCulture();
    }

    public CardAmounts amounts() {
        return new CardAmounts(creditGeneral, creditMarket, creditTransit, creditCulture,
                debitGeneral, debitMarket, debitTransit, debitCulture);
    }

    /** 8칸 가운데 미입력 칸 수. */
    public int blankCount() {
        return (int) Stream.of(creditGeneral, creditMarket, creditTransit, creditCulture,
                debitGeneral, debitMarket, debitTransit, debitCulture).filter(Objects::isNull).count();
    }

    public Long getId() { return id; }
    public String getIssuerName() { return issuerName; }
    public LocalDate getAsOfDate() { return asOfDate; }
    public String getMemo() { return memo; }
    public long getRowVersion() { return rowVersion; }
}
```

`main/tax/record/TaxCashReceipt.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.CashAmounts;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.util.Objects;
import java.util.stream.Stream;

/** 현금영수증 자료. 연도 기록당 하나이고 따로 삭제하지 않는다(연도 기록과 함께만 지워진다). */
@Entity
@Table(name = "tax_cash_receipts")
public class TaxCashReceipt {

    @Id
    @Column(name = "record_id")
    private Long recordId;

    @Column(name = "as_of_date", nullable = false)
    private LocalDate asOfDate;

    private String memo;

    private Long general;

    private Long market;

    private Long transit;

    private Long culture;

    // id를 직접 넣는 엔티티라 저장소가 새 행인지를 이 값이 null인지로 판단한다. 그래서 long이 아니라 Long이다.
    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    protected TaxCashReceipt() {
    }

    public static TaxCashReceipt create(long recordId, LocalDate asOfDate, String memo, CashAmounts amounts) {
        TaxCashReceipt cash = new TaxCashReceipt();
        cash.recordId = recordId;
        cash.edit(asOfDate, memo, amounts);
        return cash;
    }

    /** 새 누계로 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(LocalDate asOfDate, String memo, CashAmounts amounts) {
        this.asOfDate = asOfDate;
        this.memo = memo;
        general = amounts.general();
        market = amounts.market();
        transit = amounts.transit();
        culture = amounts.culture();
    }

    public CashAmounts amounts() {
        return new CashAmounts(general, market, transit, culture);
    }

    /** 4칸 가운데 미입력 칸 수. */
    public int blankCount() {
        return (int) Stream.of(general, market, transit, culture).filter(Objects::isNull).count();
    }

    public LocalDate getAsOfDate() { return asOfDate; }
    public String getMemo() { return memo; }
    public Long getRowVersion() { return rowVersion; }
}
```

`main/tax/record/TaxCardStatementRepository.java`

```java
package com.saladbowl.api.tax.record;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** 카드 자료는 항상 소유한 연도 기록의 id와 함께 읽는다. id만으로 읽는 메서드(findById 등)를 서비스에서 쓰지 않는다. */
public interface TaxCardStatementRepository extends JpaRepository<TaxCardStatement, Long> {

    List<TaxCardStatement> findByRecordIdOrderByIdAsc(long recordId);

    Optional<TaxCardStatement> findByIdAndRecordId(long id, long recordId);
}
```

`main/tax/record/TaxCashReceiptRepository.java`

```java
package com.saladbowl.api.tax.record;

import org.springframework.data.jpa.repository.JpaRepository;

/** 기본 키가 연도 기록 id다. 소유한 연도 기록을 먼저 찾고 그 id로 읽는다. */
public interface TaxCashReceiptRepository extends JpaRepository<TaxCashReceipt, Long> {
}
```

- [ ] **Step 5: 연도 합계**

`main/tax/record/SpendingTotals.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.CardAmounts;
import com.saladbowl.api.tax.record.TaxRecordDtos.CashAmounts;

import java.util.List;
import java.util.stream.LongStream;

/**
 * 연도 합계표: 결제수단 3 x 소비구분 4. 그 연도 기록의 모든 카드 자료와 현금영수증 자료를 더한 값이고 저장하지 않는다.
 * 미입력 칸(null)은 0으로 더한다. 합계는 여기 한 곳에서만 만들고 웹은 다시 더하지 않는다.
 */
public record SpendingTotals(
        long creditGeneral, long creditMarket, long creditTransit, long creditCulture,
        long debitGeneral, long debitMarket, long debitTransit, long debitCulture,
        long cashGeneral, long cashMarket, long cashTransit, long cashCulture) {

    /** cashReceipt는 한 번도 입력하지 않았으면 null이다. */
    public static SpendingTotals of(List<TaxCardStatement> cards, TaxCashReceipt cashReceipt) {
        long[] sum = new long[12];
        for (TaxCardStatement card : cards) {
            CardAmounts a = card.amounts();
            add(sum, 0, a.creditGeneral(), a.creditMarket(), a.creditTransit(), a.creditCulture(),
                    a.debitGeneral(), a.debitMarket(), a.debitTransit(), a.debitCulture());
        }
        if (cashReceipt != null) {
            CashAmounts a = cashReceipt.amounts();
            add(sum, 8, a.general(), a.market(), a.transit(), a.culture());
        }
        return new SpendingTotals(sum[0], sum[1], sum[2], sum[3], sum[4], sum[5], sum[6], sum[7],
                sum[8], sum[9], sum[10], sum[11]);
    }

    /** 12칸 가운데 가장 큰 값. 합계 상한 검사에 쓴다. */
    public long max() {
        return LongStream.of(creditGeneral, creditMarket, creditTransit, creditCulture,
                debitGeneral, debitMarket, debitTransit, debitCulture,
                cashGeneral, cashMarket, cashTransit, cashCulture).max().getAsLong();
    }

    private static void add(long[] sum, int offset, Long... amounts) {
        for (int i = 0; i < amounts.length; i++) {
            if (amounts[i] != null) {
                sum[offset + i] += amounts[i];
            }
        }
    }
}
```

- [ ] **Step 6: 서비스** — 쓰기는 모두 `lockOwned`로 시작한다. 카드 자료는 `requireCard`(소유한 연도 기록의 id와 함께 조회)로만 찾는다. 저장한 뒤 `viewWithinTotalLimit`가 합계 상한을 넘으면 400을 던지고 트랜잭션이 저장을 되돌린다.

`main/tax/record/TaxRecordService.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordService.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordService.java
@@ -6,6 +6,10 @@
 import com.saladbowl.api.tax.law.TaxLawService;
 import com.saladbowl.api.tax.law.TaxLawVersion;
 import com.saladbowl.api.tax.law.TaxLawVersionRepository;
+import com.saladbowl.api.tax.record.TaxRecordDtos.CardRequest;
+import com.saladbowl.api.tax.record.TaxRecordDtos.CardView;
+import com.saladbowl.api.tax.record.TaxRecordDtos.CashRequest;
+import com.saladbowl.api.tax.record.TaxRecordDtos.CashView;
 import com.saladbowl.api.tax.record.TaxRecordDtos.LawVersionRef;
 import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
 import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
@@ -16,7 +20,9 @@
 import java.time.Clock;
 import java.time.LocalDate;
 import java.time.ZoneId;
+import java.util.List;
 import java.util.Optional;
+import java.util.stream.Stream;
 
 /**
  * 회원 본인의 소득공제 자료. 서버 검사는 "요청자 = 소유자" 하나이고 그룹과 무관하다(GroupAccess를 쓰지 않는다).
@@ -29,13 +35,18 @@
     private static final ZoneId KST = ZoneId.of("Asia/Seoul");
 
     private final TaxYearRecordRepository records;
+    private final TaxCardStatementRepository cards;
+    private final TaxCashReceiptRepository cashReceipts;
     private final TaxLawService laws;
     private final TaxLawVersionRepository lawVersions;
     private final Clock clock;
 
-    public TaxRecordService(TaxYearRecordRepository records, TaxLawService laws,
+    public TaxRecordService(TaxYearRecordRepository records, TaxCardStatementRepository cards,
+                            TaxCashReceiptRepository cashReceipts, TaxLawService laws,
                             TaxLawVersionRepository lawVersions, Clock clock) {
         this.records = records;
+        this.cards = cards;
+        this.cashReceipts = cashReceipts;
         this.laws = laws;
         this.lawVersions = lawVersions;
         this.clock = clock;
@@ -77,6 +88,55 @@
         records.delete(lockOwned(userId, year));
     }
 
+    @Transactional
+    public TaxYearView addCard(long userId, int year, CardRequest request) {
+        TaxYearRecord record = lockOwned(userId, year);
+        cards.saveAndFlush(TaxCardStatement.create(record.getId(), issuerName(request.issuerName()),
+                asOfDate(request.asOfDate(), year), blankToNull(request.memo()), request.amounts()));
+        return viewWithinTotalLimit(record);
+    }
+
+    @Transactional
+    public TaxYearView updateCard(long userId, int year, long cardId, CardRequest request) {
+        TaxYearRecord record = lockOwned(userId, year);
+        TaxCardStatement card = requireCard(record, cardId);
+        requireRowVersion(card.getRowVersion(), request.rowVersion());
+        card.edit(issuerName(request.issuerName()), asOfDate(request.asOfDate(), year),
+                blankToNull(request.memo()), request.amounts());
+        cards.saveAndFlush(card);
+        return viewWithinTotalLimit(record);
+    }
+
+    /** 다른 곳에서 새 누계로 고친 자료를 옛 화면에서 지우지 않도록 삭제도 rowVersion을 본다. */
+    @Transactional
+    public void deleteCard(long userId, int year, long cardId, long rowVersion) {
+        TaxYearRecord record = lockOwned(userId, year);
+        TaxCardStatement card = requireCard(record, cardId);
+        requireRowVersion(card.getRowVersion(), rowVersion);
+        cards.delete(card);
+    }
+
+    /** 현금영수증 자료는 연도에 하나다. 없으면 만들고(rowVersion 없이), 있으면 고친다(rowVersion 필수). */
+    @Transactional
+    public TaxYearView saveCashReceipt(long userId, int year, CashRequest request) {
+        TaxYearRecord record = lockOwned(userId, year);
+        LocalDate asOfDate = asOfDate(request.asOfDate(), year);
+        String memo = blankToNull(request.memo());
+        Optional<TaxCashReceipt> existing = cashReceipts.findById(record.getId());
+        if (existing.isEmpty()) {
+            if (request.rowVersion() != null) {
+                throw conflict();
+            }
+            cashReceipts.saveAndFlush(TaxCashReceipt.create(record.getId(), asOfDate, memo, request.amounts()));
+        } else {
+            TaxCashReceipt cash = existing.get();
+            requireRowVersion(cash.getRowVersion(), request.rowVersion());
+            cash.edit(asOfDate, memo, request.amounts());
+            cashReceipts.saveAndFlush(cash);
+        }
+        return viewWithinTotalLimit(record);
+    }
+
     /** 읽기용. 요청자의 그 귀속연도 기록이 없으면 404다. 조회(이 클래스와 PR 4의 분석)가 쓴다. */
     public TaxYearRecord requireOwned(long userId, int year) {
         return records.findByOwnerIdAndTaxYear(userId, year).orElseThrow(TaxRecordService::notFound);
@@ -87,6 +147,39 @@
         return records.findOwnedForUpdate(userId, year).orElseThrow(TaxRecordService::notFound);
     }
 
+    /** 소유한 연도 기록에 딸린 카드 자료만 찾는다. 남의 자료와 없는 자료는 같은 404다. */
+    private TaxCardStatement requireCard(TaxYearRecord record, long cardId) {
+        return cards.findByIdAndRecordId(cardId, record.getId()).orElseThrow(TaxRecordService::notFound);
+    }
+
+    private static String issuerName(String raw) {
+        String name = raw.trim();
+        if (name.isEmpty() || name.length() > 50) {
+            throw invalid("issuerName: 1~50자로 입력하세요");
+        }
+        return name;
+    }
+
+    private static LocalDate asOfDate(LocalDate date, int year) {
+        if (date.getYear() != year) {
+            throw invalid("asOfDate: 귀속연도 안의 날짜여야 합니다");
+        }
+        return date;
+    }
+
+    private static String blankToNull(String value) {
+        return value == null || value.isBlank() ? null : value.trim();
+    }
+
+    /** 저장한 뒤의 연도 합계가 금액 상한을 넘으면 저장을 되돌린다. 계산기(PR 4)는 합계가 상한 이하라고 가정한다. */
+    private TaxYearView viewWithinTotalLimit(TaxYearRecord record) {
+        TaxYearView view = view(record);
+        if (view.totals().max() > TaxRecordDtos.MAX_AMOUNT) {
+            throw invalid("amounts: 연도 합계가 9,999,999,999,999원을 넘습니다");
+        }
+        return view;
+    }
+
     private void requireCreatableYear(int year) {
         int thisYear = LocalDate.now(clock.withZone(KST)).getYear();
         if (year < thisYear - 1 || year > thisYear + 1) {
@@ -97,8 +190,21 @@
     private TaxYearView view(TaxYearRecord record) {
         LawVersionRef lawVersion = record.getLawVersionId() == null ? null
                 : lawVersions.findById(record.getLawVersionId()).map(TaxRecordService::toRef).orElse(null);
+        List<TaxCardStatement> cardRows = cards.findByRecordIdOrderByIdAsc(record.getId());
+        TaxCashReceipt cash = cashReceipts.findById(record.getId()).orElse(null);
+        List<CardView> cardViews = cardRows.stream().map(c -> new CardView(c.getId(), c.getRowVersion(),
+                c.getIssuerName(), c.getAsOfDate(), c.getMemo(), c.amounts(), c.blankCount())).toList();
+        CashView cashView = cash == null ? null : new CashView(cash.getRowVersion(), cash.getAsOfDate(),
+                cash.getMemo(), cash.amounts(), cash.blankCount());
+        // 현금영수증 자료를 한 번도 입력하지 않은 연도는 4칸이 빈 것으로 센다(TAX-24).
+        int blankCount = cardRows.stream().mapToInt(TaxCardStatement::blankCount).sum()
+                + (cash == null ? 4 : cash.blankCount());
+        long asOfDates = Stream.concat(cardRows.stream().map(TaxCardStatement::getAsOfDate),
+                Stream.ofNullable(cash).map(TaxCashReceipt::getAsOfDate)).distinct().count();
         return new TaxYearView(record.getTaxYear(), record.getRowVersion(), record.getTotalSalary(),
-                record.getWorkStartMonth(), record.getWorkEndMonth(), record.getChildCount(), lawVersion);
+                record.getWorkStartMonth(), record.getWorkEndMonth(), record.getChildCount(), lawVersion,
+                cardViews, cashView, SpendingTotals.of(cardRows, cash), blankCount,
+                !cardRows.isEmpty() || cash != null, asOfDates > 1);
     }
 
     private static LawVersionRef toRef(TaxLawVersion version) {
@@ -109,10 +215,14 @@
     /** 저장된 값과 요청의 rowVersion이 다르면(없는 것 포함) 다른 곳에서 먼저 바뀐 것이다. */
     static void requireRowVersion(long stored, Long requested) {
         if (requested == null || stored != requested) {
-            throw new ApiException(ErrorCode.CONFLICT, "tax record was modified elsewhere");
+            throw conflict();
         }
     }
 
+    static ApiException conflict() {
+        return new ApiException(ErrorCode.CONFLICT, "tax record was modified elsewhere");
+    }
+
     static ApiException invalid(String message) {
         return new ApiException(ErrorCode.VALIDATION_FAILED, message);
     }
```

- [ ] **Step 7: 컨트롤러**

`main/tax/record/TaxRecordController.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordController.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordController.java
@@ -1,6 +1,8 @@
 package com.saladbowl.api.tax.record;
 
 import com.saladbowl.api.auth.CurrentUser;
+import com.saladbowl.api.tax.record.TaxRecordDtos.CardRequest;
+import com.saladbowl.api.tax.record.TaxRecordDtos.CashRequest;
 import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
 import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
 import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
@@ -12,9 +14,11 @@
 import org.springframework.web.bind.annotation.DeleteMapping;
 import org.springframework.web.bind.annotation.GetMapping;
 import org.springframework.web.bind.annotation.PathVariable;
+import org.springframework.web.bind.annotation.PostMapping;
 import org.springframework.web.bind.annotation.PutMapping;
 import org.springframework.web.bind.annotation.RequestBody;
 import org.springframework.web.bind.annotation.RequestMapping;
+import org.springframework.web.bind.annotation.RequestParam;
 import org.springframework.web.bind.annotation.RestController;
 
 /** 로그인한 회원 본인의 소득공제 자료. 경로에 회원 id가 없고 항상 요청자의 자료만 다룬다. */
@@ -45,4 +49,31 @@
         service.deleteYear(userId, year);
         return ResponseEntity.noContent().build();
     }
+
+    @PostMapping("/cards")
+    public ResponseEntity<TaxYearView> addCard(@CurrentUser Long userId,
+                                               @PathVariable @Min(1000) @Max(9999) int year,
+                                               @Valid @RequestBody CardRequest request) {
+        return ResponseEntity.status(HttpStatus.CREATED).body(service.addCard(userId, year, request));
+    }
+
+    @PutMapping("/cards/{cardId}")
+    public TaxYearView updateCard(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
+                                  @PathVariable long cardId, @Valid @RequestBody CardRequest request) {
+        return service.updateCard(userId, year, cardId, request);
+    }
+
+    @DeleteMapping("/cards/{cardId}")
+    public ResponseEntity<Void> deleteCard(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
+                                           @PathVariable long cardId, @RequestParam long rowVersion) {
+        service.deleteCard(userId, year, cardId, rowVersion);
+        return ResponseEntity.noContent().build();
+    }
+
+    // 현금영수증 자료에는 삭제 경로를 두지 않는다(D19). 연도 기록을 지우면 함께 지워진다.
+    @PutMapping("/cash-receipt")
+    public TaxYearView saveCashReceipt(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
+                                       @Valid @RequestBody CashRequest request) {
+        return service.saveCashReceipt(userId, year, request);
+    }
 }
```

- [ ] **Step 8: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxStatementApiTest' --tests '*TaxYearApiTest'`
Expected: `BUILD SUCCESSFUL`. `TaxStatementApiTest` 14건, `TaxYearApiTest` 15건 통과.

- [ ] **Step 9: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(임시 복사본에서는 전체 358건 통과).

- [ ] **Step 10: 커밋(컨트롤러)**

```bash
git add apps/api/src/main/java/com/saladbowl/api/tax/record apps/api/src/test/java/com/saladbowl/api/support/TestTaxRecords.java apps/api/src/test/java/com/saladbowl/api/tax/record
git commit -m "feat(api): 소득공제 카드 자료·현금영수증 자료와 연도 합계" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

---

### Task 3.3: 지출계획 저장과 세법 버전 기억·다시 계산 (TAX-51, 66, 70, 29)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `main/tax/record/TaxSpendingPlan.java`, `TaxSpendingPlanRepository.java`
- Modify: `main/tax/record/TaxRecordDtos.java`, `TaxYearRecord.java`, `TaxRecordService.java`, `TaxRecordController.java`
- Modify: `main/tax/law/TaxLawService.java`(`apply`의 NULL 채우기와 advisory lock, `currentAppliedForNewRecord`)
- Modify: `test/support/TestTaxRecords.java`, `test/support/TestTaxLaws.java`
- Test: `test/tax/record/TaxPlanApiTest.java`(생성), `test/tax/record/TaxLawPinApiTest.java`(생성)

**Interfaces:**
- Consumes: Task 3.1·3.2의 `TaxRecordService.lockOwned`·`requireRowVersion`·`conflict()`·`view`·`saveYear`, `TaxYearRecord`, `TaxRecordDtos.MAX_AMOUNT`·`@WholeNumber`·`YearRequest`, PR 2의 `TaxLawService.apply(long adminId, long id, long rowVersion)`·`currentApplied(int)`·`lockDraft`, `TestTaxLaws.createFilledDraft`(끝난 뒤 `rowVersion` 1), `TaxLawConcurrencyTest.runTogether`(Task 3.1에서 `public`).
- Produces:
  - `TaxRecordDtos.PlanRow(Long creditFixed, Long debitFixed, Long flexible)`, `PlanRequest(PlanRow general, PlanRow market, PlanRow transit, PlanRow culture, Long rowVersion)`, `PlanView(long rowVersion, PlanRow general, PlanRow market, PlanRow transit, PlanRow culture)`.
  - `TaxYearView`에 `boolean newerLawVersion`(`lawVersion` 뒤)과 `PlanView plan`(`cashReceipt` 뒤)이 붙는다. 최종 순서: `taxYear, rowVersion, totalSalary, workStartMonth, workEndMonth, childCount, lawVersion, newerLawVersion, cards, cashReceipt, plan, totals, blankCount, hasInputs, asOfDateMismatch`.
  - `TaxSpendingPlan`: `static create(long recordId, PlanRequest)`, `edit(PlanRequest)`, `general()`·`market()`·`transit()`·`culture(): PlanRow`, `getRowVersion(): Long`. `TaxSpendingPlanRepository`(기본 키 = 연도 기록 id). PR 4의 현재 계획 배분·추천이 `TaxYearView.plan`을 읽는다.
  - `TaxYearRecord.useLawVersion(long lawVersionId)`.
  - `TaxRecordService.savePlan(long userId, int year, PlanRequest): TaxYearView`, `refreshLawVersion(long userId, int year): TaxYearView`.
  - `TaxLawService.currentAppliedForNewRecord(int taxYear): Optional<TaxLawVersion>`(연도 기록을 만드는 트랜잭션 안에서만 부른다).
  - HTTP: `PUT /tax/years/{year}/plan`, `POST /tax/years/{year}/law-version/refresh`.
  - 테스트 헬퍼 `TestTaxRecords.planBody(Long rowVersion, Long... amounts12)`, `putPlan(mvc, user, year, body)`, `TestTaxLaws.createApplied(mvc, admin, taxYear): long`.

`apply`의 순서: 초안 행 잠금(`lockDraft`) → `rowVersion` 비교 → 검증 → 그 귀속연도의 advisory 배타 잠금 → 상태 변경·flush → `tax_year = ? AND law_version_id IS NULL`인 연도 기록에 이 버전 넣기. 모두 한 트랜잭션이다. 기존 `TaxLawApplyApiTest`·`TaxLawConcurrencyTest`는 고치지 않아도 통과한다(임시 복사본에서 확인).

- [ ] **Step 1: 실패하는 테스트 작성**

헬퍼를 더한다.

`test/support/TestTaxRecords.java`

```diff
--- a/apps/api/src/test/java/com/saladbowl/api/support/TestTaxRecords.java
+++ b/apps/api/src/test/java/com/saladbowl/api/support/TestTaxRecords.java
@@ -80,4 +80,25 @@
         return mvc.perform(put(URL + "/" + year + "/cash-receipt").header("Authorization", user.bearer())
                 .contentType(MediaType.APPLICATION_JSON).content(body));
     }
+
+    /**
+     * 지출계획 본문. amounts는 일반·전통시장·대중교통·문화체육 순서로 각 행의
+     * 신용카드 고정 / 체크카드·현금영수증 고정 / 변경 가능, 모두 12칸이다.
+     */
+    public static String planBody(Long rowVersion, Long... amounts) {
+        return """
+                {"rowVersion": %s,
+                  "general": {"creditFixed": %s, "debitFixed": %s, "flexible": %s},
+                  "market": {"creditFixed": %s, "debitFixed": %s, "flexible": %s},
+                  "transit": {"creditFixed": %s, "debitFixed": %s, "flexible": %s},
+                  "culture": {"creditFixed": %s, "debitFixed": %s, "flexible": %s}}
+                """.formatted(rowVersion, amounts[0], amounts[1], amounts[2], amounts[3], amounts[4], amounts[5],
+                amounts[6], amounts[7], amounts[8], amounts[9], amounts[10], amounts[11]);
+    }
+
+    public static ResultActions putPlan(MockMvc mvc, TestAuth.AuthedUser user, int year, String body)
+            throws Exception {
+        return mvc.perform(put(URL + "/" + year + "/plan").header("Authorization", user.bearer())
+                .contentType(MediaType.APPLICATION_JSON).content(body));
+    }
 }
```

`test/support/TestTaxLaws.java`

```diff
--- a/apps/api/src/test/java/com/saladbowl/api/support/TestTaxLaws.java
+++ b/apps/api/src/test/java/com/saladbowl/api/support/TestTaxLaws.java
@@ -61,6 +61,15 @@
         return id;
     }
 
+    /** 새 초안을 2026 값으로 채워 적용하고 그 id를 돌려준다. */
+    public static long createApplied(MockMvc mvc, TestAuth.AuthedUser admin, int taxYear) throws Exception {
+        long id = createFilledDraft(mvc, admin, taxYear);
+        mvc.perform(post(URL + "/" + id + "/apply").header("Authorization", admin.bearer())
+                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":1}"))
+                .andExpect(status().isOk());
+        return id;
+    }
+
     /** 적용 API(Task 2.3) 없이 적용본을 만든다. 적용본의 수정·삭제 거부와 current 조회 테스트에 쓴다. */
     public static void markApplied(JdbcTemplate jdbc, long id, long adminId) {
         jdbc.update("UPDATE tax_law_versions SET status = 'APPLIED', applied_by = ?, applied_at = now() WHERE id = ?",
```

`test/tax/record/TaxPlanApiTest.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.planBody;
import static com.saladbowl.api.support.TestTaxRecords.putPlan;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 지출계획 저장(TAX-51, 70, 29, AC-01, 33, 36). 금액은 모두 합성값이고 테스트의 올해는 2026이다. */
@Import(TestClock.Config.class)
class TaxPlanApiTest extends IntegrationTest {

    private static final long MAX = 9_999_999_999_999L;

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser owner;

    @BeforeEach
    void createOwnerYear() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
        createYear(mvc, owner, 2026);
    }

    /** 일반 300,000 / 200,000 / 900,000, 전통시장 0 / 50,000 / 100,000, 대중교통 0 / 0 / 120,000, 문화체육 40,000 / 0 / 60,000. */
    private static String plan(Long rowVersion) {
        return planBody(rowVersion, 300_000L, 200_000L, 900_000L, 0L, 50_000L, 100_000L,
                0L, 0L, 120_000L, 40_000L, 0L, 60_000L);
    }

    private static String zeroPlanWith(Long rowVersion, long generalFlexible) {
        return planBody(rowVersion, 0L, 0L, generalFlexible, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L);
    }

    private int planCount() {
        return jdbc.queryForObject("SELECT count(*) FROM tax_spending_plans", Integer.class);
    }

    @Test
    void planIsSavedAndReadBackEvenWithoutStatementsOrLaw() throws Exception {
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan").value(nullValue()));

        // 자료가 미완료이고 세법이 없어도 저장된다(TAX-75).
        putPlan(mvc, owner, 2026, plan(null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.rowVersion").value(0))
                .andExpect(jsonPath("$.plan.general.creditFixed").value(300_000))
                .andExpect(jsonPath("$.plan.general.debitFixed").value(200_000))
                .andExpect(jsonPath("$.plan.general.flexible").value(900_000))
                .andExpect(jsonPath("$.plan.market.debitFixed").value(50_000))
                .andExpect(jsonPath("$.plan.transit.flexible").value(120_000))
                .andExpect(jsonPath("$.plan.culture.creditFixed").value(40_000))
                .andExpect(jsonPath("$.plan.culture.flexible").value(60_000))
                // 지출계획은 연도 합계표(입력자료의 합)에 들어가지 않는다.
                .andExpect(jsonPath("$.totals.creditGeneral").value(0))
                .andExpect(jsonPath("$.rowVersion").value(0));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(900_000))
                .andExpect(jsonPath("$.plan.culture.flexible").value(60_000));

        putPlan(mvc, owner, 2026, zeroPlanWith(0L, 500_000L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.rowVersion").value(1))
                .andExpect(jsonPath("$.plan.general.flexible").value(500_000))
                .andExpect(jsonPath("$.plan.general.creditFixed").value(0));
        assertThat(planCount()).isEqualTo(1);
    }

    @Test
    void stalePlanSaveIsConflictAndKeepsTheFirstSave() throws Exception {
        // 아직 없는 계획을 고치려는 요청(rowVersion 있음)은 만들지 않는다.
        putPlan(mvc, owner, 2026, plan(0L)).andExpect(status().isConflict());
        assertThat(planCount()).isZero();

        putPlan(mvc, owner, 2026, plan(null)).andExpect(status().isOk());
        putPlan(mvc, owner, 2026, zeroPlanWith(0L, 500_000L)).andExpect(status().isOk());

        for (Long stale : new Long[]{0L, null}) {
            putPlan(mvc, owner, 2026, zeroPlanWith(stale, 777_000L))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("CONFLICT"));
        }
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(500_000))
                .andExpect(jsonPath("$.plan.rowVersion").value(1));
    }

    @Test
    void rejectsInvalidPlan() throws Exception {
        String[] invalid = {
                zeroPlanWith(null, -1L),
                zeroPlanWith(null, MAX + 1),
                planBody(null, 0L, null, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L),
                plan(null).replace("900000}", "900000.5}"),
                "{\"general\": {\"creditFixed\": 0, \"debitFixed\": 0, \"flexible\": 0}}",
                "{}"
        };
        for (String body : invalid) {
            putPlan(mvc, owner, 2026, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        assertThat(planCount()).isZero();

        putPlan(mvc, owner, 2026, zeroPlanWith(null, MAX)).andExpect(status().isOk());
    }

    @Test
    void anotherMemberCannotReachMyPlan() throws Exception {
        putPlan(mvc, owner, 2026, plan(null)).andExpect(status().isOk());
        AuthedUser stranger = TestAuth.signupAndLogin(mvc, "stranger@example.test", "남");

        // 연도 기록이 없는 회원은 404다.
        putPlan(mvc, stranger, 2026, zeroPlanWith(0L, 1L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        putPlan(mvc, stranger, 2026, zeroPlanWith(null, 1L)).andExpect(status().isNotFound());
        // 자기 연도 기록이 있으면 자기 계획이 따로 생기고 내 계획은 그대로다.
        createYear(mvc, stranger, 2026);
        putPlan(mvc, stranger, 2026, zeroPlanWith(null, 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.general.flexible").value(1));

        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(900_000))
                .andExpect(jsonPath("$.plan.rowVersion").value(0));
        assertThat(planCount()).isEqualTo(2);
    }

    @Test
    void deletingTheYearDeletesItsPlanOnly() throws Exception {
        createYear(mvc, owner, 2025);
        putPlan(mvc, owner, 2025, zeroPlanWith(null, 25_000L)).andExpect(status().isOk());
        putPlan(mvc, owner, 2026, plan(null)).andExpect(status().isOk());

        mvc.perform(delete(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(status().isNoContent());

        assertThat(planCount()).isEqualTo(1);
        mvc.perform(get(URL + "/2025").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan.general.flexible").value(25_000));
        // 같은 연도를 다시 만들면 계획 없이 시작한다.
        createYear(mvc, owner, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.plan").value(nullValue()));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(put(URL + "/2026/plan").contentType(MediaType.APPLICATION_JSON).content(plan(null)))
                .andExpect(status().isUnauthorized());
    }
}
```

세법 버전 기억 테스트. 마지막 테스트는 첫 버전 적용과 연도 기록 만들기를 실제 트랜잭션으로 겹친다. advisory lock이 없으면 `law_version_id`가 NULL로 남는 회차가 나온다(임시 복사본에서 잠금을 빼고 2회 실행해 2회 모두 실패를 봤다).

`test/tax/record/TaxLawPinApiTest.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestTaxLaws;
import com.saladbowl.api.tax.law.TaxLawConcurrencyTest;
import com.saladbowl.api.tax.law.TaxLawService;
import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.putYear;
import static com.saladbowl.api.support.TestTaxRecords.yearBody;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 연도 기록이 기억하는 세법 버전과 다시 계산(TAX-66, AC-19, 알려진 제약 7번). 테스트의 올해는 2026이다. */
@Import(TestClock.Config.class)
class TaxLawPinApiTest extends IntegrationTest {

    private static final String REFRESH = "/law-version/refresh";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TaxLawService laws;

    @Autowired
    TaxRecordService records;

    AuthedUser admin;
    AuthedUser owner;

    @BeforeEach
    void signUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@example.test", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
    }

    private Long pinnedLawId(long ownerId, int year) {
        return jdbc.queryForObject("SELECT law_version_id FROM tax_year_records WHERE owner_id = ? AND tax_year = ?",
                Long.class, ownerId, year);
    }

    @Test
    void newerVersionIsOnlyAnnouncedUntilTheMemberRefreshes() throws Exception {
        long first = TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.lawVersion.id").value(first))
                .andExpect(jsonPath("$.newerLawVersion").value(false));

        // 초안은 회원에게 영향이 없다.
        long second = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.newerLawVersion").value(false));

        mvc.perform(post(TestTaxLaws.URL + "/" + second + "/apply").header("Authorization", admin.bearer())
                        .contentType("application/json").content("{\"rowVersion\":1}"))
                .andExpect(status().isOk());
        // 새 버전이 적용돼도 연도 기록의 버전은 그대로이고 알림만 켜진다(AC-19).
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.lawVersion.id").value(first))
                .andExpect(jsonPath("$.lawVersion.versionNo").value(1))
                .andExpect(jsonPath("$.newerLawVersion").value(true))
                .andExpect(jsonPath("$.rowVersion").value(0));
        assertThat(pinnedLawId(owner.id(), 2026)).isEqualTo(first);

        mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion.id").value(second))
                .andExpect(jsonPath("$.lawVersion.versionNo").value(2))
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.rowVersion").value(1));
        // 이미 현재 버전이면 아무것도 바뀌지 않는다.
        mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion.id").value(second))
                .andExpect(jsonPath("$.rowVersion").value(1));
    }

    @Test
    void firstAppliedVersionReachesWaitingRecordsOfThatYearOnly() throws Exception {
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@example.test", "다른 회원");
        createYear(mvc, owner, 2025);
        createYear(mvc, owner, 2026);
        createYear(mvc, other, 2026);
        mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andExpect(jsonPath("$.lawVersion").value(nullValue()))
                .andExpect(jsonPath("$.newerLawVersion").value(false));

        long lawId = TestTaxLaws.createApplied(mvc, admin, 2026);

        // 회원이 누르지 않아도 "세법 준비 중"이 풀린다. 다른 귀속연도의 기록은 그대로다.
        for (AuthedUser member : new AuthedUser[]{owner, other}) {
            mvc.perform(get(URL + "/2026").header("Authorization", member.bearer()))
                    .andExpect(jsonPath("$.lawVersion.id").value(lawId))
                    .andExpect(jsonPath("$.newerLawVersion").value(false));
        }
        assertThat(pinnedLawId(owner.id(), 2025)).isNull();
        // 세법 버전을 채워도 기본정보의 rowVersion은 오르지 않는다. 열어 둔 화면의 저장이 409가 되지 않는다.
        putYear(mvc, owner, 2026, yearBody(52_000_000L, 1, 12, 0, 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion.id").value(lawId));
    }

    @Test
    void refreshWithoutAnAppliedVersionKeepsTheRecordWaiting() throws Exception {
        createYear(mvc, owner, 2026);
        TestTaxLaws.createFilledDraft(mvc, admin, 2026);

        mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lawVersion").value(nullValue()))
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.rowVersion").value(0));
    }

    @Test
    void refreshReachesOnlyTheRequestersOwnYear() throws Exception {
        long first = TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        TestTaxLaws.createApplied(mvc, admin, 2026);

        // 연도 기록이 없는 회원(서비스 관리자 포함)은 404이고 남의 기록은 바뀌지 않는다.
        mvc.perform(post(URL + "/2026" + REFRESH).header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(post(URL + "/2026" + REFRESH)).andExpect(status().isUnauthorized());

        assertThat(pinnedLawId(owner.id(), 2026)).isEqualTo(first);
    }

    /** 첫 버전 적용과 연도 기록 만들기가 겹쳐도 세법 버전 없이 남는 기록이 없어야 한다. */
    @Test
    void recordsCreatedWhileTheFirstVersionIsBeingAppliedStillGetIt() throws Exception {
        List<AuthedUser> members = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            members.add(TestAuth.signupAndLogin(mvc, "member" + i + "@example.test", "회원" + i));
        }
        YearRequest request = new YearRequest(40_000_000L, 1, 12, 0, null);
        for (int round = 0; round < 10; round++) {
            jdbc.update("DELETE FROM tax_year_records");
            jdbc.update("DELETE FROM tax_law_versions");
            long lawId = TestTaxLaws.createFilledDraft(mvc, admin, 2026);
            List<Callable<String>> calls = new ArrayList<>();
            calls.add(() -> {
                laws.apply(admin.id(), lawId, 1L);
                return "APPLIED";
            });
            for (AuthedUser member : members) {
                calls.add(() -> {
                    records.saveYear(member.id(), 2026, request);
                    return "CREATED";
                });
            }

            List<String> results = TaxLawConcurrencyTest.runTogether(calls);

            assertThat(results).as("round %d", round)
                    .containsExactly("APPLIED", "CREATED", "CREATED", "CREATED", "CREATED");
            assertThat(jdbc.queryForList("SELECT law_version_id FROM tax_year_records", Long.class))
                    .as("round %d", round).containsOnly(lawId).hasSize(4);
        }
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxPlanApiTest' --tests '*TaxLawPinApiTest'`
Expected: `11 tests completed, 9 failed`. `TaxPlanApiTest.requiresLogin`과 `TaxLawPinApiTest.refreshReachesOnlyTheRequestersOwnYear`만 통과한다(경로가 없어 404·401).

- [ ] **Step 3: DTO**

`main/tax/record/TaxRecordDtos.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordDtos.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordDtos.java
@@ -86,13 +86,34 @@
     public record CashView(long rowVersion, LocalDate asOfDate, String memo, CashAmounts amounts, int blankCount) {
     }
 
+    /** 지출계획의 소비구분 한 행: 신용카드 고정 / 체크카드·현금영수증 고정 / 변경 가능. 빈 칸이 없다. */
+    public record PlanRow(
+            @NotNull @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long creditFixed,
+            @NotNull @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long debitFixed,
+            @NotNull @Min(0) @Max(MAX_AMOUNT) @WholeNumber Long flexible) {
+    }
+
+    /** 지출계획 저장. 처음 저장은 rowVersion을 보내지 않고, 그 뒤로는 읽을 때 받은 rowVersion을 보낸다. */
+    public record PlanRequest(
+            @NotNull @Valid PlanRow general,
+            @NotNull @Valid PlanRow market,
+            @NotNull @Valid PlanRow transit,
+            @NotNull @Valid PlanRow culture,
+            @WholeNumber Long rowVersion) {
+    }
+
+    public record PlanView(long rowVersion, PlanRow general, PlanRow market, PlanRow transit, PlanRow culture) {
+    }
+
     /** 연도 기록이 기억하는 세법 버전. childTiersApply는 웹이 자녀등 입력란을 보일지 판단하는 값이다. */
     public record LawVersionRef(long id, int versionNo, OffsetDateTime appliedAt, boolean childTiersApply) {
     }
 
     /**
      * 연도 기록 묶음. 모든 조회·저장 응답이 이 모양이다.
+     * newerLawVersion은 연도 기록의 세법 버전이 그 귀속연도의 현재 적용 버전과 다른지다.
      * cashReceipt가 null이면 한 번도 입력하지 않은 것이고 blankCount에 4칸으로 센다.
+     * plan이 null이면 지출계획을 저장한 적이 없다.
      * totals는 미입력 칸을 0으로 더한 연도 합계표다. asOfDateMismatch는 자료끼리 기준일이 서로 다른지다.
      */
     public record TaxYearView(
@@ -103,8 +124,10 @@
             int workEndMonth,
             int childCount,
             LawVersionRef lawVersion,
+            boolean newerLawVersion,
             List<CardView> cards,
             CashView cashReceipt,
+            PlanView plan,
             SpendingTotals totals,
             int blankCount,
             boolean hasInputs,
```

- [ ] **Step 4: 엔티티와 저장소**

`main/tax/record/TaxSpendingPlan.java`

```java
package com.saladbowl.api.tax.record;

import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRequest;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * 지출계획. 연도 기록당 하나다. 남은 기간의 예상 공제대상액을 소비구분 4 x
 * (신용카드 고정 / 체크카드·현금영수증 고정 / 변경 가능)으로 받는다. 추천 결과는 저장하지 않는다.
 */
@Entity
@Table(name = "tax_spending_plans")
public class TaxSpendingPlan {

    @Id
    @Column(name = "record_id")
    private Long recordId;

    @Column(name = "general_credit_fixed", nullable = false)
    private long generalCreditFixed;

    @Column(name = "general_debit_fixed", nullable = false)
    private long generalDebitFixed;

    @Column(name = "general_flexible", nullable = false)
    private long generalFlexible;

    @Column(name = "market_credit_fixed", nullable = false)
    private long marketCreditFixed;

    @Column(name = "market_debit_fixed", nullable = false)
    private long marketDebitFixed;

    @Column(name = "market_flexible", nullable = false)
    private long marketFlexible;

    @Column(name = "transit_credit_fixed", nullable = false)
    private long transitCreditFixed;

    @Column(name = "transit_debit_fixed", nullable = false)
    private long transitDebitFixed;

    @Column(name = "transit_flexible", nullable = false)
    private long transitFlexible;

    @Column(name = "culture_credit_fixed", nullable = false)
    private long cultureCreditFixed;

    @Column(name = "culture_debit_fixed", nullable = false)
    private long cultureDebitFixed;

    @Column(name = "culture_flexible", nullable = false)
    private long cultureFlexible;

    // id를 직접 넣는 엔티티라 저장소가 새 행인지를 이 값이 null인지로 판단한다. 그래서 long이 아니라 Long이다.
    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    protected TaxSpendingPlan() {
    }

    public static TaxSpendingPlan create(long recordId, PlanRequest request) {
        TaxSpendingPlan plan = new TaxSpendingPlan();
        plan.recordId = recordId;
        plan.edit(request);
        return plan;
    }

    /** 12칸을 덮어쓴다. 이전 값은 남지 않는다. */
    public void edit(PlanRequest request) {
        generalCreditFixed = request.general().creditFixed();
        generalDebitFixed = request.general().debitFixed();
        generalFlexible = request.general().flexible();
        marketCreditFixed = request.market().creditFixed();
        marketDebitFixed = request.market().debitFixed();
        marketFlexible = request.market().flexible();
        transitCreditFixed = request.transit().creditFixed();
        transitDebitFixed = request.transit().debitFixed();
        transitFlexible = request.transit().flexible();
        cultureCreditFixed = request.culture().creditFixed();
        cultureDebitFixed = request.culture().debitFixed();
        cultureFlexible = request.culture().flexible();
    }

    public PlanRow general() { return new PlanRow(generalCreditFixed, generalDebitFixed, generalFlexible); }
    public PlanRow market() { return new PlanRow(marketCreditFixed, marketDebitFixed, marketFlexible); }
    public PlanRow transit() { return new PlanRow(transitCreditFixed, transitDebitFixed, transitFlexible); }
    public PlanRow culture() { return new PlanRow(cultureCreditFixed, cultureDebitFixed, cultureFlexible); }
    public Long getRowVersion() { return rowVersion; }
}
```

`main/tax/record/TaxSpendingPlanRepository.java`

```java
package com.saladbowl.api.tax.record;

import org.springframework.data.jpa.repository.JpaRepository;

/** 기본 키가 연도 기록 id다. 소유한 연도 기록을 먼저 찾고 그 id로 읽는다. */
public interface TaxSpendingPlanRepository extends JpaRepository<TaxSpendingPlan, Long> {
}
```

`main/tax/record/TaxYearRecord.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxYearRecord.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxYearRecord.java
@@ -75,6 +75,11 @@
         childCount = request.childCount();
     }
 
+    /** 현재 적용 버전으로 바꾼다. 회원이 다시 계산을 눌렀을 때만 부른다. */
+    public void useLawVersion(long lawVersionId) {
+        this.lawVersionId = lawVersionId;
+    }
+
     @PrePersist
     void onCreate() {
         createdAt = updatedAt = OffsetDateTime.now();
```

- [ ] **Step 5: 세법 적용이 기다리던 연도 기록을 채우게 한다** — `JdbcTemplate`은 JPA와 같은 트랜잭션·같은 연결을 쓴다(번호 카운터와 같다). UPDATE는 `tax_year`와 `law_version_id IS NULL` 두 조건을 모두 건다.

`main/tax/law/TaxLawService.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/law/TaxLawService.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/law/TaxLawService.java
@@ -28,6 +28,9 @@
             RETURNING last_version_no
             """;
 
+    // 'TAXL'. 연도 기록 만들기(공유)와 그 귀속연도의 세법 적용(배타)이 서로를 기다리게 하는 advisory lock의 첫 번째 키.
+    private static final int APPLY_LOCK = 0x5441584C;
+
     private final TaxLawVersionRepository versions;
     private final UserRepository users;
     private final JdbcTemplate jdbc;
@@ -88,8 +91,16 @@
             FieldError first = errors.get(0);
             throw new ApiException(ErrorCode.VALIDATION_FAILED, first.field() + ": " + first.message());
         }
+        // 만드는 중인 연도 기록이 커밋될 때까지 기다린다. 기다리지 않으면 아래 UPDATE가 그 행을 보지 못하고,
+        // 그 기록은 적용 버전을 못 본 채 세법 버전 없이 남는다.
+        jdbc.query("SELECT pg_advisory_xact_lock(?, ?)", rs -> { }, APPLY_LOCK, draft.getTaxYear());
         draft.apply(adminId, OffsetDateTime.now());
-        return toAdminResponse(versions.saveAndFlush(draft));
+        VersionResponse response = toAdminResponse(versions.saveAndFlush(draft));
+        // 적용 버전이 없어 기다리던 그 귀속연도의 연도 기록만 이 버전을 기억한다. 이미 버전이 있는 기록은
+        // 회원이 다시 계산을 누를 때까지 그대로다(TAX-66). 기본정보의 row_version은 올리지 않는다.
+        jdbc.update("UPDATE tax_year_records SET law_version_id = ? WHERE tax_year = ? AND law_version_id IS NULL",
+                draft.getId(), draft.getTaxYear());
+        return response;
     }
 
     /** 회원용: 그 귀속연도의 현재 적용 버전. 작성자·적용자 닉네임과 메모는 내리지 않는다. */
@@ -103,6 +114,15 @@
         return versions.findFirstByTaxYearAndStatusOrderByAppliedAtDescIdDesc(taxYear, TaxLawStatus.APPLIED);
     }
 
+    /**
+     * 새 연도 기록이 기억할 현재 적용 버전. 연도 기록을 만드는 트랜잭션 안에서 부른다.
+     * 같은 귀속연도의 적용(apply)이 진행 중이면 끝날 때까지 기다렸다가 읽는다.
+     */
+    public Optional<TaxLawVersion> currentAppliedForNewRecord(int taxYear) {
+        jdbc.query("SELECT pg_advisory_xact_lock_shared(?, ?)", rs -> { }, APPLY_LOCK, taxYear);
+        return currentApplied(taxYear);
+    }
+
     /** 행을 잠그고 초안인지 확인한다. 잠금 뒤에 상태를 보므로 동시에 적용된 버전은 여기서 409가 된다. */
     private TaxLawVersion lockDraft(long id) {
         TaxLawVersion version = versions.findByIdForUpdate(id).orElseThrow(TaxLawService::notFound);
```

- [ ] **Step 6: 서비스** — 연도 기록을 만들 때 `currentApplied` 대신 `currentAppliedForNewRecord`를 부른다.

`main/tax/record/TaxRecordService.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordService.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordService.java
@@ -11,6 +11,8 @@
 import com.saladbowl.api.tax.record.TaxRecordDtos.CashRequest;
 import com.saladbowl.api.tax.record.TaxRecordDtos.CashView;
 import com.saladbowl.api.tax.record.TaxRecordDtos.LawVersionRef;
+import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRequest;
+import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;
 import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
 import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
 import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
@@ -21,6 +23,7 @@
 import java.time.LocalDate;
 import java.time.ZoneId;
 import java.util.List;
+import java.util.Objects;
 import java.util.Optional;
 import java.util.stream.Stream;
 
@@ -37,16 +40,18 @@
     private final TaxYearRecordRepository records;
     private final TaxCardStatementRepository cards;
     private final TaxCashReceiptRepository cashReceipts;
+    private final TaxSpendingPlanRepository plans;
     private final TaxLawService laws;
     private final TaxLawVersionRepository lawVersions;
     private final Clock clock;
 
     public TaxRecordService(TaxYearRecordRepository records, TaxCardStatementRepository cards,
-                            TaxCashReceiptRepository cashReceipts, TaxLawService laws,
-                            TaxLawVersionRepository lawVersions, Clock clock) {
+                            TaxCashReceiptRepository cashReceipts, TaxSpendingPlanRepository plans,
+                            TaxLawService laws, TaxLawVersionRepository lawVersions, Clock clock) {
         this.records = records;
         this.cards = cards;
         this.cashReceipts = cashReceipts;
+        this.plans = plans;
         this.laws = laws;
         this.lawVersions = lawVersions;
         this.clock = clock;
@@ -70,7 +75,7 @@
                 throw notFound();
             }
             requireCreatableYear(year);
-            Long lawVersionId = laws.currentApplied(year).map(TaxLawVersion::getId).orElse(null);
+            Long lawVersionId = laws.currentAppliedForNewRecord(year).map(TaxLawVersion::getId).orElse(null);
             // 같은 회원이 동시에 두 번 만들면 UNIQUE (owner_id, tax_year)가 한쪽을 409로 만든다.
             TaxYearRecord created = records.saveAndFlush(TaxYearRecord.create(userId, year, request, lawVersionId));
             return new SavedYear(true, view(created));
@@ -137,6 +142,33 @@
         return viewWithinTotalLimit(record);
     }
 
+    /** 지출계획은 연도에 하나다. 없으면 만들고(rowVersion 없이), 있으면 고친다(rowVersion 필수). 자료가 미완료여도 저장된다. */
+    @Transactional
+    public TaxYearView savePlan(long userId, int year, PlanRequest request) {
+        TaxYearRecord record = lockOwned(userId, year);
+        Optional<TaxSpendingPlan> existing = plans.findById(record.getId());
+        if (existing.isEmpty()) {
+            if (request.rowVersion() != null) {
+                throw conflict();
+            }
+            plans.saveAndFlush(TaxSpendingPlan.create(record.getId(), request));
+        } else {
+            TaxSpendingPlan plan = existing.get();
+            requireRowVersion(plan.getRowVersion(), request.rowVersion());
+            plan.edit(request);
+            plans.saveAndFlush(plan);
+        }
+        return view(record);
+    }
+
+    /** 회원이 [새 버전으로 다시 계산]을 눌렀을 때만 연도 기록의 세법 버전을 현재 적용 버전으로 바꾼다(TAX-66). */
+    @Transactional
+    public TaxYearView refreshLawVersion(long userId, int year) {
+        TaxYearRecord record = lockOwned(userId, year);
+        laws.currentApplied(year).ifPresent(current -> record.useLawVersion(current.getId()));
+        return view(records.saveAndFlush(record));
+    }
+
     /** 읽기용. 요청자의 그 귀속연도 기록이 없으면 404다. 조회(이 클래스와 PR 4의 분석)가 쓴다. */
     public TaxYearRecord requireOwned(long userId, int year) {
         return records.findByOwnerIdAndTaxYear(userId, year).orElseThrow(TaxRecordService::notFound);
@@ -190,6 +222,9 @@
     private TaxYearView view(TaxYearRecord record) {
         LawVersionRef lawVersion = record.getLawVersionId() == null ? null
                 : lawVersions.findById(record.getLawVersionId()).map(TaxRecordService::toRef).orElse(null);
+        Long currentLawVersionId = laws.currentApplied(record.getTaxYear()).map(TaxLawVersion::getId).orElse(null);
+        PlanView plan = plans.findById(record.getId()).map(p -> new PlanView(p.getRowVersion(), p.general(),
+                p.market(), p.transit(), p.culture())).orElse(null);
         List<TaxCardStatement> cardRows = cards.findByRecordIdOrderByIdAsc(record.getId());
         TaxCashReceipt cash = cashReceipts.findById(record.getId()).orElse(null);
         List<CardView> cardViews = cardRows.stream().map(c -> new CardView(c.getId(), c.getRowVersion(),
@@ -203,7 +238,8 @@
                 Stream.ofNullable(cash).map(TaxCashReceipt::getAsOfDate)).distinct().count();
         return new TaxYearView(record.getTaxYear(), record.getRowVersion(), record.getTotalSalary(),
                 record.getWorkStartMonth(), record.getWorkEndMonth(), record.getChildCount(), lawVersion,
-                cardViews, cashView, SpendingTotals.of(cardRows, cash), blankCount,
+                !Objects.equals(record.getLawVersionId(), currentLawVersionId),
+                cardViews, cashView, plan, SpendingTotals.of(cardRows, cash), blankCount,
                 !cardRows.isEmpty() || cash != null, asOfDates > 1);
     }
 
```

- [ ] **Step 7: 컨트롤러**

`main/tax/record/TaxRecordController.java`

```diff
--- a/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordController.java
+++ b/apps/api/src/main/java/com/saladbowl/api/tax/record/TaxRecordController.java
@@ -3,6 +3,7 @@
 import com.saladbowl.api.auth.CurrentUser;
 import com.saladbowl.api.tax.record.TaxRecordDtos.CardRequest;
 import com.saladbowl.api.tax.record.TaxRecordDtos.CashRequest;
+import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRequest;
 import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
 import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
 import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
@@ -76,4 +77,15 @@
                                        @Valid @RequestBody CashRequest request) {
         return service.saveCashReceipt(userId, year, request);
     }
+
+    @PutMapping("/plan")
+    public TaxYearView savePlan(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
+                                @Valid @RequestBody PlanRequest request) {
+        return service.savePlan(userId, year, request);
+    }
+
+    @PostMapping("/law-version/refresh")
+    public TaxYearView refreshLawVersion(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
+        return service.refreshLawVersion(userId, year);
+    }
 }
```

- [ ] **Step 8: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*tax*'`
Expected: `BUILD SUCCESSFUL`. `TaxPlanApiTest` 6건, `TaxLawPinApiTest` 5건, `TaxStatementApiTest` 14건, `TaxYearApiTest` 15건, 기존 `TaxLawApplyApiTest` 15건, `TaxLawConcurrencyTest` 4건, `TaxLawAdminApiTest` 13건, `TaxLawValidatorTest` 9건, `TaxAdminAccessTest` 5건 통과.

- [ ] **Step 9: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(임시 복사본에서는 전체 369건 통과).

- [ ] **Step 10: 커밋(컨트롤러)**

```bash
git add apps/api/src/main/java/com/saladbowl/api/tax apps/api/src/test/java/com/saladbowl/api/support/TestTaxRecords.java apps/api/src/test/java/com/saladbowl/api/support/TestTaxLaws.java apps/api/src/test/java/com/saladbowl/api/tax/record
git commit -m "feat(api): 소득공제 지출계획 저장과 세법 버전 기억·다시 계산" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

---

### PR 3 마무리 (컨트롤러)

- [ ] `cd apps/api && ./gradlew test` 결과를 구현 보고와 대조한다(이미 통과한 것은 변경 없이 다시 돌리지 않는다). `memoryTest`는 생략하고 PR 본문 "확인"에 이유(업로드 한도·파서·메모리 변경 없음)를 적는다.
- [ ] `api` 모드 뒤처리: `git status`에 `apps/api` 밖의 변경이 없는지, `~/.gradle/init.d`·`~/.gradle/gradle.properties`가 바뀌지 않았는지 확인한다.
- [ ] 브랜치 최종 리뷰: Claude Fable 5.2 서브에이전트 한 번(`review-final`). 볼 것: 요구사항 추적표의 PR 3 항목(TAX-01·02·03·20~24·26~29·51·65·66·70, AC-01·02·03·14·15·19·20·22·28·30·31·33·36·37)이 테스트로 덮였는지, "HTTP 인터페이스" 표·`TaxYearView` 필드와 실제 응답이 같은지, PR 4가 쓸 `SpendingTotals`·`TaxRecordService.get`·`requireOwned`의 시그니처.
- [ ] **반론 리뷰: Codex `gpt-6-astra` / `xhigh` (`read`, 템플릿 F, 태그 `review-risk`)**. 대상은 `origin/main..HEAD`의 `apps/api` 변경이다. 깨 보라고 요청할 것:
  - 소유권 우회
    - `owner_id` 조건 없이 읽거나 쓰는 쿼리가 있는가: `tax/record`의 `findById`·`getReferenceById`·`existsById`·`deleteById`·JPQL·native SQL을 모두 본다. `cashReceipts.findById`·`plans.findById`의 인자가 항상 `lockOwned`·`requireOwned`가 돌려준 기록의 id인지, `cards`를 `findByIdAndRecordId` 말고 다른 길로 읽는 곳이 있는지.
    - `cardId`를 다른 회원의 것, 같은 회원의 다른 귀속연도 것으로 바꿔 수정·삭제할 수 있는가. 본문에 `recordId`·`ownerId`·`id`·`lawVersionId`를 넣어 엔티티에 바인딩되는 길이 있는가(요청 record에 없는 필드여야 한다).
    - 그룹 ADMIN·공개 중인 같은 그룹 회원·서비스 관리자가 닿는 길: `tax/record`에 `GroupAccess`·`ServiceAdminGuard`·`groupId` 참조가 없어야 한다. `/tax/admin/**` 쪽에서 연도 기록을 읽어 내보내는 응답이 있는가(`apply` 응답에 채운 기록 수·회원 정보가 실리지 않는지).
  - 응답 차이로 남의 자료 존재가 새는가
    - 남의 `cardId`와 없는 `cardId`에 대해 상태 코드·`code`·`message`·응답 시간(잠금 대기)이 같은가. 틀린 `rowVersion`·잘못된 본문·기준일 오류를 섞었을 때 404보다 409·400이 먼저 나오는 조합이 있는가(판정 순서: 본문 형식 400 → 연도 기록 404 → 카드 자료 404 → `rowVersion` 409 → 서비스 검증 400).
    - 다른 회원이 이미 만든 연도를 내가 만들 때 409가 나오는 길이 있는가(`UNIQUE (owner_id, tax_year)`는 회원별이어야 한다). 연속 id(`cards[].id`)로 다른 회원의 자료 수를 짐작하는 것 말고 내용이 새는 곳이 있는가.
    - 403이 나오는 경로가 `/tax/years/**`에 있는가(없어야 한다).
  - 삭제 연쇄
    - 연도 기록 삭제가 그 회원·그 귀속연도의 카드 자료·현금영수증 자료·지출계획만 지우는가. 다른 귀속연도·다른 회원의 행, `tax_law_versions`에 닿는가.
    - 연도 기록 삭제와 그 연도의 카드 추가·지출계획 저장이 겹치면 부모 없는 행이나 500이 나오는가(둘 다 연도 기록 행 잠금을 거치는지). 삭제 뒤 같은 연도를 다시 만들었을 때 옛 `cardId`·옛 `rowVersion`으로 새 기록을 고칠 수 있는가.
    - 연도 기록 삭제가 부모 `rowVersion`만 비교하여 딸린 자료 변경은 감지하지 못하는 한계("결정이 필요한 점" 1번). 현금영수증 자료를 지우는 길(`DELETE`, 본문 `amounts: null`)이 있는가.
    - 연도 기록이 가리키는 세법 버전을 지울 수 있는가(초안은 참조되지 않아야 한다. 복합 FK가 초안·다른 연도 버전 참조를 막는지).
  - `apply`의 NULL 채우기 경합
    - 적용과 연도 기록 만들기가 겹쳐 적용 버전이 있는데 `law_version_id`가 NULL로 남는 순서가 있는가. advisory lock을 잡는 시점(만들기: 현재 적용 버전을 읽기 전, 적용: 상태 변경 전)과 푸는 시점(커밋)이 맞는지, `currentAppliedForNewRecord`를 트랜잭션 밖에서 부르는 곳이 있는지.
    - UPDATE가 다른 귀속연도나 이미 버전이 있는 기록을 건드리는가. 적용이 검증 실패·`rowVersion` 불일치로 롤백될 때 채운 값도 되돌아가는가.
    - 서로 다른 초안 둘을 같은 연도에 동시에 적용하면 기다리던 기록이 어느 버전을 갖는가, 그때 `newerLawVersion`이 맞는가. 적용과 `refresh`·기본정보 수정이 겹칠 때 Hibernate가 전체 열을 쓰면서 `law_version_id`를 옛 값(NULL)으로 되돌리는 순서가 있는가.
    - 초안 행 잠금 → advisory lock → 연도 기록 행 잠금 순서에서 교착이 생기는 조합이 있는가(연도 기록 쓰기는 advisory lock을 기다리지 않아야 한다).
  - `rowVersion` 우회
    - `rowVersion` 없이 또는 `null`·소수·문자열·음수·`Long` 범위 밖 값으로 기존 행을 덮어쓰는 길이 있는가. 현금영수증 자료·지출계획의 "없으면 만들기"가 이미 있는 행을 덮는 순서가 있는가.
    - 잠금 없이 읽고 쓰는 쓰기 경로(`lockOwned`를 거치지 않는 `save`·`delete`)가 있는가. 같은 `rowVersion`으로 동시에 들어온 두 수정이 둘 다 성공하는가.
    - 값이 같은 수정(변경 없음)에서 `rowVersion`이 오르지 않는 것이 문제를 만드는가.
  - 금액·연도 검증 우회
    - 음수·상한 초과·소수·지수 표기(`1e3`)·문자열 숫자·아주 큰 수가 저장되는가. 칸마다는 상한 이하인데 연도 합계가 상한을 넘거나 `long`을 넘치는 길(카드 자료를 많이 더하기, 수정으로 늘리기)이 있는가. 합계 상한 검사가 저장을 실제로 되돌리는가.
    - 연도 범위: `PUT`의 만들기 말고 연도 기록이 생기는 길이 있는가. 한국 시각 연말·연초 경계, `year` 경로 값(`02026`, `+2026`, 공백, 음수)의 처리.
    - 기준일이 귀속연도 밖이거나 없는 날짜, 카드사명이 공백·제어문자·51자 이상, 메모 201자 이상, 근로기간 역전, `childCount` 음수가 DB까지 가는가(가더라도 CHECK가 막아 500이 되지 않는지).
- [ ] 반론 리뷰의 발견은 원래 구현자(`resume-api`)가 고치고, 고친 범위만 Claude가 다시 본다. 이중 리뷰를 하지 않는다.
- [ ] PR 본문 "무엇"에 남길 것: 소유권 검사가 조회 조건 한 가지라는 점, 행 잠금 + `rowVersion` 비교 방식과 `GlobalExceptionHandler`를 고치지 않은 이유, 세법 적용 때의 NULL 채우기와 advisory lock, "계획 초안에서 달라진 점"·"결정이 필요한 점" 목록, 이 PR은 화면이 없어 캡처가 없다는 점. `## 소모값`은 `python3 scripts/pr_usage.py` 출력으로 채운다.
- [ ] 배포 순서(`docs/deploy.md` 12절): 이 PR은 API만 바꾼다. 병합 뒤 Render 배포가 Live가 되면 V10이 실행된다(`tax_law_versions`에 UNIQUE 제약 추가 포함. 행이 몇 개뿐이라 잠금 시간은 무시할 수 있다).

---

# PR 4 — 계산기·추천·분석 조회 API

구현 뒤 주의(2026-11-17): remainingToThreshold 정의와 lawRates 필드는 구현 코드가 우선.

반론 리뷰 대상이 아니다(이유는 "PR 4 마무리"). 브랜치: `feat/tax-calc-api`(최신 `origin/main` `f908524`에서 만든 worktree). PR 제목 예: `feat(api): 소득공제 계산기·추천·분석 조회 API`.

검증: `cd apps/api && ./gradlew test`. 업로드·파서를 건드리지 않으므로 `memoryTest`는 생략하고 PR 본문에 이유를 적는다(API CI는 둘 다 돌린다). JDK 21과 Docker(Testcontainers)가 필요하다. 계산기·배분·추천 테스트는 Spring 없이 도는 단위 테스트다.

이 PR의 코드와 테스트는 계획을 쓸 때 저장소 밖 임시 복사본에서 Task 순서대로 실행해 확인했다(2026-11-17, `f908524` 기준, 시작 시점 전체 375건). Task마다 테스트를 먼저 넣어 실패를 보고(4.1: 10건 중 10건, 4.2: 16건 중 16건, 4.3: 7건 중 7건 실패) 구현을 넣은 뒤 `./gradlew cleanTest test` 전체를 돌렸다(4.1 뒤 385건, 4.2 뒤 401건, 4.3 뒤 408건 통과). 아래 코드 블록은 그 임시 복사본의 파일을 그대로 옮긴 것이다. 저장소의 앱 코드는 아직 바꾸지 않았다.

경로 줄임: `main/` = `apps/api/src/main/java/com/saladbowl/api/`, `test/` = `apps/api/src/test/java/com/saladbowl/api/`. 이 PR은 새 파일만 만든다(`main/tax/calc/` 11개, `test/tax/calc/` 4개). 기존 파일·migration·테스트 헬퍼는 고치지 않는다. 그래서 `diff` 블록이 없고 모든 블록이 파일 전체다.

## 조문 대조 (PRD 14장, 2026-11-17)

PRD 7.1절 산식과 8.1절 값을 착수 전에 공개 자료와 다시 대조했다. **PRD와 다른 값은 없었다.** 값을 바꾸지 않았다.

| 항목 | PRD 값 | 확인한 자료 | 결과 |
|---|---|---|---|
| 최저사용금액 | 총급여의 25% 초과분부터 | 국세청 안내, 조문 열람 사이트(법 ①) | 일치 |
| 공제율 | 신용 15 / 직불·현금영수증 30 / 문화체육 30(7천만원 이하만) / 전통시장 40 / 대중교통 40 | 국세청 안내, 조문 열람 사이트(법 ② 1~5호) | 일치 |
| 최저사용금액 차감액 3경우 | 7.1절 3번 식 | 국세청 안내의 계산식 ⑥ | 일치(세 경우의 조건과 식이 같다) |
| 7천만원 초과의 문화체육 | 원래 결제수단의 일반 사용분 | 국세청 안내의 계산식 ①~③("총급여 7천만원 이하자의 문화체육 사용분"만 따로 뺀다) | 일치 |
| 기본한도 | 7천만원 이하 300만 / 초과 250만 | 국세청 안내, 조문 열람 사이트(법 ⑩) | 일치 |
| 자녀등 한도(2026 귀속) | 7천만원 이하 350만·400만 / 초과 275만·300만 | 조문 열람 사이트(법 ⑩), 2차 자료 1건 | 일치. 국세청 안내에는 이 내용이 없다(PRD 8.1절에 이미 적힌 차이) |
| 추가한도 | 7천만원 이하: 전통+대중+문화체육 공제액 합계, 300만 / 초과: 전통+대중, 200만 | 국세청 안내 ⑦, 조문 열람 사이트(법 ⑪ 1호) | 일치 |
| 일몰 | 2028.12.31. 사용분까지 | 조문 열람 사이트(법 ①) | 일치 |

- 근거 URL: 국세청 안내 https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2469&cntntsId=7794 , 조문 열람 https://casenote.kr/법령/조세특례제한법/제126조의2 (2025.12.23. 법률 제21223호 개정 이력 표시), 2차 자료 https://asiatop.co.kr/tax/yearend-income-deduction-items-2026/ .
- **불확실한 점.** 국가법령정보센터(PRD 8.1절의 `law.go.kr` 주소)는 본문을 스크립트로 불러와 이번 도구로는 조문 원문을 읽지 못했다. 조문은 열람 사이트의 요지와 국세청 안내로 확인했고, 두 자료 모두 요약 도구를 거쳐 읽었다. 법 ⑪ 2호(전년 대비 증가분, 2024년 한정)는 PRD대로 계산에 넣지 않는다. 원 단위 처리·중도 입퇴사 합산 기간·취소분 귀속은 여전히 미확인이다(PRD 8.1절 "미확인").
- **2027 귀속에 영향을 줄 수 있는 것.** 2026.8.3. 발표된 2026년 세제개편안은 2027년 사용분부터 대중교통 우대 폐지, 추가한도 축소(200만·100만), 문화체육 30%의 7천만원 요건 폐지를 담고 있다(기사 https://news.mtn.co.kr/news-detail/2026080315521251297 , 확인 시점에 국회 미확정). 2026 귀속 계산에는 영향이 없다. 확정되면 대중교통 공제율·추가한도는 세법 버전 값으로 바꿀 수 있지만 "문화체육 우대는 낮은 급여구간만"은 계산기에 고정돼 있어 알고리즘 버전 2가 필요하다(PRD 8.2절).

## 계산 규칙 (알고리즘 버전 1)

- 입력: 총급여 S, 자녀등 수, `SpendingTotals` 12칸, `TaxLawValues`. 체크카드와 현금영수증은 "직불등"으로 묶는다.
- S ≤ `bracketBoundary`면 낮은 구간(문화체육 우대 적용), 초과면 높은 구간(문화체육을 원래 결제수단의 일반으로 보고 문화체육 = 0).
- 최저사용금액 L = S × `minSpendRatePct` ÷ 100. 전체가 L 이하면 0원이다("달성"은 초과다. 같으면 미달이다).
- 공제 가능 금액 = Σ(구분 금액 × 그 공제율) − 차감액. 차감액은 L을 신용 → 직불등 → 문화체육 → 전통시장 → 대중교통 순으로 채우며 채운 부분에 그 공제율을 곱한 합이다. 2025·2026 값(직불등과 문화체육 30%, 전통시장과 대중교통 40%)에서는 PRD 7.1절 3번 식과 같다. 전체가 L 이하면 모든 구분이 다 채워져 차감액 = Σ(구분 금액 × 공제율)이 되므로 따로 분기하지 않아도 0원이다.
- 기본한도 H = 구간 × 자녀등 단계(0 / 1 / 2명 이상). **자녀등 단계가 없는 세법(세 칸이 같은 값, `childTiersApply == false`)에서는 저장된 `childCount`를 쓰지 않고 0명 칸을 읽는다.** 서버는 `childCount`를 항상 저장하기 때문이다(PR 3). 추가 인정액 = min(공제 가능 금액 − H, 전통시장·대중교통·문화체육의 금액 × 공제율 합계, 구간별 추가한도 상한), 공제 가능 금액 ≤ H면 0. 소득공제액 = min(공제 가능 금액, H) + 추가 인정액.
- 정수 연산: 중간값은 원 × 10,000 `long`이다(금액 × 100 × 퍼센트). 최종 소득공제액에서 10,000으로 나눠 한 번 내린다(TAX-45). 부동소수점을 쓰지 않는다.
- 오버플로: 연도 합계표 한 칸과 지출계획 한 칸의 상한이 9,999,999,999,999원이므로 계산기에 들어가는 12칸의 합은 누계 12칸 + 지출계획 12칸 = 24 × 상한 < 240조 원이다. 공제율이 모두 100%여도 중간값은 240조 × 100 × 100 = 2.4 × 10^18로 `long` 최댓값(약 9.22 × 10^18) 안이다. 최저사용금액은 상한 × 100 = 10^15, 한도는 상한 × 10,000 = 10^17 이하다. 이 최악 입력을 계산기·추천 테스트에 넣었다. 현재 계획 배분의 `V × 입력액`(약 10^26)만 `BigInteger`로 곱한다.
- 과정 값(`threshold`, `beforeThresholdCut`, `thresholdCut`, `deductible`, `basicUsed`, `extraEligible`, `extraUsed`)은 화면 표시용으로 각각 원 미만을 버린 값이다. `remainingToThreshold`는 사용 합계에 더해 최저사용금액을 넘기는 최소 정수 원(이미 넘었으면 0)이다. 계산 결과는 `amount` 하나이고, 과정 값을 다시 더해 `amount`를 만들지 않는다("결정이 필요한 점" 1번).
- 현재 계획 배분: PRD 7.2절 규칙 1~5. 신용카드 몫은 "바꿀 수 있는 금액 − 체크카드 몫 − 현금영수증 몫"으로 구한다(신용카드 몫도 원 미만을 버린 뒤 남는 원을 더한 값과 같다).
- 추천: 현재 계획에서 시작해 소비구분을 일반 → 문화체육 → 전통시장 → 대중교통 순으로 보며, 그 소비구분의 "바꿀 수 있는 금액"을 전부 체크카드·현금영수증 / 전부 신용카드에 둔 두 후보를 같은 계산기로 계산해 지금까지의 최댓값보다 엄격히 클 때만 바꾼다. 같으면 현재 계획의 배분을 유지한다. 근사식을 쓰지 않는다. 비교하는 값은 원 미만을 버린 소득공제액이다.
- 이유는 문장이 아니라 코드와 숫자로 내려 준다(문장은 웹이 만든다). 공제액이 커진 소비구분마다 `CREDIT_OVER_THRESHOLD`(체크카드·현금영수증으로 옮김, `category`, `amount` = 현재 계획에서 신용카드에 있던 금액) 또는 `CREDIT_RATE_HIGHER`(신용카드로 옮김. 신용카드 공제율을 더 높게 설정한 세법에서만 나온다). 차이가 없으면 아래 순서로 먼저 맞는 것 하나: `NO_FLEXIBLE_AMOUNT`(바꿀 수 있는 금액이 모두 0) → `BELOW_THRESHOLD`(현재 계획의 연말 예상이 최저사용금액 이하, `amount` = 남은 금액) → `LIMIT_REACHED`(소득공제액 = 기본한도 + min(추가한도 대상 공제액, 추가한도 상한)) → `METHOD_NEUTRAL`(바꿀 수 있는 금액이 일반에 없고, 문화체육에도 없거나 낮은 급여구간) → `ALREADY_BEST`(그 밖. 예: 지금까지 체크카드만 써서 현재 계획이 이미 전부 체크카드, 신용카드가 최저사용금액 아래).

## HTTP 인터페이스 (웹 PR 7이 쓴다)

`GET /tax/years/{year}/analysis` — 로그인 회원 본인의 연도 기록만 계산한다. 본문·쿼리가 없다.

- 비로그인 401 `UNAUTHORIZED`. `year`가 1000~9999 정수가 아니면 400 `VALIDATION_FAILED`. 요청자에게 그 연도 기록이 없으면 404 `NOT_FOUND`(`tax record not found`)이고, 남의 연도와 없는 연도의 응답이 같다. 서비스 관리자도 남의 연도는 404다. `/tax/admin/**`이 아니므로 `TaxAdminInterceptor`가 걸리지 않는다.
- 읽기 전용이다. 행 잠금을 잡지 않고 아무 행도 쓰지 않으며 `rowVersion`이 바뀌지 않는다. 결과를 저장하지 않으므로 새 테이블·migration이 없다(TAX-44).

`status`는 위에서부터 먼저 맞는 것이다: `NO_INPUT`(입력자료 없음. `hasInputs == false`) → `INCOMPLETE`(빈 칸 있음) → `LAW_PENDING`(자료 완료, 연도 기록에 세법 버전 없음) → `READY`.

응답 `TaxAnalysisView`

- 공통: `taxYear, status, blankCount, totals`(12칸. `TaxYearView.totals`와 같은 값)`, totalSalary, estimated`(= `asOfDateMismatch`)`, asOfDateMin, asOfDateMax`(자료가 없으면 `null`)`, partialYear`(근로기간이 1~12월 전체가 아님)`, law: {id, versionNo, appliedAt, childTiersApply} | null`(연도 기록이 기억한 버전. `TaxYearView.lawVersion`과 같은 모양)`, newerLawVersion, planSaved`.
- `lawRates`(`READY`일 때만, 아니면 `null`): `{minSpendRatePct, bracketBoundary, rateCreditPct, rateDebitCashPct, rateCulturePct, rateMarketPct, rateTransitPct}`. 연도 기록이 기억한 세법 버전의 계산 수치다.
- `deduction`(`READY`일 때만, 아니면 `null`): `{highBracket, credit, debitCash, culture, market, transit, total, threshold, thresholdReached, remainingToThreshold, beforeThresholdCut, thresholdCut, deductible, basicLimit, basicUsed, extraCap, extraEligible, extraUsed, amount}`. `credit`~`transit`은 계산에 쓴 구분 합계(PRD 7.1절의 A, B, M, T, P)다. `remainingToThreshold`는 최저사용금액을 넘기기 위해 더 쓸 최소 정수 원(이미 넘었으면 0)이며, `thresholdReached`는 원 미만까지 정확히 비교한 초과 여부다.
- `recommendation`(`READY`이고 지출계획이 저장돼 있을 때만, 아니면 `null`): `{methodShare: {creditPct, debitPct, cashPct} | null, current: {allocation, yearEndDeduction}, recommended: {allocation, yearEndDeduction}, difference, reasons: [{code, category, amount}]}`.
  - `methodShare`는 연도 합계표 전체의 결제수단 비율이다(퍼센트, 소수 첫째 자리 반올림, 예 `82.0`). 연도 합계가 0원이면 `null`이다. 반올림 때문에 세 값의 합이 100.0이 아닐 수 있다.
  - `allocation`은 소비구분 4개(`general, market, transit, culture`)마다 지출계획의 "바꿀 수 있는 금액"을 결제수단에 둔 금액이다. 고정액은 들어 있지 않다. `current`는 `{credit, debit, cash}`, `recommended`는 `{credit, debitCash}`다. 추천이 바꾸지 않은 소비구분은 `recommended.credit == current.credit`이다.
  - `yearEndDeduction`은 (누계 + 지출계획 전체)로 계산한 연말 예상 소득공제액, `difference = recommended − current`(0 이상)다.
  - `reasons[].category`는 `GENERAL | MARKET | TRANSIT | CULTURE` 또는 `null`, `amount`는 수 또는 `null`이다.
- 미완료·세법 준비 중이어도 `totals`·`blankCount`·`planSaved`는 내려간다. 웹은 `status`를 보고 현황 숫자와 추천을 그리지 않는다(TAX-38, TAX-75).

성능과 응답 크기: 요청마다 계산기를 10번(현황 1 + 현재 계획 1 + 후보 4 × 2) 부른다. 한 번이 12칸에 대한 고정 횟수의 정수 연산이고 `BigInteger` 나눗셈은 8번이라 입력 크기와 무관하게 일정하다. DB 읽기는 `GET /tax/years/{year}`와 같은 쿼리(카드 자료는 연도 기록당 50건 이하)다. 응답은 추천을 포함해 약 1.6KB(임시 복사본에서 1,627바이트)이고 카드 자료 건수와 무관하다.

## 계획 초안에서 달라진 점

- 현재 코드와 대조한 결과(`f908524`): 지출계획은 `TaxSpendingPlan`의 12칸 접근자가 아니라 `TaxYearView.plan`(`PlanView` → `PlanRow(Long creditFixed, Long debitFixed, Long flexible)` 4개)로 읽힌다. 그래서 초안의 `PlanAmounts`·`PlanAmounts.from(TaxSpendingPlan)`을 만들지 않고 `PlanView`를 그대로 받는다.
- 초안의 `record Allocation`(소비구분 4 × 3)은 `ByCategory<Split>`(현재 계획)과 `ByCategory<Pair>`(추천)로 나눴다. 추천은 체크카드와 현금영수증을 나누지 않기 때문이다. 소비구분 이름은 `enum SpendingCategory`다.
- 초안의 `TaxAnalysisDtos`는 `TaxAnalysisView`(+ `Status`) 하나다. `DeductionResult`·`Recommendation`은 변환 없이 그대로 응답에 싣는다.
- `TaxAnalysisService`는 `requireOwned`를 직접 부르지 않고 `TaxRecordService.get(userId, year)`(안에서 `requireOwned`를 부른다)의 `TaxYearView`를 쓴다. 합계·빈 칸 수·기준일 불일치·세법 버전·지출계획을 다시 조립하지 않기 위해서다. 회원 자료의 저장소를 `tax/calc`에서 직접 읽지 않는다. 세법 버전(전역 자료)만 `TaxLawVersionRepository.findById`로 읽는다.
- 응답 이름: `deduction`의 `A, B, M, T, P`는 `credit, debitCash, culture, market, transit`, `law`는 `{id, taxYear, versionNo, appliedAt}` 대신 PR 3의 `LawVersionRef`(`{id, versionNo, appliedAt, childTiersApply}`)를 다시 쓴다. 귀속연도는 응답 최상위 `taxYear`와 같다(복합 FK가 보장).
- 이유 코드에 `ALREADY_BEST`와 `CREDIT_RATE_HIGHER`를 더했다(초안의 5개로는 "현재 계획이 이미 전부 체크카드"인 경우와 신용카드 쪽으로 옮기는 경우의 문장이 틀린다).
- 테스트 표의 사례는 그대로이고 "최저사용금액 1원 미만", "최악 입력(오버플로)", "높은 급여구간의 문화체육 추천", `ALREADY_BEST`를 더했다. 표의 기대값은 모두 다시 계산해 맞는 것을 확인했다(틀린 값 없음).
- 실패 확인 방식: 4.1·4.2는 순수 새 클래스라 테스트만 넣으면 컴파일 오류다. 실패 건수를 보기 위해 Step 1에서 타입과 빈 메서드(틀)를 함께 넣는다.
- 브랜치 이름은 예시(`feat/tax-analysis-api`)가 아니라 실제 브랜치 `feat/tax-calc-api`다.

## 결정이 필요한 점 (기본값으로 썼다)

1. **과정 값은 원 미만을 버려 내려 준다.** `amount`만 계산 결과이고, 과정 값은 각각 따로 버리므로 `beforeThresholdCut − thresholdCut`이 `deductible`과 1원 다를 수 있다(예: 와이어프레임의 현재 계획 연말 1,997,272.55원). 다른 선택: 원 × 10,000 정수를 내려 웹이 소수까지 보인다(와이어프레임 설명서의 식은 소수를 적었다).
2. **이유 코드 7개와 판정 순서**(위 "계산 규칙"). 다른 선택: 초안의 5개만 쓰고 나머지는 `METHOD_NEUTRAL`로 묶는다(문장이 사실과 다를 수 있다).
3. **추천 탐색은 소비구분을 하나씩 보는 방식이다(계산기 9번).** 2025·2026 값처럼 신용카드 공제율이 직불등보다 높지 않으면 "소비구분 4개를 전부 신용 / 전부 직불등으로 둔 16개 조합과 현재 계획"의 최댓값과 같고, 이를 테스트로 고정했다. 관리자가 신용카드 공제율을 더 높게 설정하면 최댓값을 놓칠 수 있다. 다른 선택: 소비구분마다 (현재 계획 / 전부 신용 / 전부 직불등) 81개 조합을 모두 계산한다.
4. **`methodShare`는 소수 첫째 자리 반올림이고 합이 100.0이 아닐 수 있다. 연도 합계가 0원이면 `null`이다.** 다른 선택: 가장 큰 값에서 차이를 빼 합을 100.0으로 맞춘다.
5. **`allocation`에는 "바꿀 수 있는 금액"만 싣는다**(와이어프레임 ③의 표와 같다). 고정액을 더한 결제수단별 합계가 필요하면 웹이 `TaxYearView.plan`과 더한다(표시용 합산이고 공제액 계산이 아니다).
6. **`BELOW_THRESHOLD`와 `LIMIT_REACHED`는 현재 계획의 연말 예상으로 판정한다.** 지금 누계 기준의 달성 여부는 `deduction.thresholdReached`다.
7. **`NO_INPUT`일 때 `blankCount`는 4다**(현금영수증 자료가 없어서. PR 3의 `TaxYearView.blankCount`와 같은 값).
8. **"기본한도까지 남은 공제 여유"(TAX-55)와 사용액 비율(TAX-32~34)은 응답에 따로 없다.** 웹(PR 7)이 `basicLimit − basicUsed`와 `totals`의 비율로 그린다(표시용 산술이고 공제액 계산이 아니다). 다른 선택: 서버가 `basicRemaining`과 비율 필드를 더 내려 준다.

---

### Task 4.1: `DeductionCalculator` (TAX-35, 40, 41, 42, 45, 46, 71)

**담당:** Codex `gpt-6-astra` / `medium` (`api`, 계산 정확성), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `main/tax/calc/TaxLawValues.java`, `DeductionResult.java`, `DeductionCalculator.java`
- Test: `test/tax/calc/DeductionCalculatorTest.java`(생성. Spring 없는 단위 테스트)

**Interfaces:**
- Consumes: PR 3의 `record SpendingTotals(long creditGeneral, long creditMarket, long creditTransit, long creditCulture, long debitGeneral, long debitMarket, long debitTransit, long debitCulture, long cashGeneral, long cashMarket, long cashTransit, long cashCulture)`, PR 2의 `TaxLawVersion` getter(`getMinSpendRatePct(): Integer`, `getBracketBoundary(): Long`, `getRateCreditPct()`·`getRateDebitCashPct()`·`getRateCulturePct()`·`getRateMarketPct()`·`getRateTransitPct(): Integer`, `getBasicLimitLow0()`~`getBasicLimitLow2()`·`getBasicLimitHigh0()`~`getBasicLimitHigh2(): Long`, `getExtraLimitLow()`·`getExtraLimitHigh(): Long`).
- Produces:
  - `record TaxLawValues(int minSpendRatePct, long bracketBoundary, int rateCreditPct, int rateDebitCashPct, int rateCulturePct, int rateMarketPct, int rateTransitPct, List<Long> basicLimitLow, List<Long> basicLimitHigh, long extraLimitLow, long extraLimitHigh)`, `static TaxLawValues from(TaxLawVersion)`, `boolean childTiersApply()`.
  - `record DeductionResult(boolean highBracket, long credit, long debitCash, long culture, long market, long transit, long total, long threshold, boolean thresholdReached, long remainingToThreshold, long beforeThresholdCut, long thresholdCut, long deductible, long basicLimit, long basicUsed, long extraCap, long extraEligible, long extraUsed, long amount)`.
  - `static DeductionResult DeductionCalculator.calculate(long totalSalary, int childCount, SpendingTotals totals, TaxLawValues law)`.
  - 테스트 공용: `DeductionCalculatorTest.LAW_2026`, `LAW_2025`, `static SpendingTotals totals(long... 12칸)`(Task 4.2의 테스트가 쓴다).

기대값 표(손계산. 2026 값: 25% / 경계 70,000,000 / 15·30·30·40·40 / 기본한도 낮은 구간 300·350·400만, 높은 구간 250·275·300만 / 추가한도 300만·200만. 2025 값은 기본한도가 자녀등과 무관하게 300만·250만). 테스트 코드는 이 표의 숫자를 직접 적는다. 계산기를 불러 기대값을 만들지 않는다(AC-24).

| 사례 | 입력 | 기대 소득공제액 | 대응 |
|---|---|---|---|
| PRD 합성 예시 1 | S 4,000만, 신용 일반 1,200만, 체크 일반 200만 + 현금 일반 100만, 문화체육 50만, 전통시장 100만, 대중교통 50만 | 1,950,000 | AC-13, AC-08(L ≤ 신용), AC-12(기본한도 미달) |
| PRD 합성 예시 2 | S 8,000만, 신용 일반 3,000만, 체크 일반 1,000만, 체크 문화체육 100만, 전통시장 200만, 대중교통 100만 | 3,700,000 | AC-13, AC-10, AC-12(추가한도가 공제액 합계 1,200,000으로 제한) |
| 와이어프레임 현황 | S 5,000만, 일반 1,400만/200만/50만, 전통시장 30만/20만/10만, 대중교통 20만/30만/0, 문화체육 10만/10만/0 | 1,475,000 | 화면 숫자 |
| 최저사용금액 1원 미만 | S 4,000만, 신용 일반 9,999,999 | 0 | AC-07 |
| 최저사용금액과 같음 | S 4,000만, 신용 일반 10,000,000 | 0 (`thresholdReached` false) | AC-07 |
| 1원 초과 | S 4,000만, 신용 일반 10,000,001 | 0 (0.15원 → 원 미만 버림) | AC-07, TAX-45 |
| 7원 초과 | S 4,000만, 신용 일반 10,000,007 | 1 (1.05원) | AC-07 |
| 미달의 남은 금액 | S 4,000만, 신용 일반 4,000,000 | 0, 남은 금액 6,000,000 | TAX-35 |
| 신용 < L ≤ 신용+직불등+문화체육 | S 4,000만, 신용 일반 600만, 체크 일반 500만, 체크 문화체육 100만, 전통시장 100만 | 1,000,000 (공제율 곱 합 3,100,000, 차감 2,100,000) | AC-08 |
| L이 그보다 큼 | S 4,000만, 신용 일반 400만, 체크 일반 300만, 체크 문화체육 100만, 전통시장 300만, 대중교통 100만 | 800,000 (3,400,000 − 2,600,000) | AC-08 |
| 경계 정확히 | S 70,000,000, 신용 일반 2,000만, 신용 문화체육 100만 | 675,000 | AC-09 |
| 경계 + 1원 | S 70,000,001, 같은 입력 | 524,999 (524,999.9625) | AC-09, AC-10 |
| 기본한도 낮은 구간 | S 5,000만, 신용 일반 1억, 자녀등 0 / 1 / 2 / 3 | 3,000,000 / 3,500,000 / 4,000,000 / 4,000,000 | AC-11 |
| 기본한도 높은 구간 | S 8,000만, 신용 일반 1억, 자녀등 0 / 1 / 2 | 2,500,000 / 2,750,000 / 3,000,000 | AC-11 |
| 2025 값(자녀등 무시) | 위 두 줄을 2025 값으로, 자녀등 0 / 2 | 3,000,000 / 3,000,000, 2,500,000 / 2,500,000 | AC-11 |
| 기본한도 정확히 | S 4,000만, 신용 일반 3,000만 | 3,000,000 (추가 0) | AC-12 |
| 추가가 초과분으로 제한 | S 4,000만, 신용 일반 2,000만, 전통시장 500만 | 3,500,000 (추가 500,000) | AC-12 |
| 추가가 상한으로 제한 | S 4,000만, 신용 일반 3,000만, 전통시장 1,000만 | 6,000,000 (추가 3,000,000) | AC-12 |
| 최악 입력 | S 9,999,999,999,999, 12칸 각 20조, 비율 모두 100%, 경계·한도 모두 9,999,999,999,999 | 19,999,999,999,998 (공제 가능 230,000,000,000,001) | 오버플로 |

기대값의 독립성: 표의 숫자는 PRD 7.1절 3번 식(세 경우)으로 계산했고, 계산기는 같은 결과를 내는 다른 방법(채움 순서 루프)으로 구현한다. 계획을 쓸 때 표 전체를 PRD 식을 그대로 옮긴 별도 스크립트(Python `fractions`, 계산기 코드와 무관)로 다시 계산해 일치를 확인했다.

- [ ] **Step 1: 틀과 실패하는 테스트 작성**

값 타입 두 개는 최종 모양이고 계산기는 0만 돌려주는 틀이다.

`main/tax/calc/TaxLawValues.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.law.TaxLawVersion;

import java.util.List;

/**
 * 계산에 쓰는 세법 수치. 금액은 원, 비율은 정수 퍼센트다.
 * basicLimitLow·basicLimitHigh는 자녀등 0명 / 1명 / 2명 이상 순서의 3칸이다.
 */
public record TaxLawValues(
        int minSpendRatePct,
        long bracketBoundary,
        int rateCreditPct,
        int rateDebitCashPct,
        int rateCulturePct,
        int rateMarketPct,
        int rateTransitPct,
        List<Long> basicLimitLow,
        List<Long> basicLimitHigh,
        long extraLimitLow,
        long extraLimitHigh) {

    /** 적용된 세법 버전만 넘긴다. 적용본은 검증(TaxLawValidator)을 거쳐 빈 값이 없다. */
    public static TaxLawValues from(TaxLawVersion v) {
        return new TaxLawValues(v.getMinSpendRatePct(), v.getBracketBoundary(), v.getRateCreditPct(),
                v.getRateDebitCashPct(), v.getRateCulturePct(), v.getRateMarketPct(), v.getRateTransitPct(),
                List.of(v.getBasicLimitLow0(), v.getBasicLimitLow1(), v.getBasicLimitLow2()),
                List.of(v.getBasicLimitHigh0(), v.getBasicLimitHigh1(), v.getBasicLimitHigh2()),
                v.getExtraLimitLow(), v.getExtraLimitHigh());
    }

    /** 자녀등 단계별 기본한도가 서로 다른가. 같으면(2025 값) 자녀등 수는 계산에 쓰지 않는다. */
    public boolean childTiersApply() {
        return basicLimitLow.stream().distinct().count() > 1 || basicLimitHigh.stream().distinct().count() > 1;
    }
}
```

`main/tax/calc/DeductionResult.java`

```java
package com.saladbowl.api.tax.calc;

/**
 * 소득공제액과 그 계산 과정(TAX-35, TAX-71). 금액은 모두 원이다.
 * 과정 값(threshold ~ extraUsed)은 화면 표시용으로 원 미만을 버린 값이고, amount만 계산 결과다.
 *
 * @param highBracket          총급여가 급여구간 경계를 넘는가(문화체육 우대 없음)
 * @param credit               신용카드 일반(높은 구간은 신용카드 문화체육 포함)
 * @param debitCash            체크카드·현금영수증 일반(높은 구간은 문화체육 포함)
 * @param culture              문화체육(높은 구간은 0)
 * @param market               전통시장
 * @param transit              대중교통
 * @param total                위 다섯 구분의 합 = 연도 합계표 12칸의 합
 * @param threshold            최저사용금액
 * @param thresholdReached     total이 최저사용금액을 넘었는가
 * @param remainingToThreshold 최저사용금액까지 남은 금액(넘었으면 0)
 * @param beforeThresholdCut   구분 금액 × 공제율의 합
 * @param thresholdCut         최저사용금액 차감액
 * @param deductible           공제 가능 금액 = beforeThresholdCut − thresholdCut
 * @param basicLimit           기본한도
 * @param basicUsed            기본한도 안에서 인정된 금액
 * @param extraCap             추가한도 상한
 * @param extraEligible        추가한도 대상 공제액(전통시장·대중교통·문화체육의 금액 × 공제율 합)
 * @param extraUsed            추가 인정액
 * @param amount               소득공제액
 */
public record DeductionResult(
        boolean highBracket,
        long credit,
        long debitCash,
        long culture,
        long market,
        long transit,
        long total,
        long threshold,
        boolean thresholdReached,
        long remainingToThreshold,
        long beforeThresholdCut,
        long thresholdCut,
        long deductible,
        long basicLimit,
        long basicUsed,
        long extraCap,
        long extraEligible,
        long extraUsed,
        long amount) {
}
```

`main/tax/calc/DeductionCalculator.java` (틀. Step 3에서 구현으로 바꾼다)

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;

/** 신용카드 등 사용금액 소득공제액 계산(PRD 7.1절, 알고리즘 버전 1). 계산은 이 클래스 한 곳에서만 한다. */
public final class DeductionCalculator {

    private DeductionCalculator() {
    }

    public static DeductionResult calculate(long totalSalary, int childCount, SpendingTotals totals,
                                            TaxLawValues law) {
        return new DeductionResult(false, 0, 0, 0, 0, 0, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
}
```

`test/tax/calc/DeductionCalculatorTest.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 소득공제액 산식(PRD 7.1절, TAX-40~42·45·71, AC-07~13). DB 없이 계산만 본다.
 * 기대값은 PRD 7.1절 식을 손으로 계산한 숫자다(AC-24). 계산기를 불러 기대값을 만들지 않는다.
 */
class DeductionCalculatorTest {

    /** 2026 귀속 값(조세특례제한법 제126조의2, PRD 8.1절). */
    static final TaxLawValues LAW_2026 = new TaxLawValues(25, 70_000_000L, 15, 30, 30, 40, 40,
            List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
            3_000_000L, 2_000_000L);

    /** 2025 귀속 값. 자녀등 단계가 없어 세 칸이 같다. */
    static final TaxLawValues LAW_2025 = new TaxLawValues(25, 70_000_000L, 15, 30, 30, 40, 40,
            List.of(3_000_000L, 3_000_000L, 3_000_000L), List.of(2_500_000L, 2_500_000L, 2_500_000L),
            3_000_000L, 2_000_000L);

    /** 12칸 순서: 신용카드(일반·전통시장·대중교통·문화체육), 체크카드 4칸, 현금영수증 4칸. */
    static SpendingTotals totals(long... c) {
        return new SpendingTotals(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11]);
    }

    private static long amount(long salary, int childCount, TaxLawValues law, long... cells) {
        return DeductionCalculator.calculate(salary, childCount, totals(cells), law).amount();
    }

    @Test
    void prdExample1ShowsEveryStep() {
        // 신용 일반 1,200만 / 체크 일반 200만 + 현금 일반 100만 / 전통시장 100만 / 대중교통 50만 / 문화체육 50만
        DeductionResult r = DeductionCalculator.calculate(40_000_000L, 0, totals(
                12_000_000, 1_000_000, 500_000, 500_000, 2_000_000, 0, 0, 0, 1_000_000, 0, 0, 0), LAW_2026);

        assertThat(r.highBracket()).isFalse();
        assertThat(List.of(r.credit(), r.debitCash(), r.culture(), r.market(), r.transit()))
                .containsExactly(12_000_000L, 3_000_000L, 500_000L, 1_000_000L, 500_000L);
        assertThat(r.total()).isEqualTo(17_000_000L);
        assertThat(r.threshold()).isEqualTo(10_000_000L);
        assertThat(r.thresholdReached()).isTrue();
        assertThat(r.remainingToThreshold()).isZero();
        // 1,800,000 + 900,000 + 150,000 + 400,000 + 200,000
        assertThat(r.beforeThresholdCut()).isEqualTo(3_450_000L);
        assertThat(r.thresholdCut()).isEqualTo(1_500_000L);
        assertThat(r.deductible()).isEqualTo(1_950_000L);
        assertThat(r.basicLimit()).isEqualTo(3_000_000L);
        assertThat(r.basicUsed()).isEqualTo(1_950_000L);
        assertThat(r.extraCap()).isEqualTo(3_000_000L);
        // 전통시장 400,000 + 대중교통 200,000 + 문화체육 150,000
        assertThat(r.extraEligible()).isEqualTo(750_000L);
        assertThat(r.extraUsed()).isZero();
        assertThat(r.amount()).isEqualTo(1_950_000L);
    }

    @Test
    void prdExample2MovesCultureToItsPaymentMethodAboveTheBoundary() {
        // 총급여 8,000만: 체크 문화체육 100만은 체크 일반으로 보고 추가한도 대상에서 빠진다(AC-10).
        DeductionResult r = DeductionCalculator.calculate(80_000_000L, 0, totals(
                30_000_000, 2_000_000, 1_000_000, 0, 10_000_000, 0, 0, 1_000_000, 0, 0, 0, 0), LAW_2026);

        assertThat(r.highBracket()).isTrue();
        assertThat(r.credit()).isEqualTo(30_000_000L);
        assertThat(r.debitCash()).isEqualTo(11_000_000L);
        assertThat(r.culture()).isZero();
        assertThat(r.thresholdCut()).isEqualTo(3_000_000L);
        assertThat(r.deductible()).isEqualTo(6_000_000L);
        assertThat(r.basicLimit()).isEqualTo(2_500_000L);
        assertThat(r.basicUsed()).isEqualTo(2_500_000L);
        assertThat(r.extraCap()).isEqualTo(2_000_000L);
        // 전통시장 800,000 + 대중교통 400,000. 초과분 3,500,000과 상한 2,000,000보다 작다(AC-12).
        assertThat(r.extraEligible()).isEqualTo(1_200_000L);
        assertThat(r.extraUsed()).isEqualTo(1_200_000L);
        assertThat(r.amount()).isEqualTo(3_700_000L);
    }

    @Test
    void wireframeStatusExample() {
        // 일반 1,400만/200만/50만, 전통시장 30만/20만/10만, 대중교통 20만/30만/0, 문화체육 10만/10만/0
        assertThat(amount(50_000_000L, 0, LAW_2026,
                14_000_000, 300_000, 200_000, 100_000, 2_000_000, 200_000, 300_000, 100_000, 500_000, 100_000, 0, 0))
                .isEqualTo(1_475_000L);
    }

    @Test
    void nothingIsDeductedUpToTheThresholdAndFractionsOfAWonAreDropped() {
        // 최저사용금액 1,000만. 1원 미만 → 0원, 1원 초과 → 0.15원 → 0원, 7원 초과 → 1.05원 → 1원(AC-07, TAX-45)
        assertThat(amount(40_000_000L, 0, LAW_2026, 9_999_999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).isZero();
        assertThat(amount(40_000_000L, 0, LAW_2026, 10_000_001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).isZero();
        assertThat(amount(40_000_000L, 0, LAW_2026, 10_000_007, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).isEqualTo(1L);

        DeductionResult equal = DeductionCalculator.calculate(40_000_000L, 0,
                totals(10_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(equal.thresholdReached()).isFalse();
        assertThat(equal.amount()).isZero();

        DeductionResult below = DeductionCalculator.calculate(40_000_000L, 0,
                totals(4_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(below.thresholdReached()).isFalse();
        assertThat(below.remainingToThreshold()).isEqualTo(6_000_000L);
        assertThat(below.deductible()).isZero();
    }

    @Test
    void thresholdIsFilledByCreditThenDebitCashAndCultureThenMarketAndTransit() {
        // 신용 < 최저 ≤ 신용+직불등+문화체육: 차감 = 600만×15% + 400만×30% = 2,100,000(AC-08)
        DeductionResult second = DeductionCalculator.calculate(40_000_000L, 0, totals(
                6_000_000, 1_000_000, 0, 0, 5_000_000, 0, 0, 1_000_000, 0, 0, 0, 0), LAW_2026);
        assertThat(second.beforeThresholdCut()).isEqualTo(3_100_000L);
        assertThat(second.thresholdCut()).isEqualTo(2_100_000L);
        assertThat(second.amount()).isEqualTo(1_000_000L);

        // 그보다 큼: 차감 = 400만×15% + 400만×30% + 200만×40% = 2,600,000
        DeductionResult third = DeductionCalculator.calculate(40_000_000L, 0, totals(
                4_000_000, 3_000_000, 1_000_000, 0, 3_000_000, 0, 0, 1_000_000, 0, 0, 0, 0), LAW_2026);
        assertThat(third.beforeThresholdCut()).isEqualTo(3_400_000L);
        assertThat(third.thresholdCut()).isEqualTo(2_600_000L);
        assertThat(third.amount()).isEqualTo(800_000L);
    }

    @Test
    void salaryExactlyAtTheBoundaryIsTheLowBracket() {
        // 신용 일반 2,000만 + 신용 문화체육 100만(AC-09)
        long[] cells = {20_000_000, 0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0};
        // 7,000만: 3,000,000 + 300,000 − 1,750만×15% = 675,000
        assertThat(amount(70_000_000L, 0, LAW_2026, cells)).isEqualTo(675_000L);
        // 7,000만 1원: 2,100만×15% − 17,500,000.25×15% = 524,999.9625 → 524,999
        DeductionResult above = DeductionCalculator.calculate(70_000_001L, 0, totals(cells), LAW_2026);
        assertThat(above.highBracket()).isTrue();
        assertThat(above.culture()).isZero();
        assertThat(above.threshold()).isEqualTo(17_500_000L);
        assertThat(above.amount()).isEqualTo(524_999L);
    }

    @Test
    void basicLimitDependsOnBracketAndChildTier() {
        long[] cells = {100_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
        assertThat(amount(50_000_000L, 0, LAW_2026, cells)).isEqualTo(3_000_000L);
        assertThat(amount(50_000_000L, 1, LAW_2026, cells)).isEqualTo(3_500_000L);
        assertThat(amount(50_000_000L, 2, LAW_2026, cells)).isEqualTo(4_000_000L);
        assertThat(amount(50_000_000L, 3, LAW_2026, cells)).isEqualTo(4_000_000L);
        assertThat(amount(80_000_000L, 0, LAW_2026, cells)).isEqualTo(2_500_000L);
        assertThat(amount(80_000_000L, 1, LAW_2026, cells)).isEqualTo(2_750_000L);
        assertThat(amount(80_000_000L, 2, LAW_2026, cells)).isEqualTo(3_000_000L);
    }

    @Test
    void childCountIsIgnoredWhenTheLawHasNoChildTiers() {
        // 서버는 childCount를 항상 저장한다. 자녀등 단계가 없는 세법(2025 값)에서는 무시한다(AC-11).
        long[] cells = {100_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
        assertThat(LAW_2025.childTiersApply()).isFalse();
        assertThat(LAW_2026.childTiersApply()).isTrue();
        assertThat(amount(50_000_000L, 0, LAW_2025, cells)).isEqualTo(3_000_000L);
        assertThat(amount(50_000_000L, 2, LAW_2025, cells)).isEqualTo(3_000_000L);
        assertThat(amount(80_000_000L, 0, LAW_2025, cells)).isEqualTo(2_500_000L);
        assertThat(amount(80_000_000L, 2, LAW_2025, cells)).isEqualTo(2_500_000L);
    }

    @Test
    void extraLimitIsBoundedByTheExcessAndByTheCap() {
        // 기본한도 정확히: 3,000만×15% − 150만 = 3,000,000, 추가 0(AC-12)
        DeductionResult exact = DeductionCalculator.calculate(40_000_000L, 0,
                totals(30_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(exact.deductible()).isEqualTo(3_000_000L);
        assertThat(exact.extraUsed()).isZero();
        assertThat(exact.amount()).isEqualTo(3_000_000L);

        // 초과분으로 제한: 공제 가능 3,500,000, 전통시장 공제액 2,000,000 → 추가 500,000
        DeductionResult excess = DeductionCalculator.calculate(40_000_000L, 0,
                totals(20_000_000, 5_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(excess.extraUsed()).isEqualTo(500_000L);
        assertThat(excess.amount()).isEqualTo(3_500_000L);

        // 상한으로 제한: 공제 가능 7,000,000, 전통시장 공제액 4,000,000, 상한 3,000,000 → 추가 3,000,000
        DeductionResult capped = DeductionCalculator.calculate(40_000_000L, 0,
                totals(30_000_000, 10_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);
        assertThat(capped.extraEligible()).isEqualTo(4_000_000L);
        assertThat(capped.extraUsed()).isEqualTo(3_000_000L);
        assertThat(capped.amount()).isEqualTo(6_000_000L);
    }

    @Test
    void largestInputsDoNotOverflow() {
        // 연말 예상 합계의 최악: 12칸 합 240조(누계 상한 + 지출계획 상한보다 크다). 비율은 모두 100%.
        long max = 9_999_999_999_999L;
        TaxLawValues everything = new TaxLawValues(100, max, 100, 100, 100, 100, 100,
                List.of(max, max, max), List.of(max, max, max), max, max);
        long cell = 20_000_000_000_000L;
        DeductionResult r = DeductionCalculator.calculate(max, 0,
                totals(cell, cell, cell, cell, cell, cell, cell, cell, cell, cell, cell, cell), everything);

        assertThat(r.total()).isEqualTo(240_000_000_000_000L);
        assertThat(r.beforeThresholdCut()).isEqualTo(240_000_000_000_000L);
        assertThat(r.thresholdCut()).isEqualTo(max);
        assertThat(r.deductible()).isEqualTo(230_000_000_000_001L);
        assertThat(r.extraEligible()).isEqualTo(180_000_000_000_000L);
        // 기본한도 9,999,999,999,999 + 추가한도 상한 9,999,999,999,999
        assertThat(r.amount()).isEqualTo(19_999_999_999_998L);
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*DeductionCalculatorTest'`
Expected: `10 tests completed, 10 failed`, `BUILD FAILED`(틀이 0만 돌려주므로 모든 테스트가 기대값에서 실패한다).

- [ ] **Step 3: 계산기 구현**

`main/tax/calc/DeductionCalculator.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;

/**
 * 신용카드 등 사용금액 소득공제액 계산(PRD 7.1절, 알고리즘 버전 1). 계산은 이 클래스 한 곳에서만 한다.
 * 부동소수점을 쓰지 않는다. 중간값은 원 × 10,000 정수(금액 × 100 × 퍼센트)이고 소득공제액에서 한 번 버린다(TAX-45).
 * 12칸의 합이 240조 원(누계 상한 + 지출계획 상한) 이하이면 중간값은 2.4 × 10^18로 long 안에 있다.
 */
public final class DeductionCalculator {

    /** 중간값 단위(원 × 10,000)를 원으로 되돌리는 값. */
    private static final long SCALE = 10_000;

    private DeductionCalculator() {
    }

    public static DeductionResult calculate(long totalSalary, int childCount, SpendingTotals totals,
                                            TaxLawValues law) {
        // 경계와 같으면 낮은 구간이다. 높은 구간은 문화체육을 원래 결제수단의 일반 사용분으로 본다(TAX-41).
        boolean high = totalSalary > law.bracketBoundary();
        long credit = totals.creditGeneral() + (high ? totals.creditCulture() : 0);
        long debitCash = totals.debitGeneral() + totals.cashGeneral()
                + (high ? totals.debitCulture() + totals.cashCulture() : 0);
        long culture = high ? 0 : totals.creditCulture() + totals.debitCulture() + totals.cashCulture();
        long market = totals.creditMarket() + totals.debitMarket() + totals.cashMarket();
        long transit = totals.creditTransit() + totals.debitTransit() + totals.cashTransit();
        long total = credit + debitCash + culture + market + transit;

        // 최저사용금액(원 × 100)을 신용 → 직불등 → 문화체육 → 전통시장 → 대중교통 순으로 채운다.
        // 채운 부분에 그 구분의 공제율을 곱한 합이 차감액이다. 전체가 최저사용금액 이하면 전부 차감돼 0원이 된다.
        long[] amounts = {credit, debitCash, culture, market, transit};
        int[] rates = {law.rateCreditPct(), law.rateDebitCashPct(), law.rateCulturePct(),
                law.rateMarketPct(), law.rateTransitPct()};
        long threshold = totalSalary * law.minSpendRatePct();
        long unfilled = threshold;
        long before = 0;
        long cut = 0;
        for (int i = 0; i < amounts.length; i++) {
            long amount = amounts[i] * 100;
            long filled = Math.min(unfilled, amount);
            before += amount * rates[i];
            cut += filled * rates[i];
            unfilled -= filled;
        }
        long deductible = before - cut;

        // 자녀등 단계가 없는 세법(세 칸이 같은 값)에서는 저장된 자녀등 수를 쓰지 않는다.
        int tier = law.childTiersApply() ? Math.min(childCount, 2) : 0;
        long basicLimit = (high ? law.basicLimitHigh() : law.basicLimitLow()).get(tier);
        long extraCap = high ? law.extraLimitHigh() : law.extraLimitLow();
        long extraEligible = (culture * law.rateCulturePct() + market * law.rateMarketPct()
                + transit * law.rateTransitPct()) * 100;
        long basicUsed = Math.min(deductible, basicLimit * SCALE);
        long extraUsed = Math.min(deductible - basicUsed, Math.min(extraEligible, extraCap * SCALE));

        return new DeductionResult(high, credit, debitCash, culture, market, transit, total,
                threshold / 100, total * 100 > threshold, unfilled / 100,
                before / SCALE, cut / SCALE, deductible / SCALE,
                basicLimit, basicUsed / SCALE, extraCap, extraEligible / SCALE, extraUsed / SCALE,
                (basicUsed + extraUsed) / SCALE);
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*DeductionCalculatorTest'`
Expected: `BUILD SUCCESSFUL`. `DeductionCalculatorTest` 10건 통과.

- [ ] **Step 5: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(임시 복사본에서는 전체 385건 통과).

- [ ] **Step 6: 커밋(컨트롤러)**

```bash
git add apps/api/src/main/java/com/saladbowl/api/tax/calc apps/api/src/test/java/com/saladbowl/api/tax/calc
git commit -m "feat(api): 소득공제액 계산기" -m "Co-Authored-By: Codex (gpt-6-astra) <noreply@openai.com>"
```

---

### Task 4.2: 현재 계획 배분과 추천 (TAX-46, 50, 52, 53, 54, 69)

**담당:** Codex `gpt-6-astra` / `medium` (`api`, 계산 정확성), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `main/tax/calc/SpendingCategory.java`, `ByCategory.java`, `PlanAllocator.java`, `Recommendation.java`, `Recommender.java`
- Test: `test/tax/calc/PlanAllocatorTest.java`, `RecommenderTest.java`(생성. Spring 없는 단위 테스트)

**Interfaces:**
- Consumes: Task 4.1의 `DeductionCalculator.calculate(long totalSalary, int childCount, SpendingTotals totals, TaxLawValues law): DeductionResult`, `DeductionResult.amount()`·`thresholdReached()`·`remainingToThreshold()`·`basicLimit()`·`extraEligible()`·`extraCap()`·`highBracket()`, `DeductionCalculatorTest.LAW_2026`·`totals(long...)`. PR 3의 `SpendingTotals`, `TaxRecordDtos.PlanView(long rowVersion, PlanRow general, PlanRow market, PlanRow transit, PlanRow culture)`, `TaxRecordDtos.PlanRow(Long creditFixed, Long debitFixed, Long flexible)`.
- Produces:
  - `enum SpendingCategory { GENERAL, MARKET, TRANSIT, CULTURE }`, `record ByCategory<T>(T general, T market, T transit, T culture)`와 `T get(SpendingCategory)`.
  - `record PlanAllocator.Split(long credit, long debit, long cash)`, `static ByCategory<Split> PlanAllocator.currentPlan(SpendingTotals totals, PlanView plan)`.
  - `record Recommendation(MethodShare methodShare, Scenario<Split> current, Scenario<Pair> recommended, long difference, List<Reason> reasons)`와 그 안의 `record MethodShare(BigDecimal creditPct, BigDecimal debitPct, BigDecimal cashPct)`, `record Scenario<T>(ByCategory<T> allocation, long yearEndDeduction)`, `record Pair(long credit, long debitCash)`, `record Reason(ReasonCode code, SpendingCategory category, Long amount)`, `enum ReasonCode { CREDIT_OVER_THRESHOLD, CREDIT_RATE_HIGHER, NO_FLEXIBLE_AMOUNT, BELOW_THRESHOLD, LIMIT_REACHED, METHOD_NEUTRAL, ALREADY_BEST }`.
  - `static Recommendation Recommender.recommend(long totalSalary, int childCount, SpendingTotals totals, PlanView plan, TaxLawValues law)`.
  - 테스트 공용: `PlanAllocatorTest.plan(long... 12칸): PlanView`.

연말 예상 합계표: 누계 칸에 지출계획을 더한다. 신용카드 칸 += 신용카드 고정 + 배분의 신용카드 몫, 체크카드 칸 += 체크카드·현금영수증 고정 + 배분의 체크카드·현금영수증 몫, 현금영수증 칸은 그대로다(체크카드와 현금영수증은 공제율이 같고 계산기가 둘을 더해 쓴다).

기대값 표(손계산)

| 사례 | 기대 | 대응 |
|---|---|---|
| PRD 합성 예시 3: 일반 입력액 3,000,000 / 1,000,000 / 0, V 1,000,001 | 750,001 / 250,000 / 0 | AC-35 |
| PRD 합성 예시 4: 그 소비구분 입력액 0, 연도 전체 6,000,000 / 3,000,000 / 1,000,000, V 333,333 | 200,001 / 99,999 / 33,333 | AC-35 |
| PRD 합성 예시 5: 연도 전체 0, V 500,000 | 500,000 / 0 / 0, `methodShare` 없음 | AC-35 |
| 배분 최악 입력: 12칸과 V 모두 9,999,999,999,999 | 3,333,333,333,333씩 | 오버플로(`BigInteger`) |
| 와이어프레임: S 5,000만, 현황 입력 + 계획(일반 50만/30만/120만, 전통시장 0/10만/10만, 대중교통 10만/0/0, 문화체육 0/0/10만) | 현재 계획 일반 1,018,183 / 145,454 / 36,363, 전통시장 50,001 / 33,333 / 16,666, 문화체육 50,000 / 50,000 / 0. 비율 82.0 / 14.6 / 3.4. 현재 계획 연말 1,997,272, 추천 연말 2,150,000, 차이 152,728(옮긴 1,018,183원의 15% = 152,727.45). 추천은 일반 1,200,000만 체크·현금으로 옮기고 다른 소비구분은 현재 계획 그대로. 이유 `CREDIT_OVER_THRESHOLD`, `GENERAL`, 1,018,183 | AC-17, AC-18, AC-35 |
| 모든 소비구분 | 현재 계획과 추천의 소비구분별 합 = 그 소비구분의 V | AC-17, AC-35 |
| 높은 급여구간의 문화체육: S 8,000만, 신용 일반 3,000만, 문화체육 V 100만 | 현재 1,650,000 → 추천 1,800,000, 차이 150,000, 이유 `CREDIT_OVER_THRESHOLD`, `CULTURE`, 1,000,000 | TAX-41, TAX-52 |
| 차이 없음: 바꿀 수 있는 금액 0 (S 4,000만, 신용 일반 1,200만, 일반 고정 100만/50만) | 600,000, `NO_FLEXIBLE_AMOUNT` | AC-17 |
| 차이 없음: 최저사용금액 미달 (S 4,000만, 신용 일반 300만, 일반 V 100만) | 0, `BELOW_THRESHOLD`, 남은 금액 6,000,000 | AC-17 |
| 차이 없음: 한도 도달 (S 5,000만, 신용 일반 1억, 일반 V 100만) | 3,000,000, `LIMIT_REACHED` | AC-17 |
| 차이 없음: 전통시장 V 50만·대중교통 V 30만뿐 (S 4,000만, 신용 일반 1,200만) | 620,000, `METHOD_NEUTRAL` | AC-17 |
| 차이 없음: 낮은 급여구간의 문화체육 V 100만뿐 (S 5,000만, 신용 일반 3,000만) | 2,925,000, `METHOD_NEUTRAL` | AC-17 |
| 차이 없음: 이미 전부 체크카드 (S 4,000만, 체크 일반 1,200만, 일반 V 100만) | 900,000(전부 신용카드여도 900,000), `ALREADY_BEST` | AC-17 |
| 추천 최악 입력: S·누계 12칸·계획 12칸 모두 9,999,999,999,999 | 4,500,000(높은 구간 기본한도 250만 + 추가한도 상한 200만), `LIMIT_REACHED` | 오버플로 |
| 탐색 검증: 와이어프레임 / 신용 950만 + 일반 V 200만(S 4,000만) / 여러 구분이 섞인 입력(S 6,000만 자녀등 1, S 9,000만 자녀등 2) | 소비구분 4개를 전부 신용 / 전부 직불등으로 둔 16개 조합과 현재 계획의 최댓값 = 추천 연말 공제액 = 손계산 2,150,000 / 450,000 / 4,050,000 / 3,630,000 | TAX-52 |

탐색 검증만 테스트 안에서 계산기를 부른다. 이 테스트가 보는 것은 "탐색이 16개 조합의 최댓값을 놓치지 않는가"이고, 최댓값 자체는 손계산 숫자와도 비교한다. 표의 숫자는 Task 4.1과 같은 별도 스크립트로 다시 계산해 일치를 확인했다.

- [ ] **Step 1: 틀과 실패하는 테스트 작성**

타입은 최종 모양이고 `PlanAllocator.currentPlan`은 0만, `Recommender.recommend`는 `null`을 돌려주는 틀이다.

`main/tax/calc/SpendingCategory.java`

```java
package com.saladbowl.api.tax.calc;

/** 소비구분. 가계부의 생활 카테고리와 다른 축이다. */
public enum SpendingCategory {
    GENERAL, MARKET, TRANSIT, CULTURE
}
```

`main/tax/calc/ByCategory.java`

```java
package com.saladbowl.api.tax.calc;

/** 소비구분 4개마다 하나씩 있는 값. */
public record ByCategory<T>(T general, T market, T transit, T culture) {

    public T get(SpendingCategory category) {
        return switch (category) {
            case GENERAL -> general;
            case MARKET -> market;
            case TRANSIT -> transit;
            case CULTURE -> culture;
        };
    }
}
```

`main/tax/calc/Recommendation.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;

import java.math.BigDecimal;
import java.util.List;

/**
 * 추천 결과(TAX-50, 53, 54). 저장하지 않고 조회할 때마다 만든다.
 * allocation은 지출계획의 "바꿀 수 있는 금액"을 결제수단에 둔 금액이고 고정액은 들어 있지 않다.
 *
 * @param methodShare 연도 합계표 전체의 결제수단 비율. 합계가 0원이면 null
 * @param current     현재 계획(지금까지의 결제수단 비율대로 나눈 배분)과 그 연말 예상 소득공제액
 * @param recommended 공제액이 가장 큰 배분과 그 연말 예상 소득공제액. 공제액이 같은 소비구분은 현재 계획 그대로다
 * @param difference  recommended − current 연말 예상 소득공제액. 0이면 "차이 없음"
 * @param reasons     difference > 0이면 바뀐 소비구분마다 하나, 0이면 차이가 없는 이유 하나
 */
public record Recommendation(
        MethodShare methodShare,
        Scenario<Split> current,
        Scenario<Pair> recommended,
        long difference,
        List<Reason> reasons) {

    /** 퍼센트, 소수 첫째 자리(반올림). 예: 82.0 */
    public record MethodShare(BigDecimal creditPct, BigDecimal debitPct, BigDecimal cashPct) {
    }

    public record Scenario<T>(ByCategory<T> allocation, long yearEndDeduction) {
    }

    /** 추천 배분의 한 소비구분. 체크카드와 현금영수증은 공제율이 같아 한 묶음이다. */
    public record Pair(long credit, long debitCash) {
    }

    /** 문장은 웹이 만든다. category·amount는 코드에 따라 null이다. */
    public record Reason(ReasonCode code, SpendingCategory category, Long amount) {
    }

    public enum ReasonCode {
        /** 그 소비구분의 바꿀 수 있는 금액을 체크카드·현금영수증으로 옮겼다. amount = 현재 계획에서 신용카드에 있던 금액 */
        CREDIT_OVER_THRESHOLD,
        /** 신용카드로 옮겼다(신용카드 공제율이 더 높게 설정된 세법에서만). amount = 현재 계획에서 체크카드·현금영수증에 있던 금액 */
        CREDIT_RATE_HIGHER,
        /** 바꿀 수 있는 금액이 모두 0원이다. */
        NO_FLEXIBLE_AMOUNT,
        /** 연말 예상 사용액이 최저사용금액 이하다. amount = 최저사용금액까지 남은 금액 */
        BELOW_THRESHOLD,
        /** 현재 계획으로 이미 한도(기본한도 + 추가한도)까지 공제된다. */
        LIMIT_REACHED,
        /** 바꿀 수 있는 금액이 결제수단과 무관한 소비구분에만 있다. */
        METHOD_NEUTRAL,
        /** 현재 계획보다 공제액이 큰 배분이 없다. */
        ALREADY_BEST
    }
}
```

`main/tax/calc/PlanAllocator.java` (틀. Step 3에서 구현으로 바꾼다)

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;

/** 현재 계획: 지출계획의 "바꿀 수 있는 금액"을 지금까지의 결제수단 비율대로 나눈 배분(PRD 7.2절, TAX-69). */
public final class PlanAllocator {

    /** 한 소비구분의 "바꿀 수 있는 금액"을 결제수단에 나눈 금액. 세 값의 합은 그 금액과 같다. */
    public record Split(long credit, long debit, long cash) {
    }

    private PlanAllocator() {
    }

    public static ByCategory<Split> currentPlan(SpendingTotals totals, PlanView plan) {
        Split none = new Split(0, 0, 0);
        return new ByCategory<>(none, none, none, none);
    }
}
```

`main/tax/calc/Recommender.java` (틀. Step 3에서 구현으로 바꾼다)

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;

/** 남은 기간의 결제수단 추천(PRD 7.2절, TAX-52). */
public final class Recommender {

    private Recommender() {
    }

    public static Recommendation recommend(long totalSalary, int childCount, SpendingTotals totals, PlanView plan,
                                           TaxLawValues law) {
        return null;
    }
}
```

`test/tax/calc/PlanAllocatorTest.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;
import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;
import org.junit.jupiter.api.Test;

import static com.saladbowl.api.tax.calc.DeductionCalculatorTest.totals;
import static org.assertj.core.api.Assertions.assertThat;

/** 현재 계획의 배분 규칙(PRD 7.2절 규칙 1~4, TAX-69, AC-35). 기대값은 PRD 합성 예시 3~5와 와이어프레임의 숫자다. */
class PlanAllocatorTest {

    /** 12칸 순서: 일반·전통시장·대중교통·문화체육 각각 신용카드 고정 / 체크카드·현금영수증 고정 / 바꿀 수 있음. */
    static PlanView plan(long... c) {
        return new PlanView(0L, new PlanRow(c[0], c[1], c[2]), new PlanRow(c[3], c[4], c[5]),
                new PlanRow(c[6], c[7], c[8]), new PlanRow(c[9], c[10], c[11]));
    }

    private static void assertSumsToFlexible(ByCategory<Split> current, PlanView plan) {
        assertThat(sum(current.general())).isEqualTo(plan.general().flexible());
        assertThat(sum(current.market())).isEqualTo(plan.market().flexible());
        assertThat(sum(current.transit())).isEqualTo(plan.transit().flexible());
        assertThat(sum(current.culture())).isEqualTo(plan.culture().flexible());
    }

    private static long sum(Split split) {
        return split.credit() + split.debit() + split.cash();
    }

    @Test
    void splitsByTheCategoryRatioAndGivesLeftoverWonToCredit() {
        // 합성 예시 3: 일반 3,000,000 / 1,000,000 / 0, V = 1,000,001 → 750,000.75 / 250,000.25 / 0, 남는 1원은 신용카드
        SpendingTotals totals = totals(3_000_000, 0, 0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0);
        PlanView plan = plan(0, 0, 1_000_001, 0, 0, 0, 0, 0, 0, 0, 0, 0);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.general()).isEqualTo(new Split(750_001, 250_000, 0));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void fallsBackToTheYearRatioWhenTheCategoryHasNoSpending() {
        // 합성 예시 4: 문화체육 입력액 0, 연도 전체 6,000,000 / 3,000,000 / 1,000,000, V = 333,333
        // → 199,999.8 / 99,999.9 / 33,333.3, 남는 2원은 신용카드
        SpendingTotals totals = totals(6_000_000, 0, 0, 0, 3_000_000, 0, 0, 0, 1_000_000, 0, 0, 0);
        PlanView plan = plan(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 333_333);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.culture()).isEqualTo(new Split(200_001, 99_999, 33_333));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void putsEverythingOnCreditWhenTheYearHasNoSpending() {
        // 합성 예시 5
        PlanView plan = plan(0, 0, 500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), plan);

        assertThat(current.general()).isEqualTo(new Split(500_000, 0, 0));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void wireframeExample() {
        // 일반 1,200,000 × (14,000,000 : 2,000,000 : 500,000) → 1,018,181 / 145,454 / 36,363, 남는 2원
        // 전통시장 100,000 × (300,000 : 200,000 : 100,000) → 50,000 / 33,333 / 16,666, 남는 1원
        // 문화체육 100,000 × (100,000 : 100,000 : 0) → 50,000 / 50,000 / 0
        SpendingTotals totals = totals(14_000_000, 300_000, 200_000, 100_000,
                2_000_000, 200_000, 300_000, 100_000, 500_000, 100_000, 0, 0);
        PlanView plan = plan(500_000, 300_000, 1_200_000, 0, 100_000, 100_000, 100_000, 0, 0, 0, 0, 100_000);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.general()).isEqualTo(new Split(1_018_183, 145_454, 36_363));
        assertThat(current.market()).isEqualTo(new Split(50_001, 33_333, 16_666));
        assertThat(current.transit()).isEqualTo(new Split(0, 0, 0));
        assertThat(current.culture()).isEqualTo(new Split(50_000, 50_000, 0));
        assertSumsToFlexible(current, plan);
    }

    @Test
    void largestAmountsDoNotOverflow() {
        // V × 입력액 = 약 10^26으로 long을 넘는다. 9,999,999,999,999 ÷ 3 = 3,333,333,333,333(나머지 없음)
        long max = 9_999_999_999_999L;
        SpendingTotals totals = totals(max, max, max, max, max, max, max, max, max, max, max, max);
        PlanView plan = plan(max, max, max, max, max, max, max, max, max, max, max, max);

        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);

        assertThat(current.general())
                .isEqualTo(new Split(3_333_333_333_333L, 3_333_333_333_333L, 3_333_333_333_333L));
        assertSumsToFlexible(current, plan);
    }
}
```

`test/tax/calc/RecommenderTest.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;
import com.saladbowl.api.tax.calc.Recommendation.MethodShare;
import com.saladbowl.api.tax.calc.Recommendation.Pair;
import com.saladbowl.api.tax.calc.Recommendation.Reason;
import com.saladbowl.api.tax.calc.Recommendation.ReasonCode;
import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static com.saladbowl.api.tax.calc.DeductionCalculatorTest.LAW_2026;
import static com.saladbowl.api.tax.calc.DeductionCalculatorTest.totals;
import static com.saladbowl.api.tax.calc.PlanAllocatorTest.plan;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * 추천(PRD 7.2절, TAX-50·52~54, AC-17·18). 기대 공제액은 PRD 7.1절 식을 손으로 계산한 숫자다(AC-24).
 * 탐색 검증 한 건만 계산기를 불러 후보의 최댓값과 비교한다(탐색이 빠뜨린 배분이 없는지 본다).
 */
class RecommenderTest {

    private static final SpendingTotals WIREFRAME_TOTALS = totals(14_000_000, 300_000, 200_000, 100_000,
            2_000_000, 200_000, 300_000, 100_000, 500_000, 100_000, 0, 0);
    private static final PlanView WIREFRAME_PLAN =
            plan(500_000, 300_000, 1_200_000, 0, 100_000, 100_000, 100_000, 0, 0, 0, 0, 100_000);

    private static Recommendation noDifference(long salary, SpendingTotals totals, PlanView plan) {
        Recommendation r = Recommender.recommend(salary, 0, totals, plan, LAW_2026);
        assertThat(r.difference()).isZero();
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(r.current().yearEndDeduction());
        for (SpendingCategory category : SpendingCategory.values()) {
            Split current = r.current().allocation().get(category);
            assertThat(r.recommended().allocation().get(category))
                    .isEqualTo(new Pair(current.credit(), current.debit() + current.cash()));
        }
        return r;
    }

    @Test
    void wireframeExampleMovesGeneralSpendingOffCredit() {
        Recommendation r = Recommender.recommend(50_000_000L, 0, WIREFRAME_TOTALS, WIREFRAME_PLAN, LAW_2026);

        // 연도 전체: 14,600,000 / 2,600,000 / 600,000 ÷ 17,800,000 = 82.02% / 14.61% / 3.37%
        assertThat(r.methodShare()).isEqualTo(
                new MethodShare(new BigDecimal("82.0"), new BigDecimal("14.6"), new BigDecimal("3.4")));
        assertThat(r.current().allocation().general()).isEqualTo(new Split(1_018_183, 145_454, 36_363));
        // 현재 계획 연말: A 15,518,183 / B 2,981,817 / M 300,000 / T 800,000 / P 600,000
        // 2,327,727.45 + 894,545.10 + 90,000 + 320,000 + 240,000 − 1,875,000 = 1,997,272.55
        assertThat(r.current().yearEndDeduction()).isEqualTo(1_997_272L);
        // 일반 1,200,000을 모두 체크카드·현금영수증으로: A 14,500,000 / B 4,000,000 → 2,150,000
        assertThat(r.recommended().allocation().general()).isEqualTo(new Pair(0, 1_200_000));
        assertThat(r.recommended().allocation().market()).isEqualTo(new Pair(50_001, 49_999));
        assertThat(r.recommended().allocation().transit()).isEqualTo(new Pair(0, 0));
        assertThat(r.recommended().allocation().culture()).isEqualTo(new Pair(50_000, 50_000));
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(2_150_000L);
        assertThat(r.difference()).isEqualTo(152_728L);
        // AC-18: 옮긴 1,018,183원의 15% = 152,727.45원. 원 미만 처리 차이는 1원 안이다.
        assertThat(r.difference()).isBetween(152_727L, 152_728L);
        assertThat(r.reasons()).containsExactly(
                new Reason(ReasonCode.CREDIT_OVER_THRESHOLD, SpendingCategory.GENERAL, 1_018_183L));
    }

    @Test
    void totalsPerCategoryAreTheSameBeforeAndAfter() {
        Recommendation r = Recommender.recommend(50_000_000L, 0, WIREFRAME_TOTALS, WIREFRAME_PLAN, LAW_2026);

        for (SpendingCategory category : SpendingCategory.values()) {
            PlanRow row = new ByCategory<>(WIREFRAME_PLAN.general(), WIREFRAME_PLAN.market(),
                    WIREFRAME_PLAN.transit(), WIREFRAME_PLAN.culture()).get(category);
            Split current = r.current().allocation().get(category);
            Pair recommended = r.recommended().allocation().get(category);
            assertThat(current.credit() + current.debit() + current.cash()).isEqualTo(row.flexible());
            assertThat(recommended.credit() + recommended.debitCash()).isEqualTo(row.flexible());
        }
    }

    @Test
    void cultureFollowsItsPaymentMethodAboveTheBoundary() {
        // 총급여 8,000만, 신용 일반 3,000만, 문화체육 바꿀 수 있음 100만(입력액이 신용뿐이라 현재 계획은 전부 신용카드)
        // 현재: 3,100만×15% − 2,000만×15% = 1,650,000. 추천: 3,000만×15% + 100만×30% − 300만 = 1,800,000
        Recommendation r = Recommender.recommend(80_000_000L, 0,
                totals(30_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1_000_000), LAW_2026);

        assertThat(r.methodShare()).isEqualTo(
                new MethodShare(new BigDecimal("100.0"), new BigDecimal("0.0"), new BigDecimal("0.0")));
        assertThat(r.current().yearEndDeduction()).isEqualTo(1_650_000L);
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(1_800_000L);
        assertThat(r.recommended().allocation().culture()).isEqualTo(new Pair(0, 1_000_000));
        assertThat(r.difference()).isEqualTo(150_000L);
        assertThat(r.reasons()).containsExactly(
                new Reason(ReasonCode.CREDIT_OVER_THRESHOLD, SpendingCategory.CULTURE, 1_000_000L));
    }

    @Test
    void noDifferenceWhenNothingIsFlexible() {
        // 신용 일반 1,200만 + 고정 100만/50만: 1,300만×15% + 50만×30% − 150만 = 600,000
        Recommendation r = noDifference(40_000_000L, totals(12_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(1_000_000, 500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isEqualTo(600_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.NO_FLEXIBLE_AMOUNT, null, null));
    }

    @Test
    void noDifferenceBelowTheThreshold() {
        // 연말 예상 400만 ≤ 최저사용금액 1,000만. 남은 금액 600만
        Recommendation r = noDifference(40_000_000L, totals(3_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isZero();
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.BELOW_THRESHOLD, null, 6_000_000L));
    }

    @Test
    void noDifferenceAtTheLimit() {
        // 신용 일반 1억 100만: 1,515만 − 187.5만 = 13,275,000 > 기본한도 300만, 추가한도 대상 0
        Recommendation r = noDifference(50_000_000L, totals(100_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isEqualTo(3_000_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.LIMIT_REACHED, null, null));
    }

    @Test
    void noDifferenceWhenOnlyMethodNeutralCategoriesAreFlexible() {
        // 전통시장 50만·대중교통 30만만 바꿀 수 있다: 180만 + 32만 − 150만 = 620,000
        Recommendation r = noDifference(40_000_000L, totals(12_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 0, 0, 0, 500_000, 0, 0, 300_000, 0, 0, 0));

        assertThat(r.current().yearEndDeduction()).isEqualTo(620_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.METHOD_NEUTRAL, null, null));

        // 총급여 7천만원 이하의 문화체육도 결제수단과 무관하다: 450만 + 30만 − 187.5만 = 2,925,000
        Recommendation culture = noDifference(50_000_000L, totals(30_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1_000_000));

        assertThat(culture.current().yearEndDeduction()).isEqualTo(2_925_000L);
        assertThat(culture.reasons()).containsExactly(new Reason(ReasonCode.METHOD_NEUTRAL, null, null));
    }

    @Test
    void noDifferenceWhenTheCurrentPlanIsAlreadyBest() {
        // 지금까지 체크카드만 썼다 → 현재 계획이 전부 체크카드. 1,300만×30% − 1,000만×30% = 900,000
        // 전부 신용카드여도 15만 + 360만 − (15만 + 900만×30%) = 900,000으로 같다(신용카드가 최저사용금액 아래).
        Recommendation r = noDifference(40_000_000L, totals(0, 0, 0, 0, 12_000_000, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 1_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        assertThat(r.current().allocation().general()).isEqualTo(new Split(0, 1_000_000, 0));
        assertThat(r.current().yearEndDeduction()).isEqualTo(900_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.ALREADY_BEST, null, null));
    }

    @Test
    void methodShareIsMissingWhenTheYearHasNoSpending() {
        Recommendation r = Recommender.recommend(40_000_000L, 0, totals(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0), LAW_2026);

        assertThat(r.methodShare()).isNull();
        assertThat(r.current().allocation().general()).isEqualTo(new Split(500_000, 0, 0));
    }

    @Test
    void largestInputsDoNotOverflow() {
        // 누계 12칸과 지출계획 12칸이 모두 상한. 연말 12칸 합은 약 240조이고 공제액은 한도로 묶인다.
        // 총급여가 경계를 넘으므로 기본한도 2,500,000 + 추가한도 상한 2,000,000
        long max = 9_999_999_999_999L;
        Recommendation r = noDifference(max, totals(max, max, max, max, max, max, max, max, max, max, max, max),
                plan(max, max, max, max, max, max, max, max, max, max, max, max));

        assertThat(r.current().yearEndDeduction()).isEqualTo(4_500_000L);
        assertThat(r.reasons()).containsExactly(new Reason(ReasonCode.LIMIT_REACHED, null, null));
    }

    @Test
    void recommendationIsTheBestOfAllCreditOrAllDebitCashCombinations() {
        // 손계산한 최댓값: 2,150,000 / 450,000 / 4,050,000 / 3,630,000
        assertBestOfSixteen(50_000_000L, 0, WIREFRAME_TOTALS, WIREFRAME_PLAN, 2_150_000L);
        // 신용 950만 + 바꿀 수 있음 200만: 전부 체크카드면 950만×15% + 200만×30% − (950만×15% + 50만×30%) = 450,000
        assertBestOfSixteen(40_000_000L, 0, totals(9_500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                plan(0, 0, 2_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0), 450_000L);
        SpendingTotals mixed = totals(20_000_000, 500_000, 0, 300_000, 3_000_000, 0, 700_000, 0,
                1_000_000, 0, 0, 200_000);
        PlanView mixedPlan = plan(1_000_000, 0, 3_000_000, 0, 0, 400_000, 0, 200_000, 0, 0, 0, 600_000);
        assertBestOfSixteen(60_000_000L, 1, mixed, mixedPlan, 4_050_000L);
        SpendingTotals high = totals(25_000_000, 500_000, 0, 300_000, 3_000_000, 0, 700_000, 0,
                1_000_000, 0, 0, 200_000);
        assertBestOfSixteen(90_000_000L, 2, high, mixedPlan, 3_630_000L);
    }

    private static void assertBestOfSixteen(long salary, int childCount, SpendingTotals t, PlanView plan,
                                            long expected) {
        Recommendation r = Recommender.recommend(salary, childCount, t, plan, LAW_2026);
        List<PlanRow> rows = List.of(plan.general(), plan.market(), plan.transit(), plan.culture());
        long best = r.current().yearEndDeduction();
        for (int mask = 0; mask < 16; mask++) {
            long[] credit = new long[4];
            long[] debit = new long[4];
            for (int i = 0; i < 4; i++) {
                boolean allCredit = (mask & (1 << i)) != 0;
                credit[i] = rows.get(i).creditFixed() + (allCredit ? rows.get(i).flexible() : 0);
                debit[i] = rows.get(i).debitFixed() + (allCredit ? 0 : rows.get(i).flexible());
            }
            SpendingTotals yearEnd = new SpendingTotals(
                    t.creditGeneral() + credit[0], t.creditMarket() + credit[1],
                    t.creditTransit() + credit[2], t.creditCulture() + credit[3],
                    t.debitGeneral() + debit[0], t.debitMarket() + debit[1],
                    t.debitTransit() + debit[2], t.debitCulture() + debit[3],
                    t.cashGeneral(), t.cashMarket(), t.cashTransit(), t.cashCulture());
            best = Math.max(best, DeductionCalculator.calculate(salary, childCount, yearEnd, LAW_2026).amount());
        }
        assertThat(r.recommended().yearEndDeduction()).isEqualTo(best).isEqualTo(expected);
        assertThat(r.difference()).isEqualTo(best - r.current().yearEndDeduction());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*PlanAllocatorTest' --tests '*RecommenderTest'`
Expected: `16 tests completed, 16 failed`, `BUILD FAILED`(`PlanAllocatorTest` 5건은 기대 배분에서, `RecommenderTest` 11건은 `NullPointerException`으로 실패한다).

- [ ] **Step 3: 현재 계획 배분 구현**

`main/tax/calc/PlanAllocator.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;

import java.math.BigInteger;

/** 현재 계획: 지출계획의 "바꿀 수 있는 금액"을 지금까지의 결제수단 비율대로 나눈 배분(PRD 7.2절, TAX-69). */
public final class PlanAllocator {

    /** 한 소비구분의 "바꿀 수 있는 금액"을 결제수단에 나눈 금액. 세 값의 합은 그 금액과 같다. */
    public record Split(long credit, long debit, long cash) {
    }

    private PlanAllocator() {
    }

    public static ByCategory<Split> currentPlan(SpendingTotals t, PlanView plan) {
        long[] year = {
                t.creditGeneral() + t.creditMarket() + t.creditTransit() + t.creditCulture(),
                t.debitGeneral() + t.debitMarket() + t.debitTransit() + t.debitCulture(),
                t.cashGeneral() + t.cashMarket() + t.cashTransit() + t.cashCulture()};
        return new ByCategory<>(
                split(plan.general().flexible(), year, t.creditGeneral(), t.debitGeneral(), t.cashGeneral()),
                split(plan.market().flexible(), year, t.creditMarket(), t.debitMarket(), t.cashMarket()),
                split(plan.transit().flexible(), year, t.creditTransit(), t.debitTransit(), t.cashTransit()),
                split(plan.culture().flexible(), year, t.creditCulture(), t.debitCulture(), t.cashCulture()));
    }

    /** 비율의 기준: 그 소비구분의 입력액 → 0원이면 연도 전체 → 그것도 0원이면 전부 신용카드. */
    private static Split split(long flexible, long[] year, long... category) {
        long[] basis = category[0] + category[1] + category[2] > 0 ? category : year;
        long sum = basis[0] + basis[1] + basis[2];
        if (sum == 0) {
            return new Split(flexible, 0, 0);
        }
        long debit = share(flexible, basis[1], sum);
        long cash = share(flexible, basis[2], sum);
        // 신용카드 몫의 원 미만도 버린 뒤 남는 원을 모두 신용카드에 더한 값과 같다.
        return new Split(flexible - debit - cash, debit, cash);
    }

    /** flexible × part ÷ sum, 원 미만 버림. 곱이 long을 넘을 수 있다(약 10^26). */
    private static long share(long flexible, long part, long sum) {
        return BigInteger.valueOf(flexible).multiply(BigInteger.valueOf(part))
                .divide(BigInteger.valueOf(sum)).longValueExact();
    }
}
```

- [ ] **Step 4: 추천 구현**

`main/tax/calc/Recommender.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.PlanAllocator.Split;
import com.saladbowl.api.tax.calc.Recommendation.MethodShare;
import com.saladbowl.api.tax.calc.Recommendation.Pair;
import com.saladbowl.api.tax.calc.Recommendation.Reason;
import com.saladbowl.api.tax.calc.Recommendation.ReasonCode;
import com.saladbowl.api.tax.calc.Recommendation.Scenario;
import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRow;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanView;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 남은 기간의 결제수단 추천(PRD 7.2절, TAX-52). 근사식 없이 (누계 + 계획)을 DeductionCalculator에 넣어 비교한다.
 * 현재 계획에서 시작해 소비구분을 하나씩 보며 "바꿀 수 있는 금액"을 전부 체크카드·현금영수증 / 전부 신용카드에 둔
 * 후보가 지금까지의 최댓값보다 클 때만 바꾼다. 같으면 현재 계획을 유지한다. 계산기 호출은 요청마다 9번이다.
 */
public final class Recommender {

    private static final List<SpendingCategory> SEARCH_ORDER = List.of(SpendingCategory.GENERAL,
            SpendingCategory.CULTURE, SpendingCategory.MARKET, SpendingCategory.TRANSIT);

    private Recommender() {
    }

    public static Recommendation recommend(long totalSalary, int childCount, SpendingTotals totals, PlanView plan,
                                           TaxLawValues law) {
        ByCategory<PlanRow> rows = new ByCategory<>(plan.general(), plan.market(), plan.transit(), plan.culture());
        ByCategory<Split> current = PlanAllocator.currentPlan(totals, plan);
        Map<SpendingCategory, Pair> best = new EnumMap<>(SpendingCategory.class);
        for (SpendingCategory category : SpendingCategory.values()) {
            Split split = current.get(category);
            best.put(category, new Pair(split.credit(), split.debit() + split.cash()));
        }
        DeductionResult currentResult = DeductionCalculator.calculate(totalSalary, childCount,
                yearEnd(totals, rows, best), law);
        long bestAmount = currentResult.amount();

        List<Reason> reasons = new ArrayList<>();
        for (SpendingCategory category : SEARCH_ORDER) {
            long flexible = rows.get(category).flexible();
            Pair kept = best.get(category);
            for (Pair candidate : List.of(new Pair(0, flexible), new Pair(flexible, 0))) {
                best.put(category, candidate);
                long amount = DeductionCalculator.calculate(totalSalary, childCount,
                        yearEnd(totals, rows, best), law).amount();
                if (amount > bestAmount) {
                    bestAmount = amount;
                    kept = candidate;
                }
            }
            best.put(category, kept);
            Split before = current.get(category);
            if (kept.credit() < before.credit()) {
                reasons.add(new Reason(ReasonCode.CREDIT_OVER_THRESHOLD, category, before.credit()));
            } else if (kept.credit() > before.credit()) {
                reasons.add(new Reason(ReasonCode.CREDIT_RATE_HIGHER, category, before.debit() + before.cash()));
            }
        }
        if (reasons.isEmpty()) {
            reasons.add(noDifference(rows, currentResult));
        }
        return new Recommendation(methodShare(totals),
                new Scenario<>(current, currentResult.amount()),
                new Scenario<>(new ByCategory<>(best.get(SpendingCategory.GENERAL), best.get(SpendingCategory.MARKET),
                        best.get(SpendingCategory.TRANSIT), best.get(SpendingCategory.CULTURE)), bestAmount),
                bestAmount - currentResult.amount(), List.copyOf(reasons));
    }

    /** 누계에 지출계획을 더한 연말 예상 합계표. 체크카드·현금영수증 몫은 공제율이 같아 체크카드 칸에 더한다. */
    private static SpendingTotals yearEnd(SpendingTotals t, ByCategory<PlanRow> rows,
                                          Map<SpendingCategory, Pair> allocation) {
        long[] credit = new long[4];
        long[] debit = new long[4];
        for (SpendingCategory category : SpendingCategory.values()) {
            PlanRow row = rows.get(category);
            Pair pair = allocation.get(category);
            credit[category.ordinal()] = row.creditFixed() + pair.credit();
            debit[category.ordinal()] = row.debitFixed() + pair.debitCash();
        }
        return new SpendingTotals(
                t.creditGeneral() + credit[0], t.creditMarket() + credit[1],
                t.creditTransit() + credit[2], t.creditCulture() + credit[3],
                t.debitGeneral() + debit[0], t.debitMarket() + debit[1],
                t.debitTransit() + debit[2], t.debitCulture() + debit[3],
                t.cashGeneral(), t.cashMarket(), t.cashTransit(), t.cashCulture());
    }

    /** 어떤 후보도 현재 계획보다 크지 않을 때의 이유. 위에서부터 먼저 맞는 것 하나다. */
    private static Reason noDifference(ByCategory<PlanRow> rows, DeductionResult current) {
        long general = rows.general().flexible();
        long culture = rows.culture().flexible();
        if (general + culture + rows.market().flexible() + rows.transit().flexible() == 0) {
            return new Reason(ReasonCode.NO_FLEXIBLE_AMOUNT, null, null);
        }
        if (!current.thresholdReached()) {
            return new Reason(ReasonCode.BELOW_THRESHOLD, null, current.remainingToThreshold());
        }
        if (current.amount() == current.basicLimit() + Math.min(current.extraEligible(), current.extraCap())) {
            return new Reason(ReasonCode.LIMIT_REACHED, null, null);
        }
        // 일반은 언제나, 문화체육은 높은 급여구간에서만 결제수단에 따라 공제율이 달라진다.
        if (general == 0 && (culture == 0 || !current.highBracket())) {
            return new Reason(ReasonCode.METHOD_NEUTRAL, null, null);
        }
        return new Reason(ReasonCode.ALREADY_BEST, null, null);
    }

    private static MethodShare methodShare(SpendingTotals t) {
        long credit = t.creditGeneral() + t.creditMarket() + t.creditTransit() + t.creditCulture();
        long debit = t.debitGeneral() + t.debitMarket() + t.debitTransit() + t.debitCulture();
        long cash = t.cashGeneral() + t.cashMarket() + t.cashTransit() + t.cashCulture();
        long total = credit + debit + cash;
        return total == 0 ? null : new MethodShare(percent(credit, total), percent(debit, total), percent(cash, total));
    }

    private static BigDecimal percent(long part, long total) {
        return BigDecimal.valueOf(part).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*tax.calc*'`
Expected: `BUILD SUCCESSFUL`. `PlanAllocatorTest` 5건, `RecommenderTest` 11건, `DeductionCalculatorTest` 10건 통과.

- [ ] **Step 6: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(임시 복사본에서는 전체 401건 통과).

- [ ] **Step 7: 커밋(컨트롤러)**

```bash
git add apps/api/src/main/java/com/saladbowl/api/tax/calc apps/api/src/test/java/com/saladbowl/api/tax/calc
git commit -m "feat(api): 소득공제 현재 계획 배분과 결제수단 추천" -m "Co-Authored-By: Codex (gpt-6-astra) <noreply@openai.com>"
```

---

### Task 4.3: 분석 조회 API (TAX-24, 35, 36, 38, 44, 50, 65, 75)

**담당:** Codex `gpt-6-sol` / `medium` (`api`. 계산은 4.1·4.2에서 끝났고 이 Task는 조립이다), 태그 `impl-api`. 리뷰: Claude Fable 5.2 (`review-task`).

**Files:**
- Create: `main/tax/calc/TaxAnalysisView.java`, `TaxAnalysisService.java`, `TaxAnalysisController.java`
- Test: `test/tax/calc/TaxAnalysisApiTest.java`(생성. Testcontainers 통합 테스트)

**Interfaces:**
- Consumes:
  - PR 3의 `TaxRecordService.get(long userId, int year): TaxYearView`(안에서 `requireOwned`를 부르고 없으면 404 `tax record not found`), `TaxYearView`의 `taxYear()`, `totalSalary()`, `workStartMonth()`, `workEndMonth()`, `childCount()`, `lawVersion(): LawVersionRef`(없으면 `null`), `newerLawVersion()`, `cards(): List<CardView>`, `cashReceipt(): CashView`(없으면 `null`), `plan(): PlanView`(없으면 `null`), `totals(): SpendingTotals`, `blankCount()`, `hasInputs()`, `asOfDateMismatch()`. `CardView.asOfDate()`, `CashView.asOfDate()`, `LawVersionRef(long id, int versionNo, OffsetDateTime appliedAt, boolean childTiersApply)`.
  - PR 2의 `TaxLawVersionRepository.findById(Long)`, `auth/CurrentUser`.
  - Task 4.1의 `TaxLawValues.from(TaxLawVersion)`, `DeductionCalculator.calculate(...)`, Task 4.2의 `Recommender.recommend(long totalSalary, int childCount, SpendingTotals totals, PlanView plan, TaxLawValues law)`.
  - 테스트 헬퍼(모두 기존): `TestTaxRecords.URL`·`createYear`·`putYear`·`yearBody`·`cardBody`·`cashBody`·`addCard`·`putCard`·`putCash`·`planBody`·`putPlan`·`readVersion`, `TestTaxLaws.URL`·`createApplied`·`createDraft`·`values2026`, `TestAdmins.grant`, `TestAuth.signupAndLogin`, `TestClock.Config`.
- Produces:
  - `record TaxAnalysisView(int taxYear, Status status, int blankCount, SpendingTotals totals, long totalSalary, boolean estimated, LocalDate asOfDateMin, LocalDate asOfDateMax, boolean partialYear, LawVersionRef law, boolean newerLawVersion, boolean planSaved, DeductionResult deduction, Recommendation recommendation)`, `enum TaxAnalysisView.Status { NO_INPUT, INCOMPLETE, LAW_PENDING, READY }`.
  - `TaxAnalysisService.get(long userId, int year): TaxAnalysisView`(`@Transactional(readOnly = true)`).
  - HTTP: `GET /tax/years/{year}/analysis`(위 "HTTP 인터페이스"). 웹 PR 7이 쓴다.

지킬 것: `tax/calc`에서 `TaxYearRecordRepository`·`TaxCardStatementRepository`·`TaxCashReceiptRepository`·`TaxSpendingPlanRepository`를 주입하지 않는다(회원 자료는 `TaxRecordService.get`으로만 읽는다). `lockOwned`·`save`·`refreshLawVersion`을 부르지 않는다. 세법은 `laws.currentApplied`가 아니라 `view.lawVersion().id()`로 읽는다.

테스트 대상

| 테스트 | 확인하는 것 | 대응 |
|---|---|---|
| `onlyTheOwnerReadsTheAnalysis` | 본인 200, 다른 회원·서비스 관리자·없는 연도는 같은 404(`code`·`message` 동일), 비로그인 401, `year` 999는 400 | AC-01, TAX-02 |
| `statusGoesFromNoInputToIncompleteToLawPendingToReady` | 자료 없음(빈 칸 4) → 빈 칸 5 → 자료 완료·세법 없음 → 첫 버전 적용 뒤 `READY`. `READY` 전에는 `deduction`·`recommendation`이 없고 지출계획은 저장돼 `planSaved`가 true | TAX-38, 65, 75, AC-20, 43 |
| `readyAnalysisShowsPrdExample1StepByStep` | 합성 예시 1의 응답 전체(과정 값 포함, `amount` 1,950,000), 세법 버전·기준일 표시, 지출계획이 없으면 `recommendation` 없음 | TAX-35, 36, 71, AC-13 |
| `savedPlanIsRecommendedOnceTheStatementsAreComplete` | 미완료 때 저장한 계획으로, 빈 칸을 채운 뒤 추천이 나온다(와이어프레임 숫자: 1,997,272 → 2,150,000, 차이 152,728) | TAX-50, 75, AC-17, 43 |
| `partialYearAndMismatchedDatesAreFlaggedWithoutChangingTheAmount` | 근로기간 3~12월이면 `partialYear`, 기준일이 다르면 `estimated`와 최소·최대 기준일. 금액은 1,950,000 그대로 | AC-30, AC-31 |
| `calculationUsesTheLawVersionTheRecordRemembers` | 신용카드 공제율 20%인 새 버전을 적용해도 1,950,000 그대로이고 `newerLawVersion`이 true. `refresh` 뒤 2,050,000 | TAX-66, AC-19 |
| `readingTheAnalysisWritesNothing` | 두 번 읽은 응답이 같고, 네 테이블 모든 행의 `xmin`과 `GET /tax/years/2026` 응답(모든 `rowVersion` 포함)이 그대로다 | TAX-44 |

`calculationUsesTheLawVersionTheRecordRemembers`의 기대값: 신용카드 공제율이 20%면 12,000,000 × 20% + 3,000,000 × 30% + 500,000 × 30% + 1,000,000 × 40% + 500,000 × 40% − 10,000,000 × 20% = 2,400,000 + 900,000 + 150,000 + 400,000 + 200,000 − 2,000,000 = 2,050,000.

- [ ] **Step 1: 실패하는 테스트 작성**

새 타입을 참조하지 않는 HTTP 테스트라 테스트만 넣어도 컴파일된다.

`test/tax/calc/TaxAnalysisApiTest.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAdmins;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestClock;
import com.saladbowl.api.support.TestTaxLaws;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;

import static com.saladbowl.api.support.TestTaxRecords.URL;
import static com.saladbowl.api.support.TestTaxRecords.addCard;
import static com.saladbowl.api.support.TestTaxRecords.cardBody;
import static com.saladbowl.api.support.TestTaxRecords.cashBody;
import static com.saladbowl.api.support.TestTaxRecords.createYear;
import static com.saladbowl.api.support.TestTaxRecords.planBody;
import static com.saladbowl.api.support.TestTaxRecords.putCard;
import static com.saladbowl.api.support.TestTaxRecords.putCash;
import static com.saladbowl.api.support.TestTaxRecords.putPlan;
import static com.saladbowl.api.support.TestTaxRecords.putYear;
import static com.saladbowl.api.support.TestTaxRecords.readVersion;
import static com.saladbowl.api.support.TestTaxRecords.yearBody;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 분석 조회(TAX-24, 35, 36, 38, 44, 50, 65, 75, AC-01, 13, 19, 20, 30, 31, 43).
 * 금액은 모두 합성값이고 기대 공제액은 PRD 7.1절 식의 손계산이다. 테스트의 올해는 2026이다.
 */
@Import(TestClock.Config.class)
class TaxAnalysisApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    AuthedUser admin;
    AuthedUser owner;

    @BeforeEach
    void signUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@example.test", "관리자");
        TestAdmins.grant(jdbc, admin.id());
        owner = TestAuth.signupAndLogin(mvc, "owner@example.test", "소유자");
    }

    private ResultActions analysis(AuthedUser user, int year) throws Exception {
        return mvc.perform(get(URL + "/" + year + "/analysis").header("Authorization", user.bearer()));
    }

    /** PRD 합성 예시 1의 입력자료: 신용 일반 1,200만, 체크 일반 200만 + 현금 일반 100만, 전통시장 100만, 대중교통 50만, 문화체육 50만. */
    private void addExample1Statements(AuthedUser user, String cardDate, String cashDate) throws Exception {
        addCard(mvc, user, 2026, cardBody("가나카드", cardDate, null,
                12_000_000L, 1_000_000L, 500_000L, 500_000L, 2_000_000L, 0L, 0L, 0L));
        putCash(mvc, user, 2026, cashBody(cashDate, null, 1_000_000L, 0L, 0L, 0L)).andExpect(status().isOk());
    }

    /** 와이어프레임의 입력자료(총급여 5,000만 기준 소득공제액 1,475,000원). */
    private void addWireframeStatements(AuthedUser user) throws Exception {
        addCard(mvc, user, 2026, cardBody("가나카드", "2026-06-30", null,
                14_000_000L, 300_000L, 200_000L, 100_000L, 2_000_000L, 200_000L, 300_000L, 100_000L));
        putCash(mvc, user, 2026, cashBody("2026-06-30", null, 500_000L, 100_000L, 0L, 0L))
                .andExpect(status().isOk());
    }

    private static String wireframePlan() {
        return planBody(null, 500_000L, 300_000L, 1_200_000L, 0L, 100_000L, 100_000L,
                100_000L, 0L, 0L, 0L, 0L, 100_000L);
    }

    /** 네 테이블 모든 행의 xmin(마지막으로 쓴 트랜잭션). 읽기만 했다면 그대로다. */
    private List<String> rowStamps() {
        return jdbc.queryForList("""
                SELECT 'year' || id || ':' || xmin FROM tax_year_records
                UNION ALL SELECT 'card' || id || ':' || xmin FROM tax_card_statements
                UNION ALL SELECT 'cash' || record_id || ':' || xmin FROM tax_cash_receipts
                UNION ALL SELECT 'plan' || record_id || ':' || xmin FROM tax_spending_plans
                ORDER BY 1""", String.class);
    }

    @Test
    void onlyTheOwnerReadsTheAnalysis() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        addExample1Statements(owner, "2026-06-30", "2026-06-30");
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@example.test", "다른회원");

        analysis(owner, 2026).andExpect(status().isOk());
        // 남의 연도와 없는 연도는 같은 404다. 서비스 관리자도 남의 자료는 읽지 못한다.
        for (AuthedUser stranger : List.of(other, admin)) {
            analysis(stranger, 2026).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("tax record not found"));
        }
        analysis(owner, 2025).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("tax record not found"));
        mvc.perform(get(URL + "/2026/analysis")).andExpect(status().isUnauthorized());
        analysis(owner, 999).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void statusGoesFromNoInputToIncompleteToLawPendingToReady() throws Exception {
        // 적용 버전이 없는 연도의 기록(AC-20)
        createYear(mvc, owner, 2026);
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.taxYear").value(2026))
                .andExpect(jsonPath("$.status").value("NO_INPUT"))
                .andExpect(jsonPath("$.blankCount").value(4))
                .andExpect(jsonPath("$.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.totals.creditGeneral").value(0))
                .andExpect(jsonPath("$.asOfDateMin").value(nullValue()))
                .andExpect(jsonPath("$.asOfDateMax").value(nullValue()))
                .andExpect(jsonPath("$.law").value(nullValue()))
                .andExpect(jsonPath("$.planSaved").value(false))
                .andExpect(jsonPath("$.deduction").value(nullValue()))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        // 카드 자료의 한 칸이 비었고 현금영수증 자료가 없다: 빈 칸 1 + 4
        long cardId = addCard(mvc, owner, 2026, cardBody("가나카드", "2026-06-30", null,
                12_000_000L, 1_000_000L, 500_000L, 500_000L, 2_000_000L, 0L, 0L, null));
        putPlan(mvc, owner, 2026, wireframePlan()).andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INCOMPLETE"))
                .andExpect(jsonPath("$.blankCount").value(5))
                .andExpect(jsonPath("$.totals.creditGeneral").value(12_000_000))
                .andExpect(jsonPath("$.planSaved").value(true))
                .andExpect(jsonPath("$.deduction").value(nullValue()))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        // 빈 칸을 모두 채웠지만 세법이 없다(TAX-65, TAX-75)
        putCard(mvc, owner, 2026, cardId, cardBody("가나카드", "2026-06-30",
                readVersion(mvc, owner, 2026, "$.cards[0].rowVersion"),
                12_000_000L, 1_000_000L, 500_000L, 500_000L, 2_000_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        putCash(mvc, owner, 2026, cashBody("2026-06-30", null, 1_000_000L, 0L, 0L, 0L)).andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LAW_PENDING"))
                .andExpect(jsonPath("$.blankCount").value(0))
                .andExpect(jsonPath("$.law").value(nullValue()))
                .andExpect(jsonPath("$.planSaved").value(true))
                .andExpect(jsonPath("$.deduction").value(nullValue()))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        // 첫 버전이 적용되면 기다리던 연도 기록이 그 버전을 기억하고 계산된다.
        long lawId = TestTaxLaws.createApplied(mvc, admin, 2026);
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.law.id").value(lawId))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000))
                .andExpect(jsonPath("$.recommendation.difference").isNumber());
    }

    @Test
    void readyAnalysisShowsPrdExample1StepByStep() throws Exception {
        long lawId = TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        addExample1Statements(owner, "2026-06-30", "2026-06-30");

        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.blankCount").value(0))
                .andExpect(jsonPath("$.totals.creditGeneral").value(12_000_000))
                .andExpect(jsonPath("$.totals.cashGeneral").value(1_000_000))
                .andExpect(jsonPath("$.estimated").value(false))
                .andExpect(jsonPath("$.asOfDateMin").value("2026-06-30"))
                .andExpect(jsonPath("$.asOfDateMax").value("2026-06-30"))
                .andExpect(jsonPath("$.partialYear").value(false))
                .andExpect(jsonPath("$.law.id").value(lawId))
                .andExpect(jsonPath("$.law.versionNo").value(1))
                .andExpect(jsonPath("$.law.appliedAt").isString())
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.planSaved").value(false))
                .andExpect(jsonPath("$.recommendation").value(nullValue()))
                .andExpect(jsonPath("$.deduction.highBracket").value(false))
                .andExpect(jsonPath("$.deduction.credit").value(12_000_000))
                .andExpect(jsonPath("$.deduction.debitCash").value(3_000_000))
                .andExpect(jsonPath("$.deduction.culture").value(500_000))
                .andExpect(jsonPath("$.deduction.market").value(1_000_000))
                .andExpect(jsonPath("$.deduction.transit").value(500_000))
                .andExpect(jsonPath("$.deduction.total").value(17_000_000))
                .andExpect(jsonPath("$.deduction.threshold").value(10_000_000))
                .andExpect(jsonPath("$.deduction.thresholdReached").value(true))
                .andExpect(jsonPath("$.deduction.remainingToThreshold").value(0))
                .andExpect(jsonPath("$.deduction.beforeThresholdCut").value(3_450_000))
                .andExpect(jsonPath("$.deduction.thresholdCut").value(1_500_000))
                .andExpect(jsonPath("$.deduction.deductible").value(1_950_000))
                .andExpect(jsonPath("$.deduction.basicLimit").value(3_000_000))
                .andExpect(jsonPath("$.deduction.basicUsed").value(1_950_000))
                .andExpect(jsonPath("$.deduction.extraCap").value(3_000_000))
                .andExpect(jsonPath("$.deduction.extraEligible").value(750_000))
                .andExpect(jsonPath("$.deduction.extraUsed").value(0))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000));
    }

    @Test
    void savedPlanIsRecommendedOnceTheStatementsAreComplete() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        putYear(mvc, owner, 2026, yearBody(50_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
        // 현금영수증 자료가 없어 미완료다. 계획은 저장되지만 추천은 나오지 않는다(AC-43).
        addCard(mvc, owner, 2026, cardBody("가나카드", "2026-06-30", null,
                14_000_000L, 300_000L, 200_000L, 100_000L, 2_000_000L, 200_000L, 300_000L, 100_000L));
        putPlan(mvc, owner, 2026, wireframePlan()).andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INCOMPLETE"))
                .andExpect(jsonPath("$.blankCount").value(4))
                .andExpect(jsonPath("$.planSaved").value(true))
                .andExpect(jsonPath("$.recommendation").value(nullValue()));

        putCash(mvc, owner, 2026, cashBody("2026-06-30", null, 500_000L, 100_000L, 0L, 0L))
                .andExpect(status().isOk());
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.deduction.amount").value(1_475_000))
                .andExpect(jsonPath("$.recommendation.methodShare.creditPct").value(82.0))
                .andExpect(jsonPath("$.recommendation.methodShare.debitPct").value(14.6))
                .andExpect(jsonPath("$.recommendation.methodShare.cashPct").value(3.4))
                .andExpect(jsonPath("$.recommendation.current.allocation.general.credit").value(1_018_183))
                .andExpect(jsonPath("$.recommendation.current.allocation.general.debit").value(145_454))
                .andExpect(jsonPath("$.recommendation.current.allocation.general.cash").value(36_363))
                .andExpect(jsonPath("$.recommendation.current.allocation.market.credit").value(50_001))
                .andExpect(jsonPath("$.recommendation.current.allocation.transit.credit").value(0))
                .andExpect(jsonPath("$.recommendation.current.allocation.culture.debit").value(50_000))
                .andExpect(jsonPath("$.recommendation.current.yearEndDeduction").value(1_997_272))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.general.credit").value(0))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.general.debitCash").value(1_200_000))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.market.credit").value(50_001))
                .andExpect(jsonPath("$.recommendation.recommended.allocation.market.debitCash").value(49_999))
                .andExpect(jsonPath("$.recommendation.recommended.yearEndDeduction").value(2_150_000))
                .andExpect(jsonPath("$.recommendation.difference").value(152_728))
                .andExpect(jsonPath("$.recommendation.reasons.length()").value(1))
                .andExpect(jsonPath("$.recommendation.reasons[0].code").value("CREDIT_OVER_THRESHOLD"))
                .andExpect(jsonPath("$.recommendation.reasons[0].category").value("GENERAL"))
                .andExpect(jsonPath("$.recommendation.reasons[0].amount").value(1_018_183));
    }

    @Test
    void partialYearAndMismatchedDatesAreFlaggedWithoutChangingTheAmount() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        putYear(mvc, owner, 2026, yearBody(40_000_000L, 3, 12, 0, null)).andExpect(status().isCreated());
        addExample1Statements(owner, "2026-06-30", "2026-05-31");

        // 근로기간이 전체가 아니고 기준일이 서로 달라도 입력한 금액 그대로 계산한다(AC-30, AC-31).
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.partialYear").value(true))
                .andExpect(jsonPath("$.estimated").value(true))
                .andExpect(jsonPath("$.asOfDateMin").value("2026-05-31"))
                .andExpect(jsonPath("$.asOfDateMax").value("2026-06-30"))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000));
    }

    @Test
    void calculationUsesTheLawVersionTheRecordRemembers() throws Exception {
        long first = TestTaxLaws.createApplied(mvc, admin, 2026);
        createYear(mvc, owner, 2026);
        addExample1Statements(owner, "2026-06-30", "2026-06-30");

        // 신용카드 공제율만 20%로 올린 두 번째 버전을 적용한다.
        long second = TestTaxLaws.createDraft(mvc, admin, 2026);
        mvc.perform(put(TestTaxLaws.URL + "/" + second).header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TestTaxLaws.values2026(0).replace("\"rateCreditPct\": 15", "\"rateCreditPct\": 20")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rateCreditPct").value(20));
        mvc.perform(post(TestTaxLaws.URL + "/" + second + "/apply").header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rowVersion\":1}"))
                .andExpect(status().isOk());

        // 회원이 다시 계산하기 전에는 기억한 버전의 결과 그대로다(AC-19).
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.law.id").value(first))
                .andExpect(jsonPath("$.newerLawVersion").value(true))
                .andExpect(jsonPath("$.deduction.amount").value(1_950_000));

        mvc.perform(post(URL + "/2026/law-version/refresh").header("Authorization", owner.bearer()))
                .andExpect(status().isOk());
        // 2,400,000 + 900,000 + 150,000 + 400,000 + 200,000 − 1,000만×20% = 2,050,000
        analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.law.id").value(second))
                .andExpect(jsonPath("$.law.versionNo").value(2))
                .andExpect(jsonPath("$.newerLawVersion").value(false))
                .andExpect(jsonPath("$.deduction.thresholdCut").value(2_000_000))
                .andExpect(jsonPath("$.deduction.amount").value(2_050_000));
    }

    @Test
    void readingTheAnalysisWritesNothing() throws Exception {
        TestTaxLaws.createApplied(mvc, admin, 2026);
        putYear(mvc, owner, 2026, yearBody(50_000_000L, 1, 12, 0, null)).andExpect(status().isCreated());
        addWireframeStatements(owner);
        putPlan(mvc, owner, 2026, wireframePlan()).andExpect(status().isOk());
        String yearBefore = mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andReturn().getResponse().getContentAsString();
        List<String> stampsBefore = rowStamps();
        assertThat(stampsBefore).hasSize(4);

        String first = analysis(owner, 2026).andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation.difference").value(152_728))
                .andReturn().getResponse().getContentAsString();
        String again = analysis(owner, 2026).andReturn().getResponse().getContentAsString();

        // 결과는 저장하지 않고 볼 때마다 같은 값으로 다시 계산한다(TAX-44). rowVersion도 그대로다.
        assertThat(again).isEqualTo(first);
        assertThat(rowStamps()).isEqualTo(stampsBefore);
        assertThat(mvc.perform(get(URL + "/2026").header("Authorization", owner.bearer()))
                .andReturn().getResponse().getContentAsString()).isEqualTo(yearBefore);
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TaxAnalysisApiTest'`
Expected: `7 tests completed, 7 failed`, `BUILD FAILED`(경로가 없어 첫 분석 조회가 `Status expected:<200> but was:<404>`로 실패한다).

- [ ] **Step 3: 응답 타입**

`main/tax/calc/TaxAnalysisView.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.record.SpendingTotals;
import com.saladbowl.api.tax.record.TaxRecordDtos.LawVersionRef;

import java.time.LocalDate;

/**
 * 분석 조회 응답. 저장하지 않고 조회할 때마다 입력·세법 버전으로 다시 계산한다(TAX-44).
 *
 * @param blankCount      미입력 칸 수(현금영수증 자료가 없으면 4 포함)
 * @param estimated       자료 기준일이 서로 다르다(TAX-27)
 * @param asOfDateMin     가장 이른 자료 기준일. 자료가 없으면 null
 * @param partialYear     근로기간이 1~12월 전체가 아니다(D03)
 * @param law             연도 기록이 기억하는 세법 버전. 없으면 null(세법 준비 중)
 * @param newerLawVersion 기억한 버전과 그 연도의 현재 적용 버전이 다르다
 * @param planSaved       저장된 지출계획이 있다
 * @param deduction       READY일 때만 있다
 * @param recommendation  READY이고 저장된 지출계획이 있을 때만 있다
 */
public record TaxAnalysisView(
        int taxYear,
        Status status,
        int blankCount,
        SpendingTotals totals,
        long totalSalary,
        boolean estimated,
        LocalDate asOfDateMin,
        LocalDate asOfDateMax,
        boolean partialYear,
        LawVersionRef law,
        boolean newerLawVersion,
        boolean planSaved,
        DeductionResult deduction,
        Recommendation recommendation) {

    /** 위에서부터 먼저 맞는 상태다. */
    public enum Status {
        /** 입력자료가 없다. */
        NO_INPUT,
        /** 미입력 칸이 있다. */
        INCOMPLETE,
        /** 자료는 완료됐지만 연도 기록에 세법 버전이 없다. */
        LAW_PENDING,
        READY
    }
}
```

- [ ] **Step 4: 서비스**

`main/tax/calc/TaxAnalysisService.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.tax.calc.TaxAnalysisView.Status;
import com.saladbowl.api.tax.law.TaxLawVersionRepository;
import com.saladbowl.api.tax.record.TaxRecordDtos.CardView;
import com.saladbowl.api.tax.record.TaxRecordDtos.CashView;
import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
import com.saladbowl.api.tax.record.TaxRecordService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

/**
 * 분석 조회. 회원 자료는 TaxRecordService.get(요청자, 귀속연도)으로만 읽으므로 남의 연도와 없는 연도는 같은 404다.
 * 아무것도 저장하지 않는다.
 */
@Service
public class TaxAnalysisService {

    private final TaxRecordService records;
    private final TaxLawVersionRepository lawVersions;

    public TaxAnalysisService(TaxRecordService records, TaxLawVersionRepository lawVersions) {
        this.records = records;
        this.lawVersions = lawVersions;
    }

    @Transactional(readOnly = true)
    public TaxAnalysisView get(long userId, int year) {
        TaxYearView view = records.get(userId, year);
        Status status = !view.hasInputs() ? Status.NO_INPUT
                : view.blankCount() > 0 ? Status.INCOMPLETE
                : view.lawVersion() == null ? Status.LAW_PENDING
                : Status.READY;

        DeductionResult deduction = null;
        Recommendation recommendation = null;
        if (status == Status.READY) {
            // 현재 적용 버전이 아니라 연도 기록이 기억한 버전으로 계산한다(TAX-66).
            TaxLawValues law = TaxLawValues.from(lawVersions.findById(view.lawVersion().id()).orElseThrow());
            deduction = DeductionCalculator.calculate(view.totalSalary(), view.childCount(), view.totals(), law);
            if (view.plan() != null) {
                recommendation = Recommender.recommend(view.totalSalary(), view.childCount(), view.totals(),
                        view.plan(), law);
            }
        }
        List<LocalDate> asOfDates = Stream.concat(view.cards().stream().map(CardView::asOfDate),
                Stream.ofNullable(view.cashReceipt()).map(CashView::asOfDate)).sorted().toList();
        return new TaxAnalysisView(view.taxYear(), status, view.blankCount(), view.totals(), view.totalSalary(),
                view.asOfDateMismatch(),
                asOfDates.isEmpty() ? null : asOfDates.getFirst(),
                asOfDates.isEmpty() ? null : asOfDates.getLast(),
                view.workStartMonth() != 1 || view.workEndMonth() != 12,
                view.lawVersion(), view.newerLawVersion(), view.plan() != null, deduction, recommendation);
    }
}
```

- [ ] **Step 5: 컨트롤러**

`TaxRecordController`의 `@RequestMapping("/tax/years/{year}")`와 같은 경로 아래이지만 다른 컨트롤러다(계산 패키지가 기록 패키지를 읽기만 하도록).

`main/tax/calc/TaxAnalysisController.java`

```java
package com.saladbowl.api.tax.calc;

import com.saladbowl.api.auth.CurrentUser;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 회원 본인의 소득공제 분석. 경로에 회원 id가 없고 항상 요청자의 연도 기록만 계산한다. */
@RestController
public class TaxAnalysisController {

    private final TaxAnalysisService service;

    public TaxAnalysisController(TaxAnalysisService service) {
        this.service = service;
    }

    @GetMapping("/tax/years/{year}/analysis")
    public TaxAnalysisView get(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
        return service.get(userId, year);
    }
}
```

- [ ] **Step 6: 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*tax*'`
Expected: `BUILD SUCCESSFUL`. `TaxAnalysisApiTest` 7건, `RecommenderTest` 11건, `PlanAllocatorTest` 5건, `DeductionCalculatorTest` 10건과 기존 `tax` 테스트 통과.

- [ ] **Step 7: 전체 테스트**

Run: `cd apps/api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`(임시 복사본에서는 전체 408건 통과).

- [ ] **Step 8: 커밋(컨트롤러)**

```bash
git add apps/api/src/main/java/com/saladbowl/api/tax/calc apps/api/src/test/java/com/saladbowl/api/tax/calc
git commit -m "feat(api): 소득공제 분석 조회 API" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

---

### PR 4 마무리 (컨트롤러)

- [ ] `cd apps/api && ./gradlew test` 결과를 구현 보고와 대조한다(이미 통과한 것은 변경 없이 다시 돌리지 않는다). `memoryTest`는 생략하고 PR 본문 "확인"에 이유(업로드 한도·파서·메모리 변경 없음)를 적는다.
- [ ] `api` 모드 뒤처리: `git status`에 `apps/api/src/main/java/com/saladbowl/api/tax/calc`·`apps/api/src/test/java/com/saladbowl/api/tax/calc` 밖의 변경이 없는지(`tax/record`·`tax/law`·migration·테스트 헬퍼가 그대로인지), `~/.gradle/init.d`·`~/.gradle/gradle.properties`가 바뀌지 않았는지 확인한다.
- [ ] 문서(Codex `gpt-6-luna` / `low`, 태그 `docs`, 또는 컨트롤러): `docs/architecture.md`의 `tax` 설명에 "`GET /tax/years/{year}/analysis`는 소득공제액과 추천을 저장하지 않고 조회할 때마다 `tax/calc`의 계산기 한 곳에서 계산한다"를 한 문장으로 더한다. `docs/deploy.md`·`docs/limits.md`는 바뀌는 것이 없다(새 테이블·한도 없음).
- [ ] 브랜치 최종 리뷰: Claude Fable 5.2 서브에이전트 한 번(`review-final`). 대상은 `origin/main..HEAD`. 볼 것:
  - **기대값 독립성(AC-24, TAX-46).** `DeductionCalculatorTest`·`PlanAllocatorTest`·`RecommenderTest`·`TaxAnalysisApiTest`의 기대 금액이 숫자 상수인지, 계산기·배분·추천을 불러 만든 기대값이 없는지(예외는 `assertBestOfSixteen`의 탐색 검증 한 곳이고 거기도 손계산 숫자와 함께 비교한다). 위 기대값 표에서 서너 줄을 골라 PRD 7.1절 3번 식으로 직접 계산해 테스트의 숫자와 맞는지 본다. 구현이 테스트를 통과시키려고 기대값을 고치지 않았는지(`git log -p`로 테스트 숫자의 변경 이력) 본다.
  - **조문 대조.** 위 "조문 대조" 표의 값이 `TestTaxLaws.values2026`·`LAW_2026`·`LAW_2025`와 같은지, 계산기에 세법 숫자(25, 15, 30, 40, 70,000,000, 한도)가 상수로 박혀 있지 않은지(모두 `TaxLawValues`에서 와야 한다).
  - **오버플로.** `DeductionCalculator`의 곱셈마다 최댓값을 따져 "계산 규칙"의 한계(12칸 합 240조, 비율 100%)와 맞는지, `largestInputsDoNotOverflow` 세 건이 그 한계를 실제로 넣는지, `PlanAllocator.share`가 `long` 곱을 쓰지 않는지, 부동소수점(`double`·`float`)이 `tax/calc`에 없는지.
  - **소유권.** `tax/calc`가 회원 자료를 `TaxRecordService.get` 말고 다른 길로 읽지 않는지(`tax/record`의 저장소 주입, `findById`, native SQL이 없어야 한다). 응답에 다른 회원의 값이 섞일 길(캐시·정적 필드·싱글턴 상태)이 없는지. 남의 연도·없는 연도·서비스 관리자의 404가 같은 본문인지.
  - **읽기 전용.** `TaxAnalysisService`가 `@Transactional(readOnly = true)`이고 `lockOwned`·`save*`·`refreshLawVersion`·`nextRowVersion`을 부르지 않는지, `readingTheAnalysisWritesNothing`이 `xmin`과 `rowVersion`을 모두 보는지. 새 migration·엔티티·저장소가 없는지.
  - **자녀등 무시.** `childTiersApply()`가 false인 세법에서 `childCount`가 결과에 닿는 길이 없는지(`childCountIsIgnoredWhenTheLawHasNoChildTiers`), 2명 초과가 2명 칸을 읽는지, 추천에도 같은 `childCount`·세법이 넘어가는지.
  - **세법 버전 고정.** 계산이 `view.lawVersion().id()`의 버전을 쓰고 `currentApplied`를 쓰지 않는지, 세법이 없을 때 계산기를 부르지 않고 `LAW_PENDING`인지, `calculationUsesTheLawVersionTheRecordRemembers`가 적용 전·`refresh` 전·후를 모두 보는지.
  - 그 밖: 요구사항 추적표의 PR 4 항목(TAX-24·35·36·38·40~42·44~46·50·52~54·65·69·71·75, AC-07~13·17·18·19·20·24·30·31·35·43)이 테스트로 덮였는지, "HTTP 인터페이스"의 필드 이름과 실제 응답이 같은지(웹 PR 7이 이 이름으로 타입을 만든다), 상태 판정 순서, 추천 전후 소비구분별 합이 같은지.
- [ ] **반론 리뷰(Codex 템플릿 F)는 붙이지 않는다.** 템플릿 F의 대상은 인증·쿠키·프록시·삭제·권한 변경인데 이 PR은 그중 어느 것도 바꾸지 않는다. 새 경로 하나는 읽기 전용이고 소유권 검사는 PR 3에서 반론 리뷰를 거친 `TaxRecordService.get`(→ `requireOwned`) 하나만 지난다. 이 PR의 위험은 계산이 틀리는 것이고, 그것은 구현하지 않은 쪽(Claude)의 Task 리뷰·최종 리뷰가 위 항목으로 본다. 같은 범위를 Codex가 한 번 더 보면 이중 리뷰다. **다음 중 하나라도 생기면 붙인다:** `tax/calc`가 `tax/record`의 저장소를 직접 읽게 됨, `tax/record`·`tax/law`·인증 설정을 고치게 됨, 분석 결과를 저장하게 됨. 그때 범위는 소유권 우회와 응답 차이로 좁힌다.
- [ ] PR 본문 "무엇"에 남길 것: 계산은 `tax/calc` 한 곳이고 결과를 저장하지 않는다는 점, 정수 연산과 원 미만 처리(과정 값은 표시용 버림), 연도 기록이 기억한 세법 버전으로 계산한다는 점, 자녀등 단계가 없는 세법에서 `childCount`를 무시한다는 점, 추천 탐색 방식과 이유 코드 7개, "조문 대조" 결과와 불확실한 점, "계획 초안에서 달라진 점"·"결정이 필요한 점" 목록, 화면이 없어 캡처가 없다는 점. `## 소모값`은 `python3 scripts/pr_usage.py` 출력으로 채운다.
- [ ] 배포 순서(`docs/deploy.md` 12절): 이 PR은 API만 바꾸고 migration이 없다. 병합 뒤 Render 배포가 Live가 되면 새 경로가 열린다. 웹은 PR 7 전까지 이 경로를 부르지 않는다.

---

# UI 표준 적용 (PR 5~7, 2026-11-14)

[UI 표준](../../ui-standards.md)을 소득공제 화면에 옮긴 기준이다. PR 5~7의 모든 화면 Task와 리뷰는 이 절을 요구사항으로 읽는다.

- 글자: 카드 제목 `--text-xl`(16px, 굵게), 섹션 제목·주요 내용·금액·카드사명 `--text-lg`(15px), 실행 버튼 `--text-card-action`(14px), 보조 설명·기준일·입력 라벨 `--text-md`(13px). 소득공제 화면 CSS Module 안에서만 지정하고 페이지 전체 토큰·행간을 재정의하지 않는다. 요약 4칸의 큰 숫자, 표 숫자는 기존 금액 표기 규칙(`useAmountFormatter`, `tabular-nums`)을 따른다.
- 창: 소득공제의 입력·확인 창은 공용 `Overlay.module.css`의 `typography`(창 제목 16px, 본문 15px, 버튼 14px, 라벨 13px, 행간 1.5)를 그대로 쓴다. Task 5.1의 `centered`도 이 클래스와 `content` 간격을 유지한다.
- 배치 — 정보는 왼쪽, 조작은 그 카드·섹션·행의 오른쪽 끝. 공간이 모자라 줄이 바뀌어도 우측 정렬을 유지하고, 긴 이름이 버튼을 밀어내지 않는다.

| 화면 | 왼쪽 | 오른쪽 |
|---|---|---|
| 입력자료 · 기본정보 카드 | 제목, 총급여·근로기간·자녀등 수 | [수정] |
| 입력자료 · 신용·체크 자료 카드 | 제목 (?) | [신용·체크 자료 추가] |
| 입력자료 · 카드사 행 | 카드사명, 완료/미완료, 기준일·합계·메모 | [편집] [삭제] (미완료면 [빈 칸 0원으로 채우기]도 오른쪽) |
| 입력자료 · 현금영수증 카드 | 제목, 상태, 기준일·합계 | [편집] / 미입력이면 [입력] [4칸 0원으로 채우기] |
| 입력자료 · 연도 기록 삭제 | 지워지는 범위 한 문장 | [2026년 기록 삭제] |
| 세법 관리 · 버전 목록 | 제목 | [새 초안 만들기] |
| 세법 관리 · 버전 행 | 번호·상태, 작성자·적용자·시각 | 초안만 [삭제] |
| 세법 관리 · 초안 하단 | — | [초안 저장] [검증] [적용] |
| 분석 · ② 지출계획 하단 | 저장 안내(미완료면 "저장만 합니다") | [계산하기] |
| 분석 · 단계 이동 | [이전] | [다음] (단계 탭은 공용 탭 구조를 따름) |
| 확인 창 | 결과 문장 | [취소] [삭제·적용] (실행이 오른쪽 끝) |

- 도움말 `?`: 보충 규칙은 제목 옆 `?` 팝오버로 옮기고, 상태·실행 불가 이유·오류와 해결 방법·삭제 결과는 화면이나 확인창에 직접 쓴다.
  - 도움말로: 자녀등 요건 3가지(기본정보 창의 자녀등 수 옆), "일반"이 전통시장·대중교통·문화체육을 뺀 금액이라는 설명의 상세(입력 창에는 한 줄 요약을 남김), 체크카드·현금영수증을 추천에서 한 묶음으로 보는 이유, 세법 관리의 급여구간 경계·추가한도 상한 뜻.
  - 직접 표시(도움말로 옮기지 않음): 미완료·빈 칸 수, 기준일 불일치 "추정", 근로기간 확인 필요, 세법 준비 중, 새 세법 버전 있음, 비율의 분모 문장(TAX-34), "환급액 아님"(TAX-43), 추천의 이유·가정(TAX-53), 연도 기록 삭제 범위, "다른 초안은 초안으로 남습니다".
  - "계산 과정 보기"는 펼침 영역(D20)이며 도움말 팝오버가 아니다.
  - 도움말 부품: 지금 `groups/GroupHelp.tsx`만 있다. 소득공제가 두 번째 사용처이므로 Task 5.1에서 `common/HelpButton.tsx`로 옮겨 공용화하고 그룹 화면은 import만 바꾼다(동작·스타일 불변). 접근성 이름은 `<대상> 도움말`.
- PWA: 버튼·아이콘 버튼·도움말·탭의 누르는 영역 최소 44×44px, 입력 글자 16px, 안전 영역·하단 탭 여백 유지. 820px 이하가 좁은 화면(`useMediaQuery`).
- 검증(각 화면 PR 마무리에 추가): 320px·375px·데스크톱에서 겹침·의도하지 않은 가로 스크롤 없음, 긴 카드사명·메모(예: 40자)와 글자 확대에서 줄바꿈, 도움말의 누르기·다시 누르기·바깥 누르기·Esc·포커스 복귀와 값 불변, 빈 상태·로딩·오류·저장 중. 브라우저 확인과 실기기(iOS·Android 설치형 PWA) 확인을 구분해 보고한다.

---

# PR 5 — 소득공제 메뉴와 입력자료 화면

> **에이전트 모델 배치(2026-11-20, Claude Fable 5.2 사용 종료 이후):** 구현은 Codex(`codex-collab` 3장 표: 공용 부품·설계 판단이 큰 Task는 `gpt-6-astra`, 일반 화면은 `gpt-6-sol`, 문서는 `gpt-6-luna`), Task 리뷰는 Claude Sonnet 5.5(`review-task`), 브랜치 최종 리뷰와 Task 상세 계획 작성은 Claude Opus 5.5(`review-final`·`controller`), 위험 영역이 바뀌면 Codex `gpt-6-astra` xhigh 반론 리뷰. 아래 Task의 "리뷰" 칸은 이 배치를 따른다. 모든 Agent 호출은 `model`을 명시한다.

화면 PR이다(375px 이전·이후 캡처). 브랜치 예: `feat/tax-inputs-web`(최신 `origin/main`에서 만든 worktree). PR 제목 예: `feat(web): 소득공제 메뉴와 입력자료 화면`.

검증: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build` + verify 스킬. API는 바꾸지 않는다(PR 1~4의 API만 부른다).

이 PR의 코드와 테스트는 계획을 쓸 때 저장소 밖 임시 복사본(`7e647af` 위 계획 커밋 `4aecc38` 기준)에서 Task 순서대로 실행해 확인했다(2026-11-20). Task마다 테스트만 먼저 넣어 실패를 보고(5.1: 새 5건 중 3건, 5.2: 7건과 새 파일 2개, 5.3: 12건, 5.4: 12건, 5.5: 5건 실패) 구현을 넣은 뒤 통과를 봤고, 마지막에 `typecheck`·`lint`(새 경고 없음)·`build`와 전체 `vitest run --maxWorkers=4`(85파일 684건 통과)를 돌렸다. 아래 코드 블록을 Task 순서대로 넣으면 그 상태와 같아지는 것도 확인했다. 브라우저 화면은 띄워 보지 않았다(PR 마무리의 verify에서 본다).

경로 줄임: 코드 블록 위 줄에 `<경로>` 전체(새 파일·통째 교체) 또는 `git apply`(기존 파일 고침, 저장소 루트에서 실행)를 적었다. 줄 번호가 어긋나면 내용을 보고 손으로 넣는다.

## 웹 설계

- 라우트(모두 기존 `RequireAuth > GroupProvider > TaxYearProvider > AppLayout` 아래): `/tax`는 `/tax/inputs`로 보낸다(`<Navigate replace>`; PR 7에서 TAX-68 규칙으로 바꾼다), `/tax/inputs`는 `TaxInputsPage`(lazy). PR 6이 `/tax/law`, PR 7이 `/tax/analysis`를 더한다.
- 메뉴: `MENU`의 두 번째에 `{ to: '/tax', label: '소득공제', shortLabel: '소득공제', icon: 'calculator', end: false, children: [{ to: '/tax/inputs', label: '입력자료' }] }`. 하단 탭은 5칸(홈·소득공제·대시보드·거래·그룹, AC-25). 회원·관리자 모두 하위 메뉴는 `입력자료` 하나다. 세법 관리 메뉴는 PR 6이 넣는다.
- 사이드바 하위 링크: 지금 `AppLayout`은 대시보드 안에서 **모든** 하위 링크에 `?month=`를 붙이고 `replace`한다. 소득공제 하위 링크가 대시보드 주소의 `?month=`를 가져가지 않도록 대시보드 메뉴에만 적용한다(Task 5.2).
- 선택 연도: `TaxYearProvider`(React 상태, 메모리만). 로그인 레이아웃(`AppLayout` 바깥, `GroupProvider` 안)에 두어 메뉴를 옮겨도 유지되고 로그아웃하면 사라진다. 처음 값과 선택지는 한국 시각 기준 올해·전년도·다음 해이고 로그인 동안 고정이다. 브라우저 저장소에 두지 않는다(TAX-07).
- 쿼리 키: `['tax', 'year', year]`, `['tax', 'law', 'current', year]`. `isGroupScopedKey`가 보지 않는 머리말이다. `GET /tax/years/{year}`와 `GET /tax/law-versions/current`의 404는 `taxApi`가 `null`로 바꿔 "없음" 상태가 되고 오류로 남지 않는다. 현재 적용 세법은 연도 기록이 없을 때만 읽는다(만들 때 기억될 버전의 `childTiersApply`와 "세법 준비 중" 판단). 기록이 있으면 기록의 `lawVersion`을 쓴다.
- 쓰기: `TaxYearView`를 돌려주는 저장은 응답으로 캐시를 바꾼다(`useTaxSave`). 카드 자료 삭제(204)는 연도를 다시 읽고, 연도 삭제(204)는 캐시를 `null`로 둔다. 합계·빈 칸 수는 서버 값을 쓴다.
- `rowVersion`: 응답에서 받은 값을 그대로 돌려보낸다. 입력 창은 연 시점의 값과 버전을 `useState`로 잡아 두고 저장한다(그 사이 캐시가 바뀌어도 오래된 버전으로 보내 서버가 409로 막게).
- 동시 수정·삭제(409, 404): 입력 창은 입력을 남긴 채 "다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다."와 [다시 불러오기]를 보이고, 누르면 연도를 다시 읽고 창을 닫는다(`SaveError`). 입력이 없는 동작(카드 삭제 확인, 연도 삭제 확인, 행의 [빈 칸 0원으로 채우기])은 바로 다시 읽고 "…새로 불러온 내용을 확인한 뒤 다시 시도해 주세요."를 보인다(`actionError`). 그 밖의 실패는 `errorMessage` 문구와 "입력한 값은 그대로 있습니다."(통신 오류 포함).
- 창: 입력·확인 창은 모두 `Dialog`/`ConfirmDialog`의 `centered`(Task 5.1)다. 창 안의 `Select`·기준일 달력은 기존 동작(좁은 화면 시트)을 둔다.
- 화면은 `useGroups()`를 쓰지 않는다. 머리에 "개인 자료 · 그룹과 무관"을 적는다(TAX-13). 좁은 화면 안 탭(`TaxTabs`)은 하위 화면이 둘이 되는 PR 7에서 만든다.
- 글자: 화면 뿌리(`inputs.module.css`의 `.page`)에서 `--text-base`·`--text-sm`·`--text-label`을 15px·13px·13px로 다시 가리켜 UI 표준의 크기를 맞춘다(창의 `Overlay.module.css` `typography`와 같은 방식, 이 화면 안에서만). 카드 제목 16px, 섹션 안 버튼 14px.
- 배치: 각 카드·행은 `.split`(왼쪽 정보는 `flex: 1 1 12rem`로 줄바꿈, 오른쪽 `.actions`는 `margin-left: auto`)으로 정보 왼쪽·조작 오른쪽을 지킨다. 넓은 화면(1100px 이상)은 자료(기본정보·신용·체크·현금영수증) | 연도 합계표 2단, 그보다 좁으면 차례로 쌓는다. 연도 기록 삭제는 맨 아래 전체 폭.

## 계획 초안에서 달라진 점 (2026-11-20)

- `TaxTabs.tsx`·`TaxIndexRedirect.tsx`를 만들지 않는다. 하위 화면이 하나뿐이라 좁은 화면 안 탭은 탭 하나짜리가 되고, `/tax` 진입은 한 줄 `<Navigate>`면 된다. PR 7 Task 7.1이 둘을 새로 만든다(7.1의 "Modify"는 "Create"로 읽는다).
- `MenuItem.children[].adminOnly`, `AppLayout`의 관리자 거르기, `Me.serviceAdmin`, `testMe.serviceAdmin`을 PR 5에서 넣지 않는다. 쓰는 곳이 PR 6(세법 관리 메뉴)뿐이다. PR 6 Task 6.1이 넣는다.
- 로그아웃·다른 회원·브라우저 저장소·그룹 전환 테스트는 입력자료 화면이 생기는 Task 5.3으로 옮겼다(5.2에는 화면 내용이 없다).
- 기준일 입력: 날짜만 받는 공용 부품이 없어 `common/DateTimePicker`에 `granularity="day"`·`minValue`·`maxValue`를 더한다(기본값은 그대로, 기존 사용처 불변). 연도 밖 날짜는 필드 오류로 제출을 막는다.
- 자녀등 수는 `MoneyField`가 아니라 RAC `NumberField`(0~99, 라벨 옆 `HelpButton` 때문에 `aria-labelledby`)다.
- 8칸·4칸 입력은 표가 아니라 소비구분별 `fieldset` 묶음 + 2열 격자(`AmountGrid`)다. 375px 창 폭에서 `MoneyField`(원 단위 표시 포함)가 두 칸 들어가고 가로 스크롤이 없다. 행·열 머리는 `legend`와 칸 라벨이다.
- 연도 합계표의 12칸은 서버 `totals` 그대로이고, 행 합계(소비구분 "계")·열 합계·총합계와 카드 행의 "합계"는 그 칸들을 더한 표시용 값이다(아래 "결정이 필요한 점" 2).
- `verify` 시드에 그룹 없는 계정 `verify5@example.test`(그룹없음)를 더한다. 지금 시드 4계정은 모두 그룹 멤버다(`verify4`도 공개만 끈 멤버).
- `ui-standards.md`가 `groups/GroupHelp.tsx`를 가리키는 문장을 Task 5.1에서 `common/HelpButton.tsx`로 고친다.
- 계획 초안의 테스트 유틸 이름 `renderApp`은 공용 유틸이 아니라 `app/AppRoutes.test.tsx` 안의 지역 함수다. 화면 테스트는 `test/renderPage.tsx`의 `renderPage`를 감싼 `test/taxFixtures.tsx`의 `renderTaxInputs`를 쓴다.

## 결정이 필요한 점 (기본값으로 썼다)

1. **`TaxTabs`·`TaxIndexRedirect`·`adminOnly`·`Me.serviceAdmin`은 쓰는 PR(6·7)에서 만든다.** 다른 선택: 계획 초안대로 PR 5에서 미리 만든다(쓰지 않는 코드가 한동안 운영에 나간다).
2. **표시용 합계는 웹이 더한다.** 연도 합계표의 12칸과 빈 칸 수·`hasInputs`·`asOfDateMismatch`는 서버 값이고 자료에서 다시 더하지 않는다. 행·열·총합계와 카드 한 건의 합계는 화면에 보이는 칸을 더한 정수 합(최대 약 3×10^13, JS 안전 정수 이내)이다. 다른 선택: 합계 행·열과 카드 합계를 빼고 12칸만 보인다(와이어프레임의 "계"·합계 열이 없어진다).
3. **409·404의 두 흐름.** 입력 창은 입력을 남기고 [다시 불러오기]를 누르면 새 값을 읽고 창을 닫는다(같은 창에서 새 버전으로 다시 저장하면 다른 곳의 변경을 말없이 덮을 수 있어서다). 입력이 없는 확인·채우기 동작은 바로 다시 읽고 다시 시도하게 한다. 다른 선택: 모든 경우 창을 유지한 채 자동으로 다시 읽고 새 버전으로 저장하게 한다.
4. **기준일 입력은 `DateTimePicker`를 넓혀 쓴다**(공용 부품 변경, Task 5.4를 `gpt-6-astra`로). 다른 선택: `common/DatePicker.tsx`를 새로 만든다(달력 마크업 중복).
5. **새 자료의 기준일 기본값은 이미 넣은 자료의 기준일**(마지막 카드, 없으면 현금영수증, 둘 다 없으면 빈 값)이다. 기준일 불일치(TAX-27)를 줄이려는 미리 채우기이고 바꿀 수 있다. 다른 선택: 늘 빈 값.
6. **[4칸 0원으로 채우기]는 4칸을 0으로 채운 현금영수증 입력 창을 연다.** 기준일이 필수라 누르자마자 저장할 수 없다. 다른 선택: 마지막 카드 기준일로 바로 저장한다(사용자가 기준일을 보지 못한다).
7. **카드 자료 50건 상한을 화면에서 미리 막는다**([신용·체크 자료 추가]를 끄고 이유를 적는다). 서버 400은 그대로 남는다.
8. **연도 선택지는 로그인 동안 고정된 3개다.** 범위를 벗어난 기존 기록(예: 2028년의 2026 기록)은 서버가 허용하지만 화면에서 고를 수 없다. 연도 목록 API가 없어서이며 후속 과제로 둔다.
9. **넓은 화면 2단은 1100px 이상.** 821~1099px에서 2단이면 연도 합계표 5열이 칸보다 넓어진다. 표는 아주 큰 금액·320px에 대비해 표 안에서만 가로로 움직일 수 있다(페이지는 넘치지 않는다).
10. **좁은 화면의 가운데 창 안쪽 여백은 16px**(아래 시트와 같은 값). 320px에서 8칸 입력의 두 칸 폭을 확보하려는 것이다.
11. **연도 합계표 안 금액은 ₩ 기호를 뺀다**(표 제목에 "단위 원"). 375px에서 세 결제수단 열이 들어가게 하려는 것이며 가림 문자도 `•••••`만 보인다. 기본정보 총급여·카드 행 합계는 `₩`를 둔다.
12. **verify 시드:** 소유자 `verify@example.test`를 SQL로 서비스 관리자로 지정하고, 한국 시각 기준 올해 귀속 세법을 2026 귀속 값으로 초안 생성·적용하고, 소유자에게 와이어프레임 합성값(총급여 5천만, A카드 9,600,000 · B카드 7,600,000 · 현금영수증 600,000, 지출계획 총 2,400,000)을 넣는다. 그룹 없는 `verify5`는 가입만 한다.

---

### Task 5.1: `Dialog` 가운데 창 선택지와 도움말 부품 공용화 (TAX-76, UI 표준)

**담당:** Codex `gpt-6-astra` / `medium` (`write`, 공용 부품), 태그 `impl-web-common`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Modify: `apps/web/src/common/Dialog.tsx`, `Overlay.module.css`, `ConfirmDialog.tsx`
- Create: `apps/web/src/common/HelpButton.tsx`(`groups/GroupHelp.tsx`를 옮김), `common/HelpButton.module.css`(`groups/GroupsPage.module.css`의 `helpButton`·`helpPopover`·`helpContent`를 옮김)
- Delete: `apps/web/src/groups/GroupHelp.tsx`
- Modify: `apps/web/src/groups/InviteSection.tsx`, `GroupSettings.tsx`, `BanList.tsx`(import만), `groups/GroupsPage.module.css`(옮긴 6줄 삭제), `docs/ui-standards.md:173`
- Test: `apps/web/src/common/Dialog.test.tsx`, `ConfirmDialog.test.tsx`. 그룹 도움말은 기존 `groups/GroupsPage.test.tsx`가 그대로 덮는다.

**Interfaces:**
- Consumes: RAC `ModalOverlay`가 주는 `--visual-viewport-height`(기존 시트와 같다), `revealFocusedField`.
- Produces: `DialogFrame`의 `centered?: boolean`(기본 false), `Dialog({ title, onClose, closeDisabled?, centered?, children })`, `ConfirmDialog`의 `centered?: boolean`. `centered`면 좁은 화면에서도 `styles.backdrop` + `styles.centeredNarrow`와 `styles.modal`을 쓰고, `AriaDialog`의 `content`·`typography`는 그대로다. 좁은 화면이면 `centered`여도 `revealFocusedField`로 포커스한 입력란을 키보드 위로 다시 보인다. `HelpButton({ title, children: string })` default export — `GroupHelp`와 같은 props·동작·스타일, 접근성 이름 `<title> 도움말`.

- [ ] **Step 1: 실패하는 테스트 작성** — 두 테스트 파일 끝에 더한다.

`git apply`:

```diff
diff --git a/apps/web/src/common/ConfirmDialog.test.tsx b/apps/web/src/common/ConfirmDialog.test.tsx
index 2aca1b1..78a9b5e 100644
--- a/apps/web/src/common/ConfirmDialog.test.tsx
+++ b/apps/web/src/common/ConfirmDialog.test.tsx
@@ -1,6 +1,7 @@
 import { act, render, screen, waitFor, within } from '@testing-library/react'
 import userEvent from '@testing-library/user-event'
 import { describe, expect, it, vi } from 'vitest'
+import { mockViewport } from '../test/mockViewport'
 import ConfirmDialog from './ConfirmDialog'
 
 function renderConfirm(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
@@ -93,3 +94,12 @@ describe('ConfirmDialog', () => {
     expect(screen.getByRole('button', { name: '짝꿍 내보내기 확인' })).toBeInTheDocument()
   })
 })
+
+it('opens as a centered modal on a narrow screen when centered', async () => {
+  mockViewport(true)
+  const { user } = renderConfirm({ centered: true })
+
+  await user.click(screen.getByRole('button', { name: '그룹 나가기' }))
+
+  expect(screen.getByRole('dialog', { name: '그룹 나가기' }).parentElement).toHaveClass('modal')
+})
diff --git a/apps/web/src/common/Dialog.test.tsx b/apps/web/src/common/Dialog.test.tsx
index c290d9f..4264bc6 100644
--- a/apps/web/src/common/Dialog.test.tsx
+++ b/apps/web/src/common/Dialog.test.tsx
@@ -237,3 +237,42 @@ describe('DialogFrame when the sheet resizes', () => {
     expect(observe).not.toHaveBeenCalled()
   })
 })
+
+describe('centered dialogs', () => {
+  it('opens a centered modal on a narrow screen and keeps the shared typography', () => {
+    mockViewport(true)
+    render(<DialogFrame isOpen onOpenChange={() => {}} title="기본정보" centered>{() => <p>본문</p>}</DialogFrame>)
+
+    const dialog = screen.getByRole('dialog', { name: '기본정보' })
+    expect(dialog).toHaveClass('content', 'typography')
+    expect(dialog.parentElement).toHaveClass('modal')
+    expect(dialog.parentElement).not.toHaveClass('modalSheet')
+    expect(dialog.parentElement!.parentElement).toHaveClass('backdrop', 'centeredNarrow')
+  })
+
+  it('still opens a bottom sheet on a narrow screen without centered', () => {
+    mockViewport(true)
+    render(<DialogFrame isOpen onOpenChange={() => {}} title="그룹 만들기">{() => <p>본문</p>}</DialogFrame>)
+
+    expect(screen.getByRole('dialog', { name: '그룹 만들기' }).parentElement).toHaveClass('modalSheet')
+  })
+
+  it('keeps the wide-screen modal unchanged when centered', () => {
+    mockViewport(false)
+    render(<DialogFrame isOpen onOpenChange={() => {}} title="기본정보" centered>{() => <p>본문</p>}</DialogFrame>)
+
+    const modal = screen.getByRole('dialog', { name: '기본정보' }).parentElement!
+    expect(modal).toHaveClass('modal')
+    expect(modal.parentElement).not.toHaveClass('centeredNarrow')
+  })
+
+  it('passes centered through Dialog and still reveals the focused input above the keyboard', () => {
+    mockViewport(true)
+    const { observe } = mockResizeObserver()
+    render(<Dialog title="자료 편집" onClose={vi.fn()} centered><label>카드사명<input /></label></Dialog>)
+
+    const modal = screen.getByRole('dialog', { name: '자료 편집' }).parentElement
+    expect(modal).toHaveClass('modal')
+    expect(observe).toHaveBeenCalledWith(modal)
+  })
+})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/Dialog.test.tsx src/common/ConfirmDialog.test.tsx`
Expected: 3건 FAIL(`opens a centered modal on a narrow screen…`, `passes centered through Dialog…`, `opens as a centered modal on a narrow screen when centered` — 부모가 `modalSheet`). 새 테스트 가운데 시트 유지·넓은 화면 2건과 기존 22건은 PASS(27건 중 24건).

- [ ] **Step 3: `centered` 구현**

`git apply`:

```diff
diff --git a/apps/web/src/common/ConfirmDialog.tsx b/apps/web/src/common/ConfirmDialog.tsx
index 0170c25..85ae4d5 100644
--- a/apps/web/src/common/ConfirmDialog.tsx
+++ b/apps/web/src/common/ConfirmDialog.tsx
@@ -16,6 +16,7 @@ type Props = {
   error: string | null
   onConfirm: (close: () => void) => void
   onOpen?: () => void
+  centered?: boolean
 }
 
 /**
@@ -23,7 +24,7 @@ type Props = {
  * 트리거는 RAC Button이라 Safari처럼 누를 때 포커스를 주지 않는 브라우저에서도 닫힌 뒤 트리거로 돌아온다.
  */
 export default function ConfirmDialog(props: Props) {
-  const { triggerLabel, triggerAriaLabel, triggerIcon, title, description, confirmLabel, confirmAriaLabel, isPending, error, onConfirm, onOpen } = props
+  const { triggerLabel, triggerAriaLabel, triggerIcon, title, description, confirmLabel, confirmAriaLabel, isPending, error, onConfirm, onOpen, centered } = props
   const [open, setOpen] = useState(false)
   // 실행 중 닫기 막기는 closeDisabled와 버튼 비활성이 맡는다. 여기서 isPending을 보면
   // mutate의 onSuccess(리렌더 전, isPending이 아직 true)에서 부른 close가 막힌다.
@@ -34,7 +35,7 @@ export default function ConfirmDialog(props: Props) {
         onPress={() => { onOpen?.(); setOpen(true) }}>
         {triggerIcon && <Icon name={triggerIcon} size={18} />}{triggerLabel}
       </Button>
-      <DialogFrame isOpen={open} onOpenChange={setOpen} title={title} closeDisabled={isPending} closeOnOutsideClick>
+      <DialogFrame isOpen={open} onOpenChange={setOpen} title={title} closeDisabled={isPending} closeOnOutsideClick centered={centered}>
         {() => (
           <>
             <p>{description}</p>
diff --git a/apps/web/src/common/Dialog.tsx b/apps/web/src/common/Dialog.tsx
index 5f71898..0afe111 100644
--- a/apps/web/src/common/Dialog.tsx
+++ b/apps/web/src/common/Dialog.tsx
@@ -15,14 +15,16 @@ type FrameProps = {
   closeOnOutsideClick?: boolean
   fullHeight?: boolean
   wide?: boolean
+  /** 좁은 화면에서도 아래 시트가 아니라 가운데 창으로 연다(소득공제 창, TAX-76). */
+  centered?: boolean
   pinnedHeader?: boolean
   headerAction?: ReactNode
   children: (opts: { close: () => void }) => ReactNode
 }
 
-/** 넓은 화면은 가운데 모달, 좁은 화면은 아래에서 올라오는 시트. 포커스 가두기·Esc·복귀는 RAC가 맡는다. */
+/** 넓은 화면은 가운데 모달, 좁은 화면은 아래에서 올라오는 시트(centered면 가운데 모달). 포커스 가두기·Esc·복귀는 RAC가 맡는다. */
 export function DialogFrame(props: FrameProps) {
-  const { isOpen, onOpenChange, title, closeDisabled = false, closeOnOutsideClick = false, fullHeight = false, wide = false, pinnedHeader = false, headerAction, children } = props
+  const { isOpen, onOpenChange, title, closeDisabled = false, closeOnOutsideClick = false, fullHeight = false, wide = false, centered = false, pinnedHeader = false, headerAction, children } = props
   const narrow = useNarrowWhileOpen(isOpen)
   useDialogHistory(isOpen, closeDisabled, onOpenChange)
 
@@ -40,23 +42,25 @@ export function DialogFrame(props: FrameProps) {
   const sheetClass = fullHeight ? `${styles.modalSheet} ${styles.fullSheet}` : styles.modalSheet
   const modalClass = wide ? `${styles.modal} ${styles.wide}` : styles.modal
   const pinned = pinnedHeader ? ` ${styles.pinned}` : ''
+  const sheet = narrow && !centered
+  const backdropClass = sheet ? styles.sheetBackdrop : narrow ? `${styles.backdrop} ${styles.centeredNarrow}` : styles.backdrop
   return (
     <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={closeOnOutsideClick && !closeDisabled}
-      isKeyboardDismissDisabled={closeDisabled} className={narrow ? styles.sheetBackdrop : styles.backdrop}>
-      <Modal ref={narrow ? revealFocusedField : undefined} className={(narrow ? sheetClass : modalClass) + pinned}>
+      isKeyboardDismissDisabled={closeDisabled} className={backdropClass}>
+      <Modal ref={narrow ? revealFocusedField : undefined} className={(sheet ? sheetClass : modalClass) + pinned}>
         <AriaDialog className={`${styles.content} ${styles.typography}`}>{({ close }) => body(close)}</AriaDialog>
       </Modal>
     </ModalOverlay>
   )
 }
 
-type Props = { title: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }
+type Props = { title: string; onClose: () => void; closeDisabled?: boolean; centered?: boolean; children: ReactNode }
 
 /** 화면이 조건부로 그려서 여닫는 대화상자. 기존 Modal과 사용법이 같다. */
-export default function Dialog({ title, onClose, closeDisabled = false, children }: Props) {
+export default function Dialog({ title, onClose, closeDisabled = false, centered, children }: Props) {
   return (
     <DialogFrame isOpen onOpenChange={(open) => { if (!open && !closeDisabled) onClose() }}
-      title={title} closeDisabled={closeDisabled}
+      title={title} closeDisabled={closeDisabled} centered={centered}
       headerAction={<button type="button" className={`${ui.button} ${ui.iconButton} ${ui.ghost}`} aria-label="닫기" disabled={closeDisabled} onClick={onClose}><Icon name="x" /></button>}>
       {() => children}
     </DialogFrame>
diff --git a/apps/web/src/common/Overlay.module.css b/apps/web/src/common/Overlay.module.css
index ef3a3e6..f88925c 100644
--- a/apps/web/src/common/Overlay.module.css
+++ b/apps/web/src/common/Overlay.module.css
@@ -23,6 +23,9 @@
 .backdrop { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; padding: var(--space-6) max(16px, env(safe-area-inset-left, 0px)); background: var(--overlay); }
 .modal { width: 100%; max-width: 560px; max-height: 100%; overflow: auto; background: var(--surface-000); border-radius: var(--radius-lg); }
 .wide { max-width: 880px; }
+/* 좁은 화면의 가운데 창: 시트처럼 화면 키보드 위 높이에서 가운데에 둔다(RAC가 --visual-viewport-height를 준다). */
+.centeredNarrow { inset: 0 0 auto; height: var(--visual-viewport-height); z-index: 20; padding: var(--space-4) max(16px, env(safe-area-inset-right, 0px)) var(--space-4) max(16px, env(safe-area-inset-left, 0px)); }
+.centeredNarrow .content { padding: var(--space-4); }
 .content { display: flex; flex-direction: column; gap: var(--space-6); padding: var(--space-6); outline: none; }
 /* 선택 시트의 .title에는 안쪽 여백이 있어 일반 창 제목은 별도 클래스로 쓴다. */
 .dialogTitle { margin: 0; font-size: var(--text-xl); line-height: 1.5; min-width: 0; overflow-wrap: anywhere; }
```

- [ ] **Step 4: 도움말 부품 옮기기** — `git rm apps/web/src/groups/GroupHelp.tsx` 뒤 아래 두 파일을 만든다(내용은 옮긴 것이고 import 경로·이름·주석만 다르다).

삭제: `apps/web/src/groups/GroupHelp.tsx`

`apps/web/src/common/HelpButton.tsx` 전체:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components'
import ui from './ui.module.css'
import styles from './HelpButton.module.css'

/** 제목 옆 `?` 버튼으로 여는 짧은 보충 설명. 다시 누르기·바깥 누르기·닫기·Esc로 닫는다. 접근성 이름은 `<title> 도움말`. */
export default function HelpButton({ title, children }: { title: string; children: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    // RAC의 비모달 팝오버는 포커스를 받지 않는 바깥 영역을 눌러도 닫히지 않는다.
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !popover.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button ref={trigger} aria-label={`${title} 도움말`} className={`${ui.button} ${ui.iconButton} ${ui.ghost} ${styles.helpButton}`}>
        <span aria-hidden="true">?</span>
      </Button>
      <Popover ref={popover} isNonModal placement="bottom start" offset={4} className={styles.helpPopover}
        shouldCloseOnInteractOutside={(element) => !trigger.current?.contains(element)}>
        <Dialog aria-label={`${title} 도움말`} className={styles.helpContent}>
          <p>{children}</p>
          <Button slot="close" className={ui.button}>닫기</Button>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
```

`apps/web/src/common/HelpButton.module.css` 전체:

```css
.helpButton { flex: none; color: var(--ink-muted); }
.helpButton span { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid currentColor; border-radius: 50%; font-size: var(--text-sm); }
.helpPopover { width: min(280px, calc(100vw - 32px)); max-height: var(--available-height); overflow: auto; overscroll-behavior: contain; background: var(--surface-000); border: 1px solid var(--line); border-radius: var(--radius-sm); box-shadow: 0 4px 16px var(--overlay); }
.helpContent { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); outline: none; font-size: var(--text-lg); line-height: 1.5; }
.helpContent p { margin: 0; overflow-wrap: anywhere; }
.helpContent > button { align-self: flex-end; font-size: var(--text-card-action); }
```

그룹 화면 import와 스타일, UI 표준 문장:

`git apply`:

```diff
diff --git a/apps/web/src/groups/BanList.tsx b/apps/web/src/groups/BanList.tsx
index 82142d6..68afb3c 100644
--- a/apps/web/src/groups/BanList.tsx
+++ b/apps/web/src/groups/BanList.tsx
@@ -7,7 +7,7 @@ import { groupsApi } from './groupsApi'
 import styles from './GroupsPage.module.css'
 import { useGroupMutations } from './useGroupMutations'
 import Icon from '../common/Icon'
-import GroupHelp from './GroupHelp'
+import HelpButton from '../common/HelpButton'
 
 export default function BanList({ groupId }: { groupId: number }) {
   const bans = useQuery({ queryKey: ['bans', groupId], queryFn: () => groupsApi.bans(groupId) })
@@ -17,7 +17,7 @@ export default function BanList({ groupId }: { groupId: number }) {
     <section aria-labelledby="bans-title" className={ui.stack}>
       <div className={styles.titleWithHelp}>
         <h3 id="bans-title" className={styles.subTitle}>차단 목록</h3>
-        <GroupHelp title="차단 목록">내보낸 멤버는 다시 합류할 수 없습니다. 차단을 해제하면 다시 초대할 수 있습니다.</GroupHelp>
+        <HelpButton title="차단 목록">내보낸 멤버는 다시 합류할 수 없습니다. 차단을 해제하면 다시 초대할 수 있습니다.</HelpButton>
       </div>
       {bans.isPending && <SkeletonRegion><ul className={styles.memberList}>
         {[0, 1].map((i) => <li key={i} className={styles.member}>
diff --git a/apps/web/src/groups/GroupSettings.tsx b/apps/web/src/groups/GroupSettings.tsx
index b0a8c14..14f6f75 100644
--- a/apps/web/src/groups/GroupSettings.tsx
+++ b/apps/web/src/groups/GroupSettings.tsx
@@ -5,7 +5,7 @@ import { errorMessage } from '../common/errorMessage'
 import ui from '../common/ui.module.css'
 import TextField from '../common/TextField'
 import field from '../common/Field.module.css'
-import GroupHelp from './GroupHelp'
+import HelpButton from '../common/HelpButton'
 import styles from './GroupsPage.module.css'
 import { toast } from '../common/Toast'
 import { useGroupMutations } from './useGroupMutations'
@@ -36,7 +36,7 @@ export function ShareToggle({ groupId, enabled }: { groupId: number; enabled: bo
         <div className={styles.settingCopy}>
           <div className={styles.titleWithHelp}>
             <label id={`${shareId}-label`} htmlFor={shareId}>내 거래 그룹 공개</label>
-            <GroupHelp title="내 거래 그룹 공개">끄면 그룹 대시보드와 그룹 거래에서 내 거래가 제외됩니다. 숨긴 거래는 공개해도 보이지 않습니다.</GroupHelp>
+            <HelpButton title="내 거래 그룹 공개">끄면 그룹 대시보드와 그룹 거래에서 내 거래가 제외됩니다. 숨긴 거래는 공개해도 보이지 않습니다.</HelpButton>
           </div>
           <Text slot="description" className={ui.muted}>이 그룹에 내 거래를 공유해요.</Text>
         </div>
diff --git a/apps/web/src/groups/GroupsPage.module.css b/apps/web/src/groups/GroupsPage.module.css
index 8243e9e..3c7e59b 100644
--- a/apps/web/src/groups/GroupsPage.module.css
+++ b/apps/web/src/groups/GroupsPage.module.css
@@ -36,10 +36,4 @@
 .titleWithHelp > :first-child { min-width: 0; overflow-wrap: anywhere; }
 .settingCopy { min-width: 0; display: flex; flex-direction: column; }
 .shareButton { justify-content: center; min-width: 44px; }
-.helpButton { flex: none; color: var(--ink-muted); }
-.helpButton span { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid currentColor; border-radius: 50%; font-size: var(--text-sm); }
-.helpPopover { width: min(280px, calc(100vw - 32px)); max-height: var(--available-height); overflow: auto; overscroll-behavior: contain; background: var(--surface-000); border: 1px solid var(--line); border-radius: var(--radius-sm); box-shadow: 0 4px 16px var(--overlay); }
-.helpContent { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); outline: none; font-size: var(--text-lg); line-height: 1.5; }
-.helpContent p { margin: 0; overflow-wrap: anywhere; }
-.helpContent > button { align-self: flex-end; font-size: var(--text-card-action); }
 .detail h2 { overflow-wrap: anywhere; }
diff --git a/apps/web/src/groups/InviteSection.tsx b/apps/web/src/groups/InviteSection.tsx
index 9a5bb19..471ce4a 100644
--- a/apps/web/src/groups/InviteSection.tsx
+++ b/apps/web/src/groups/InviteSection.tsx
@@ -7,7 +7,7 @@ import TextField from '../common/TextField'
 import ui from '../common/ui.module.css'
 import styles from './GroupsPage.module.css'
 import { useGroupMutations } from './useGroupMutations'
-import GroupHelp from './GroupHelp'
+import HelpButton from '../common/HelpButton'
 
 const MAX_MEMBERS = 6
 
@@ -33,7 +33,7 @@ export default function InviteSection({ groupId, memberCount }: { groupId: numbe
       <div className={styles.actionRow}>
         <div className={styles.titleWithHelp}>
           <h3 id="invite-title" className={styles.subTitle}>초대 링크</h3>
-          <GroupHelp title="초대 링크">링크는 7일간 유효합니다. 받은 사람은 로그인하거나 가입한 뒤 합류할 수 있습니다.</GroupHelp>
+          <HelpButton title="초대 링크">링크는 7일간 유효합니다. 받은 사람은 로그인하거나 가입한 뒤 합류할 수 있습니다.</HelpButton>
         </div>
         <button type="button" className={ui.button} disabled={full || createInvite.isPending}
           onClick={() => { setCopied(null); createInvite.mutate(groupId) }}>
diff --git a/docs/ui-standards.md b/docs/ui-standards.md
index 7006a56..565ffb2 100644
--- a/docs/ui-standards.md
+++ b/docs/ui-standards.md
@@ -170,7 +170,7 @@ Salad Bowl의 새 화면과 UI 수정에 적용하는 공통 기준이다.
 
 그룹 관리에 먼저 적용했다. 이름 변경·초대 생성·복사·나가기의 우측 정렬,
 좌측 설명·우측 공개 토글, 세 종류의 도움말이 기준 사례다.
-현재 도움말 구현은 `apps/web/src/groups/GroupHelp.tsx`이며 아직 공용 부품은 아니다.
+도움말은 공용 부품 `apps/web/src/common/HelpButton.tsx`를 쓴다(그룹 관리·소득공제).
 
 다른 화면이 모두 이 표준을 충족한다고 보지는 않는다. 새 UI와 수정하는 영역부터 적용하고,
 화면별 의미나 권한·데이터 처리 동작을 배치 통일만을 위해 바꾸지 않는다.
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/web && npx vitest run src/common/Dialog.test.tsx src/common/ConfirmDialog.test.tsx && npx vitest run src/groups && npx tsc -b`
Expected: 27 passed, 18 passed(그룹 도움말 테스트 포함), 타입 오류 없음.

- [ ] **Step 6: 커밋(컨트롤러)** — Codex는 커밋하지 않는다. 컨트롤러가 보고와 diff를 확인한 뒤 커밋한다.

```bash
git add -A apps/web/src/common apps/web/src/groups docs/ui-standards.md
git commit -m "feat(web): Dialog에 가운데 창 선택지를 두고 도움말 부품을 공용화" -m "Co-Authored-By: Codex (gpt-6-astra) <noreply@openai.com>"
```

### Task 5.2: 메뉴·라우트·선택 연도·API 모듈과 캐시 규칙 (TAX-03, 07, 10, 12, 13, 19, 68 일부)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Create: `apps/web/src/tax/taxApi.ts`, `tax/TaxYearProvider.tsx`, `tax/TaxHeader.tsx`, `tax/inputs/TaxInputsPage.tsx`(머리만 있는 첫 판, Task 5.3이 통째로 바꾼다)
- Modify: `apps/web/src/app/menu.ts`, `app/AppRoutes.tsx`, `app/AppLayout.tsx:92-93`, `common/Icon.tsx`(`history` 위에 `calculator`)
- Test: `apps/web/src/tax/TaxHeader.test.tsx`, `tax/taxApi.test.ts`(생성), `app/BottomTabBar.test.tsx`, `app/AppRoutes.test.tsx`, `api/queryClient.test.ts`(수정)

**Interfaces:**
- Consumes: `apiFetch`(`api/client.ts`), `ApiError`, `PageHeader({ title, action })`, `Select({ label, items, selectedKey, onSelectionChange })`, `menuLabel('/tax')`.
- Produces:
  - `taxApi.year(year): Promise<TaxYearView | null>`(404 → null), `saveBasicInfo(year, BasicInfoInput)`, `deleteYear(year, rowVersion)`, `addCard(year, CardInput)`, `saveCard(year, cardId, CardInput)`, `deleteCard(year, cardId, rowVersion)`, `saveCashReceipt(year, CashInput)`, `currentLaw(year): Promise<CurrentLaw | null>`(404 → null). 타입 `TaxYearView`, `CardView`, `CashView`, `CardAmounts`, `CashAmounts`, `SpendingTotals`, `LawVersionRef`, `PlanView`, `PlanRow`, `CurrentLaw`, `BasicInfoInput`, `CardInput`, `CashInput`(PR 3 `TaxRecordDtos`와 같은 필드).
  - `taxKeys.year(year)` = `['tax', 'year', year]`, `taxKeys.currentLaw(year)` = `['tax', 'law', 'current', year]`.
  - `useTaxYearView(year)`(useQuery), `useTaxSave(year, save)`(성공하면 응답 `TaxYearView`로 캐시 교체), `isStale(error)`(409·404).
  - `TaxYearProvider({ children, today? })`, `useTaxYear(): { year; setYear(year); choices: number[] }`, `seoulYear(now: Date): number`.
  - `TaxHeader()` — 넓은 화면 `h1` "소득공제", 오른쪽 `귀속연도` 선택, "개인 자료 · 그룹과 무관".
  - 아이콘 이름 `'calculator'`(Lucide `calculator`, lucide-static 1.61.0 경로. 리뷰어는 그 버전 SVG와 대조한다).

- [ ] **Step 1: 실패하는 테스트 작성** — 새 테스트 파일 둘과 기존 테스트 고침.

`apps/web/src/tax/TaxHeader.test.tsx` 전체:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from 'react-aria-components'
import { describe, expect, it } from 'vitest'
import TaxHeader from './TaxHeader'
import { seoulYear, TaxYearProvider, useTaxYear } from './TaxYearProvider'

function Year() {
  return <p>선택: {useTaxYear().year}</p>
}

function renderHeader(today: Date) {
  render(
    <I18nProvider locale="ko-KR">
      <TaxYearProvider today={today}><TaxHeader /><Year /></TaxYearProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

describe('seoulYear', () => {
  it('reads the year in Korea, not in UTC', () => {
    expect(seoulYear(new Date('2026-12-31T14:59:00Z'))).toBe(2026)
    expect(seoulYear(new Date('2026-12-31T15:00:00Z'))).toBe(2027)
  })
})

describe('TaxHeader', () => {
  it('starts at this year, offers last, this and next year, and says the data is personal', async () => {
    const user = renderHeader(new Date('2026-11-20T00:00:00+09:00'))

    expect(screen.getByRole('heading', { level: 1, name: '소득공제' })).toBeInTheDocument()
    expect(screen.getByText('개인 자료 · 그룹과 무관')).toBeInTheDocument()
    expect(screen.getByText('선택: 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /귀속연도/ }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['2025년', '2026년', '2027년'])

    await user.click(screen.getByRole('option', { name: '2025년' }))

    expect(screen.getByText('선택: 2025')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /귀속연도/ })).toHaveTextContent('2025년')
  })
})
```

`apps/web/src/tax/taxApi.test.ts` 전체:

```ts
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { taxApi } from './taxApi'

describe('taxApi', () => {
  it('reads a missing year record or law version as null', async () => {
    server.use(
      http.get('*/api/tax/years/2026', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })),
      http.get('*/api/tax/law-versions/current', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })),
    )

    expect(await taxApi.year(2026)).toBeNull()
    expect(await taxApi.currentLaw(2026)).toBeNull()
  })

  it('still throws other errors', async () => {
    server.use(http.get('*/api/tax/years/2026', () => HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })))

    await expect(taxApi.year(2026)).rejects.toMatchObject({ status: 500 })
  })

  it('sends the row version it was given unchanged when deleting', async () => {
    const urls: string[] = []
    server.use(
      http.delete('*/api/tax/years/2026', ({ request }) => { urls.push(request.url); return new HttpResponse(null, { status: 204 }) }),
      http.delete('*/api/tax/years/2026/cards/7', ({ request }) => { urls.push(request.url); return new HttpResponse(null, { status: 204 }) }),
    )

    await taxApi.deleteYear(2026, 9007199254740991)
    await taxApi.deleteCard(2026, 7, 41)

    expect(urls.map((url) => new URL(url).search)).toEqual(['?rowVersion=9007199254740991', '?rowVersion=41'])
  })
})
```

`git apply`:

```diff
diff --git a/apps/web/src/api/queryClient.test.ts b/apps/web/src/api/queryClient.test.ts
index 031c88a..9b8ee93 100644
--- a/apps/web/src/api/queryClient.test.ts
+++ b/apps/web/src/api/queryClient.test.ts
@@ -27,6 +27,8 @@ describe('isGroupScopedKey', () => {
     expect(isGroupScopedKey(['categories'])).toBe(false)
     expect(isGroupScopedKey(['groups'])).toBe(false)
     expect(isGroupScopedKey(['transactions', 'mine', '2026-10'])).toBe(false)
+    expect(isGroupScopedKey(['tax', 'year', 2026])).toBe(false)
+    expect(isGroupScopedKey(['tax', 'law', 'current', 2026])).toBe(false)
   })
 })
 
@@ -43,6 +45,18 @@ describe('createQueryClient', () => {
     expect(client.getQueryState(['groups'])?.isInvalidated).toBe(true)
   })
 
+  it('leaves the group list alone when a tax query is not found', async () => {
+    const client = createQueryClient()
+    client.setQueryData(['groups'], [])
+
+    await client.prefetchQuery({
+      queryKey: ['tax', 'year', 2026],
+      queryFn: () => Promise.reject(new ApiError(404, 'NOT_FOUND', 'x')),
+    })
+
+    expect(client.getQueryState(['groups'])?.isInvalidated).toBe(false)
+  })
+
   it('leaves the group list alone for other errors', async () => {
     const client = createQueryClient()
     client.setQueryData(['groups'], [])
diff --git a/apps/web/src/app/AppRoutes.test.tsx b/apps/web/src/app/AppRoutes.test.tsx
index 8be0abf..6843044 100644
--- a/apps/web/src/app/AppRoutes.test.tsx
+++ b/apps/web/src/app/AppRoutes.test.tsx
@@ -81,12 +81,44 @@ describe('AppRoutes', () => {
     renderApp('/')
     const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
     expect(within(nav).getAllByRole('link').map((l) => l.textContent))
-      .toEqual(['홈', '대시보드', '대분류', '소분류', '거래 목록', '그룹 관리'])
+      .toEqual(['홈', '소득공제', '입력자료', '대시보드', '대분류', '소분류', '거래 목록', '그룹 관리'])
     expect(within(nav).getByRole('link', { name: '대분류' })).toHaveAttribute('href', '/dashboard/major')
     expect(within(nav).getByRole('link', { name: '소분류' })).toHaveAttribute('href', '/dashboard/minor')
     expect(within(nav).getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current')
   })
 
+  it('opens 소득공제 at its inputs screen with the sub-link marked and no law admin link', async () => {
+    signedIn([])
+    server.use(
+      http.get('*/api/tax/years/:year', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })),
+      http.get('*/api/tax/law-versions/current', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })),
+    )
+    renderApp('/')
+    const user = userEvent.setup()
+
+    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
+    await user.click(within(nav).getByRole('link', { name: '소득공제' }))
+
+    expect(await screen.findByRole('heading', { level: 1, name: '소득공제' })).toBeInTheDocument()
+    expect(within(nav).getByRole('link', { name: '입력자료' })).toHaveAttribute('aria-current', 'page')
+    expect(within(nav).getByRole('link', { name: '소득공제' })).toHaveAttribute('aria-current', 'true')
+    expect(screen.queryByRole('link', { name: /세법 관리/ })).not.toBeInTheDocument()
+  })
+
+  it('does not carry the dashboard month into the tax sub-link', async () => {
+    mockViewport(false)
+    signedIn([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
+    server.use(
+      http.get('*/api/groups/10/summary', () => HttpResponse.json({ month: '2026-08', income: 0, expense: 0, byCategory: [], byMember: [] })),
+      http.get('*/api/groups/10/summary/trend', () => HttpResponse.json({ months: [], categories: [] })),
+    )
+    renderApp('/dashboard/major?month=2026-08')
+
+    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
+    expect(within(nav).getByRole('link', { name: '대분류' })).toHaveAttribute('href', '/dashboard/major?month=2026-08')
+    expect(within(nav).getByRole('link', { name: '입력자료' })).toHaveAttribute('href', '/tax/inputs')
+  })
+
   it('marks only the current dashboard sub-link as the page', async () => {
     mockViewport(false)
     signedIn([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
@@ -422,7 +454,7 @@ describe('AppRoutes on a narrow screen', () => {
     const navs = await screen.findAllByRole('navigation', { name: '주 메뉴' })
     expect(navs).toHaveLength(1)
     const names = within(navs[0]).getAllByRole('link').map((link) => link.textContent)
-    expect(names).toEqual(['홈', '대시보드', '거래', '그룹'])
+    expect(names).toEqual(['홈', '소득공제', '대시보드', '거래', '그룹'])
     expect(within(navs[0]).getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page')
     // 닉네임과 로그아웃은 상단 바에 없고 계정 시트 안에 있다.
     expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument()
diff --git a/apps/web/src/app/BottomTabBar.test.tsx b/apps/web/src/app/BottomTabBar.test.tsx
index 0563903..24f53e3 100644
--- a/apps/web/src/app/BottomTabBar.test.tsx
+++ b/apps/web/src/app/BottomTabBar.test.tsx
@@ -14,16 +14,22 @@ function renderAt(path: string) {
 }
 
 describe('BottomTabBar', () => {
-  it('shows four short-named links', () => {
+  it('shows five short-named links with 소득공제 second', () => {
     const nav = renderAt('/')
     const names = within(nav).getAllByRole('link').map((link) => link.textContent)
-    expect(names).toEqual(['홈', '대시보드', '거래', '그룹'])
+    expect(names).toEqual(['홈', '소득공제', '대시보드', '거래', '그룹'])
+    expect(within(nav).getByRole('link', { name: '소득공제' })).toHaveAttribute('href', '/tax')
+  })
+
+  it('marks 소득공제 on its sub-screens', () => {
+    const nav = renderAt('/tax/inputs')
+    expect(within(nav).getByRole('link', { name: '소득공제' })).toHaveAttribute('aria-current', 'page')
   })
 
   it('marks only the current screen', () => {
     const nav = renderAt('/transactions')
     expect(within(nav).getByRole('link', { name: '거래' })).toHaveAttribute('aria-current', 'page')
-    for (const name of ['홈', '대시보드', '그룹']) {
+    for (const name of ['홈', '소득공제', '대시보드', '그룹']) {
       expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current')
     }
   })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/app/BottomTabBar.test.tsx src/app/AppRoutes.test.tsx src/api/queryClient.test.ts src/tax`
Expected: `src/tax/TaxHeader.test.tsx`·`src/tax/taxApi.test.ts`는 `Failed to resolve import "./TaxHeader"`·`"./taxApi"`로 파일째 FAIL. 나머지에서 7건 FAIL(하단 탭 3건, 사이드바 목록·소득공제 진입·`?month=`·좁은 화면 탭 4건), 38건 PASS(`queryClient`의 새 2건은 지금도 통과하는 회귀 방지).

- [ ] **Step 3: API 모듈**

`apps/web/src/tax/taxApi.ts` 전체:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { ApiError } from '../api/errors'

// PR 3 응답(TaxRecordDtos)과 같은 모양. 금액은 원 단위 정수, null은 미입력이다.
// rowVersion은 서버가 주는 불투명한 값(JS 안전 정수 이하)이다. 받은 값을 그대로 돌려보내고 계산하지 않는다.
export type CardAmounts = {
  creditGeneral: number | null; creditMarket: number | null; creditTransit: number | null; creditCulture: number | null
  debitGeneral: number | null; debitMarket: number | null; debitTransit: number | null; debitCulture: number | null
}
export type CashAmounts = { general: number | null; market: number | null; transit: number | null; culture: number | null }
export type CardView = { id: number; rowVersion: number; issuerName: string; asOfDate: string; memo: string | null; amounts: CardAmounts; blankCount: number }
export type CashView = { rowVersion: number; asOfDate: string; memo: string | null; amounts: CashAmounts; blankCount: number }
export type PlanRow = { creditFixed: number; debitFixed: number; flexible: number }
export type PlanView = { rowVersion: number; general: PlanRow; market: PlanRow; transit: PlanRow; culture: PlanRow }
export type LawVersionRef = { id: number; versionNo: number; appliedAt: string; childTiersApply: boolean }
/** 연도 합계표 12칸. 서버가 그 연도 자료를 더한 값이고 웹은 자료에서 다시 더하지 않는다. */
export type SpendingTotals = Record<keyof CardAmounts | 'cashGeneral' | 'cashMarket' | 'cashTransit' | 'cashCulture', number>
export type TaxYearView = {
  taxYear: number; rowVersion: number; totalSalary: number; workStartMonth: number; workEndMonth: number; childCount: number
  lawVersion: LawVersionRef | null; newerLawVersion: boolean; cards: CardView[]; cashReceipt: CashView | null; plan: PlanView | null
  totals: SpendingTotals; blankCount: number; hasInputs: boolean; asOfDateMismatch: boolean
}
/** 회원용 현재 적용 세법(`GET /tax/law-versions/current`) 가운데 화면이 쓰는 칸. */
export type CurrentLaw = { id: number; taxYear: number; versionNo: number; appliedAt: string; childTiersApply: boolean }

export type BasicInfoInput = { totalSalary: number; workStartMonth: number; workEndMonth: number; childCount: number; rowVersion?: number }
export type CardInput = { issuerName: string; asOfDate: string; memo: string | null; amounts: CardAmounts; rowVersion?: number }
export type CashInput = { asOfDate: string; memo: string | null; amounts: CashAmounts; rowVersion?: number }

const yearPath = (year: number) => `/tax/years/${year}`

/** 404는 "없음"(연도 기록 없음, 적용 세법 없음)이라 null로 돌려준다. 그룹 쿼리처럼 그룹 목록을 다시 부르지 않는다. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export const taxApi = {
  year: (year: number) => orNull(apiFetch<TaxYearView>(yearPath(year))),
  /** rowVersion이 없으면 연도 기록을 만들고(201), 있으면 기본정보를 고친다(200). */
  saveBasicInfo: (year: number, body: BasicInfoInput) => apiFetch<TaxYearView>(yearPath(year), { method: 'PUT', json: body }),
  deleteYear: (year: number, rowVersion: number) => apiFetch<void>(`${yearPath(year)}?rowVersion=${rowVersion}`, { method: 'DELETE' }),
  addCard: (year: number, body: CardInput) => apiFetch<TaxYearView>(`${yearPath(year)}/cards`, { method: 'POST', json: body }),
  saveCard: (year: number, cardId: number, body: CardInput) =>
    apiFetch<TaxYearView>(`${yearPath(year)}/cards/${cardId}`, { method: 'PUT', json: body }),
  deleteCard: (year: number, cardId: number, rowVersion: number) =>
    apiFetch<void>(`${yearPath(year)}/cards/${cardId}?rowVersion=${rowVersion}`, { method: 'DELETE' }),
  saveCashReceipt: (year: number, body: CashInput) => apiFetch<TaxYearView>(`${yearPath(year)}/cash-receipt`, { method: 'PUT', json: body }),
  currentLaw: (year: number) => orNull(apiFetch<CurrentLaw>(`/tax/law-versions/current?year=${year}`)),
}

/** 소득공제 쿼리 키. 머리말 `tax`는 isGroupScopedKey가 보지 않고, 로그아웃 때 queryClient.clear()로 지워진다. */
export const taxKeys = {
  year: (year: number) => ['tax', 'year', year] as const,
  currentLaw: (year: number) => ['tax', 'law', 'current', year] as const,
}

export function useTaxYearView(year: number) {
  return useQuery({ queryKey: taxKeys.year(year), queryFn: () => taxApi.year(year) })
}

/** TaxYearView를 돌려주는 저장. 응답으로 캐시를 바꾼다(합계를 다시 계산하지 않는다). */
export function useTaxSave<T>(year: number, save: (input: T) => Promise<TaxYearView>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: save, onSuccess: (view) => client.setQueryData(taxKeys.year(year), view) })
}

/** 다른 곳에서 먼저 고쳤거나(409) 지운(404) 자료에 대한 저장. 새로 불러와야 다시 저장할 수 있다. */
export function isStale(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404)
}
```

- [ ] **Step 4: 선택 연도와 머리**

`apps/web/src/tax/TaxYearProvider.tsx` 전체:

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react'

const yearFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' })

/** 한국 시각 기준 올해. 서버가 연도 기록을 만들 수 있는 범위(올해·전년도·다음 해)와 같은 기준이다. */
// oxlint-disable-next-line react/only-export-components
export function seoulYear(now: Date): number {
  return Number(yearFormat.format(now))
}

type TaxYear = { year: number; setYear: (year: number) => void; choices: number[] }
const TaxYearContext = createContext<TaxYear | null>(null)

/**
 * 소득공제 화면이 기억하는 귀속연도. React 상태(메모리)에만 둔다(TAX-07).
 * 로그인 레이아웃 안에 있어 로그아웃하면 사라지고, 새로 고치면 올해로 돌아간다.
 */
export function TaxYearProvider({ children, today }: { children: ReactNode; today?: Date }) {
  // 선택지는 로그인 동안 고정한다. 자정을 넘겨 연도가 바뀌어도 새로 고칠 때까지 같은 3개다.
  const [thisYear] = useState(() => seoulYear(today ?? new Date()))
  const [year, setYear] = useState(thisYear)
  return (
    <TaxYearContext.Provider value={{ year, setYear, choices: [thisYear - 1, thisYear, thisYear + 1] }}>
      {children}
    </TaxYearContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useTaxYear(): TaxYear {
  const value = useContext(TaxYearContext)
  if (!value) throw new Error('useTaxYear는 TaxYearProvider 안에서만 쓴다')
  return value
}
```

`apps/web/src/tax/TaxHeader.tsx` 전체:

```tsx
import { menuLabel } from '../app/menu'
import PageHeader from '../common/PageHeader'
import Select from '../common/Select'
import ui from '../common/ui.module.css'
import { useTaxYear } from './TaxYearProvider'

/** 소득공제 화면 머리: 제목(넓은 화면), 오른쪽 귀속연도 선택, 개인 자료 표시(TAX-13). */
export default function TaxHeader() {
  const { year, setYear, choices } = useTaxYear()
  return (
    <>
      <PageHeader title={menuLabel('/tax')} action={
        <Select label="귀속연도" items={choices.map((y) => ({ id: y, label: `${y}년` }))}
          selectedKey={year} onSelectionChange={(key) => { if (key != null) setYear(Number(key)) }} />
      } />
      <p className={ui.muted}>개인 자료 · 그룹과 무관</p>
    </>
  )
}
```

`apps/web/src/tax/inputs/TaxInputsPage.tsx` 전체(첫 판):

```tsx
import ui from '../../common/ui.module.css'
import { usePageTitle } from '../../common/usePageTitle'
import TaxHeader from '../TaxHeader'

/** 소득공제 › 입력자료. 내용은 Task 5.3~5.5에서 채운다. */
export default function TaxInputsPage() {
  usePageTitle('입력자료 · 소득공제')
  return <div className={ui.stack}><TaxHeader /></div>
}
```

- [ ] **Step 5: 아이콘·메뉴·라우트·사이드바 하위 링크**

`git apply`:

```diff
diff --git a/apps/web/src/app/AppLayout.tsx b/apps/web/src/app/AppLayout.tsx
index 7668233..74f3cc6 100644
--- a/apps/web/src/app/AppLayout.tsx
+++ b/apps/web/src/app/AppLayout.tsx
@@ -90,7 +90,8 @@ export default function AppLayout() {
                 <Icon name={item.icon} />{item.label}
               </NavLink>
               {item.children?.map((child) => (
-                <NavLink key={child.to} to={inDashboard ? child.to + location.search : child.to} replace={inDashboard}
+                <NavLink key={child.to} to={inDashboard && item.to === '/dashboard' ? child.to + location.search : child.to}
+                  replace={inDashboard && item.to === '/dashboard'}
                   className={({ isActive }) => `${styles.link} ${styles.subLink}${isActive ? ` ${styles.active}` : ''}`}>
                   {child.label}
                 </NavLink>
diff --git a/apps/web/src/app/AppRoutes.tsx b/apps/web/src/app/AppRoutes.tsx
index bab5e1b..c06bc31 100644
--- a/apps/web/src/app/AppRoutes.tsx
+++ b/apps/web/src/app/AppRoutes.tsx
@@ -8,12 +8,14 @@ import ClearCacheOnSignOut from './ClearCacheOnSignOut'
 import PageLoading from './PageLoading'
 import PublicOnly from './PublicOnly'
 import RequireAuth from './RequireAuth'
+import { TaxYearProvider } from '../tax/TaxYearProvider'
 
 const LoginPage = lazy(() => import('../auth/LoginPage'))
 const InvitePage = lazy(() => import('../invite/InvitePage'))
 const DashboardPage = lazy(() => import('../dashboard/DashboardPage'))
 const TransactionsPage = lazy(() => import('../transactions/TransactionsPage'))
 const GroupsPage = lazy(() => import('../groups/GroupsPage'))
+const TaxInputsPage = lazy(() => import('../tax/inputs/TaxInputsPage'))
 
 /** 옛 업로드 주소. 홈의 월별 등록 현황이 ?month=를 받아 그 달 창을 연다. */
 function UploadRedirect() {
@@ -28,8 +30,11 @@ export default function AppRoutes() {
         <Routes>
           <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
           <Route path="/invite/:token" element={<RequireAuth><InvitePage /></RequireAuth>} />
-          <Route element={<RequireAuth><GroupProvider><AppLayout /></GroupProvider></RequireAuth>}>
+          <Route element={<RequireAuth><GroupProvider><TaxYearProvider><AppLayout /></TaxYearProvider></GroupProvider></RequireAuth>}>
             <Route index element={<HomePage />} />
+            {/* PR 7에서 TAX-68(자료가 있으면 분석) 규칙으로 바꾼다. */}
+            <Route path="tax" element={<Navigate to="/tax/inputs" replace />} />
+            <Route path="tax/inputs" element={<TaxInputsPage />} />
             <Route path="dashboard/:level?/:view?" element={<DashboardPage />} />
             <Route path="transactions" element={<TransactionsPage />} />
             <Route path="upload" element={<UploadRedirect />} />
diff --git a/apps/web/src/app/menu.ts b/apps/web/src/app/menu.ts
index 835d6b9..2f78e63 100644
--- a/apps/web/src/app/menu.ts
+++ b/apps/web/src/app/menu.ts
@@ -9,6 +9,8 @@ export type MenuItem = {
 // 사이드바는 label, 좁은 화면의 하단 탭은 shortLabel을 쓴다.
 export const MENU: MenuItem[] = [
   { to: '/', label: '홈', shortLabel: '홈', icon: 'home', end: true },
+  { to: '/tax', label: '소득공제', shortLabel: '소득공제', icon: 'calculator', end: false,
+    children: [{ to: '/tax/inputs', label: '입력자료' }] },
   { to: '/dashboard', label: '대시보드', shortLabel: '대시보드', icon: 'dashboard', end: false,
     children: [{ to: '/dashboard/major', label: '대분류' }, { to: '/dashboard/minor', label: '소분류' }] },
   { to: '/transactions', label: '거래 목록', shortLabel: '거래', icon: 'receipt', end: false },
diff --git a/apps/web/src/common/Icon.tsx b/apps/web/src/common/Icon.tsx
index 286e329..ce714da 100644
--- a/apps/web/src/common/Icon.tsx
+++ b/apps/web/src/common/Icon.tsx
@@ -128,6 +128,7 @@ const ICONS = {
       <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
     </>
   ),
+  calculator: <><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></>,
   history: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>,
   // 도메인: 뱅크샐러드 엑셀 올리기. 시트 문서 오른쪽 아래에 올리기 화살표를 둔다.
   'sheet-upload': (
```

- [ ] **Step 6: 통과 확인**

Run: `cd apps/web && npx vitest run src/app/BottomTabBar.test.tsx src/app/AppRoutes.test.tsx src/api/queryClient.test.ts src/tax && npx tsc -b && npx oxlint`
Expected: 5파일 50 passed, 타입 오류 없음, `src/tax`에 lint 경고 없음.

- [ ] **Step 7: 커밋(컨트롤러)**

```bash
git add apps/web/src/tax apps/web/src/app apps/web/src/api/queryClient.test.ts apps/web/src/common/Icon.tsx
git commit -m "feat(web): 소득공제 메뉴와 선택 연도·API 모듈을 더함" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

### Task 5.3: 입력자료 화면 — 연도 선택·기본정보·연도 기록 삭제와 캐시 테스트 (TAX-01, 07, 13, 20, 28, 29, 31, 37, AC-02·06·30·32·33·40·44)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Create: `apps/web/src/tax/inputs/BasicInfoDialog.tsx`, `DeleteYearDialog.tsx`, `SaveError.tsx`, `inputs.module.css`
- Modify (전체 교체): `apps/web/src/tax/inputs/TaxInputsPage.tsx`
- Create (테스트 지원): `apps/web/src/test/taxFixtures.tsx`
- Test: `apps/web/src/tax/inputs/TaxInputsPage.test.tsx`(생성), `app/AppRoutes.test.tsx`(수정: 로그아웃·다른 회원·저장소·그룹 전환)

**Interfaces:**
- Consumes: Task 5.2의 `useTaxYear`, `useTaxYearView`, `useTaxSave`, `isStale`, `taxApi`, `taxKeys`, `TaxHeader`. Task 5.1의 `Dialog`(`centered`), `HelpButton`. `MoneyField({ label, value, onChange, isRequired, minValue })`, `Select`(`variant="field"`), `TextField`, `useAmountFormatter('income')`, `toast`, `errorMessage`.
- Produces:
  - `BasicInfoDialog({ year, view: TaxYearView | null, childTiersApply: boolean, onClose })` — `view`가 null이면 `rowVersion` 없이 만든다.
  - `DeleteYearDialog({ view: TaxYearView, onClose })` — 귀속연도를 똑같이 입력해야 [삭제], `?rowVersion=`은 `view.rowVersion` 그대로.
  - `SaveError({ error, year, onReload })` — 입력 창의 저장 실패 문구와 [다시 불러오기].
  - `inputs.module.css` 클래스: `page`, `split`, `actions`, `titleWithHelp`, `facts`, `amount`, `note`, `empty`, `months`, `labelRow`, `fieldError`. Task 5.4가 화면 뿌리 글자 토큰과 `list`·`rowInfo`·`name`·`gridTitle`·`amountGroup`을 더해 통째로 바꾼다.
  - 테스트 지원 `taxToday`, `yearView(overrides)`, `cardView(overrides)`, `law2026`, `serveTax(view | null, law | null = law2026): { year: number }`(GET 횟수), `renderTaxInputs({ groups? })`(`AmountMaskProvider` + `TaxYearProvider today={taxToday}` + `renderPage`).
  - 화면 구조(5.4·5.5가 넣을 자리): 머리 → 불러오는 중·오류 → "세법 준비 중" → 빈 상태 또는 [기본정보 카드 …] → 연도 기록 삭제 카드.

- [ ] **Step 1: 실패하는 테스트 작성** — 테스트 지원 파일, 화면 테스트, 앱 테스트 추가. 금액은 모두 합성값이다.

`apps/web/src/test/taxFixtures.tsx` 전체:

```tsx
import { http, HttpResponse } from 'msw'
import { AmountMaskProvider } from '../common/AmountMask'
import TaxInputsPage from '../tax/inputs/TaxInputsPage'
import type { CardView, CurrentLaw, TaxYearView } from '../tax/taxApi'
import { TaxYearProvider } from '../tax/TaxYearProvider'
import { renderPage } from './renderPage'
import { server } from './server'

// 소득공제 화면 테스트용 합성값. 실제 급여·카드 금액이 아니다.
export const taxToday = new Date('2026-11-20T09:00:00+09:00')

const zeroTotals = {
  creditGeneral: 0, creditMarket: 0, creditTransit: 0, creditCulture: 0,
  debitGeneral: 0, debitMarket: 0, debitTransit: 0, debitCulture: 0,
  cashGeneral: 0, cashMarket: 0, cashTransit: 0, cashCulture: 0,
}

export function yearView(overrides: Partial<TaxYearView> = {}): TaxYearView {
  return {
    taxYear: 2026, rowVersion: 777, totalSalary: 50_000_000, workStartMonth: 1, workEndMonth: 12, childCount: 0,
    lawVersion: { id: 1, versionNo: 1, appliedAt: '2026-01-02T00:00:00Z', childTiersApply: true }, newerLawVersion: false,
    cards: [], cashReceipt: null, plan: null, totals: zeroTotals, blankCount: 4, hasInputs: false, asOfDateMismatch: false,
    ...overrides,
  }
}

export function cardView(overrides: Partial<CardView> = {}): CardView {
  return {
    id: 7, rowVersion: 3, issuerName: 'A카드', asOfDate: '2026-10-31', memo: '주 사용 카드',
    amounts: {
      creditGeneral: 9_000_000, creditMarket: 300_000, creditTransit: 200_000, creditCulture: 100_000,
      debitGeneral: 0, debitMarket: 0, debitTransit: 0, debitCulture: 0,
    },
    blankCount: 0,
    ...overrides,
  }
}

export const law2026: CurrentLaw = { id: 1, taxYear: 2026, versionNo: 1, appliedAt: '2026-01-02T00:00:00Z', childTiersApply: true }

const notFound = () => HttpResponse.json({ code: 'NOT_FOUND', message: 'not found' }, { status: 404 })

/** GET 연도 기록과 현재 적용 세법. null이면 404(없음)다. 연도 기록 GET 횟수를 센다. */
export function serveTax(view: TaxYearView | null, law: CurrentLaw | null = law2026) {
  const calls = { year: 0 }
  server.use(
    http.get('*/api/tax/years/:year', () => {
      calls.year++
      return view ? HttpResponse.json(view) : notFound()
    }),
    http.get('*/api/tax/law-versions/current', () => (law ? HttpResponse.json(law) : notFound())),
  )
  return calls
}

export function renderTaxInputs(options: { groups?: unknown[] } = {}) {
  return renderPage(
    <AmountMaskProvider><TaxYearProvider today={taxToday}><TaxInputsPage /></TaxYearProvider></AmountMaskProvider>,
    options,
  )
}
```

`apps/web/src/tax/inputs/TaxInputsPage.test.tsx` 전체:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('TaxInputsPage — 기본정보와 연도 기록', () => {
  it('creates the year record from the empty state in a centered dialog, without any group', async () => {
    mockViewport(true)
    serveTax(null)
    let body: unknown
    server.use(http.put('*/api/tax/years/2026', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({ childCount: 2 }), { status: 201 })
    }))
    const { user } = renderTaxInputs({ groups: [] })

    expect(await screen.findByRole('heading', { name: '2026년 귀속 기록이 없습니다' })).toBeInTheDocument()
    expect(screen.getByText('개인 자료 · 그룹과 무관')).toBeInTheDocument()
    expect(screen.queryByText(/세법은 준비 중입니다/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기본정보 입력' }))

    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    expect(dialog.parentElement).toHaveClass('modal')
    await user.type(within(dialog).getByLabelText('예상 총급여'), '50000000')
    await user.clear(within(dialog).getByLabelText('자녀등 수'))
    await user.type(within(dialog).getByLabelText('자녀등 수'), '2')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ totalSalary: 50_000_000, workStartMonth: 1, workEndMonth: 12, childCount: 2 })
    const basic = screen.getByRole('region', { name: '기본정보' })
    expect(basic).toHaveTextContent('₩ 50,000,000')
    expect(basic).toHaveTextContent('1월 ~ 12월')
    expect(basic).toHaveTextContent('2명')
  })

  it('explains the child rules in a help popover without closing the dialog or changing the value', async () => {
    serveTax(null)
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '기본정보 입력' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    const help = within(dialog).getByRole('button', { name: '자녀등 수 도움말' })

    expect(screen.queryByText(/직계비속/)).not.toBeInTheDocument()
    await user.click(help)
    expect(await screen.findByRole('dialog', { name: '자녀등 수 도움말' })).toHaveTextContent('20세 이하')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '자녀등 수 도움말' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: '2026년 귀속 기본정보' })).toBeInTheDocument()
    await waitFor(() => expect(help).toHaveFocus())
    expect(within(dialog).getByLabelText('자녀등 수')).toHaveValue('0')
  })

  it('hides the child count and says the law is not ready when the year has no applied law', async () => {
    serveTax(null, null)
    const { user } = renderTaxInputs()

    expect(await screen.findByText('2026년 귀속 세법은 준비 중입니다. 자료는 저장되며, 분석은 세법이 등록된 뒤 볼 수 있습니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기본정보 입력' }))

    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    expect(within(dialog).queryByLabelText('자녀등 수')).not.toBeInTheDocument()
  })

  it('edits the basic info with the row version it received and blocks a start month after the end month', async () => {
    serveTax(yearView({ rowVersion: 9_007_199_254_740_991 }))
    const bodies: unknown[] = []
    server.use(http.put('*/api/tax/years/2026', async ({ request }) => {
      bodies.push(await request.json())
      return HttpResponse.json(yearView({ workStartMonth: 4, rowVersion: 12 }))
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    expect(within(dialog).getByLabelText('예상 총급여')).toHaveValue('50,000,000')
    await user.click(within(dialog).getByRole('button', { name: /종료월/ }))
    await user.click(screen.getByRole('option', { name: '3월' }))
    await user.click(within(dialog).getByRole('button', { name: /시작월/ }))
    await user.click(screen.getByRole('option', { name: '4월' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('시작월이 종료월보다 늦습니다.')
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: /종료월/ }))
    await user.click(screen.getByRole('option', { name: '12월' }))
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies).toEqual([{ totalSalary: 50_000_000, workStartMonth: 4, workEndMonth: 12, childCount: 0, rowVersion: 9_007_199_254_740_991 }])
    expect(screen.getByRole('region', { name: '기본정보' })).toHaveTextContent('4월 ~ 12월근로기간 확인 필요')
  })

  it('stops a stale save, keeps the input and reloads on request', async () => {
    serveTax(yearView())
    server.use(http.put('*/api/tax/years/2026', () => HttpResponse.json({ code: 'CONFLICT', message: 'x' }, { status: 409 })))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    const salary = within(dialog).getByLabelText('예상 총급여')
    await user.clear(salary)
    await user.type(salary, '61000000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다.')
    expect(salary).toHaveValue('61,000,000')
    serveTax(yearView({ totalSalary: 70_000_000, rowVersion: 900 }))
    await user.click(within(dialog).getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('₩ 70,000,000')).toBeInTheDocument()
  })

  it('keeps the input when the server cannot be reached', async () => {
    serveTax(yearView())
    server.use(http.put('*/api/tax/years/2026', () => HttpResponse.error()))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 입력한 값은 그대로 있습니다.')
    expect(within(dialog).getByLabelText('예상 총급여')).toHaveValue('50,000,000')
  })

  it('masks the salary with the income setting but never the field being edited', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ INCOME: true }))
    serveTax(yearView())
    const { user } = renderTaxInputs()

    const basic = await screen.findByRole('region', { name: '기본정보' })
    expect(basic).toHaveTextContent('₩ •••••')
    expect(basic).not.toHaveTextContent('50,000,000')
    await user.click(screen.getByRole('button', { name: '기본정보 수정' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('예상 총급여')).toHaveValue('50,000,000')
  })

  it('shows the salary when only the expense setting is masked', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: true }))
    serveTax(yearView())
    renderTaxInputs()

    expect(await screen.findByRole('region', { name: '기본정보' })).toHaveTextContent('₩ 50,000,000')
  })

  it('deletes the year only after the exact year is typed, starting empty each time', async () => {
    mockViewport(true)
    serveTax(yearView())
    let url = ''
    server.use(http.delete('*/api/tax/years/2026', ({ request }) => {
      url = request.url
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '2026년 기록 삭제' }))
    let dialog = await screen.findByRole('dialog', { name: '2026년 기록을 삭제할까요?' })
    expect(dialog.parentElement).toHaveClass('modal')
    expect(dialog).toHaveTextContent('기본정보, 신용·체크 자료 0건, 현금영수증 자료, 지출계획이 모두 지워집니다')
    const confirm = () => within(dialog).getByRole('button', { name: '삭제' })
    expect(confirm()).toBeDisabled()
    await user.type(within(dialog).getByLabelText('확인을 위해 귀속연도 2026을 입력하세요'), '2025')
    expect(confirm()).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    serveTax(null)
    await user.click(screen.getByRole('button', { name: '2026년 기록 삭제' }))
    dialog = await screen.findByRole('dialog', { name: '2026년 기록을 삭제할까요?' })
    const input = within(dialog).getByLabelText('확인을 위해 귀속연도 2026을 입력하세요')
    expect(input).toHaveValue('')
    await user.type(input, '2026')
    await user.click(confirm())

    expect(await screen.findByRole('heading', { name: '2026년 귀속 기록이 없습니다' })).toBeInTheDocument()
    expect(new URL(url).search).toBe('?rowVersion=777')
  })

  it('tells a failed load apart and retries it', async () => {
    let fail = true
    server.use(
      http.get('*/api/tax/years/:year', () => (fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json(yearView()))),
    )
    const { user } = renderTaxInputs()

    expect(await screen.findByRole('alert')).toHaveTextContent('입력자료를 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('region', { name: '기본정보' })).toBeInTheDocument()
  })
})
```

`git apply`:

```diff
diff --git a/apps/web/src/app/AppRoutes.test.tsx b/apps/web/src/app/AppRoutes.test.tsx
index 6843044..b1c008a 100644
--- a/apps/web/src/app/AppRoutes.test.tsx
+++ b/apps/web/src/app/AppRoutes.test.tsx
@@ -9,6 +9,8 @@ import { setAccessToken } from '../api/client'
 import { AuthProvider } from '../auth/AuthProvider'
 import { mockViewport } from '../test/mockViewport'
 import { server } from '../test/server'
+import { serveTax, yearView } from '../test/taxFixtures'
+import { seoulYear } from '../tax/TaxYearProvider'
 import AppRoutes from './AppRoutes'
 
 const me = { userId: 1, email: 'me@test.com', nickname: '나' }
@@ -336,6 +338,58 @@ describe('AppRoutes', () => {
     expect(await screen.findByRole('button', { name: /그룹/ })).toHaveTextContent('B의 그룹')
   })
 
+  it('clears tax data on logout and never shows it to the next member or keeps it in browser storage', async () => {
+    const year = seoulYear(new Date())
+    signedIn([])
+    serveTax(yearView({ taxYear: year, totalSalary: 52_340_000 }))
+    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
+    const client = renderApp('/tax/inputs')
+    const user = userEvent.setup()
+
+    expect(await screen.findByText('₩ 52,340,000')).toBeInTheDocument()
+    const stored = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage })
+    expect(stored).not.toMatch(/52,?340,?000/)
+
+    await user.click(screen.getByRole('button', { name: '로그아웃' }))
+    await screen.findByRole('button', { name: '로그인' })
+    expect(client.getQueryData(['tax', 'year', year])).toBeUndefined()
+
+    server.use(
+      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'b1' })),
+      http.get('*/api/me', () => HttpResponse.json({ userId: 2, email: 'b@test.com', nickname: '비' })),
+      http.get('*/api/tax/years/:year', async () => {
+        await delay(300)
+        return HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })
+      }),
+    )
+    await user.type(screen.getByLabelText('이메일'), 'b@test.com')
+    await user.type(screen.getByLabelText('비밀번호'), 'password1')
+    await user.click(screen.getByRole('button', { name: '로그인' }))
+    await user.click(await screen.findByRole('link', { name: '소득공제' }))
+
+    expect(await screen.findByText('입력자료 불러오는 중')).toBeInTheDocument()
+    expect(screen.queryByText('₩ 52,340,000')).not.toBeInTheDocument()
+    expect(await screen.findByRole('heading', { name: `${year}년 귀속 기록이 없습니다` })).toBeInTheDocument()
+  })
+
+  it('keeps the same tax data without a new request when the header group changes', async () => {
+    signedIn([
+      { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 },
+      { groupId: 20, name: '커플 가계부', myRole: 'MEMBER', memberCount: 2 },
+    ])
+    const calls = serveTax(yearView({ taxYear: seoulYear(new Date()) }))
+    renderApp('/tax/inputs')
+    const user = userEvent.setup()
+
+    expect(await screen.findByText('₩ 50,000,000')).toBeInTheDocument()
+    await user.click(await screen.findByRole('button', { name: /그룹/ }))
+    await user.click(screen.getByRole('option', { name: '커플 가계부' }))
+
+    expect(screen.getByRole('button', { name: /그룹/ })).toHaveTextContent('커플 가계부')
+    expect(screen.getByText('₩ 50,000,000')).toBeInTheDocument()
+    expect(calls.year).toBe(1)
+  })
+
   it('returns to the invite page after logging in', async () => {
     server.use(
       http.post('*/api/auth/refresh', () => HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })),
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/tax/inputs src/app/AppRoutes.test.tsx`
Expected: 12건 FAIL(화면 10건 — `Unable to find role="heading" and name "2026년 귀속 기록이 없습니다"` 등, 앱 2건 — `₩ 52,340,000`·`₩ 50,000,000`을 찾지 못함), 32건 PASS.

- [ ] **Step 3: 화면 스타일**

`apps/web/src/tax/inputs/inputs.module.css` 전체(5.3 판, Task 5.4가 통째로 바꾸고 5.5가 덧붙인다):

```css
/* 소득공제 입력자료 화면과 창. 글자 크기는 UI 표준(카드 제목 16px, 내용·금액 15px, 실행 버튼 14px, 보조 13px)을 이 모듈 안에서만 정한다. */
.page { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
.page h2 { margin: 0; font-size: var(--text-xl); line-height: 1.5; }
.page section button { font-size: var(--text-card-action); }
.page section p { margin: 0; }

/* 정보는 왼쪽, 조작은 오른쪽 끝. 줄이 바뀌어도 조작은 오른쪽에 남고 긴 이름이 밀어내지 않는다. */
.split { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2) var(--space-3); }
.split > :first-child { flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); margin-left: auto; }
.titleWithHelp { display: flex; align-items: center; gap: var(--space-1); min-width: 0; }
.titleWithHelp > :first-child { min-width: 0; overflow-wrap: anywhere; }

.facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-1) var(--space-4); margin: 0; font-size: var(--text-lg); line-height: 1.5; }
.facts dt { color: var(--ink-muted); font-size: var(--text-md); }
.facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.amount { font-variant-numeric: tabular-nums; }
.note { margin-left: var(--space-2); color: var(--pending); font-size: var(--text-md); }
.empty { align-items: flex-start; }

/* 창 */
.months { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
.months legend { padding: 0; margin-bottom: var(--space-1); font-size: var(--text-md); font-weight: 500; color: var(--ink-muted); }
.labelRow { display: flex; align-items: center; gap: var(--space-1); }
.fieldError { margin: 0; color: var(--danger); font-size: var(--text-md); }
```

- [ ] **Step 4: 저장 실패 문구**

`apps/web/src/tax/inputs/SaveError.tsx` 전체:

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../common/errorMessage'
import ui from '../../common/ui.module.css'
import { isStale, taxKeys } from '../taxApi'
import styles from './inputs.module.css'

type Props = { error: unknown; year: number; onReload: () => void }

/**
 * 입력 창의 저장 실패. 다른 곳에서 먼저 고쳤으면(409·404) 입력을 남긴 채 알리고, [다시 불러오기]를 누르면 새 값을 받고 창을 닫는다.
 * 그 밖의 실패는 입력을 그대로 두고 다시 저장하게 한다.
 */
export default function SaveError({ error, year, onReload }: Props) {
  const client = useQueryClient()
  if (!error) return null
  if (!isStale(error)) return <p role="alert" className={ui.alert}>{errorMessage(error)} 입력한 값은 그대로 있습니다.</p>
  return (
    <div className={styles.split}>
      <p role="alert" className={ui.alert}>다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다.</p>
      <button type="button" className={ui.button}
        onClick={() => { void client.invalidateQueries({ queryKey: taxKeys.year(year) }); onReload() }}>다시 불러오기</button>
    </div>
  )
}
```

- [ ] **Step 5: 기본정보 창과 연도 기록 삭제 창**

`apps/web/src/tax/inputs/BasicInfoDialog.tsx` 전체:

```tsx
import { useId, useState, type FormEvent } from 'react'
import { FieldError, Input, NumberField } from 'react-aria-components'
import Dialog from '../../common/Dialog'
import fields from '../../common/Field.module.css'
import HelpButton from '../../common/HelpButton'
import MoneyField from '../../common/MoneyField'
import Select from '../../common/Select'
import ui from '../../common/ui.module.css'
import { taxApi, useTaxSave, type BasicInfoInput, type TaxYearView } from '../taxApi'
import SaveError from './SaveError'
import styles from './inputs.module.css'

type Props = { year: number; view: TaxYearView | null; childTiersApply: boolean; onClose: () => void }

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, label: `${i + 1}월` }))

/** 기본정보 만들기·수정. view가 null이면 이 연도 기록을 새로 만든다(rowVersion 없이 PUT). */
export default function BasicInfoDialog({ year, view, childTiersApply, onClose }: Props) {
  // 연 시점의 값과 버전으로 저장한다. 그 사이 다른 곳에서 바뀌면 서버가 409로 막는다.
  const [salary, setSalary] = useState<number | null>(view?.totalSalary ?? null)
  const [start, setStart] = useState(view?.workStartMonth ?? 1)
  const [end, setEnd] = useState(view?.workEndMonth ?? 12)
  const [childCount, setChildCount] = useState(view?.childCount ?? 0)
  const [rowVersion] = useState(view?.rowVersion)
  const save = useTaxSave(year, (body: BasicInfoInput) => taxApi.saveBasicInfo(year, body))
  const childLabel = useId()
  const monthError = start > end

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (salary == null || monthError) return
    const body: BasicInfoInput = { totalSalary: salary, workStartMonth: start, workEndMonth: end, childCount }
    save.mutate(rowVersion === undefined ? body : { ...body, rowVersion }, { onSuccess: onClose })
  }

  return (
    <Dialog title={`${year}년 귀속 기본정보`} onClose={onClose} closeDisabled={save.isPending} centered>
      <form className={ui.stack} onSubmit={onSubmit}>
        <SaveError error={save.error} year={year} onReload={onClose} />
        <div className={ui.stack}>
          <MoneyField label="예상 총급여" value={salary} onChange={setSalary} isRequired minValue={1} />
          <p className={ui.muted}>비과세 소득을 뺀 연간 총급여</p>
        </div>
        <fieldset className={styles.months}>
          <legend>근로기간</legend>
          <Select label="시작월" variant="field" items={MONTHS} selectedKey={start}
            onSelectionChange={(key) => { if (key != null) setStart(Number(key)) }} />
          <Select label="종료월" variant="field" items={MONTHS} selectedKey={end}
            onSelectionChange={(key) => { if (key != null) setEnd(Number(key)) }} />
        </fieldset>
        {monthError && <p role="alert" className={styles.fieldError}>시작월이 종료월보다 늦습니다.</p>}
        <p className={ui.muted}>중도 입사·퇴사한 해는 근로기간에 쓴 금액만 입력합니다.</p>
        {childTiersApply && (
          <div className={fields.field}>
            <div className={styles.labelRow}>
              <span id={childLabel} className={fields.label}>자녀등 수</span>
              <HelpButton title="자녀등 수">
                직계비속 가운데 ① 소득금액 100만원 이하(근로소득만 있으면 총급여 500만원 이하) ② 20세 이하(장애인은 나이와 관계없음) ③ 다른 사람의 기본공제를 받지 않는 사람의 수입니다.
              </HelpButton>
            </div>
            <NumberField aria-labelledby={childLabel} value={childCount} minValue={0} maxValue={99}
              onChange={(v) => setChildCount(Number.isNaN(v) ? 0 : v)} formatOptions={{ maximumFractionDigits: 0 }}
              validationBehavior="native" isWheelDisabled className={fields.field}>
              <Input className={fields.input} />
              <FieldError className={fields.error} />
            </NumberField>
          </div>
        )}
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={save.isPending} onClick={onClose}>취소</button>
          <button type="submit" className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={save.isPending || monthError}>저장</button>
        </div>
      </form>
    </Dialog>
  )
}
```

`apps/web/src/tax/inputs/DeleteYearDialog.tsx` 전체(5.3 판, Task 5.4가 오류 문구를 `actionError`로 바꾼다):

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Dialog from '../../common/Dialog'
import { errorMessage } from '../../common/errorMessage'
import TextField from '../../common/TextField'
import { toast } from '../../common/Toast'
import ui from '../../common/ui.module.css'
import { isStale, taxApi, taxKeys, type TaxYearView } from '../taxApi'

/** 연도 기록 삭제 확인(D22). 귀속연도 4자리를 똑같이 입력해야 [삭제]가 켜진다. 닫으면 입력이 사라진다(창을 조건부로 그린다). */
export default function DeleteYearDialog({ view, onClose }: { view: TaxYearView; onClose: () => void }) {
  const year = view.taxYear
  const client = useQueryClient()
  const [typed, setTyped] = useState('')
  const remove = useMutation({
    mutationFn: () => taxApi.deleteYear(year, view.rowVersion),
    onSuccess: () => {
      client.setQueryData(taxKeys.year(year), null)
      toast(`${year}년 기록을 삭제했습니다.`)
      onClose()
    },
    // 다른 곳에서 바뀌었으면 새로 불러온다. 지울 범위 문장도 새 값으로 바뀐다.
    onError: (error) => { if (isStale(error)) void client.invalidateQueries({ queryKey: taxKeys.year(year) }) },
  })

  return (
    <Dialog title={`${year}년 기록을 삭제할까요?`} onClose={onClose} closeDisabled={remove.isPending} centered>
      <p>{year}년 귀속의 기본정보, 신용·체크 자료 {view.cards.length}건, 현금영수증 자료, 지출계획이 모두 지워집니다. 다른 연도의 기록은 남습니다. 복구할 수 없습니다.</p>
      {remove.error && (
        <p role="alert" className={ui.alert}>
          {isStale(remove.error) ? '다른 곳에서 수정되거나 삭제됐습니다. 새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.' : errorMessage(remove.error)}
        </p>
      )}
      <TextField label={`확인을 위해 귀속연도 ${year}을 입력하세요`} value={typed} onChange={setTyped} autoComplete="off" />
      <div className={ui.confirmActions}>
        <button type="button" className={ui.button} disabled={remove.isPending} onClick={onClose}>취소</button>
        <button type="button" className={`${ui.button} ${ui.dangerFill} ${ui.cta}`}
          disabled={typed !== String(year) || remove.isPending} onClick={() => remove.mutate()}>삭제</button>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 6: 화면**

`apps/web/src/tax/inputs/TaxInputsPage.tsx` 전체(통째로 교체):

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import Icon from '../../common/Icon'
import Skeleton, { SkeletonRegion } from '../../common/Skeleton'
import ui from '../../common/ui.module.css'
import { usePageTitle } from '../../common/usePageTitle'
import TaxHeader from '../TaxHeader'
import { useTaxYear } from '../TaxYearProvider'
import { taxApi, taxKeys, useTaxYearView, type TaxYearView } from '../taxApi'
import BasicInfoDialog from './BasicInfoDialog'
import DeleteYearDialog from './DeleteYearDialog'
import styles from './inputs.module.css'

/** 소득공제 › 입력자료. 선택 연도의 기록 하나를 보여 주고 고친다. 그룹과 무관하다(useGroups를 쓰지 않는다). */
export default function TaxInputsPage() {
  usePageTitle('입력자료 · 소득공제')
  const { year } = useTaxYear()
  const record = useTaxYearView(year)
  const view = record.data
  // 기록이 없을 때만 만들 때 기억될 현재 적용 세법을 읽는다. 기록이 있으면 기록이 기억한 버전을 쓴다(TAX-66).
  const law = useQuery({ queryKey: taxKeys.currentLaw(year), queryFn: () => taxApi.currentLaw(year), enabled: view === null })
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const lawPending = view ? view.lawVersion === null : view === null && law.data === null
  const childTiersApply = (view ? view.lawVersion?.childTiersApply : law.data?.childTiersApply) ?? false

  return (
    <div className={styles.page}>
      <TaxHeader />
      {record.isPending && (
        <SkeletonRegion label="입력자료 불러오는 중"><Skeleton height={160} radius="var(--radius-md)" /></SkeletonRegion>
      )}
      {record.isError && (
        <div className={styles.split}>
          <p role="alert" className={ui.alert}>입력자료를 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void record.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
        </div>
      )}
      {lawPending && <p className={ui.status}>{year}년 귀속 세법은 준비 중입니다. 자료는 저장되며, 분석은 세법이 등록된 뒤 볼 수 있습니다.</p>}
      {view === null && (
        <section aria-labelledby="tax-empty-title" className={`${ui.card} ${styles.empty}`}>
          <h2 id="tax-empty-title">{year}년 귀속 기록이 없습니다</h2>
          <p>기본정보(예상 총급여·근로기간)를 입력하면 이 연도의 기록이 만들어집니다.</p>
          <button type="button" className={`${ui.button} ${ui.primary}`} disabled={law.isPending} onClick={() => setEditing(true)}>기본정보 입력</button>
        </section>
      )}
      {view && (
        <>
          <BasicInfoCard view={view} onEdit={() => setEditing(true)} />
          <section aria-label="연도 기록 삭제" className={`${ui.card} ${styles.split}`}>
            <p>이 연도의 기본정보·입력자료·금액·지출계획을 모두 지웁니다.</p>
            <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setDeleting(true)}>{year}년 기록 삭제</button>
          </section>
        </>
      )}
      {editing && view !== undefined && (
        <BasicInfoDialog year={year} view={view} childTiersApply={childTiersApply} onClose={() => setEditing(false)} />
      )}
      {deleting && view && <DeleteYearDialog view={view} onClose={() => setDeleting(false)} />}
    </div>
  )
}

function BasicInfoCard({ view, onEdit }: { view: TaxYearView; onEdit: () => void }) {
  const income = useAmountFormatter('income')
  const fullYear = view.workStartMonth === 1 && view.workEndMonth === 12
  return (
    <section aria-labelledby="tax-basic-title" className={ui.card}>
      <div className={styles.split}>
        <h2 id="tax-basic-title">기본정보</h2>
        <button type="button" className={ui.button} aria-label="기본정보 수정" onClick={onEdit}>수정</button>
      </div>
      <dl className={styles.facts}>
        <dt>예상 총급여</dt>
        <dd className={styles.amount}>{income(view.totalSalary)}</dd>
        <dt>근로기간</dt>
        <dd>{view.workStartMonth}월 ~ {view.workEndMonth}월{!fullYear && <span className={styles.note}>근로기간 확인 필요</span>}</dd>
        {view.lawVersion?.childTiersApply && <><dt>자녀등 수</dt><dd>{view.childCount}명</dd></>}
      </dl>
    </section>
  )
}
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/web && npx vitest run src/tax/inputs src/app/AppRoutes.test.tsx && npx tsc -b && npx oxlint`
Expected: 2파일 44 passed, 타입 오류 없음, 새 lint 경고 없음.

- [ ] **Step 8: 커밋(컨트롤러)**

```bash
git add apps/web/src/tax apps/web/src/test/taxFixtures.tsx apps/web/src/app/AppRoutes.test.tsx
git commit -m "feat(web): 소득공제 입력자료 화면에 기본정보와 연도 기록 삭제를 둠" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

### Task 5.4: 신용·체크 자료와 현금영수증 자료 (TAX-21~25, 28, 29, 30, AC-14·28·33·37·40·44)

**담당:** Codex `gpt-6-astra` / `medium` (`write`, 공용 `DateTimePicker`를 넓힌다), 태그 `impl-web-common`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Create: `apps/web/src/tax/inputs/amounts.ts`, `AmountGrid.tsx`, `CardStatementDialog.tsx`, `CardStatementList.tsx`, `CashReceiptDialog.tsx`, `CashReceiptSection.tsx`
- Modify: `apps/web/src/common/DateTimePicker.tsx`(`granularity`·`minValue`·`maxValue`), `tax/taxApi.ts`(`actionError`), `tax/inputs/DeleteYearDialog.tsx`, `tax/inputs/TaxInputsPage.tsx`
- Modify (전체 교체): `apps/web/src/tax/inputs/inputs.module.css`
- Test: `apps/web/src/tax/inputs/CardStatementList.test.tsx`, `CashReceiptSection.test.tsx`(생성), `common/DateTimePicker.test.tsx`(수정)

**Interfaces:**
- Consumes: Task 5.3의 `SaveError`, `inputs.module.css`, `renderTaxInputs`·`serveTax`·`yearView`·`cardView`. Task 5.1의 `ConfirmDialog`(`centered`), `HelpButton`. `MoneyField`(`minValue={0}`), `TextField`(`maxLength`), `useAmountFormatter('expense')`.
- Produces:
  - `DateTimePicker`의 `granularity?: 'minute' | 'day'`(기본 `'minute'`), `minValue?`·`maxValue?`(`YYYY-MM-DD`). `'day'`면 `YYYY-MM-DD`로 주고받고 범위 밖은 필드 오류로 제출을 막는다.
  - `amounts.ts`: `CATEGORIES`(`['General','일반'] …`), `CARD_GROUPS`, `CASH_GROUPS`, `EMPTY_CARD`, `EMPTY_CASH`, `fillBlanks(values)`, `countBlanks(values)`, `sumAmounts(values)`, 타입 `AmountGroup<K>`.
  - `AmountGrid<K>({ groups, values, onChange })` — 묶음 `fieldset` × 칸 `MoneyField`, "일반" 한 줄 안내와 `공제대상액 도움말`, 빈 칸 수와 [빈 칸 0원으로 채우기].
  - `CardStatementList({ view, defaultAsOfDate })`, `CardStatementDialog({ year, card: CardView | null, defaultAsOfDate, onClose })`, `CashReceiptSection({ view, defaultAsOfDate })`, `CashReceiptDialog({ year, cash: CashView | null, zeros: boolean, defaultAsOfDate, onClose })`.
  - `taxApi.ts`의 `actionError(error): string`.
  - 접근성 이름: 카드 행 `<카드사명> 자료 편집`·`<카드사명> 자료 삭제`, 현금영수증 `현금영수증 자료 입력`·`현금영수증 자료 편집`.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/tax/inputs/CardStatementList.test.tsx` 전체:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { cardView, renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

const CATEGORIES = ['일반', '전통시장', '대중교통', '문화체육']

function cell(dialog: HTMLElement, category: string, method: string) {
  return within(within(dialog).getByRole('group', { name: category })).getByLabelText(method)
}

async function typeDate(user: UserEvent, dialog: HTMLElement, digits: string) {
  const group = within(dialog).getByRole('group', { name: '기준일' })
  await user.click(within(group).getAllByRole('spinbutton')[0])
  await user.keyboard(digits)
}

describe('신용·체크 자료', () => {
  it('adds a card in a centered dialog with 4 categories × credit/debit and tells blank from 0', async () => {
    mockViewport(true)
    serveTax(yearView())
    let body: unknown
    server.use(http.post('*/api/tax/years/2026/cards', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({ cards: [cardView({ blankCount: 0 })], hasInputs: true }), { status: 201 })
    }))
    const { user } = renderTaxInputs()

    const section = await screen.findByRole('region', { name: '신용·체크 자료' })
    expect(section).toHaveTextContent('등록한 신용·체크 자료가 없습니다.')
    await user.click(within(section).getByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })
    expect(dialog.parentElement).toHaveClass('modal')
    expect(within(dialog).getAllByRole('group').map((g) => g.getAttribute('aria-label') ?? g.querySelector('legend')?.textContent))
      .toEqual(expect.arrayContaining(CATEGORIES))
    expect(dialog).toHaveTextContent('"일반"은 전통시장·대중교통·문화체육을 뺀 금액입니다.')
    expect(dialog).not.toHaveTextContent('직불')

    await user.type(within(dialog).getByLabelText('카드사명'), '  A카드  ')
    await typeDate(user, dialog, '20261031')
    await user.type(within(dialog).getByLabelText('메모 (선택)'), '주 사용 카드')
    await user.type(cell(dialog, '일반', '신용카드'), '9000000')
    await user.type(cell(dialog, '일반', '체크카드'), '0')
    await user.tab()
    expect(dialog).toHaveTextContent('빈 칸 6개 · 빈 칸이 있으면 미완료로 저장됩니다.')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({
      issuerName: 'A카드', asOfDate: '2026-10-31', memo: '주 사용 카드',
      amounts: {
        creditGeneral: 9_000_000, creditMarket: null, creditTransit: null, creditCulture: null,
        debitGeneral: 0, debitMarket: null, debitTransit: null, debitCulture: null,
      },
    })
    const row = within(section).getByRole('listitem')
    expect(row).toHaveTextContent('A카드')
    expect(row).toHaveTextContent('완료')
    expect(row).toHaveTextContent('기준일 2026-10-31 · 합계 ₩ 9,600,000 · 주 사용 카드')
  })

  it('fills the blanks with 0 in the dialog', async () => {
    serveTax(yearView())
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })
    await user.click(within(dialog).getByRole('button', { name: '빈 칸 0원으로 채우기' }))

    for (const category of CATEGORIES) {
      expect(cell(dialog, category, '신용카드')).toHaveValue('0')
      expect(cell(dialog, category, '체크카드')).toHaveValue('0')
    }
    expect(dialog).toHaveTextContent('빈 칸 없음')
    expect(within(dialog).getByRole('button', { name: '빈 칸 0원으로 채우기' })).toBeDisabled()
  })

  it('saves a second card with the same issuer name without a warning', async () => {
    serveTax(yearView({ cards: [cardView()], hasInputs: true }))
    let posted = 0
    server.use(http.post('*/api/tax/years/2026/cards', () => {
      posted++
      return HttpResponse.json(yearView({ cards: [cardView(), cardView({ id: 8 })], hasInputs: true }), { status: 201 })
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })
    expect(within(dialog).getByRole('group', { name: '기준일' })).toHaveTextContent('2026')
    await user.type(within(dialog).getByLabelText('카드사명'), 'A카드')
    await user.click(within(dialog).getByRole('button', { name: '빈 칸 0원으로 채우기' }))
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posted).toBe(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText(/중복|이미 있/)).not.toBeInTheDocument()
  })

  it('does not save a negative amount or a date outside the year', async () => {
    serveTax(yearView())
    let posted = 0
    server.use(http.post('*/api/tax/years/2026/cards', () => { posted++; return HttpResponse.json(yearView(), { status: 201 }) }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })
    await user.type(within(dialog).getByLabelText('카드사명'), 'B카드')
    await typeDate(user, dialog, '20251231')
    await user.type(cell(dialog, '일반', '신용카드'), '-5')
    await user.tab()
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByText('0원 이상 입력하세요')).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: '기준일' }).closest('[data-invalid]')).not.toBeNull()
    expect(posted).toBe(0)
  })

  it('shows an incomplete card with its blank count and fills the blanks from the row', async () => {
    const incomplete = cardView({
      rowVersion: 41,
      amounts: { ...cardView().amounts, debitMarket: null, debitTransit: null, debitCulture: null },
      blankCount: 3,
    })
    serveTax(yearView({ cards: [incomplete], hasInputs: true }))
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/cards/7', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({ cards: [cardView()], hasInputs: true }))
    }))
    const { user } = renderTaxInputs()

    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('미완료 · 빈 칸 3개')
    await user.click(within(row).getByRole('button', { name: '빈 칸 0원으로 채우기' }))

    await waitFor(() => expect(screen.getByRole('listitem')).toHaveTextContent('완료'))
    expect(screen.getByRole('listitem')).not.toHaveTextContent('미완료')
    expect(body).toEqual({
      issuerName: 'A카드', asOfDate: '2026-10-31', memo: '주 사용 카드',
      amounts: { ...cardView().amounts, debitMarket: 0, debitTransit: 0, debitCulture: 0 },
      rowVersion: 41,
    })
  })

  it('keeps edit and delete in the row action area even with a long issuer name', async () => {
    const longName = '아주긴카드사이름'.repeat(5)
    serveTax(yearView({ cards: [cardView({ issuerName: longName })], hasInputs: true }))
    renderTaxInputs()

    const row = await screen.findByRole('listitem')
    const actions = row.lastElementChild as HTMLElement
    expect(actions).toHaveClass('actions')
    expect(within(actions).getByRole('button', { name: `${longName} 자료 편집` })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: `${longName} 자료 삭제` })).toBeInTheDocument()
    expect(within(row.firstElementChild as HTMLElement).getByText(longName)).toBeInTheDocument()
  })

  it('deletes a card after one confirmation and reloads the year', async () => {
    mockViewport(true)
    serveTax(yearView({ cards: [cardView({ rowVersion: 5 })], hasInputs: true }))
    let url = ''
    server.use(http.delete('*/api/tax/years/2026/cards/7', ({ request }) => {
      url = request.url
      serveTax(yearView())
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: 'A카드 자료 삭제' }))
    const dialog = await screen.findByRole('dialog', { name: 'A카드 자료를 삭제할까요?' })
    expect(dialog.parentElement).toHaveClass('modal')
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(await screen.findByText('등록한 신용·체크 자료가 없습니다.')).toBeInTheDocument()
    expect(new URL(url).search).toBe('?rowVersion=5')
  })

  it('stops a stale card save and keeps the input', async () => {
    serveTax(yearView({ cards: [cardView()], hasInputs: true }))
    server.use(http.put('*/api/tax/years/2026/cards/7', () => HttpResponse.json({ code: 'CONFLICT', message: 'x' }, { status: 409 })))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: 'A카드 자료 편집' }))
    const dialog = await screen.findByRole('dialog', { name: 'A카드 자료 편집' })
    await user.clear(cell(dialog, '일반', '신용카드'))
    await user.type(cell(dialog, '일반', '신용카드'), '9500000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다.')
    expect(cell(dialog, '일반', '신용카드')).toHaveValue('9,500,000')
    expect(within(dialog).getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
  })

  it('stops adding at 50 cards and says why', async () => {
    serveTax(yearView({ cards: Array.from({ length: 50 }, (_, i) => cardView({ id: i + 1, issuerName: `카드${i + 1}` })), hasInputs: true }))
    renderTaxInputs()

    expect(await screen.findByRole('button', { name: '신용·체크 자료 추가' })).toBeDisabled()
    expect(screen.getByText('신용·체크 자료는 연도마다 50건까지 등록할 수 있습니다.')).toBeInTheDocument()
  })
})
```

`apps/web/src/tax/inputs/CashReceiptSection.test.tsx` 전체:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { cardView, renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

const zeros = { general: 0, market: 0, transit: 0, culture: 0 }

describe('현금영수증 자료', () => {
  it('starts as 4 blank cells and fills them with 0 through the centered dialog, with no delete anywhere', async () => {
    mockViewport(true)
    serveTax(yearView({ cards: [cardView({ asOfDate: '2026-09-30' })], hasInputs: true }))
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/cash-receipt', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({
        cards: [cardView({ asOfDate: '2026-09-30' })], hasInputs: true,
        cashReceipt: { rowVersion: 55, asOfDate: '2026-09-30', memo: null, amounts: zeros, blankCount: 0 },
      }))
    }))
    const { user } = renderTaxInputs()

    const section = await screen.findByRole('region', { name: '현금영수증 자료' })
    expect(section).toHaveTextContent('미완료 · 4칸 빔')
    expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual(['입력', '4칸 0원으로 채우기'])
    await user.click(within(section).getByRole('button', { name: '4칸 0원으로 채우기' }))

    const dialog = await screen.findByRole('dialog', { name: '2026년 현금영수증 자료' })
    expect(dialog.parentElement).toHaveClass('modal')
    const group = within(dialog).getByRole('group', { name: '현금영수증' })
    expect(['일반', '전통시장', '대중교통', '문화체육'].map((label) => within(group).getByLabelText(label))).toHaveLength(4)
    expect(within(group).getByLabelText('일반')).toHaveValue('0')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ asOfDate: '2026-09-30', memo: null, amounts: zeros })
    expect(section).toHaveTextContent('완료')
    expect(section).not.toHaveTextContent('미완료')
    expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual(['편집'])
    expect(screen.queryByRole('button', { name: /현금영수증.*삭제/ })).not.toBeInTheDocument()
  })

  it('edits the cash receipt with the row version it received', async () => {
    serveTax(yearView({ cashReceipt: { rowVersion: 55, asOfDate: '2026-10-31', memo: '연말정산 대비', amounts: zeros, blankCount: 0 }, hasInputs: true }))
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/cash-receipt', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView())
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '현금영수증 자료 편집' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 현금영수증 자료' })
    await user.clear(within(dialog).getByLabelText('일반'))
    await user.type(within(dialog).getByLabelText('일반'), '500000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(body).toEqual({
      asOfDate: '2026-10-31', memo: '연말정산 대비', amounts: { ...zeros, general: 500_000 }, rowVersion: 55,
    }))
  })
})
```

`git apply`:

```diff
diff --git a/apps/web/src/common/DateTimePicker.test.tsx b/apps/web/src/common/DateTimePicker.test.tsx
index 7090d4b..c2d5910 100644
--- a/apps/web/src/common/DateTimePicker.test.tsx
+++ b/apps/web/src/common/DateTimePicker.test.tsx
@@ -50,3 +50,37 @@ describe('DateTimePicker', () => {
     spies.forEach((spy) => spy.mockRestore())
   })
 })
+
+describe('DateTimePicker with day granularity', () => {
+  function DayPicker({ onValue, onSubmit }: { onValue: (v: string) => void; onSubmit: () => void }) {
+    const [value, setValue] = useState('')
+    return (
+      <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
+        <DateTimePicker label="기준일" granularity="day" minValue="2026-01-01" maxValue="2026-12-31" isRequired
+          value={value} onChange={(v) => { setValue(v); onValue(v) }} />
+        <button type="submit">저장</button>
+      </form>
+    )
+  }
+
+  it('reports YYYY-MM-DD and blocks a date outside the allowed range', async () => {
+    const user = userEvent.setup()
+    const onValue = vi.fn()
+    const onSubmit = vi.fn()
+    render(<I18nProvider locale="ko-KR"><DayPicker onValue={onValue} onSubmit={onSubmit} /></I18nProvider>)
+    const group = screen.getByRole('group', { name: '기준일' })
+    expect(within(group).getAllByRole('spinbutton')).toHaveLength(3)
+
+    await user.click(within(group).getAllByRole('spinbutton')[0])
+    await user.keyboard('20251231')
+    expect(onValue).toHaveBeenLastCalledWith('2025-12-31')
+    await user.click(screen.getByRole('button', { name: '저장' }))
+    expect(onSubmit).not.toHaveBeenCalled()
+
+    await user.click(within(group).getAllByRole('spinbutton')[0])
+    await user.keyboard('2026')
+    expect(onValue).toHaveBeenLastCalledWith('2026-12-31')
+    await user.click(screen.getByRole('button', { name: '저장' }))
+    expect(onSubmit).toHaveBeenCalledOnce()
+  })
+})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/tax/inputs/CardStatementList.test.tsx src/tax/inputs/CashReceiptSection.test.tsx src/common/DateTimePicker.test.tsx`
Expected: 12건 FAIL(카드 9건 — `Unable to find role="region" and name "신용·체크 자료"` 등, 현금영수증 2건, 날짜만 받는 `DateTimePicker` 1건 — spinbutton이 5개), 기존 `DateTimePicker` 3건 PASS.

- [ ] **Step 3: 날짜만 받는 기준일 입력** — 기본값은 그대로라 거래 입력 화면은 바뀌지 않는다.

`git apply`:

```diff
diff --git a/apps/web/src/common/DateTimePicker.tsx b/apps/web/src/common/DateTimePicker.tsx
index e434809..640e8e0 100644
--- a/apps/web/src/common/DateTimePicker.tsx
+++ b/apps/web/src/common/DateTimePicker.tsx
@@ -1,5 +1,5 @@
 import { useState } from 'react'
-import { parseDateTime, type CalendarDateTime } from '@internationalized/date'
+import { parseDate, parseDateTime, type DateValue } from '@internationalized/date'
 import {
   Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment,
   FieldError, Group, Heading, Label,
@@ -10,24 +10,30 @@ import { useNarrowWhileOpen } from './useMediaQuery'
 import fields from './Field.module.css'
 import styles from './DateTimePicker.module.css'
 
-type Props = { label: string; value: string; onChange: (value: string) => void; isRequired?: boolean }
+type Props = {
+  label: string; value: string; onChange: (value: string) => void; isRequired?: boolean
+  /** 'day'면 연·월·일만 받고 YYYY-MM-DD로 주고받는다. minValue·maxValue(YYYY-MM-DD) 밖이면 필드 오류로 제출을 막는다. */
+  granularity?: 'minute' | 'day'; minValue?: string; maxValue?: string
+}
 
-function toValue(text: string): CalendarDateTime | null {
+function toValue(text: string, day: boolean): DateValue | null {
   if (!text) return null
   try {
-    return parseDateTime(text)
+    return day ? parseDate(text) : parseDateTime(text)
   } catch {
     return null
   }
 }
 
 /** 연·월·일·시·분을 칸별로 입력하거나 달력에서 고른다. API에는 지금처럼 YYYY-MM-DDTHH:mm으로 보낸다. */
-export default function DateTimePicker({ label, value, onChange, isRequired }: Props) {
+export default function DateTimePicker({ label, value, onChange, isRequired, granularity = 'minute', minValue, maxValue }: Props) {
   const [open, setOpen] = useState(false)
   const mobile = useNarrowWhileOpen(open)
+  const day = granularity === 'day'
   return (
-    <DatePicker value={toValue(value)} onChange={(v) => onChange(v ? v.toString().slice(0, 16) : '')}
-      granularity="minute" hourCycle={24} isRequired={isRequired} validationBehavior="native"
+    <DatePicker value={toValue(value, day)} onChange={(v) => onChange(v ? v.toString().slice(0, day ? 10 : 16) : '')}
+      granularity={granularity} hourCycle={24} isRequired={isRequired} validationBehavior="native"
+      minValue={minValue ? parseDate(minValue) : undefined} maxValue={maxValue ? parseDate(maxValue) : undefined}
       onOpenChange={setOpen} className={fields.field}>
       <Label className={fields.label}>{label}</Label>
       <Group className={styles.group}>
```

- [ ] **Step 4: 금액 칸 정의와 입력표**

`apps/web/src/tax/inputs/amounts.ts` 전체:

```ts
import type { CardAmounts, CashAmounts } from '../taxApi'

export type AmountGroup<K extends string> = { legend: string; fields: { key: K; label: string }[] }

/** 소비구분. 응답 칸 이름의 뒷부분(creditGeneral, cashGeneral …)과 화면 이름. */
export const CATEGORIES = [['General', '일반'], ['Market', '전통시장'], ['Transit', '대중교통'], ['Culture', '문화체육']] as const

/** 신용·체크 자료 8칸: 소비구분 4묶음 × (신용카드, 체크카드). */
export const CARD_GROUPS: AmountGroup<keyof CardAmounts>[] = CATEGORIES.map(([key, label]) => ({
  legend: label,
  fields: [{ key: `credit${key}`, label: '신용카드' }, { key: `debit${key}`, label: '체크카드' }],
}))

/** 현금영수증 자료 4칸: 한 묶음 안의 소비구분 4칸. */
export const CASH_GROUPS: AmountGroup<keyof CashAmounts>[] = [{
  legend: '현금영수증',
  fields: [{ key: 'general', label: '일반' }, { key: 'market', label: '전통시장' }, { key: 'transit', label: '대중교통' }, { key: 'culture', label: '문화체육' }],
}]

export const EMPTY_CARD: CardAmounts = {
  creditGeneral: null, creditMarket: null, creditTransit: null, creditCulture: null,
  debitGeneral: null, debitMarket: null, debitTransit: null, debitCulture: null,
}
export const EMPTY_CASH: CashAmounts = { general: null, market: null, transit: null, culture: null }

/** 빈 칸(모름)만 0(없음)으로 바꾼다. 입력한 값은 그대로 둔다. */
export function fillBlanks<T extends Record<string, number | null>>(values: T): T {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? 0])) as T
}

export function countBlanks(values: Record<string, number | null>): number {
  return Object.values(values).filter((value) => value == null).length
}

/** 자료 한 건의 표시용 합계. 빈 칸은 0으로 더한다(서버 연도 합계표와 같은 규칙). */
export function sumAmounts(values: Record<string, number | null>): number {
  return Object.values(values).reduce<number>((sum, value) => sum + (value ?? 0), 0)
}
```

`apps/web/src/tax/inputs/AmountGrid.tsx` 전체:

```tsx
import HelpButton from '../../common/HelpButton'
import MoneyField from '../../common/MoneyField'
import ui from '../../common/ui.module.css'
import { countBlanks, fillBlanks, type AmountGroup } from './amounts'
import styles from './inputs.module.css'

type Props<K extends string> = {
  groups: AmountGroup<K>[]
  values: Record<K, number | null>
  onChange: (values: Record<K, number | null>) => void
}

/**
 * 공제대상액 입력표. 묶음(fieldset)마다 2열로 놓아 375px에서도 가로 스크롤이 없다.
 * 빈 칸은 null(모름)로 두고 0(없음)과 구별한다(TAX-24).
 */
export default function AmountGrid<K extends string>({ groups, values, onChange }: Props<K>) {
  const blanks = countBlanks(values)
  return (
    <div className={ui.stack}>
      <div className={styles.titleWithHelp}>
        <p className={styles.gridTitle}>공제대상액 (원)</p>
        <HelpButton title="공제대상액">
          카드사 명세서나 국세청 자료의 1월 1일부터 기준일까지 누계를 적습니다. 전체 사용액에서 전통시장·대중교통·문화체육 사용액을 뺀 나머지를 일반에 적고, 취소·환불이 반영된 금액을 그대로 씁니다. 이전 값에 더하지 않고 새 누계로 덮어씁니다.
        </HelpButton>
      </div>
      <p className={ui.muted}>"일반"은 전통시장·대중교통·문화체육을 뺀 금액입니다. 빈 칸은 "모름", 0은 "없음"입니다.</p>
      {groups.map((group) => (
        <fieldset key={group.legend} className={styles.amountGroup}>
          <legend>{group.legend}</legend>
          {group.fields.map((field) => (
            <MoneyField key={field.key} label={field.label} value={values[field.key]} minValue={0}
              onChange={(value) => onChange({ ...values, [field.key]: value })} />
          ))}
        </fieldset>
      ))}
      <div className={styles.split}>
        <p className={ui.muted}>{blanks > 0 ? `빈 칸 ${blanks}개 · 빈 칸이 있으면 미완료로 저장됩니다.` : '빈 칸 없음'}</p>
        <button type="button" className={ui.button} disabled={blanks === 0} onClick={() => onChange(fillBlanks(values))}>
          빈 칸 0원으로 채우기
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 확인·채우기 동작의 실패 문구** — `taxApi.ts`에 `actionError`를 더하고 연도 삭제 창이 쓴다.

`git apply`:

```diff
diff --git a/apps/web/src/tax/inputs/DeleteYearDialog.tsx b/apps/web/src/tax/inputs/DeleteYearDialog.tsx
index e63725f..cf6eb7c 100644
--- a/apps/web/src/tax/inputs/DeleteYearDialog.tsx
+++ b/apps/web/src/tax/inputs/DeleteYearDialog.tsx
@@ -1,11 +1,10 @@
 import { useMutation, useQueryClient } from '@tanstack/react-query'
 import { useState } from 'react'
 import Dialog from '../../common/Dialog'
-import { errorMessage } from '../../common/errorMessage'
 import TextField from '../../common/TextField'
 import { toast } from '../../common/Toast'
 import ui from '../../common/ui.module.css'
-import { isStale, taxApi, taxKeys, type TaxYearView } from '../taxApi'
+import { actionError, isStale, taxApi, taxKeys, type TaxYearView } from '../taxApi'
 
 /** 연도 기록 삭제 확인(D22). 귀속연도 4자리를 똑같이 입력해야 [삭제]가 켜진다. 닫으면 입력이 사라진다(창을 조건부로 그린다). */
 export default function DeleteYearDialog({ view, onClose }: { view: TaxYearView; onClose: () => void }) {
@@ -26,11 +25,7 @@ export default function DeleteYearDialog({ view, onClose }: { view: TaxYearView;
   return (
     <Dialog title={`${year}년 기록을 삭제할까요?`} onClose={onClose} closeDisabled={remove.isPending} centered>
       <p>{year}년 귀속의 기본정보, 신용·체크 자료 {view.cards.length}건, 현금영수증 자료, 지출계획이 모두 지워집니다. 다른 연도의 기록은 남습니다. 복구할 수 없습니다.</p>
-      {remove.error && (
-        <p role="alert" className={ui.alert}>
-          {isStale(remove.error) ? '다른 곳에서 수정되거나 삭제됐습니다. 새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.' : errorMessage(remove.error)}
-        </p>
-      )}
+      {remove.error && <p role="alert" className={ui.alert}>{actionError(remove.error)}</p>}
       <TextField label={`확인을 위해 귀속연도 ${year}을 입력하세요`} value={typed} onChange={setTyped} autoComplete="off" />
       <div className={ui.confirmActions}>
         <button type="button" className={ui.button} disabled={remove.isPending} onClick={onClose}>취소</button>
diff --git a/apps/web/src/tax/taxApi.ts b/apps/web/src/tax/taxApi.ts
index 29d9c3d..d7c5e6c 100644
--- a/apps/web/src/tax/taxApi.ts
+++ b/apps/web/src/tax/taxApi.ts
@@ -1,6 +1,7 @@
 import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
 import { apiFetch } from '../api/client'
 import { ApiError } from '../api/errors'
+import { errorMessage } from '../common/errorMessage'
 
 // PR 3 응답(TaxRecordDtos)과 같은 모양. 금액은 원 단위 정수, null은 미입력이다.
 // rowVersion은 서버가 주는 불투명한 값(JS 안전 정수 이하)이다. 받은 값을 그대로 돌려보내고 계산하지 않는다.
@@ -74,3 +75,8 @@ export function useTaxSave<T>(year: number, save: (input: T) => Promise<TaxYearV
 export function isStale(error: unknown): boolean {
   return error instanceof ApiError && (error.status === 409 || error.status === 404)
 }
+
+/** 확인·채우기처럼 입력이 없는 동작의 실패 문구. 다른 곳에서 바뀌었으면 호출한 쪽이 새로 불러온다. */
+export function actionError(error: unknown): string {
+  return isStale(error) ? '다른 곳에서 수정되거나 삭제됐습니다. 새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.' : errorMessage(error)
+}
```

- [ ] **Step 6: 신용·체크 자료**

`apps/web/src/tax/inputs/CardStatementDialog.tsx` 전체:

```tsx
import { useState, type FormEvent } from 'react'
import DateTimePicker from '../../common/DateTimePicker'
import Dialog from '../../common/Dialog'
import TextField from '../../common/TextField'
import ui from '../../common/ui.module.css'
import { taxApi, useTaxSave, type CardAmounts, type CardInput, type CardView } from '../taxApi'
import AmountGrid from './AmountGrid'
import { CARD_GROUPS, EMPTY_CARD } from './amounts'
import SaveError from './SaveError'

type Props = { year: number; card: CardView | null; defaultAsOfDate: string; onClose: () => void }

/** 신용·체크 자료 추가(card가 null)·편집. 같은 카드사명을 다시 써도 막지 않는다(TAX-22). */
export default function CardStatementDialog({ year, card, defaultAsOfDate, onClose }: Props) {
  const [issuerName, setIssuerName] = useState(card?.issuerName ?? '')
  const [asOfDate, setAsOfDate] = useState(card?.asOfDate ?? defaultAsOfDate)
  const [memo, setMemo] = useState(card?.memo ?? '')
  const [amounts, setAmounts] = useState<CardAmounts>(card?.amounts ?? EMPTY_CARD)
  const [rowVersion] = useState(card?.rowVersion)
  const save = useTaxSave(year, (body: CardInput) => (card ? taxApi.saveCard(year, card.id, { ...body, rowVersion }) : taxApi.addCard(year, body)))

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate({ issuerName: issuerName.trim(), asOfDate, memo: memo.trim() || null, amounts }, { onSuccess: onClose })
  }

  return (
    <Dialog title={card ? `${card.issuerName} 자료 편집` : '신용·체크 자료 추가'} onClose={onClose} closeDisabled={save.isPending} centered>
      <form className={ui.stack} onSubmit={onSubmit}>
        <SaveError error={save.error} year={year} onReload={onClose} />
        <TextField label="카드사명" value={issuerName} onChange={setIssuerName} isRequired maxLength={50} />
        <div className={ui.stack}>
          <DateTimePicker label="기준일" granularity="day" minValue={`${year}-01-01`} maxValue={`${year}-12-31`}
            value={asOfDate} onChange={setAsOfDate} isRequired />
          <p className={ui.muted}>1월 1일부터 기준일까지의 누계를 적습니다.</p>
        </div>
        <TextField label="메모 (선택)" value={memo} onChange={setMemo} maxLength={200} />
        <AmountGrid groups={CARD_GROUPS} values={amounts} onChange={setAmounts} />
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={save.isPending} onClick={onClose}>취소</button>
          <button type="submit" className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={save.isPending}>저장</button>
        </div>
      </form>
    </Dialog>
  )
}
```

`apps/web/src/tax/inputs/CardStatementList.tsx` 전체:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import ConfirmDialog from '../../common/ConfirmDialog'
import HelpButton from '../../common/HelpButton'
import Icon from '../../common/Icon'
import ui from '../../common/ui.module.css'
import { actionError, isStale, taxApi, taxKeys, useTaxSave, type CardView, type TaxYearView } from '../taxApi'
import { fillBlanks, sumAmounts } from './amounts'
import CardStatementDialog from './CardStatementDialog'
import styles from './inputs.module.css'

/** 서버의 연도 기록당 카드 자료 상한(PR 3). 넘으면 서버가 400을 준다. */
const MAX_CARDS = 50

type Props = { view: TaxYearView; defaultAsOfDate: string }

/** 신용·체크 자료 목록. 카드사마다 한 건이다. */
export default function CardStatementList({ view, defaultAsOfDate }: Props) {
  const [editing, setEditing] = useState<CardView | 'new' | null>(null)
  const full = view.cards.length >= MAX_CARDS
  return (
    <section aria-labelledby="tax-cards-title" className={ui.card}>
      <div className={styles.split}>
        <div className={styles.titleWithHelp}>
          <h2 id="tax-cards-title">신용·체크 자료</h2>
          <HelpButton title="신용·체크 자료">카드사마다 1월 1일부터 기준일까지의 누계를 한 건씩 등록합니다. 같은 카드사명을 다시 등록해도 됩니다.</HelpButton>
        </div>
        <button type="button" className={ui.button} disabled={full} onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />신용·체크 자료 추가
        </button>
      </div>
      {full && <p className={ui.muted}>신용·체크 자료는 연도마다 {MAX_CARDS}건까지 등록할 수 있습니다.</p>}
      {view.cards.length === 0 ? (
        <p className={ui.status}>등록한 신용·체크 자료가 없습니다.</p>
      ) : (
        <ul className={styles.list}>
          {view.cards.map((card) => <CardRow key={card.id} year={view.taxYear} card={card} onEdit={() => setEditing(card)} />)}
        </ul>
      )}
      {editing && (
        <CardStatementDialog year={view.taxYear} card={editing === 'new' ? null : editing} defaultAsOfDate={defaultAsOfDate}
          onClose={() => setEditing(null)} />
      )}
    </section>
  )
}

function CardRow({ year, card, onEdit }: { year: number; card: CardView; onEdit: () => void }) {
  const expense = useAmountFormatter('expense')
  const client = useQueryClient()
  const reload = () => client.invalidateQueries({ queryKey: taxKeys.year(year) })
  const fill = useTaxSave(year, () => taxApi.saveCard(year, card.id, {
    issuerName: card.issuerName, asOfDate: card.asOfDate, memo: card.memo, amounts: fillBlanks(card.amounts), rowVersion: card.rowVersion,
  }))
  // 삭제는 204라 연도를 다시 읽는다. 다른 곳에서 바뀌었어도 새로 불러와 최신 목록을 보인다.
  const remove = useMutation({
    mutationFn: () => taxApi.deleteCard(year, card.id, card.rowVersion),
    onSuccess: () => reload(),
    onError: (error) => { if (isStale(error)) void reload() },
  })
  return (
    <li className={styles.split}>
      <div className={styles.rowInfo}>
        <p className={styles.name}>{card.issuerName}</p>
        <p className={card.blankCount > 0 ? styles.note : ui.muted}>{card.blankCount > 0 ? `미완료 · 빈 칸 ${card.blankCount}개` : '완료'}</p>
        <p className={ui.muted}>기준일 {card.asOfDate} · 합계 {expense(sumAmounts(card.amounts))}{card.memo && ` · ${card.memo}`}</p>
        {fill.error && <p role="alert" className={ui.alert}>{actionError(fill.error)}</p>}
      </div>
      <div className={styles.actions}>
        {card.blankCount > 0 && (
          <button type="button" className={ui.button} disabled={fill.isPending}
            onClick={() => fill.mutate(undefined, { onError: (error) => { if (isStale(error)) void reload() } })}>빈 칸 0원으로 채우기</button>
        )}
        <button type="button" className={ui.button} aria-label={`${card.issuerName} 자료 편집`} onClick={onEdit}>편집</button>
        <ConfirmDialog centered triggerLabel="삭제" triggerAriaLabel={`${card.issuerName} 자료 삭제`}
          title={`${card.issuerName} 자료를 삭제할까요?`} description="이 자료의 금액 8칸이 지워지고 연도 합계표에서 빠집니다. 복구할 수 없습니다."
          confirmLabel="삭제" isPending={remove.isPending} error={remove.error ? actionError(remove.error) : null}
          onOpen={() => remove.reset()} onConfirm={(close) => remove.mutate(undefined, { onSuccess: close })} />
      </div>
    </li>
  )
}
```

- [ ] **Step 7: 현금영수증 자료**

`apps/web/src/tax/inputs/CashReceiptDialog.tsx` 전체:

```tsx
import { useState, type FormEvent } from 'react'
import DateTimePicker from '../../common/DateTimePicker'
import Dialog from '../../common/Dialog'
import TextField from '../../common/TextField'
import ui from '../../common/ui.module.css'
import { taxApi, useTaxSave, type CashAmounts, type CashInput, type CashView } from '../taxApi'
import AmountGrid from './AmountGrid'
import { CASH_GROUPS, EMPTY_CASH, fillBlanks } from './amounts'
import SaveError from './SaveError'

type Props = { year: number; cash: CashView | null; zeros: boolean; defaultAsOfDate: string; onClose: () => void }

/** 현금영수증 자료(연도에 1건) 입력·편집. 삭제는 없다(D19). zeros면 4칸을 0으로 채운 채 연다. */
export default function CashReceiptDialog({ year, cash, zeros, defaultAsOfDate, onClose }: Props) {
  const [asOfDate, setAsOfDate] = useState(cash?.asOfDate ?? defaultAsOfDate)
  const [memo, setMemo] = useState(cash?.memo ?? '')
  const [amounts, setAmounts] = useState<CashAmounts>(cash?.amounts ?? (zeros ? fillBlanks(EMPTY_CASH) : EMPTY_CASH))
  const [rowVersion] = useState(cash?.rowVersion)
  const save = useTaxSave(year, (body: CashInput) => taxApi.saveCashReceipt(year, body))

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const body: CashInput = { asOfDate, memo: memo.trim() || null, amounts }
    save.mutate(rowVersion === undefined ? body : { ...body, rowVersion }, { onSuccess: onClose })
  }

  return (
    <Dialog title={`${year}년 현금영수증 자료`} onClose={onClose} closeDisabled={save.isPending} centered>
      <form className={ui.stack} onSubmit={onSubmit}>
        <SaveError error={save.error} year={year} onReload={onClose} />
        <div className={ui.stack}>
          <DateTimePicker label="기준일" granularity="day" minValue={`${year}-01-01`} maxValue={`${year}-12-31`}
            value={asOfDate} onChange={setAsOfDate} isRequired />
          <p className={ui.muted}>1월 1일부터 기준일까지의 누계를 적습니다.</p>
        </div>
        <TextField label="메모 (선택)" value={memo} onChange={setMemo} maxLength={200} />
        <AmountGrid groups={CASH_GROUPS} values={amounts} onChange={setAmounts} />
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={save.isPending} onClick={onClose}>취소</button>
          <button type="submit" className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={save.isPending}>저장</button>
        </div>
      </form>
    </Dialog>
  )
}
```

`apps/web/src/tax/inputs/CashReceiptSection.tsx` 전체:

```tsx
import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import ui from '../../common/ui.module.css'
import type { TaxYearView } from '../taxApi'
import { sumAmounts } from './amounts'
import CashReceiptDialog from './CashReceiptDialog'
import styles from './inputs.module.css'

/** 현금영수증 자료(연도에 1건). 한 번도 입력하지 않았으면 4칸이 빈 미완료다(TAX-24). 삭제는 없다(D19). */
export default function CashReceiptSection({ view, defaultAsOfDate }: { view: TaxYearView; defaultAsOfDate: string }) {
  const [open, setOpen] = useState<'edit' | 'zeros' | null>(null)
  const expense = useAmountFormatter('expense')
  const cash = view.cashReceipt
  const status = !cash ? '미완료 · 4칸 빔' : cash.blankCount > 0 ? `미완료 · 빈 칸 ${cash.blankCount}개` : '완료'
  return (
    <section aria-labelledby="tax-cash-title" className={ui.card}>
      <div className={styles.split}>
        <div className={styles.rowInfo}>
          <h2 id="tax-cash-title">현금영수증 자료</h2>
          <p className={cash && cash.blankCount === 0 ? ui.muted : styles.note}>{status}</p>
          {cash ? (
            <p className={ui.muted}>기준일 {cash.asOfDate} · 합계 {expense(sumAmounts(cash.amounts))}{cash.memo && ` · ${cash.memo}`}</p>
          ) : (
            <p className={ui.muted}>아직 입력하지 않았습니다. 현금영수증을 쓰지 않았다면 0원으로 채웁니다.</p>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={ui.button} aria-label={cash ? '현금영수증 자료 편집' : '현금영수증 자료 입력'}
            onClick={() => setOpen('edit')}>{cash ? '편집' : '입력'}</button>
          {!cash && <button type="button" className={ui.button} onClick={() => setOpen('zeros')}>4칸 0원으로 채우기</button>}
        </div>
      </div>
      {open && (
        <CashReceiptDialog year={view.taxYear} cash={cash} zeros={open === 'zeros'} defaultAsOfDate={defaultAsOfDate}
          onClose={() => setOpen(null)} />
      )}
    </section>
  )
}
```

- [ ] **Step 8: 화면에 넣고 스타일 정리** — 스타일은 통째로 바꾼다(화면 뿌리 글자 토큰, 목록 행).

`git apply`:

```diff
diff --git a/apps/web/src/tax/inputs/TaxInputsPage.tsx b/apps/web/src/tax/inputs/TaxInputsPage.tsx
index 167aea2..483bb0b 100644
--- a/apps/web/src/tax/inputs/TaxInputsPage.tsx
+++ b/apps/web/src/tax/inputs/TaxInputsPage.tsx
@@ -9,6 +9,8 @@ import TaxHeader from '../TaxHeader'
 import { useTaxYear } from '../TaxYearProvider'
 import { taxApi, taxKeys, useTaxYearView, type TaxYearView } from '../taxApi'
 import BasicInfoDialog from './BasicInfoDialog'
+import CardStatementList from './CardStatementList'
+import CashReceiptSection from './CashReceiptSection'
 import DeleteYearDialog from './DeleteYearDialog'
 import styles from './inputs.module.css'
 
@@ -24,6 +26,8 @@ export default function TaxInputsPage() {
   const [deleting, setDeleting] = useState(false)
   const lawPending = view ? view.lawVersion === null : view === null && law.data === null
   const childTiersApply = (view ? view.lawVersion?.childTiersApply : law.data?.childTiersApply) ?? false
+  // 새 자료의 기준일은 이미 넣은 자료의 것으로 미리 채워 기준일 불일치(TAX-27)를 줄인다. 바꿀 수 있다.
+  const defaultAsOfDate = view?.cards.at(-1)?.asOfDate ?? view?.cashReceipt?.asOfDate ?? ''
 
   return (
     <div className={styles.page}>
@@ -48,6 +52,8 @@ export default function TaxInputsPage() {
       {view && (
         <>
           <BasicInfoCard view={view} onEdit={() => setEditing(true)} />
+          <CardStatementList view={view} defaultAsOfDate={defaultAsOfDate} />
+          <CashReceiptSection view={view} defaultAsOfDate={defaultAsOfDate} />
           <section aria-label="연도 기록 삭제" className={`${ui.card} ${styles.split}`}>
             <p>이 연도의 기본정보·입력자료·금액·지출계획을 모두 지웁니다.</p>
             <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setDeleting(true)}>{year}년 기록 삭제</button>
```

`apps/web/src/tax/inputs/inputs.module.css` 전체(5.4 판):

```css
/*
 * 소득공제 입력자료 화면과 창. UI 표준의 글자(카드 제목 16px, 내용·금액·카드사명 15px, 실행 버튼 14px, 보조·라벨 13px)를
 * 이 화면 뿌리(.page) 안에서만 정한다. 창은 Overlay.module.css의 typography를 그대로 쓴다.
 */
.page { --text-base: var(--text-lg); --text-sm: var(--text-md); --text-label: var(--text-md); display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; font-size: var(--text-base); line-height: 1.5; }
.page h2 { margin: 0; font-size: var(--text-xl); line-height: 1.5; }
.page p { margin: 0; }
.page section button { font-size: var(--text-card-action); }

/* 정보는 왼쪽, 조작은 오른쪽 끝. 줄이 바뀌어도 조작은 오른쪽에 남고 긴 이름이 버튼을 밀어내지 않는다. */
.split { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2) var(--space-3); }
.split > :first-child { flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); margin-left: auto; }
.titleWithHelp { display: flex; align-items: center; gap: var(--space-1); min-width: 0; }
.titleWithHelp > :first-child { min-width: 0; overflow-wrap: anywhere; }

.facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-1) var(--space-4); margin: 0; }
.facts dt { color: var(--ink-muted); font-size: var(--text-md); }
.facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.amount { font-variant-numeric: tabular-nums; }
.note { color: var(--pending); font-size: var(--text-md); }
.facts .note { margin-left: var(--space-2); }
.empty { align-items: flex-start; }

.list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.list > li { padding: var(--space-3) 0; border-top: 1px solid var(--line); }
.rowInfo { display: flex; flex-direction: column; gap: 2px; }
.name { font-weight: 500; }

/* 창 */
.months { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
.months legend { padding: 0; margin-bottom: var(--space-1); font-size: var(--text-md); font-weight: 500; color: var(--ink-muted); }
.labelRow { display: flex; align-items: center; gap: var(--space-1); }
.fieldError { margin: 0; color: var(--danger); font-size: var(--text-md); }
.gridTitle { margin: 0; font-size: var(--text-md); font-weight: 500; color: var(--ink-muted); }
.amountGroup { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2) var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
.amountGroup legend { padding: 0; margin-bottom: var(--space-1); font-weight: 500; }
```

- [ ] **Step 9: 통과 확인**

Run: `cd apps/web && npx vitest run src/tax src/common/DateTimePicker.test.tsx src/transactions && npx tsc -b && npx oxlint`
Expected: `src/tax`와 `DateTimePicker` 30 passed, `src/transactions`(거래 입력의 `DateTimePicker` 사용처) 10파일 127 passed, 타입 오류 없음, 새 lint 경고 없음.

- [ ] **Step 10: 커밋(컨트롤러)**

```bash
git add apps/web/src/tax apps/web/src/common/DateTimePicker.tsx apps/web/src/common/DateTimePicker.test.tsx
git commit -m "feat(web): 소득공제 신용·체크 자료와 현금영수증 자료 입력" -m "Co-Authored-By: Codex (gpt-6-astra) <noreply@openai.com>"
```

### Task 5.5: 연도 합계표·경고·금액 가림과 2단 배치 (TAX-26, 27, 30, 31, 37, AC-15·23·31·32)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Create: `apps/web/src/tax/inputs/YearTotalsTable.tsx`
- Modify: `apps/web/src/tax/inputs/TaxInputsPage.tsx`, `inputs.module.css`(덧붙임)
- Test: `apps/web/src/tax/inputs/YearTotalsTable.test.tsx`(생성)

**Interfaces:**
- Consumes: `TaxYearView.totals`(12칸), `blankCount`, `hasInputs`, `asOfDateMismatch`, `cards[].blankCount`·`asOfDate`, `cashReceipt`. Task 5.4의 `CATEGORIES`. `useAmountFormatter('expense')`.
- Produces: `YearTotalsTable({ view })` — 표 이름 `<연도>년 귀속 자료의 합 · 단위 원`, 열 소비구분·신용카드·체크카드·현금영수증·합계(좁은 화면은 합계 열을 숨기고 행 머리 아래 `계 n`), 바닥 합계 행, 미입력·기준일 불일치 경고(`role="status"`), 자료 없음이면 모든 칸 `—`. `inputs.module.css`의 `columns`·`column`·`warning`·`tableScroll`·`totals`·`narrowOnly`·`wideOnly`.

- [ ] **Step 1: 실패하는 테스트 작성** — 서버 합계를 카드 자료의 합과 일부러 다르게 두어, 화면이 자료를 다시 더하지 않는지 본다.

`apps/web/src/tax/inputs/YearTotalsTable.test.tsx` 전체:

```tsx
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { cardView, renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

// 카드 자료의 합과 일부러 다르게 둔 서버 합계. 화면이 자료를 다시 더하지 않고 이 값을 그대로 보이는지 본다.
const totals = {
  creditGeneral: 14_000_000, creditMarket: 300_000, creditTransit: 200_000, creditCulture: 100_000,
  debitGeneral: 2_000_000, debitMarket: 200_000, debitTransit: 300_000, debitCulture: 100_000,
  cashGeneral: 500_000, cashMarket: 100_000, cashTransit: 0, cashCulture: 0,
}
const cash = { rowVersion: 9, asOfDate: '2026-10-31', memo: null, amounts: { general: 500_000, market: 100_000, transit: 0, culture: 0 }, blankCount: 0 }

function rowCells(table: HTMLElement, name: string) {
  const header = within(table).getByRole('rowheader', { name: new RegExp(`^${name}`) })
  return within(header.closest('tr')!).getAllByRole('cell').map((cell) => cell.textContent)
}

describe('연도 합계표', () => {
  it('shows the 12 server totals as given, with category and method totals', async () => {
    serveTax(yearView({ cards: [cardView()], cashReceipt: cash, totals, blankCount: 0, hasInputs: true }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    const table = within(section).getByRole('table', { name: '2026년 귀속 자료의 합 · 단위 원' })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['소비구분', '신용카드', '체크카드', '현금영수증', '합계'])
    expect(rowCells(table, '일반')).toEqual(['14,000,000', '2,000,000', '500,000', '16,500,000'])
    expect(rowCells(table, '전통시장')).toEqual(['300,000', '200,000', '100,000', '600,000'])
    expect(rowCells(table, '합계')).toEqual(['14,600,000', '2,600,000', '600,000', '17,800,000'])
    expect(within(table).getByRole('rowheader', { name: /^일반/ })).toHaveTextContent('일반계 16,500,000')
    expect(section).not.toHaveTextContent('미입력 칸이 있습니다')
    expect(section).not.toHaveTextContent('기준일이 서로 다릅니다')
  })

  it('shows a dash in every cell while the year has no inputs and lists the blank cells', async () => {
    serveTax(yearView())
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    expect(rowCells(within(section).getByRole('table'), '일반')).toEqual(['—', '—', '—', '—'])
    expect(within(section).getByRole('status')).toHaveTextContent('미입력 칸이 있습니다(현금영수증 4칸).')
  })

  it('warns about blank cells and different as-of dates', async () => {
    serveTax(yearView({
      cards: [cardView(), cardView({ id: 8, issuerName: 'B카드', asOfDate: '2026-09-30', blankCount: 3 })],
      cashReceipt: cash, totals, blankCount: 3, hasInputs: true, asOfDateMismatch: true,
    }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    const [blanks, dates] = within(section).getAllByRole('status')
    expect(blanks).toHaveTextContent('미입력 칸이 있습니다(B카드 3칸). 아래 합계는 입력한 칸만 더한 값이며 분석은 확정값으로 보여 주지 않습니다.')
    expect(dates).toHaveTextContent('자료의 기준일이 서로 다릅니다(A카드 2026-10-31, B카드 2026-09-30, 현금영수증 2026-10-31).')
  })

  it('masks the deductible amounts with the expense setting and leaves the salary alone', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: true }))
    serveTax(yearView({ cards: [cardView()], cashReceipt: cash, totals, blankCount: 0, hasInputs: true }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    expect(rowCells(within(section).getByRole('table'), '일반')).toEqual(['•••••', '•••••', '•••••', '•••••'])
    expect(screen.getByRole('region', { name: '신용·체크 자료' })).toHaveTextContent('합계 ₩ •••••')
    expect(screen.getByRole('region', { name: '기본정보' })).toHaveTextContent('₩ 50,000,000')
  })

  it('shows the deductible amounts when only the income setting is masked', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ INCOME: true }))
    serveTax(yearView({ cards: [cardView()], cashReceipt: cash, totals, blankCount: 0, hasInputs: true }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    expect(rowCells(within(section).getByRole('table'), '일반')).toEqual(['14,000,000', '2,000,000', '500,000', '16,500,000'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/tax/inputs/YearTotalsTable.test.tsx`
Expected: 5건 모두 FAIL — `Unable to find role="region" and name "연도 합계표"`.

- [ ] **Step 3: 합계표**

`apps/web/src/tax/inputs/YearTotalsTable.tsx` 전체:

```tsx
import { useAmountFormatter } from '../../common/AmountMask'
import ui from '../../common/ui.module.css'
import type { TaxYearView } from '../taxApi'
import { CATEGORIES } from './amounts'
import styles from './inputs.module.css'

const METHODS = [['credit', '신용카드'], ['debit', '체크카드'], ['cash', '현금영수증']] as const
type Method = (typeof METHODS)[number][0]
type Category = (typeof CATEGORIES)[number][0]

/**
 * 연도 합계표(결제수단 3 × 소비구분 4). 12칸은 서버 totals 그대로 쓰고 자료에서 다시 더하지 않는다.
 * 행·열 합계는 그 12칸을 더한 표시용 값이다. 좁은 화면은 합계 열 대신 소비구분 이름 아래 "계"를 둔다.
 */
export default function YearTotalsTable({ view }: { view: TaxYearView }) {
  const format = useAmountFormatter('expense')
  // 세 결제수단 열이 375px에 들어가도록 표 안에서는 ₩ 기호를 뺀다(단위는 표 제목에 적는다). 가린 값도 같다.
  const amount = (value: number) => (view.hasInputs ? format(value).replace('₩ ', '') : '—')
  const cell = (method: Method, category: Category) => view.totals[`${method}${category}`]
  const categoryTotal = (category: Category) => METHODS.reduce((sum, [method]) => sum + cell(method, category), 0)
  const methodTotal = (method: Method) => CATEGORIES.reduce((sum, [category]) => sum + cell(method, category), 0)
  const cashBlanks = view.cashReceipt ? view.cashReceipt.blankCount : 4
  const blanks = [
    ...view.cards.filter((card) => card.blankCount > 0).map((card) => `${card.issuerName} ${card.blankCount}칸`),
    ...(cashBlanks > 0 ? [`현금영수증 ${cashBlanks}칸`] : []),
  ]
  const dates = [
    ...view.cards.map((card) => `${card.issuerName} ${card.asOfDate}`),
    ...(view.cashReceipt ? [`현금영수증 ${view.cashReceipt.asOfDate}`] : []),
  ]

  return (
    <section aria-labelledby="tax-totals-title" className={ui.card}>
      <h2 id="tax-totals-title">연도 합계표</h2>
      {view.blankCount > 0 && (
        <p role="status" className={styles.warning}>
          미입력 칸이 있습니다({blanks.join(', ')}). 아래 합계는 입력한 칸만 더한 값이며 분석은 확정값으로 보여 주지 않습니다.
        </p>
      )}
      {view.asOfDateMismatch && (
        <p role="status" className={styles.warning}>
          자료의 기준일이 서로 다릅니다({dates.join(', ')}). 합계는 서로 다른 시점의 누계를 더한 값이며 분석에 "추정"이 붙습니다.
        </p>
      )}
      <div className={styles.tableScroll}>
        <table className={styles.totals}>
          <caption>{view.taxYear}년 귀속 자료의 합 · 단위 원</caption>
          <thead>
            <tr>
              <th scope="col">소비구분</th>
              {METHODS.map(([method, label]) => <th key={method} scope="col">{label}</th>)}
              <th scope="col" className={styles.wideOnly}>합계</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(([category, label]) => (
              <tr key={category}>
                <th scope="row">{label}<span className={styles.narrowOnly}>계 {amount(categoryTotal(category))}</span></th>
                {METHODS.map(([method]) => <td key={method}>{amount(cell(method, category))}</td>)}
                <td className={styles.wideOnly}>{amount(categoryTotal(category))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">합계</th>
              {METHODS.map(([method]) => <td key={method}>{amount(methodTotal(method))}</td>)}
              <td className={styles.wideOnly}>{amount(METHODS.reduce((sum, [method]) => sum + methodTotal(method), 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: 2단 배치와 표 스타일**

`git apply`:

```diff
diff --git a/apps/web/src/tax/inputs/TaxInputsPage.tsx b/apps/web/src/tax/inputs/TaxInputsPage.tsx
index 483bb0b..d8749b1 100644
--- a/apps/web/src/tax/inputs/TaxInputsPage.tsx
+++ b/apps/web/src/tax/inputs/TaxInputsPage.tsx
@@ -12,6 +12,7 @@ import BasicInfoDialog from './BasicInfoDialog'
 import CardStatementList from './CardStatementList'
 import CashReceiptSection from './CashReceiptSection'
 import DeleteYearDialog from './DeleteYearDialog'
+import YearTotalsTable from './YearTotalsTable'
 import styles from './inputs.module.css'
 
 /** 소득공제 › 입력자료. 선택 연도의 기록 하나를 보여 주고 고친다. 그룹과 무관하다(useGroups를 쓰지 않는다). */
@@ -51,9 +52,14 @@ export default function TaxInputsPage() {
       )}
       {view && (
         <>
-          <BasicInfoCard view={view} onEdit={() => setEditing(true)} />
-          <CardStatementList view={view} defaultAsOfDate={defaultAsOfDate} />
-          <CashReceiptSection view={view} defaultAsOfDate={defaultAsOfDate} />
+          <div className={styles.columns}>
+            <div className={styles.column}>
+              <BasicInfoCard view={view} onEdit={() => setEditing(true)} />
+              <CardStatementList view={view} defaultAsOfDate={defaultAsOfDate} />
+              <CashReceiptSection view={view} defaultAsOfDate={defaultAsOfDate} />
+            </div>
+            <YearTotalsTable view={view} />
+          </div>
           <section aria-label="연도 기록 삭제" className={`${ui.card} ${styles.split}`}>
             <p>이 연도의 기본정보·입력자료·금액·지출계획을 모두 지웁니다.</p>
             <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setDeleting(true)}>{year}년 기록 삭제</button>
diff --git a/apps/web/src/tax/inputs/inputs.module.css b/apps/web/src/tax/inputs/inputs.module.css
index 7d0ab3f..fcc2556 100644
--- a/apps/web/src/tax/inputs/inputs.module.css
+++ b/apps/web/src/tax/inputs/inputs.module.css
@@ -35,3 +35,26 @@
 .gridTitle { margin: 0; font-size: var(--text-md); font-weight: 500; color: var(--ink-muted); }
 .amountGroup { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2) var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
 .amountGroup legend { padding: 0; margin-bottom: var(--space-1); font-weight: 500; }
+
+/* 넓은 화면(1100px 이상)은 자료(왼쪽) | 연도 합계표(오른쪽) 2단, 그보다 좁으면 차례로 쌓는다. */
+.columns { display: grid; gap: var(--space-3); align-items: start; min-width: 0; }
+.column { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
+@media (min-width: 1100px) {
+  .columns { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
+}
+
+.warning { padding: var(--space-3); border-radius: var(--radius-sm); background: var(--surface-100); color: var(--pending); font-size: var(--text-md); overflow-wrap: anywhere; }
+/* 표가 칸보다 넓어지는 예외(아주 큰 금액, 320px)에만 표 안에서 가로로 움직인다. 페이지는 넘치지 않는다. */
+.tableScroll { overflow-x: auto; min-width: 0; }
+.totals { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
+.totals caption { caption-side: top; padding-bottom: var(--space-2); text-align: left; font-size: var(--text-md); color: var(--ink-muted); }
+.totals th, .totals td { padding: var(--space-2) var(--space-1); border-bottom: 1px solid var(--line); }
+.totals td { text-align: right; white-space: nowrap; }
+.totals thead th { text-align: right; font-size: var(--text-md); font-weight: 500; color: var(--ink-muted); }
+.totals thead th:first-child, .totals tbody th, .totals tfoot th { text-align: left; font-weight: 500; }
+.totals tfoot th, .totals tfoot td { font-weight: 700; border-bottom: 0; }
+.narrowOnly { display: none; }
+@media (max-width: 820px) {
+  .narrowOnly { display: block; font-size: var(--text-md); font-weight: 400; color: var(--ink-muted); white-space: nowrap; }
+  .wideOnly { display: none; }
+}
```

- [ ] **Step 5: 통과와 웹 전체 확인**

Run: `cd apps/web && npx vitest run src/tax && npm run typecheck && npm run lint && npm run build && npx vitest run --maxWorkers=4`
Expected: `src/tax` 6파일 31 passed. typecheck 통과, lint는 기존 `imports/CoverageSection.tsx` 경고 1건 말고 새 경고 없음, build 통과(`TaxInputsPage` 청크가 따로 나뉜다), 전체 85파일 684 passed. 기본 병렬(`npm test`)은 이 기계에서 소득공제와 무관한 시간 의존 테스트(`AppRoutes`의 포커스·cold-start, 거래·대시보드 몇 건)가 실행마다 다르게 1~4건 실패했다(`4aecc38` 기준선에서도 같다). 실패하면 그 파일만 다시 돌려 통과를 확인하고 보고한다.

- [ ] **Step 6: 커밋(컨트롤러)**

```bash
git add apps/web/src/tax/inputs
git commit -m "feat(web): 소득공제 연도 합계표와 경고를 보임" -m "Co-Authored-By: Codex (gpt-6-sol) <noreply@openai.com>"
```

### Task 5.6: verify 시드·검증 지도 (AC-02, AC-23)

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Modify: `.claude/skills/verify/bin/env.sh`(그룹 없는 계정), `bin/seed.sh`, `bin/doctor.sh`, `SKILL.md`, `features/README.md`, `features/navigation.md`
- Create: `.claude/skills/verify/features/tax-inputs.md`

**Interfaces:**
- Consumes: PR 2 관리자 API `POST /tax/admin/law-versions`·`PUT /{id}`·`POST /{id}/apply`(요청마다 DB의 `users.service_admin` 확인), PR 3 회원 API, 검증 DB 컨테이너 `salad-verify-pg`(DB·사용자 `saladbowl`).
- Produces: `seed.sh` 출력 `SEEDED group=<id> tax_year=<YYYY>`. 계정 `verify5@example.test` / 그룹없음. `doctor.sh`의 `applied tax law YYYY`·`seed tax record YYYY` 확인.

- [ ] **Step 1: 시드·점검 스크립트**

`git apply`:

```diff
diff --git a/.claude/skills/verify/bin/doctor.sh b/.claude/skills/verify/bin/doctor.sh
index 2848ec9..41188d0 100755
--- a/.claude/skills/verify/bin/doctor.sh
+++ b/.claude/skills/verify/bin/doctor.sh
@@ -12,9 +12,15 @@ done
 check "port $API_PORT owned by api pid" "lsof -a -p $(cat "$STATE/api.pid" 2>/dev/null || echo 0) -iTCP:$API_PORT -sTCP:LISTEN"
 check "port $WEB_PORT owned by web pid" "lsof -a -p $(cat "$STATE/web.pid" 2>/dev/null || echo 0) -iTCP:$WEB_PORT -sTCP:LISTEN"
 check "health UP through web proxy" "curl -sf $WEB/api/actuator/health | grep -q UP"
-for email in "$SEED_EMAIL" "$SEED_EMAIL2" "$SEED_EMAIL3" "$SEED_EMAIL4"; do
+for email in "$SEED_EMAIL" "$SEED_EMAIL2" "$SEED_EMAIL3" "$SEED_EMAIL4" "$SEED_EMAIL5"; do
   check "seed login $email" "curl -sf -H 'Content-Type: application/json' -d '{\"email\":\"$email\",\"password\":\"$SEED_PASSWORD\"}' $WEB/api/auth/login"
 done
 
+tax_year=$(TZ=Asia/Seoul date +%Y)
+token=$(curl -sf -H 'Content-Type: application/json' -d "{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\"}" "$WEB/api/auth/login" \
+  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])' 2>/dev/null)
+check "applied tax law $tax_year" "curl -sf -H 'Authorization: Bearer $token' '$WEB/api/tax/law-versions/current?year=$tax_year'"
+check "seed tax record $tax_year" "curl -sf -H 'Authorization: Bearer $token' '$WEB/api/tax/years/$tax_year'"
+
 echo "build: $(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet || echo '+dirty')"
 exit $ok
diff --git a/.claude/skills/verify/bin/env.sh b/.claude/skills/verify/bin/env.sh
index 0d0b4b2..05a7bbb 100755
--- a/.claude/skills/verify/bin/env.sh
+++ b/.claude/skills/verify/bin/env.sh
@@ -10,3 +10,5 @@ SEED_EMAIL=verify@example.test SEED_PASSWORD=verify-pass-1234 SEED_NICK=검증
 SEED_EMAIL2=verify2@example.test SEED_NICK2=검증둘
 SEED_EMAIL3=verify3@example.test SEED_NICK3=검증셋
 SEED_EMAIL4=verify4@example.test SEED_NICK4=비공개러
+# 그룹에 들지 않은 계정(소득공제 TAX-03·AC-02 확인용). 가입만 한다.
+SEED_EMAIL5=verify5@example.test SEED_NICK5=그룹없음
diff --git a/.claude/skills/verify/bin/seed.sh b/.claude/skills/verify/bin/seed.sh
index 1b4d41f..ab652de 100755
--- a/.claude/skills/verify/bin/seed.sh
+++ b/.claude/skills/verify/bin/seed.sh
@@ -36,4 +36,37 @@ for member in owner second third private; do
     echo
   done
 done
-echo "SEEDED group=$gid"
+# 그룹 없는 계정: 가입만 한다.
+curl -sf -H "$json" -d "{\"email\":\"$SEED_EMAIL5\",\"password\":\"$SEED_PASSWORD\",\"nickname\":\"$SEED_NICK5\"}" "$WEB/api/auth/signup" >/dev/null
+
+# 소득공제: 소유자를 서비스 관리자로 지정하고(화면 없이 DB에서, PR 2), 올해 귀속 세법(2026 귀속 값)을 적용한 뒤
+# 소유자에게 합성 연도 기록을 넣는다. 금액은 와이어프레임 합성값과 같다(PR 7 확인 숫자의 전제).
+tax_year=$(TZ=Asia/Seoul date +%Y)
+docker exec "$PG_NAME" psql -U saladbowl -d saladbowl -qc "UPDATE users SET service_admin = true WHERE email = '$SEED_EMAIL'" >/dev/null
+field() { python3 -c "import json,sys; print(json.load(sys.stdin)[\"$1\"])"; }
+law=$(curl -sf -H "$auth" -H "$json" -d "{\"taxYear\":$tax_year}" "$WEB/api/tax/admin/law-versions")
+law_id=$(field id <<<"$law")
+law=$(curl -sf -X PUT -H "$auth" -H "$json" "$WEB/api/tax/admin/law-versions/$law_id" -d "{
+  \"rowVersion\":$(field rowVersion <<<"$law"), \"minSpendRatePct\":25, \"bracketBoundary\":70000000,
+  \"rateCreditPct\":15, \"rateDebitCashPct\":30, \"rateCulturePct\":30, \"rateMarketPct\":40, \"rateTransitPct\":40,
+  \"basicLimitLow\":[3000000,3500000,4000000], \"basicLimitHigh\":[2500000,2750000,3000000],
+  \"extraLimitLow\":3000000, \"extraLimitHigh\":2000000,
+  \"basisLawName\":\"조세특례제한법\", \"basisArticle\":\"제126조의2\", \"basisUrl\":\"https://www.law.go.kr\",
+  \"periodStart\":\"$tax_year-01-01\", \"periodEnd\":\"$tax_year-12-31\", \"memo\":\"검증용 합성 세법\"}")
+curl -sf -H "$auth" -H "$json" -d "{\"rowVersion\":$(field rowVersion <<<"$law")}" "$WEB/api/tax/admin/law-versions/$law_id/apply" >/dev/null
+tax="$WEB/api/tax/years/$tax_year"
+curl -sf -X PUT -H "$auth" -H "$json" -d '{"totalSalary":50000000,"workStartMonth":1,"workEndMonth":12,"childCount":0}' "$tax" >/dev/null
+curl -sf -H "$auth" -H "$json" "$tax/cards" -d "{\"issuerName\":\"A카드\",\"asOfDate\":\"$tax_year-06-30\",\"memo\":\"주 사용 카드\",
+  \"amounts\":{\"creditGeneral\":9000000,\"creditMarket\":300000,\"creditTransit\":200000,\"creditCulture\":100000,
+  \"debitGeneral\":0,\"debitMarket\":0,\"debitTransit\":0,\"debitCulture\":0}}" >/dev/null
+curl -sf -H "$auth" -H "$json" "$tax/cards" -d "{\"issuerName\":\"B카드\",\"asOfDate\":\"$tax_year-06-30\",
+  \"amounts\":{\"creditGeneral\":5000000,\"creditMarket\":0,\"creditTransit\":0,\"creditCulture\":0,
+  \"debitGeneral\":2000000,\"debitMarket\":200000,\"debitTransit\":300000,\"debitCulture\":100000}}" >/dev/null
+curl -sf -X PUT -H "$auth" -H "$json" "$tax/cash-receipt" \
+  -d "{\"asOfDate\":\"$tax_year-06-30\",\"amounts\":{\"general\":500000,\"market\":100000,\"transit\":0,\"culture\":0}}" >/dev/null
+curl -sf -X PUT -H "$auth" -H "$json" "$tax/plan" -d '{
+  "general":{"creditFixed":500000,"debitFixed":300000,"flexible":1200000},
+  "market":{"creditFixed":0,"debitFixed":100000,"flexible":100000},
+  "transit":{"creditFixed":100000,"debitFixed":0,"flexible":0},
+  "culture":{"creditFixed":0,"debitFixed":0,"flexible":100000}}' >/dev/null
+echo "SEEDED group=$gid tax_year=$tax_year"
```

- [ ] **Step 2: 검증 지도**

`.claude/skills/verify/features/tax-inputs.md` 전체:

```markdown
# Tax deduction inputs

소득공제 › 입력자료 (`/tax/inputs`, `h1` `소득공제` on wide screens) holds one member's record for one tax year: basic info (expected salary, work months, child count), card statements per issuer (8 amounts = 4 categories × 신용카드/체크카드), one cash-receipt statement (4 amounts), the server's year totals table, and deleting the year record. The data is personal: the header group does not change it, and members without a group can use it. Every input or confirm dialog opens as a centered dialog at every width, including 375px.

## Sub-features

- `tax-entry` opens `/tax`, which redirects to `/tax/inputs` (the analysis rule arrives with PR 7). The sidebar shows `소득공제` with the indented sub-link `입력자료`; narrow screens use the bottom tab `소득공제`.
- `tax-year` uses the `귀속연도` select (last, this, next year in Korean time). The choice lives in memory only: reload or logout returns to this year.
- `tax-basic` shows `기본정보` with `[수정]` (or `[기본정보 입력]` on an empty year). `근로기간 확인 필요` appears when the months are not 1–12. `자녀등 수` appears only when the record's law has child tiers; its rules open from the `자녀등 수 도움말` button.
- `tax-cards` lists `신용·체크 자료` rows: issuer, `완료` or `미완료 · 빈 칸 n개`, `기준일 … · 합계 ₩ … · 메모`, and on the right `[빈 칸 0원으로 채우기]` (incomplete only), `[편집]`, `[삭제]`. Delete asks once. 50 rows per year at most.
- `tax-cash` shows `현금영수증 자료`: `[입력]` and `[4칸 0원으로 채우기]` before the first save, `[편집]` after. There is no delete.
- `tax-totals` shows `연도 합계표` from the server's 12 totals, the blank-cell and different-date warnings, and `—` when the year has no inputs. Narrow screens move the row total under the category name as `계 …`.
- `tax-delete-year` deletes the whole year after the user types the exact year in `확인을 위해 귀속연도 YYYY을 입력하세요`.
- `tax-mask` follows the amount mask: `수입` hides the salary, `지출` hides card totals and the totals table. Fields being edited never hide.

## How to get to it (user POV)

- Click `소득공제` in `navigation "주 메뉴"` (sidebar or bottom tab). On wide screens, `입력자료` under it opens the same page.

## Driving it with the built-in browser

Preconditions:

- Baseline seed. `seed.sh` printed `SEEDED group=… tax_year=YYYY`. `verify@example.test` is a service admin, the `YYYY` law is applied with child tiers, and the owner's `YYYY` record has salary ₩ 50,000,000, A카드 (₩ 9,600,000), B카드 (₩ 7,600,000), cash ₩ 600,000, all dated `YYYY-06-30`. `verify5@example.test` (그룹없음) has no group and no record.

- **Seeded record.** At `mobile` and `desktop`, open `소득공제`. The totals table reads 일반 14,000,000 / 2,000,000 / 500,000 and 합계 14,600,000 / 2,600,000 / 600,000 (17,800,000 on desktop). No warning shows. No page-level horizontal scroll at 375px and 320px (`resize_window` 320×700).
- **Centered dialogs.** At `mobile`, open `기본정보 수정`, `A카드 자료 편집`, `현금영수증 자료 편집`, `A카드 자료 삭제`, and `YYYY년 기록 삭제`. Each dialog is centered with space above and below; none slides up from the bottom. The 8-cell grid shows two columns (신용카드, 체크카드) per category with no horizontal scroll.
- **Blank vs 0.** Add a card `C카드` with only 일반 신용카드 filled. Its row reads `미완료 · 빈 칸 7개`, the totals card shows the blank warning, then `[빈 칸 0원으로 채우기]` on the row turns it into `완료`. Delete `C카드` (one confirmation) to restore.
- **Long name.** Add a card whose name is 40 characters. At 375px and 320px the name wraps on the left and `[편집] [삭제]` stay right-aligned on the row. Delete it afterwards.
- **Help.** In the 기본정보 dialog, tap `자녀등 수 도움말`, tap it again, tap outside, press Esc: the popover closes each time, focus returns to `?`, the dialog stays open, and the value does not change.
- **Different dates.** Edit B카드 기준일 to `YYYY-05-31`. The totals card warns `자료의 기준일이 서로 다릅니다(…)`. Restore `YYYY-06-30`.
- **No group.** Log out, log in as `verify5@example.test`, open `소득공제`, enter basic info, add one card, then switch nothing (there is no group) and reload: the same data shows. Then, as `verify@example.test`, change the header group and confirm the tax page shows the same numbers without reloading.
- **Delete year.** As `verify5@example.test`, open `YYYY년 기록 삭제`: `삭제` stays disabled for an empty value and for the previous year, enables on the exact year, and the page returns to `YYYY년 귀속 기록이 없습니다`. Reopen the dialog before confirming once to see the input start empty.
- **Mask.** Turn on the `수입` mask: the salary shows `₩ •••••` and totals stay visible. Turn on only `지출`: totals and card sums show `•••••`, the salary is visible. Turn masks off afterwards.

## Gotchas

- The seed year follows today's Korean date. The year select only offers last, this and next year; older records exist on the server but have no entry point.
- `rowVersion` values are opaque sequence numbers, not counters. A 409 or 404 on save shows `다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다.` with `[다시 불러오기]`, which closes the dialog and reloads the year.
- Card rows sum their own 8 cells for display; the totals table uses the server's 12 totals, and its row and column totals add those 12 cells.
- The page has no analysis yet. `/tax` always opens the inputs page until PR 7.
```

`git apply`:

```diff
diff --git a/.claude/skills/verify/SKILL.md b/.claude/skills/verify/SKILL.md
index a945143..2e6a6ac 100644
--- a/.claude/skills/verify/SKILL.md
+++ b/.claude/skills/verify/SKILL.md
@@ -13,14 +13,15 @@ The user often has their own dev stack running on 5432/8080/5173. Never drive or
 
 ```bash
 .claude/skills/verify/bin/up.sh      # prints "READY http://localhost:15173"; first run builds the API jar (several minutes)
-.claude/skills/verify/bin/seed.sh    # prints the import result JSON, then "SEEDED group=<id>"
+.claude/skills/verify/bin/seed.sh    # prints the import result JSON, then "SEEDED group=<id> tax_year=<YYYY>"
 ```
 
 `up.sh` refuses to start if any of the three ports is already in use. It starts a fresh Postgres container with no volume (`salad-verify-pg`), so every launch begins with an empty DB. Flyway migrates it when the API starts. Ready means `GET http://localhost:15173/api/actuator/health` returns `UP` through the Vite proxy. `seed.sh` only works on an empty DB: run it once per launch.
 
 What the seed creates:
-- Four accounts in `bin/env.sh`, sharing `SEED_PASSWORD`: verify@example.test / 검증러 (owner), verify2@example.test / 검증둘, verify3@example.test / 검증셋, verify4@example.test / 비공개러.
-- All join 검증그룹 through invitations. First three share ON, 비공개러 explicitly OFF (membership defaults ON).
+- Five accounts in `bin/env.sh`, sharing `SEED_PASSWORD`: verify@example.test / 검증러 (owner), verify2@example.test / 검증둘, verify3@example.test / 검증셋, verify4@example.test / 비공개러, and verify5@example.test / 그룹없음 (no group, no data).
+- The owner is a service admin (set by SQL). This year's tax law (Korean time) is applied with 2026 values, and the owner has a synthetic tax record for this year: salary 50,000,000, A카드·B카드, cash receipt, and a spending plan (the wireframe numbers).
+- The first four join 검증그룹 through invitations. First three share ON, 비공개러 explicitly OFF (membership defaults ON).
 - Previous 12 complete months, 45 expense majors × 24 minors, plus salary for each member. Monthly files keep each upload below the API's 92-day limit.
 - 식비 신규 starts two months ago; 재등장 returns last month after missing months 2–4; 환불초과 is negative net spending two months ago. Private member adds 문화 공연 ₩ 990,000 monthly, excluded from group totals.
 - `python3 -I .claude/skills/verify/bin/make_xlsx.py --expected` computes the relative-month reference in [features/seed-expected.json](features/seed-expected.json). Dashboard recipes use that reference.
@@ -74,7 +75,7 @@ This kills only the pids in `$TMPDIR/salad-verify/*.pid` and removes the `salad-
 |---|---|
 | `bin/env.sh` | Shared ports, paths, and seed account. Sourced by the other scripts. |
 | `bin/up.sh` | Fresh DB, then API jar, then Vite with `API_PROXY_TARGET`. Prints `READY`. |
-| `bin/seed.sh` | Signup, group, share on, upload of fake xlsx made by `make_xlsx.py`. |
+| `bin/seed.sh` | Signup, group, share on, upload of fake xlsx made by `make_xlsx.py`, service admin, tax law and a tax record. |
 | `bin/doctor.sh` | Read-only health checks. Exit code 0 means everything passed. |
 | `bin/down.sh` | Tears down what this run started. Keeps evidence. |
 | `bin/make_xlsx.py <out.xlsx>` | Writes a fake Banksalad export (sheet `가계부 내역`) for one selected month: `--member owner|second|third|private --back 1..12`. |
diff --git a/.claude/skills/verify/features/README.md b/.claude/skills/verify/features/README.md
index 0ab891e..e34ec31 100644
--- a/.claude/skills/verify/features/README.md
+++ b/.claude/skills/verify/features/README.md
@@ -33,3 +33,4 @@ Each feature file starts with an H1 title and one paragraph describing the user-
 - [Group dashboard](./dashboard.md): sub-routes for 대분류·소분류 × 분포·추이, month in the address, totals with per-member dialog, category donut and trend.
 - [Transactions](./transactions.md): my or group transaction list, search, detail, manual add.
 - [Groups](./groups.md): create, rename, invite link, members, bans.
+- [Tax deduction inputs](./tax-inputs.md): 소득공제 › 입력자료 — basic info, card and cash-receipt statements, year totals, delete year.
diff --git a/.claude/skills/verify/features/navigation.md b/.claude/skills/verify/features/navigation.md
index 98ae35f..11023d4 100644
--- a/.claude/skills/verify/features/navigation.md
+++ b/.claude/skills/verify/features/navigation.md
@@ -4,9 +4,9 @@ Every signed-in page shares one shell. Wide screens get a left sidebar and a hea
 
 ## Sub-features
 
-- `nav-sidebar` shows four sidebar links on wide screens: 홈, 대시보드, 거래 목록, 그룹 관리. Under 대시보드 sit indented sub-links `대분류` (`/dashboard/major`) and `소분류` (`/dashboard/minor`). Inside the dashboard they replace history and keep `?month=`.
-- `nav-tabs` shows four bottom tabs on narrow screens: 홈, 대시보드, 거래, 그룹. The tabs ignore the dashboard sub-links; the dashboard has its own `대시보드 메뉴` (see dashboard.md).
-- `nav-active` marks the current page link with `aria-current="page"`. Home matches `/` exactly. Other links also match sub-paths, so on `/dashboard/major` both `대시보드` and `대분류` are highlighted. Only `대분류` gets `aria-current="page"`; the parent gets `aria-current="true"`.
+- `nav-sidebar` shows five sidebar links on wide screens: 홈, 소득공제, 대시보드, 거래 목록, 그룹 관리. Under 소득공제 sits the indented sub-link `입력자료` (`/tax/inputs`). Under 대시보드 sit indented sub-links `대분류` (`/dashboard/major`) and `소분류` (`/dashboard/minor`). Inside the dashboard the dashboard sub-links replace history and keep `?month=`; the 소득공제 sub-link never takes `?month=`.
+- `nav-tabs` shows five bottom tabs on narrow screens: 홈, 소득공제, 대시보드, 거래, 그룹. The tabs ignore sub-links; the dashboard has its own `대시보드 메뉴` (see dashboard.md). 소득공제 has one sub-screen for now and no in-page tabs.
+- `nav-active` marks the current page link with `aria-current="page"`. Home matches `/` exactly. Other links also match sub-paths, so on `/dashboard/major` both `대시보드` and `대분류` are highlighted. Only `대분류` gets `aria-current="page"`; the parent gets `aria-current="true"`. `/tax/inputs` works the same way for `소득공제` and `입력자료`.
 - `nav-account` opens the account sheet with the nickname and logout (narrow screens).
 - `nav-group` uses the header `그룹` select to change the group that group-scoped pages show.
 
@@ -21,11 +21,11 @@ Preconditions:
 
 - Baseline state, logged in, seed group `검증그룹` selected.
 
-- **Wide links.** Use preset `desktop`, then reload. Run `find "주 메뉴"` and click each link. Each click changes the `h1` and moves `aria-current` to the clicked link. The link list reads 홈, 대시보드, 대분류, 소분류, 거래 목록, 그룹 관리.
-- **Narrow tabs.** Use preset `mobile`, then reload. The same nav holds 4 tab links with the short labels. The sidebar is gone from the accessibility tree.
+- **Wide links.** Use preset `desktop`, then reload. Run `find "주 메뉴"` and click each link. Each click changes the `h1` and moves `aria-current` to the clicked link. The link list reads 홈, 소득공제, 입력자료, 대시보드, 대분류, 소분류, 거래 목록, 그룹 관리. No `세법 관리` link shows for a member.
+- **Narrow tabs.** Use preset `mobile`, then reload. The same nav holds 5 tab links with the short labels. The sidebar is gone from the accessibility tree.
 - **Account sheet.** In `mobile`, click the button `계정`. A sheet titled `계정` shows `검증러` and a logout button.
 
 ## Gotchas
 
 - The layout is picked by a media query at render time, so resizing without a reload can leave the old layout up.
-- The tab bar splits its width evenly by the number of tabs (four now). Adding a tab is a design change: check that the labels still fit at 375px.
+- The tab bar splits its width evenly by the number of tabs (five since 소득공제). Check that `소득공제` and `대시보드` still fit at 320px and 375px.
```

- [ ] **Step 3: 확인** — 스크립트 문법과 실제 시드를 본다(실제 실행은 PR 마무리의 verify에서 한다).

Run: `bash -n .claude/skills/verify/bin/seed.sh && bash -n .claude/skills/verify/bin/doctor.sh`
Expected: 출력 없음. 이어서 `up.sh` → `seed.sh`가 `SEEDED group=… tax_year=YYYY`를 출력하고 `doctor.sh`가 0으로 끝나야 한다(계획 작성 때는 문법만 확인했다).

- [ ] **Step 4: 커밋(컨트롤러)**

```bash
git add .claude/skills/verify
git commit -m "chore(verify): 소득공제 시드와 입력자료 검증 지도" -m "Co-Authored-By: Codex (gpt-6-luna) <noreply@openai.com>"
```

### PR 5 마무리 (컨트롤러)

1. **웹 검증 4종** — `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`. 시간 의존 테스트가 흔들리면 해당 파일만 다시 돌린 결과를 함께 적는다.
2. **verify**(`.claude/skills/verify`, `features/tax-inputs.md`·`navigation.md`) — 375px(`mobile`)·320px(`resize_window` 320×700)·데스크톱에서:
   - 메뉴 진입: 사이드바 `소득공제`/`입력자료`, 하단 탭 5칸(320px에서 라벨이 한 줄), `/tax` → `/tax/inputs`.
   - 시드 기록의 기본정보·카드 2건·현금영수증·연도 합계표(일반 14,000,000 / 2,000,000 / 500,000, 합계 17,800,000). 페이지 가로 스크롤 없음(AC-23). 1100px 이상 2단, 그보다 좁으면 1단.
   - 창 5종(기본정보, 카드 추가·편집, 현금영수증, 카드 삭제, 연도 삭제)이 375px·320px에서 가운데 창이고 아래에서 올라오지 않음(AC-44). 8칸 입력 두 칸이 320px에서 읽히는지(금액이 칸 안에서 잘리지 않는지), 긴 내용이 창 안에서 스크롤되는지, 창 안에서 키보드를 띄웠을 때 입력란이 가려지지 않는지(브라우저 확인, 실기기는 따로).
   - 도움말 3종(`신용·체크 자료`, `공제대상액`, 창 안 `자녀등 수`): 누르기·다시 누르기·바깥 누르기·Esc·포커스 복귀, 창이 닫히지 않음, 값 불변.
   - 긴 카드사명(40자)·긴 메모: 이름이 왼쪽에서 줄바꿈하고 [편집] [삭제]가 행 오른쪽 끝에 남음. 글자 확대에서도.
   - 빈 칸과 0, 미완료 → [빈 칸 0원으로 채우기] → 완료, 기준일 불일치 경고, 금액 가림(수입·지출 각각).
   - 그룹 없는 `verify5`로 등록·조회, 소유자로 헤더 그룹을 바꿔도 같은 내용(AC-02). 연도 삭제(정확한 연도 입력, 다시 열면 비어 있음).
   - 빈 상태·로딩·오류(서버를 잠깐 멈추면 "입력자료를 불러오지 못했습니다"와 [다시 시도])·저장 중.
   - PR용 375px 이전(`main`: 하단 탭 4칸의 홈)·이후(하단 탭 5칸, 입력자료 화면, 가운데 창 하나) 캡처를 `pr-assets` 브랜치 `pr-<번호>/`에 올린다. 화면은 시드 합성값만 쓴다.
3. **브랜치 최종 리뷰 — Claude Opus 5.5 한 번**(`review-final`). 볼 항목:
   - 계약: `rowVersion`을 응답에서 받은 값 그대로 보내는지(계산·+1 없음), 연도·카드 `DELETE`에 `?rowVersion=`이 늘 붙는지, 입력 창이 연 시점의 버전을 잡는지, 409·404 두 흐름이 입력을 잃지 않는지.
   - 삭제: 연도 삭제 [삭제]가 정확한 귀속연도에서만 켜지는지, 지워지는 범위 문장, 카드 삭제는 확인 한 번, 현금영수증 삭제가 어디에도 없는지.
   - 개인정보·캐시: `['tax', …]` 키, 로그아웃 뒤 캐시 비움, 다른 회원 화면에 이전 값 없음, 브라우저 저장소에 금액 없음, `useGroups()`를 쓰지 않음.
   - 계산 복제 없음: 12칸 합계·빈 칸 수·`hasInputs`·`asOfDateMismatch`는 서버 값, 웹의 덧셈은 표시용 합계뿐("결정이 필요한 점" 2).
   - 공용 부품 변경 범위: `Dialog`/`ConfirmDialog`의 `centered`, `DateTimePicker`의 `granularity`가 기본값에서 기존 화면을 바꾸지 않는지, `HelpButton` 이동 뒤 그룹 화면 불변.
   - UI 표준: 정보 왼쪽·조작 오른쪽, 글자 토큰, 44px, 결제수단 명칭(신용카드·체크카드·현금영수증, "직불" 없음), "소비를 늘리라"는 문구 없음.
4. **반론 리뷰(Codex 템플릿 F)는 하지 않는다.** 이유: 소유권·삭제·동시 수정의 판단은 모두 서버(PR 3, 반론 리뷰 완료)에 있고, 이 PR은 그 API를 부르며 받은 `rowVersion`을 그대로 넘길 뿐 권한·소유권·삭제 범위를 정하지 않는다. 화면이 새로 만드는 위험(로그아웃 캐시, 브라우저 저장소, 그룹 전환 노출)은 Task 5.3 테스트로 고정했다. 위 3의 삭제·계약 항목을 Opus 최종 리뷰의 필수 항목으로 두어 대신한다. 리뷰 중 서버 동작을 바꿔야 하는 문제가 나오면 그때 반론 리뷰 대상으로 올린다.
5. **PR 본문** — 무엇: 메뉴 5칸·라우트·선택 연도(메모리), 입력자료 화면(기본정보·카드·현금영수증·합계표·연도 삭제), `Dialog`/`ConfirmDialog` `centered`, `HelpButton` 공용화, `DateTimePicker` 날짜 모드, verify 시드·지도, "계획 초안에서 달라진 점"과 "결정이 필요한 점"의 기본값, **분석·지출계획은 PR 7, 세법 관리 화면은 PR 6**이며 그 전까지 회원은 입력자료만 본다(알려진 제약 4). 확인: 웹 4종 결과와 흔들린 테스트, verify 375px·320px·데스크톱 결과와 이전·이후 캡처 표, 브라우저 확인과 실기기(iOS·Android 설치형 PWA) 미확인 구분. 리뷰: Task 리뷰(Sonnet 5.5) 6회와 최종 리뷰(Opus 5.5) 결과, 반론 리뷰를 하지 않은 이유. 참고: 이 계획, PRD, 와이어프레임. 맨 끝에 `## 소모값`(`python3 scripts/pr_usage.py`).

---

# PR 6 — 연도별 세법 관리 화면

> **에이전트 모델 배치(2026-11-21):** PR 5와 같다. 구현은 Codex(`codex-collab` 3장 표: 공용 부품·앱 셸처럼 설계 판단이 큰 Task는 `gpt-6-astra`, 일반 화면은 `gpt-6-sol`, 문서는 `gpt-6-luna`), Task 리뷰는 Claude Sonnet 5.5(`review-task`), 브랜치 최종 리뷰와 Task 상세 계획 작성은 Claude Opus 5.5(`review-final`·`controller`). 모든 Agent 호출은 `model`을 명시한다.

화면 PR이다(375px 이전·이후 캡처). 브랜치: `feat/tax-law-admin-web`(최신 `origin/main` `15b38dc`에서 만든 worktree). PR 제목 예: `feat(web): 연도별 세법 관리 화면`.

검증: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build` + verify 스킬(관리자 `verify@example.test`와 일반 회원 `verify2@example.test`). API는 바꾸지 않는다(PR 2의 세법 API와 `/me`만 부른다).

이 PR의 코드와 테스트는 계획을 쓸 때 저장소 밖 임시 복사본(`15b38dc` 기준)에서 Task 순서대로 실행해 확인했다(2026-11-21). Task마다 테스트만 먼저 넣어 실패를 보고(6.1: `AppRoutes.test.tsx`와 새 `TaxLawPage.test.tsx`가 `Failed to resolve import "../tax/law/TaxLawPage"`로 파일째 실패, 6.2: 새 12건 모두 실패) 구현을 넣은 뒤 통과를 봤고, 마지막에 `typecheck`·`lint`(새 경고 없음)·`build`와 전체 `vitest run --maxWorkers=4`(87파일 726건 통과)를 돌렸다. 아래 코드 블록을 Task 순서대로 넣으면 그 상태와 같아지는 것도 확인했다. 브라우저 화면은 띄워 보지 않았다(PR 마무리의 verify에서 본다).

경로 줄임: 코드 블록 위 줄에 `<경로>` 전체(새 파일) 또는 `git apply`(기존 파일 고침, 저장소 루트에서 실행)를 적었다. 줄 번호가 어긋나면 내용을 보고 손으로 넣는다.

## 웹 설계

- 라우트: `/tax/law`는 `TaxLawPage`(lazy). 다른 소득공제 화면처럼 `RequireAuth > GroupProvider > TaxYearProvider > AppLayout` 아래다.
- 메뉴: `MENU`의 소득공제 `children`에 `{ to: '/tax/law', label: '연도별 세법 관리', shortLabel: '세법 관리', adminOnly: true }`를 더한다. 사이드바(`AppLayout`)와 화면 안 탭은 `visibleChildren(item, me.serviceAdmin)`으로 거른다. 숨김은 편의이고 권한은 서버가 요청마다 판단한다(PR 2 `TaxAdminInterceptor`).
- `Me.serviceAdmin`: `/me`가 PR 2부터 내려 주는 값이다. 웹 타입에 더하고 메뉴·화면 진입 판단에만 쓴다. 로그인(세션 복원) 때 한 번 읽으므로 메뉴는 새로 고친 뒤 바뀐다.
- 좁은 화면 안 탭(`TaxTabs`, TAX-19): 820px 이하에서 보이는 하위 화면이 둘 이상일 때만 `nav "소득공제 메뉴"` 링크 묶음을 그린다. PR 6 시점에는 관리자만 `입력자료 | 세법 관리` 두 개이고 회원은 하위 화면이 하나라 그리지 않는다. PR 7이 "분석·지출계획"을 두 번째에 넣으면 회원 2개·관리자 3개가 된다. 모양은 대시보드 화면 안 메뉴(`DashboardMenu.module.css`)를 그대로 쓰고, 형제 화면 이동이라 `replace`다. 같은 첫 경로 안의 이동이라 포커스는 누른 링크에 남는다.
- 화면 머리: `TaxHeader`에 `title`·`note`를 더한다. 세법 화면은 넓은 화면 `h1`과 문서 제목이 "연도별 세법 관리"이고 아래 줄은 "모든 회원의 계산에 쓰는 기준 · 서비스 관리자 전용"이다(개인 자료가 아니다). 귀속연도 선택은 다른 소득공제 화면과 같은 선택 연도(올해·전년도·다음 해)를 쓴다. 좁은 화면 앱 머리 제목은 다른 소득공제 화면처럼 "소득공제"다.
- 권한 없음(TAX-06): `me.serviceAdmin`이 아니면 요청을 보내지 않고 권한 없음 화면("권한 없음", "이 화면은 서비스 관리자만 볼 수 있습니다.", [입력자료로 가기])을 보인다. 관리자로 들어왔는데 서버가 403을 주면(그 사이 권한 회수) 같은 화면이다.
- 쿼리 키: 버전 목록 `['tax', 'admin', 'law', year]`(그룹 범위 키가 아니고, 로그아웃 때 `queryClient.clear()`로 지워진다). 목록 응답이 버전 전체 값을 담으므로 `GET /{id}`는 쓰지 않는다. "현재 적용" 표시는 서버 규칙(가장 늦게 적용)을 다시 판단하지 않으려고 회원용 `taxKeys.currentLaw(year)`를 함께 읽는다.
- 선택 버전: 화면 상태(`selectedId`)이고 처음과 사라졌을 때(연도 변경·삭제)는 가장 큰 번호(목록 첫 행)다.
- 초안 편집: 연 시점(또는 마지막 저장)의 값과 `rowVersion`을 폼 상태로 잡아 `PUT`(전체 교체)한다. 목록이 다시 읽혀도 폼은 다시 열리지 않는다(입력을 잃지 않게 폼 `key`는 `id`와 [다시 불러오기] 횟수다). 저장 응답으로 목록 캐시의 그 버전만 바꾸고, 다음 저장은 응답의 `rowVersion`으로 보낸다. 글 칸은 앞뒤 공백을 지우고 빈 칸은 `null`로 보낸다.
- 검증·적용: 서버는 저장된 초안을 검사한다. 그래서 저장하지 않은 변경이 있으면 [검증]·[적용]을 끄고 아래 줄에 이유를 적는다. 검증 실패는 `필드 이름: 설명` 목록, 통과는 "검증 통과 — 적용할 수 있습니다."다. [적용]은 가운데 확인 창 한 번 뒤 `POST …/apply { rowVersion }`이고, 창에 "다른 초안은 초안으로 남습니다."를 적는다. 적용 400(`VALIDATION_FAILED`)은 창 안에 "[검증]으로 이유를 확인"을 안내한다. 적용하면 그 버전은 읽기 전용 보기로 바뀌고, 회원용 현재 세법·내 연도 기록 캐시를 무효화한다.
- 409·404: 저장은 입력을 남기고 "다른 곳에서 수정·적용되거나 삭제됐습니다. 저장하지 않았습니다."와 [다시 불러오기](목록을 다시 받고 폼을 새 값으로 연다). 입력이 없는 동작(적용·초안 삭제·검증)은 바로 목록을 다시 읽고 `actionError`("…새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.")를 보인다. PR 5의 두 흐름과 같다. 그 밖의 실패는 `errorMessage`와 "입력한 값은 그대로 있습니다."
- 적용본: 입력란 없는 읽기 전용 텍스트(`dl`)이고 삭제 버튼이 없다. 초안 삭제는 목록 행 오른쪽 [삭제] → 가운데 확인 창 한 번(`ConfirmDialog centered`) → `DELETE …?rowVersion=`(204면 목록을 다시 읽는다).
- 근거 URL: 읽기 전용 보기는 `http://`·`https://`로 시작할 때만 링크로 그린다(서버 검증은 적용 때만 하므로 초안 값을 믿지 않는다).
- 배치·글자: 화면 뿌리는 입력자료와 같은 `inputs.module.css`의 `.page`(15px·13px 토큰)·`.split`·`.actions`·`.facts`를 쓴다. 넓은 화면(1100px 이상)은 목록(1) | 상세(2) 2단, 그보다 좁으면 목록 → 상세. 버전 행은 행 전체가 선택 버튼이라 `.page section button`(14px)보다 구체적인 `.versions .version`으로 이름 15px·보조 13px를 지킨다. 초안 입력 묶음은 칸 최소 9rem 자동 열 수(320px에서 한 열, 넓은 상세 칸에서 여러 열)이고 기간 날짜는 한 줄에 하나다. `ui.card`는 세로 flex라 `.split`은 카드 안쪽 `div`에 둔다(PR 5 교훈).
- 화면은 `useGroups()`를 쓰지 않는다. 세법 값은 개인 금액이 아니어서 금액 가림을 따르지 않는다(`formatWon`).

## 계획 초안에서 달라진 점 (2026-11-21)

- `TaxTabs.tsx`를 PR 6에서 만든다. 관리자에게 하위 화면이 두 개가 되는 첫 PR이라 좁은 화면에서 세법 관리로 갈 길이 필요하다. PR 5 절의 "PR 7 Task 7.1이 둘을 새로 만든다"와 Task 7.1의 `TaxTabs.tsx`는 "Modify"로 읽는다(`TaxIndexRedirect.tsx`는 여전히 7.1이 만든다). `TaxTabs`는 `MENU`에서 하위 화면을 읽으므로 7.1은 `menu.ts`에 항목만 더하면 된다.
- 계획 초안의 테스트 대상 "회원에게 하위 메뉴 2개(PR 7 뒤)·관리자에게 +1"은 PR 6 시점에 회원 1개·관리자 2개다. AC-29의 2개·3개는 PR 7 마무리에서 확인한다.
- `Me.serviceAdmin`, `testMe.serviceAdmin`, `renderPage`의 `me` 옵션을 Task 6.1에 넣는다(PR 5 "달라진 점"에서 넘긴 것). `/me` 응답은 PR 2부터 이 값을 담고 있다(`MeController.MeResponse`).
- Files를 나눴다: 목록 `LawVersionList.tsx`, 읽기 전용 보기 `LawVersionFacts.tsx`(상세 머리 `LawDetailHeading` 포함), 스타일 `law.module.css`, 테스트 지원 `test/taxLawFixtures.tsx`. 초안 삭제는 폼이 아니라 목록 행에 있다(UI 표준 표 "버전 행: 초안만 [삭제]").
- 적용본은 "모든 입력이 꺼진" 폼이 아니라 읽기 전용 텍스트다. UI 표준의 "일반 멤버에게는 읽기 전용 텍스트"와 같은 방식이고, 꺼진 입력란은 대비가 낮아 읽기 어렵다. 기간 입력(`DateTimePicker`)에 끄기 선택지가 없어 공용 부품을 고치지 않아도 된다.
- 와이어프레임의 "귀속연도 목록" 카드(연도마다 요약) 대신 머리의 귀속연도 선택과 목록 머리 요약 한 줄(`현재 적용 v1 · 초안 2개` / `적용 버전 없음(회원 화면은 "세법 준비 중")`)을 쓴다. 연도 목록 API가 없고, 선택 연도가 다른 소득공제 화면과 같아야 해서다.
- Task 6.1 담당을 `gpt-6-sol`에서 `gpt-6-astra`로 바꿨다. 앱 셸(`AppLayout`·`menu.ts`)·`Me` 타입·테스트 공용 `renderPage`를 바꾸는 Task다.
- `docs/deploy.md` 13절의 "웹은 `/me`의 `serviceAdmin`으로 메뉴를 보인다(PR 5부터)"는 사실과 달라 Task 6.3에서 "PR 6부터"로 고친다.
- verify 시드는 바꾸지 않는다. PR 5 시드가 이미 소유자를 서비스 관리자로 지정하고 올해 귀속 v1을 적용한다. 초안은 verify 여정에서 화면으로 만든다.

## 결정이 필요한 점 (기본값으로 썼다)

1. **귀속연도 목록 카드를 두지 않는다**(위 "달라진 점"). 다른 선택: 연도 3개 카드와 연도별 요약(목록 요청 3번).
2. **검증·적용은 저장한 값으로 하고, 저장하지 않은 변경이 있으면 끈다**(이유를 화면에 적는다). 다른 선택: [검증]·[적용]이 먼저 저장한다(한 번에 되지만 누르지 않은 저장이 생긴다).
3. **저장의 409·404는 입력을 남기고 [다시 불러오기]**, 입력이 없는 적용·삭제·검증은 바로 다시 읽는다(PR 5 결정 3과 같다). 다른 선택: 저장도 바로 다시 읽는다(편집 중인 값을 잃는다).
4. **적용본은 읽기 전용 텍스트**(위 "달라진 점"). 다른 선택: 꺼진 입력란(`DateTimePicker`에 `isDisabled`를 더하는 공용 부품 변경).
5. **좁은 화면 앱 머리 제목은 "소득공제"를 유지**하고 화면 안 탭 "세법 관리"가 현재 화면을 표시한다. 넓은 화면 `h1`·사이드바·문서 제목은 "연도별 세법 관리"(TAX-19). 다른 선택: 좁은 화면 머리 제목을 하위 화면 이름으로 바꾼다(`AppLayout` 변경, 입력자료 화면 제목도 바뀐다).
6. **비율은 정수 입력이고 0~100 범위는 서버 검증이 본다.** 화면은 금액 칸만 `MoneyField`의 0 이상·상한 검사를 한다. 소수를 넣으면 칸을 벗어날 때 정수로 반올림해 보인다(알려진 제약 6: 정수 퍼센트).
7. **현재 적용 표시는 회원용 `current` 응답으로 정한다**(요청 1번 더, 서버 규칙과 어긋나지 않음). 다른 선택: 목록의 `appliedAt`으로 웹이 판단한다.
8. **작성·적용 시각은 서울 기준 `YYYY-MM-DD HH:mm`**(`lawTime`). 공용 `formatInstant`는 연도가 없고, 버전은 귀속연도와 다른 해에 만들 수 있다.
9. **`TaxTabs`는 대시보드 메뉴 CSS를 가져다 쓴다.** 다른 선택: 공용 부품으로 옮긴다(대시보드 코드 변경).
10. **반론 리뷰(Codex 템플릿 F)는 하지 않는다**(아래 마무리 4).

---

### Task 6.1: 관리자 메뉴·화면 안 탭·권한 없음 화면·버전 목록 (TAX-04, 06, 10, 11, 19, 67, 72, AC-29 일부)

**담당:** Codex `gpt-6-astra` / `medium` (`write`, 앱 셸·`Me` 타입·테스트 공용 부품), 태그 `impl-web-common`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Modify: `apps/web/src/auth/authApi.ts`, `apps/web/src/app/menu.ts`, `apps/web/src/app/AppLayout.tsx`, `apps/web/src/app/AppRoutes.tsx`, `apps/web/src/tax/TaxHeader.tsx`, `apps/web/src/tax/inputs/TaxInputsPage.tsx`, `apps/web/src/test/renderPage.tsx`
- Create: `apps/web/src/tax/TaxTabs.tsx`, `apps/web/src/tax/law/taxLawApi.ts`, `law.module.css`, `LawVersionFacts.tsx`, `LawVersionList.tsx`, `TaxLawPage.tsx`, `apps/web/src/test/taxLawFixtures.tsx`
- Test: `apps/web/src/tax/law/TaxLawPage.test.tsx`(새 파일), `apps/web/src/app/AppRoutes.test.tsx`(4건 추가)

**Interfaces:**
- Consumes: `GET /me`의 `serviceAdmin`(PR 2), `GET /tax/admin/law-versions?year=`(번호 내림차순 `VersionResponse[]`), `POST /tax/admin/law-versions {taxYear}`(201, 현재 적용 버전 값을 복사한 초안), `taxApi.currentLaw`·`taxKeys.currentLaw`(PR 5), `useAuth().me`, `useTaxYear()`, `inputs.module.css`의 `.page`·`.split`·`.actions`·`.rowInfo`·`.name`·`.list`·`.facts`·`.amount`·`.titleWithHelp`·`.empty`, `DashboardMenu.module.css`의 `.menu`·`.group`·`.link`.
- Produces: `Me.serviceAdmin: boolean`; `SubMenuItem`, `visibleChildren(item, serviceAdmin): SubMenuItem[]`, 하위 메뉴도 찾는 `menuLabel(to)`; `TaxTabs`(default); `TaxHeader({ title?, note? })`; `taxLawApi.list(year)`·`create(taxYear)`, `taxLawKeys.list(year)` = `['tax', 'admin', 'law', year]`, 타입 `LawValues`·`LawVersion`, `LAW_FIELDS`(`field`는 서버 검증 오류 이름과 같음), `lawTime(iso)`, `lawHistory(version)`; `LawDetailHeading({ version })`(`h2#law-detail-title`), `LawVersionFacts({ version })`; `LawVersionList({ year, versions, selectedId, onSelect })`; `TaxLawPage`(default). 테스트 지원: `renderPage(ui, { me })`, `testMe.serviceAdmin === false`, `adminMe`, `lawVersion()`(적용본 v1), `lawDraft()`, `serveLaw(versions, current = law2026)` → `{ list, current, years }`, `renderTaxLaw({ admin = true })`.

- [ ] **Step 1: 실패하는 테스트 작성** — 테스트 지원 파일, 화면 테스트, 앱 테스트. 값은 모두 합성값이다.

`git apply`:

```diff
diff --git a/apps/web/src/app/AppRoutes.test.tsx b/apps/web/src/app/AppRoutes.test.tsx
index b1c008a..cf176fa 100644
--- a/apps/web/src/app/AppRoutes.test.tsx
+++ b/apps/web/src/app/AppRoutes.test.tsx
@@ -10,10 +10,12 @@ import { AuthProvider } from '../auth/AuthProvider'
 import { mockViewport } from '../test/mockViewport'
 import { server } from '../test/server'
 import { serveTax, yearView } from '../test/taxFixtures'
+import { lawVersion, serveLaw } from '../test/taxLawFixtures'
 import { seoulYear } from '../tax/TaxYearProvider'
 import AppRoutes from './AppRoutes'
 
-const me = { userId: 1, email: 'me@test.com', nickname: '나' }
+const me = { userId: 1, email: 'me@test.com', nickname: '나', serviceAdmin: false }
+const admin = { ...me, serviceAdmin: true }
 
 function renderApp(path: string) {
   const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
@@ -38,10 +40,10 @@ const homeHandlers = [
   http.get('*/api/imports', () => HttpResponse.json([])),
 ]
 
-function signedIn(groups: unknown[]) {
+function signedIn(groups: unknown[], profile = me) {
   server.use(
     http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
-    http.get('*/api/me', () => HttpResponse.json(me)),
+    http.get('*/api/me', () => HttpResponse.json(profile)),
     http.get('*/api/groups', () => HttpResponse.json(groups)),
     ...homeHandlers,
   )
@@ -107,6 +109,33 @@ describe('AppRoutes', () => {
     expect(screen.queryByRole('link', { name: /세법 관리/ })).not.toBeInTheDocument()
   })
 
+  it('shows 연도별 세법 관리 third under 소득공제 to a service admin only and opens it', async () => {
+    mockViewport(false)
+    signedIn([], admin)
+    serveTax(null)
+    serveLaw([lawVersion()])
+    renderApp('/tax/inputs')
+    const user = userEvent.setup()
+
+    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
+    expect(within(nav).getAllByRole('link').map((l) => l.textContent))
+      .toEqual(['홈', '소득공제', '입력자료', '연도별 세법 관리', '대시보드', '대분류', '소분류', '거래 목록', '그룹 관리'])
+    await user.click(within(nav).getByRole('link', { name: '연도별 세법 관리' }))
+
+    expect(await screen.findByRole('heading', { level: 1, name: '연도별 세법 관리' })).toBeInTheDocument()
+    expect(within(nav).getByRole('link', { name: '연도별 세법 관리' })).toHaveAttribute('aria-current', 'page')
+    expect(within(nav).getByRole('link', { name: '소득공제' })).toHaveAttribute('aria-current', 'true')
+  })
+
+  it('shows the no-permission screen to a member who types the law address', async () => {
+    signedIn([])
+    const calls = serveLaw([lawVersion()])
+    renderApp('/tax/law')
+
+    expect(await screen.findByRole('heading', { name: '권한 없음' })).toBeInTheDocument()
+    expect(calls.list).toBe(0)
+  })
+
   it('does not carry the dashboard month into the tax sub-link', async () => {
     mockViewport(false)
     signedIn([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
@@ -527,6 +556,33 @@ describe('AppRoutes on a narrow screen', () => {
     expect(within(screen.getByRole('main')).queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
   })
 
+  it('gives a service admin in-page tabs 입력자료 · 세법 관리', async () => {
+    signedIn([], admin)
+    serveTax(null)
+    serveLaw([lawVersion()])
+    renderApp('/tax/inputs')
+    const user = userEvent.setup()
+
+    const tabs = await screen.findByRole('navigation', { name: '소득공제 메뉴' })
+    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['입력자료', '세법 관리'])
+    expect(within(tabs).getByRole('link', { name: '입력자료' })).toHaveAttribute('aria-current', 'page')
+    await user.click(within(tabs).getByRole('link', { name: '세법 관리' }))
+
+    expect(await screen.findByRole('region', { name: '2026년 버전' })).toBeInTheDocument()
+    expect(within(screen.getByRole('navigation', { name: '소득공제 메뉴' })).getByRole('link', { name: '세법 관리' }))
+      .toHaveAttribute('aria-current', 'page')
+    expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1 })).toHaveTextContent('소득공제')
+  })
+
+  it('shows no in-page tax tabs to a member', async () => {
+    signedIn([])
+    serveTax(null)
+    renderApp('/tax/inputs')
+
+    expect(await screen.findByRole('heading', { name: /귀속 기록이 없습니다/ })).toBeInTheDocument()
+    expect(screen.queryByRole('navigation', { name: '소득공제 메뉴' })).not.toBeInTheDocument()
+  })
+
   it('signs out from the account sheet', async () => {
     signedIn([])
     server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
diff --git a/apps/web/src/test/renderPage.tsx b/apps/web/src/test/renderPage.tsx
index d4a0619..eb77a2d 100644
--- a/apps/web/src/test/renderPage.tsx
+++ b/apps/web/src/test/renderPage.tsx
@@ -7,20 +7,21 @@ import { I18nProvider } from 'react-aria-components'
 import { MemoryRouter } from 'react-router'
 import RequireAuth from '../app/RequireAuth'
 import { AuthProvider } from '../auth/AuthProvider'
+import type { Me } from '../auth/authApi'
 import { DialogHistoryProvider } from '../common/DialogHistory'
 import ToastRegion from '../common/Toast'
 import { GroupProvider } from '../groups/GroupProvider'
 import { server } from './server'
 
-export const testMe = { userId: 1, email: 'me@test.com', nickname: '나' }
+export const testMe: Me = { userId: 1, email: 'me@test.com', nickname: '나', serviceAdmin: false }
 
-type Options = { groups?: unknown[]; path?: string }
+type Options = { groups?: unknown[]; path?: string; me?: Me }
 
 /** 로그인한 회원으로 화면 하나를 렌더한다. 화면이 쓰는 API 핸들러는 테스트에서 server.use로 더한다. */
-export function renderPage(ui: ReactElement, { groups = [], path = '/' }: Options = {}) {
+export function renderPage(ui: ReactElement, { groups = [], path = '/', me = testMe }: Options = {}) {
   server.use(
     http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'test-token' })),
-    http.get('*/api/me', () => HttpResponse.json(testMe)),
+    http.get('*/api/me', () => HttpResponse.json(me)),
     http.get('*/api/groups', () => HttpResponse.json(groups)),
   )
   const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
```

`apps/web/src/test/taxLawFixtures.tsx` (새 파일):

```tsx
import { http, HttpResponse } from 'msw'
import type { Me } from '../auth/authApi'
import TaxLawPage from '../tax/law/TaxLawPage'
import type { LawVersion } from '../tax/law/taxLawApi'
import type { CurrentLaw } from '../tax/taxApi'
import { TaxYearProvider } from '../tax/TaxYearProvider'
import { renderPage, testMe } from './renderPage'
import { server } from './server'
import { law2026, taxToday } from './taxFixtures'

// 세법 관리 화면 테스트용. 수치는 PRD 8.1절의 공개 법령 값, 닉네임·메모는 합성값이다.
export const adminMe: Me = { ...testMe, serviceAdmin: true }

/** 적용본 v1. 시각은 서울 기준 작성 2026-01-10 09:00, 적용 2026-01-15 10:00이다. */
export function lawVersion(overrides: Partial<LawVersion> = {}): LawVersion {
  return {
    id: 1, taxYear: 2026, versionNo: 1, status: 'APPLIED', algorithmVersion: 1,
    minSpendRatePct: 25, bracketBoundary: 70_000_000,
    rateCreditPct: 15, rateDebitCashPct: 30, rateCulturePct: 30, rateMarketPct: 40, rateTransitPct: 40,
    basicLimitLow: [3_000_000, 3_500_000, 4_000_000], basicLimitHigh: [2_500_000, 2_750_000, 3_000_000],
    extraLimitLow: 3_000_000, extraLimitHigh: 2_000_000, childTiersApply: true,
    basisLawName: '조세특례제한법', basisArticle: '제126조의2', basisUrl: 'https://www.law.go.kr/',
    periodStart: '2026-01-01', periodEnd: '2026-12-31', memo: '합성 메모',
    createdByNickname: '관리자가', appliedByNickname: '관리자나', createdAt: '2026-01-10T00:00:00Z', appliedAt: '2026-01-15T01:00:00Z',
    rowVersion: 11,
    ...overrides,
  }
}

/** 초안. 적용자·적용 시각이 없다. */
export function lawDraft(overrides: Partial<LawVersion> = {}): LawVersion {
  return lawVersion({ status: 'DRAFT', appliedByNickname: null, appliedAt: null, ...overrides })
}

const notFound = () => HttpResponse.json({ code: 'NOT_FOUND', message: 'not found' }, { status: 404 })

/** 관리자 버전 목록(요청한 연도의 것만)과 회원용 현재 적용 세법. 요청 횟수를 센다. */
export function serveLaw(versions: LawVersion[], current: CurrentLaw | null = law2026) {
  const calls = { list: 0, current: 0, years: [] as number[] }
  server.use(
    http.get('*/api/tax/admin/law-versions', ({ request }) => {
      calls.list++
      const year = Number(new URL(request.url).searchParams.get('year'))
      calls.years.push(year)
      return HttpResponse.json(versions.filter((version) => version.taxYear === year))
    }),
    http.get('*/api/tax/law-versions/current', () => {
      calls.current++
      return current ? HttpResponse.json(current) : notFound()
    }),
  )
  return calls
}

export function renderTaxLaw({ admin = true }: { admin?: boolean } = {}) {
  return renderPage(<TaxYearProvider today={taxToday}><TaxLawPage /></TaxYearProvider>, { me: admin ? adminMe : testMe, path: '/tax/law' })
}
```

`apps/web/src/tax/law/TaxLawPage.test.tsx` (새 파일):

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import { lawDraft, lawVersion, renderTaxLaw, serveLaw } from '../../test/taxLawFixtures'

const v1 = lawVersion()
const v2 = lawDraft({ id: 2, versionNo: 2, rowVersion: 21, createdByNickname: '관리자다', createdAt: '2026-11-05T05:00:00Z' })
const v3 = lawDraft({ id: 3, versionNo: 3, rowVersion: 31, createdByNickname: '관리자라', createdAt: '2026-11-10T00:30:00Z' })

const rows = (list: HTMLElement) => within(list).getAllByRole('listitem')
const versionButton = (list: HTMLElement, no: number) => within(list).getByRole('button', { name: new RegExp(`^v${no} · `) })

describe('TaxLawPage — 권한', () => {
  it('shows the no-permission screen to a member without asking the admin API', async () => {
    const calls = serveLaw([v1])
    renderTaxLaw({ admin: false })

    expect(await screen.findByRole('heading', { name: '권한 없음' })).toBeInTheDocument()
    expect(screen.getByText('이 화면은 서비스 관리자만 볼 수 있습니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '입력자료로 가기' })).toHaveAttribute('href', '/tax/inputs')
    expect(screen.queryByRole('button', { name: /귀속연도/ })).not.toBeInTheDocument()
    expect(calls.list).toBe(0)
  })

  it('shows the same screen when the server answers 403 (권한을 회수한 뒤)', async () => {
    server.use(http.get('*/api/tax/admin/law-versions', () => HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 })))
    renderTaxLaw()

    expect(await screen.findByRole('heading', { name: '권한 없음' })).toBeInTheDocument()
  })
})

describe('TaxLawPage — 버전 목록', () => {
  it('lists drafts and applied versions newest first with who and when, and marks the current one', async () => {
    serveLaw([v3, v2, v1])
    renderTaxLaw()

    expect(await screen.findByRole('heading', { level: 1, name: '연도별 세법 관리' })).toBeInTheDocument()
    expect(screen.queryByText('개인 자료 · 그룹과 무관')).not.toBeInTheDocument()
    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(await within(list).findByText('현재 적용 v1 · 초안 2개')).toBeInTheDocument()
    const [first, second, third] = rows(list)
    expect(first).toHaveTextContent('v3 · 초안')
    expect(first).toHaveTextContent('작성 관리자라 · 2026-11-10 09:30')
    expect(second).toHaveTextContent('v2 · 초안')
    expect(second).toHaveTextContent('작성 관리자다 · 2026-11-05 14:00')
    expect(third).toHaveTextContent('v1 · 현재 적용')
    expect(third).toHaveTextContent('적용 관리자나 · 2026-01-15 10:00')
    // 초안이 있어도 새 초안을 만들 수 있다(TAX-72).
    expect(within(list).getByRole('button', { name: '새 초안 만들기' })).toBeEnabled()
  })

  it('opens the newest version first and shows an applied version as read-only text', async () => {
    serveLaw([v3, v2, v1])
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(versionButton(list, 3)).toHaveAttribute('aria-current', 'true')
    await user.click(versionButton(list, 1))

    expect(versionButton(list, 1)).toHaveAttribute('aria-current', 'true')
    const detail = screen.getByRole('region', { name: /2026년 귀속 v1/ })
    expect(detail).toHaveTextContent('적용된 버전은 고칠 수 없습니다. 바꾸려면 새 초안을 만듭니다.')
    expect(detail).toHaveTextContent('계산 알고리즘 버전 1 (고정)')
    expect(detail).toHaveTextContent('작성 관리자가 · 2026-01-10 09:00 · 적용 관리자나 · 2026-01-15 10:00')
    const term = (label: string) => within(detail).getByText(label, { selector: 'dt' }).nextElementSibling
    expect(term('신용카드 공제율')).toHaveTextContent('15%')
    expect(term('급여구간 경계 금액')).toHaveTextContent('₩ 70,000,000')
    expect(term('기본한도 · 경계 초과 · 자녀등 1명')).toHaveTextContent('₩ 2,750,000')
    expect(term('추가한도 상한 · 경계 이하')).toHaveTextContent('₩ 3,000,000')
    expect(within(detail).getByRole('link', { name: 'https://www.law.go.kr/' })).toHaveAttribute('href', 'https://www.law.go.kr/')
    expect(term('메모')).toHaveTextContent('합성 메모')
    expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: 'v1 초안 삭제' })).not.toBeInTheDocument()
  })

  it('never turns a non-http basis address into a link', async () => {
    serveLaw([lawVersion({ basisUrl: 'javascript:alert(1)', memo: null })])
    renderTaxLaw()

    const detail = await screen.findByRole('region', { name: /2026년 귀속 v1/ })
    expect(within(detail).queryByRole('link')).not.toBeInTheDocument()
    expect(detail).toHaveTextContent('javascript:alert(1)')
    expect(within(detail).getByText('메모', { selector: 'dt' }).nextElementSibling).toHaveTextContent('—')
  })

  it('creates a new draft even when drafts exist and selects it', async () => {
    serveLaw([v3, v2, v1])
    let body: unknown
    server.use(http.post('*/api/tax/admin/law-versions', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(lawDraft({ id: 4, versionNo: 4, rowVersion: 41, createdByNickname: '관리자마' }), { status: 201 })
    }))
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    await user.click(within(list).getByRole('button', { name: '새 초안 만들기' }))

    await waitFor(() => expect(rows(list)).toHaveLength(4))
    expect(body).toEqual({ taxYear: 2026 })
    expect(rows(list)[0]).toHaveTextContent('v4 · 초안')
    expect(versionButton(list, 4)).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('region', { name: /2026년 귀속 v4/ })).toBeInTheDocument()
    expect(within(list).getByText('현재 적용 v1 · 초안 3개')).toBeInTheDocument()
  })

  it('shows an empty year that has no applied law yet', async () => {
    serveLaw([], null)
    renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(within(list).getByText('2026년 귀속 세법 버전이 없습니다. [새 초안 만들기]로 시작합니다.')).toBeInTheDocument()
    expect(await within(list).findByText('적용 버전 없음(회원 화면은 "세법 준비 중") · 초안 0개')).toBeInTheDocument()
  })

  it('reads the versions of the year picked in the header', async () => {
    const calls = serveLaw([v1, lawDraft({ id: 9, taxYear: 2027, versionNo: 1 })])
    const { user } = renderTaxLaw()

    await screen.findByRole('region', { name: '2026년 버전' })
    await user.click(screen.getByRole('button', { name: /귀속연도/ }))
    await user.click(screen.getByRole('option', { name: '2027년' }))

    const list = await screen.findByRole('region', { name: '2027년 버전' })
    expect(within(list).getByText(/^v1 · 초안/)).toBeInTheDocument()
    expect(calls.years).toEqual([2026, 2027])
  })

  it('shows a load error with retry', async () => {
    let fail = true
    serveLaw([v1])
    server.use(http.get('*/api/tax/admin/law-versions', () => (fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json([v1]))))
    const { user } = renderTaxLaw()

    expect(await screen.findByRole('alert')).toHaveTextContent('세법 버전을 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('region', { name: '2026년 버전' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/app/AppRoutes.test.tsx src/app/BottomTabBar.test.tsx src/tax`
Expected: `src/app/AppRoutes.test.tsx`·`src/tax/law/TaxLawPage.test.tsx`는 `Failed to resolve import "../tax/law/TaxLawPage" from "src/test/taxLawFixtures.tsx"`로 파일째 FAIL. 나머지 7파일 53건 PASS.

- [ ] **Step 3: `Me`·메뉴·사이드바·라우트·화면 머리**

`git apply`:

```diff
diff --git a/apps/web/src/app/AppLayout.tsx b/apps/web/src/app/AppLayout.tsx
index 74f3cc6..81740ef 100644
--- a/apps/web/src/app/AppLayout.tsx
+++ b/apps/web/src/app/AppLayout.tsx
@@ -16,7 +16,7 @@ import BottomSheet from '../common/BottomSheet'
 import { Radio, RadioGroup } from 'react-aria-components'
 import { Indicator } from '../common/SelectionIndicator'
 import optionStyles from '../common/OptionButton.module.css'
-import { MENU } from './menu'
+import { MENU, visibleChildren } from './menu'
 
 const firstSegment = (pathname: string) => pathname.split('/')[1] ?? ''
 
@@ -89,7 +89,7 @@ export default function AppLayout() {
                 className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
                 <Icon name={item.icon} />{item.label}
               </NavLink>
-              {item.children?.map((child) => (
+              {visibleChildren(item, me?.serviceAdmin ?? false).map((child) => (
                 <NavLink key={child.to} to={inDashboard && item.to === '/dashboard' ? child.to + location.search : child.to}
                   replace={inDashboard && item.to === '/dashboard'}
                   className={({ isActive }) => `${styles.link} ${styles.subLink}${isActive ? ` ${styles.active}` : ''}`}>
diff --git a/apps/web/src/app/AppRoutes.tsx b/apps/web/src/app/AppRoutes.tsx
index c06bc31..577bf2e 100644
--- a/apps/web/src/app/AppRoutes.tsx
+++ b/apps/web/src/app/AppRoutes.tsx
@@ -16,6 +16,7 @@ const DashboardPage = lazy(() => import('../dashboard/DashboardPage'))
 const TransactionsPage = lazy(() => import('../transactions/TransactionsPage'))
 const GroupsPage = lazy(() => import('../groups/GroupsPage'))
 const TaxInputsPage = lazy(() => import('../tax/inputs/TaxInputsPage'))
+const TaxLawPage = lazy(() => import('../tax/law/TaxLawPage'))
 
 /** 옛 업로드 주소. 홈의 월별 등록 현황이 ?month=를 받아 그 달 창을 연다. */
 function UploadRedirect() {
@@ -35,6 +36,7 @@ export default function AppRoutes() {
             {/* PR 7에서 TAX-68(자료가 있으면 분석) 규칙으로 바꾼다. */}
             <Route path="tax" element={<Navigate to="/tax/inputs" replace />} />
             <Route path="tax/inputs" element={<TaxInputsPage />} />
+            <Route path="tax/law" element={<TaxLawPage />} />
             <Route path="dashboard/:level?/:view?" element={<DashboardPage />} />
             <Route path="transactions" element={<TransactionsPage />} />
             <Route path="upload" element={<UploadRedirect />} />
diff --git a/apps/web/src/app/menu.ts b/apps/web/src/app/menu.ts
index 2f78e63..4859c76 100644
--- a/apps/web/src/app/menu.ts
+++ b/apps/web/src/app/menu.ts
@@ -1,25 +1,36 @@
 import type { IconName } from '../common/Icon'
 
+/** shortLabel은 좁은 화면의 화면 안 탭 라벨이다(없으면 label). adminOnly는 서비스 관리자에게만 보인다. */
+export type SubMenuItem = { to: string; label: string; shortLabel?: string; adminOnly?: boolean }
+
 export type MenuItem = {
   to: string; label: string; shortLabel: string; icon: IconName; end: boolean
   // 사이드바에서만 들여 써서 그린다. 하단 탭은 무시한다.
-  children?: { to: string; label: string }[]
+  children?: SubMenuItem[]
 }
 
 // 사이드바는 label, 좁은 화면의 하단 탭은 shortLabel을 쓴다.
 export const MENU: MenuItem[] = [
   { to: '/', label: '홈', shortLabel: '홈', icon: 'home', end: true },
   { to: '/tax', label: '소득공제', shortLabel: '소득공제', icon: 'calculator', end: false,
-    children: [{ to: '/tax/inputs', label: '입력자료' }] },
+    children: [
+      { to: '/tax/inputs', label: '입력자료' },
+      { to: '/tax/law', label: '연도별 세법 관리', shortLabel: '세법 관리', adminOnly: true },
+    ] },
   { to: '/dashboard', label: '대시보드', shortLabel: '대시보드', icon: 'dashboard', end: false,
     children: [{ to: '/dashboard/major', label: '대분류' }, { to: '/dashboard/minor', label: '소분류' }] },
   { to: '/transactions', label: '거래 목록', shortLabel: '거래', icon: 'receipt', end: false },
   { to: '/groups', label: '그룹 관리', shortLabel: '그룹', icon: 'users', end: false },
 ]
 
-/** 화면 제목은 메뉴 이름과 같게 둔다. */
+/** 보이는 하위 메뉴. 관리자 전용 메뉴를 숨기는 것은 편의이고 권한은 서버가 판단한다(TAX-06). */
+export function visibleChildren(item: MenuItem, serviceAdmin: boolean): SubMenuItem[] {
+  return (item.children ?? []).filter((child) => serviceAdmin || !child.adminOnly)
+}
+
+/** 화면 제목은 메뉴 이름과 같게 둔다. 하위 메뉴도 찾는다. */
 export function menuLabel(to: string): string {
-  const item = MENU.find((m) => m.to === to)
+  const item = MENU.flatMap((m) => [m, ...(m.children ?? [])]).find((m) => m.to === to)
   if (!item) throw new Error(`메뉴에 없는 경로: ${to}`)
   return item.label
 }
diff --git a/apps/web/src/auth/authApi.ts b/apps/web/src/auth/authApi.ts
index 9bd1dca..74ef8e4 100644
--- a/apps/web/src/auth/authApi.ts
+++ b/apps/web/src/auth/authApi.ts
@@ -1,6 +1,7 @@
 import { apiFetch } from '../api/client'
 
-export type Me = { userId: number; email: string; nickname: string }
+/** serviceAdmin은 메뉴를 보일지 정하는 데만 쓴다. 세법 관리 권한은 서버가 요청마다 DB로 확인한다. */
+export type Me = { userId: number; email: string; nickname: string; serviceAdmin: boolean }
 
 export const authApi = {
   login: (email: string, password: string) =>
diff --git a/apps/web/src/tax/TaxHeader.tsx b/apps/web/src/tax/TaxHeader.tsx
index 5271b1b..8159193 100644
--- a/apps/web/src/tax/TaxHeader.tsx
+++ b/apps/web/src/tax/TaxHeader.tsx
@@ -4,16 +4,18 @@ import Select from '../common/Select'
 import ui from '../common/ui.module.css'
 import { useTaxYear } from './TaxYearProvider'
 
-/** 소득공제 화면 머리: 제목(넓은 화면), 오른쪽 귀속연도 선택, 개인 자료 표시(TAX-13). */
-export default function TaxHeader() {
+type Props = { title?: string; note?: string }
+
+/** 소득공제 화면 머리: 제목(넓은 화면), 오른쪽 귀속연도 선택, 아래 한 줄 안내(기본은 개인 자료 표시, TAX-13). */
+export default function TaxHeader({ title = menuLabel('/tax'), note = '개인 자료 · 그룹과 무관' }: Props) {
   const { year, setYear, choices } = useTaxYear()
   return (
     <>
-      <PageHeader title={menuLabel('/tax')} action={
+      <PageHeader title={title} action={
         <Select label="귀속연도" items={choices.map((y) => ({ id: y, label: `${y}년` }))}
           selectedKey={year} onSelectionChange={(key) => { if (key != null) setYear(Number(key)) }} />
       } />
-      <p className={ui.muted}>개인 자료 · 그룹과 무관</p>
+      <p className={ui.muted}>{note}</p>
     </>
   )
 }
diff --git a/apps/web/src/tax/inputs/TaxInputsPage.tsx b/apps/web/src/tax/inputs/TaxInputsPage.tsx
index a9c7c0e..9fb9f80 100644
--- a/apps/web/src/tax/inputs/TaxInputsPage.tsx
+++ b/apps/web/src/tax/inputs/TaxInputsPage.tsx
@@ -6,6 +6,7 @@ import Skeleton, { SkeletonRegion } from '../../common/Skeleton'
 import ui from '../../common/ui.module.css'
 import { usePageTitle } from '../../common/usePageTitle'
 import TaxHeader from '../TaxHeader'
+import TaxTabs from '../TaxTabs'
 import { useTaxYear } from '../TaxYearProvider'
 import { taxApi, taxKeys, useTaxYearView, type TaxYearView } from '../taxApi'
 import BasicInfoDialog from './BasicInfoDialog'
@@ -33,6 +34,7 @@ export default function TaxInputsPage() {
   return (
     <div className={styles.page}>
       <TaxHeader />
+      <TaxTabs />
       {record.isPending && (
         <SkeletonRegion label="입력자료 불러오는 중"><Skeleton height={160} radius="var(--radius-md)" /></SkeletonRegion>
       )}
```

- [ ] **Step 4: 화면 안 탭**

`apps/web/src/tax/TaxTabs.tsx` (새 파일):

```tsx
import { NavLink } from 'react-router'
import { MENU, visibleChildren } from '../app/menu'
import { useAuth } from '../auth/AuthProvider'
import { useMediaQuery } from '../common/useMediaQuery'
// 대시보드 화면 안 메뉴와 같은 모양을 쓴다.
import styles from '../dashboard/DashboardMenu.module.css'

const TAX = MENU.find((item) => item.to === '/tax')!

/**
 * 좁은 화면의 소득공제 하위 화면 이동(TAX-19). 사이드바가 없는 폭에서, 보이는 하위 화면이 둘 이상일 때만 그린다.
 * 화면을 바꾸는 형제 링크이므로 대시보드 메뉴처럼 replace로 이동한다.
 */
export default function TaxTabs() {
  const { me } = useAuth()
  const narrow = useMediaQuery('(max-width: 820px)')
  const links = visibleChildren(TAX, me?.serviceAdmin ?? false)
  if (!narrow || links.length < 2) return null
  return (
    <nav aria-label="소득공제 메뉴" className={styles.menu}>
      <div className={styles.group}>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} replace className={styles.link}>{link.shortLabel ?? link.label}</NavLink>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 5: API 모듈과 스타일**

`apps/web/src/tax/law/taxLawApi.ts` (새 파일):

```ts
import { apiFetch } from '../../api/client'

// PR 2 응답(TaxLawDtos.VersionResponse)과 같은 모양. 초안의 빈 칸은 null이다.
// rowVersion은 서버가 주는 불투명한 값이다. 받은 값을 그대로 돌려보내고 계산하지 않는다.
export type LawValues = {
  minSpendRatePct: number | null; bracketBoundary: number | null
  rateCreditPct: number | null; rateDebitCashPct: number | null; rateCulturePct: number | null
  rateMarketPct: number | null; rateTransitPct: number | null
  /** 자녀등 0명 / 1명 / 2명 이상 순서의 3칸. low는 급여구간 경계 이하, high는 초과. */
  basicLimitLow: (number | null)[]; basicLimitHigh: (number | null)[]
  extraLimitLow: number | null; extraLimitHigh: number | null
  basisLawName: string | null; basisArticle: string | null; basisUrl: string | null
  periodStart: string | null; periodEnd: string | null; memo: string | null
}
export type LawVersion = LawValues & {
  id: number; taxYear: number; versionNo: number; status: 'DRAFT' | 'APPLIED'; algorithmVersion: number; childTiersApply: boolean
  createdByNickname: string | null; appliedByNickname: string | null; createdAt: string; appliedAt: string | null; rowVersion: number
}

const BASE = '/tax/admin/law-versions'

export const taxLawApi = {
  list: (year: number) => apiFetch<LawVersion[]>(`${BASE}?year=${year}`),
  create: (taxYear: number) => apiFetch<LawVersion>(BASE, { method: 'POST', json: { taxYear } }),
}

/** 관리자 세법 목록 키. 머리말 `tax`라 그룹 범위 키가 아니고, 로그아웃 때 queryClient.clear()로 지워진다. */
export const taxLawKeys = {
  list: (year: number) => ['tax', 'admin', 'law', year] as const,
}

type LawField = { field: string; label: string; kind: 'pct' | 'won' | 'text' | 'url'; get: (v: LawValues) => number | string | null }

const TIERS = ['0명', '1명', '2명 이상']
const tiers = (key: 'basicLimitLow' | 'basicLimitHigh', side: string): LawField[] =>
  TIERS.map((tier, i) => ({ field: `${key}[${i}]`, label: `기본한도 · 경계 ${side} · 자녀등 ${tier}`, kind: 'won', get: (v) => v[key][i] }))

/** 화면에 보이는 설정값 순서와 이름. field는 서버 검증 오류(FieldError.field)의 이름과 같다. */
export const LAW_FIELDS: LawField[] = [
  { field: 'minSpendRatePct', label: '최저사용금액 비율', kind: 'pct', get: (v) => v.minSpendRatePct },
  { field: 'rateCreditPct', label: '신용카드 공제율', kind: 'pct', get: (v) => v.rateCreditPct },
  { field: 'rateDebitCashPct', label: '체크카드·현금영수증 공제율', kind: 'pct', get: (v) => v.rateDebitCashPct },
  { field: 'rateCulturePct', label: '문화체육 공제율', kind: 'pct', get: (v) => v.rateCulturePct },
  { field: 'rateMarketPct', label: '전통시장 공제율', kind: 'pct', get: (v) => v.rateMarketPct },
  { field: 'rateTransitPct', label: '대중교통 공제율', kind: 'pct', get: (v) => v.rateTransitPct },
  { field: 'bracketBoundary', label: '급여구간 경계 금액', kind: 'won', get: (v) => v.bracketBoundary },
  ...tiers('basicLimitLow', '이하'),
  ...tiers('basicLimitHigh', '초과'),
  { field: 'extraLimitLow', label: '추가한도 상한 · 경계 이하', kind: 'won', get: (v) => v.extraLimitLow },
  { field: 'extraLimitHigh', label: '추가한도 상한 · 경계 초과', kind: 'won', get: (v) => v.extraLimitHigh },
  { field: 'basisLawName', label: '법령명', kind: 'text', get: (v) => v.basisLawName },
  { field: 'basisArticle', label: '조문', kind: 'text', get: (v) => v.basisArticle },
  { field: 'basisUrl', label: '근거 URL', kind: 'url', get: (v) => v.basisUrl },
  { field: 'periodStart', label: '적용 대상 기간 시작', kind: 'text', get: (v) => v.periodStart },
  { field: 'periodEnd', label: '적용 대상 기간 끝', kind: 'text', get: (v) => v.periodEnd },
  { field: 'memo', label: '메모', kind: 'text', get: (v) => v.memo },
]

const seoulTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** 작성·적용 시각(오프셋 포함 ISO) → 서울 시간 `YYYY-MM-DD HH:mm`. 귀속연도와 다른 해에 만든 버전도 있어 연도를 남긴다. */
export function lawTime(iso: string): string {
  return seoulTime.format(new Date(iso))
}

/** 버전의 작성·적용 기록(TAX-67). 작성자·적용자 계정이 없어지면(FK `ON DELETE SET NULL`) 닉네임 자리에 `—`. */
export function lawHistory(v: LawVersion): string {
  const created = `작성 ${v.createdByNickname ?? '—'} · ${lawTime(v.createdAt)}`
  return v.appliedAt ? `${created} · 적용 ${v.appliedByNickname ?? '—'} · ${lawTime(v.appliedAt)}` : created
}
```

`apps/web/src/tax/law/law.module.css` (새 파일):

```css
/*
 * 연도별 세법 관리 화면. 화면 뿌리 글자 토큰·.split·.facts는 입력자료의 inputs.module.css를 같이 쓴다.
 * 넓은 화면(1100px 이상)은 버전 목록(1) | 상세(2) 2단, 그보다 좁으면 목록 → 상세 순으로 쌓는다.
 */
.columns { display: grid; gap: var(--space-3); align-items: start; min-width: 0; }
@media (min-width: 1100px) {
  .columns { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
}

/* 버전 행 전체가 선택 버튼이다. `.page section button`(14px)보다 구체적으로 써서 이름 15px·보조 13px를 지킨다. */
.versions .version {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 44px; padding: var(--space-1) var(--space-2);
  border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--ink);
  font-size: var(--text-base); text-align: left; cursor: pointer;
}
.versions .version[aria-current='true'] { border-color: var(--brand); background: var(--surface-100); }
.versions .version:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
```

- [ ] **Step 6: 읽기 전용 보기·목록·화면**

`apps/web/src/tax/law/LawVersionFacts.tsx` (새 파일):

```tsx
import { Fragment } from 'react'
import { formatWon } from '../../common/format'
import HelpButton from '../../common/HelpButton'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import { LAW_FIELDS, lawHistory, type LawVersion } from './taxLawApi'

/** 상세 머리: 귀속연도·번호·상태, 고정된 계산 알고리즘 버전(TAX-62), 작성·적용 기록(TAX-67). section의 이름이 된다. */
export function LawDetailHeading({ version }: { version: LawVersion }) {
  return (
    <div className={inputs.rowInfo}>
      <div className={inputs.titleWithHelp}>
        <h2 id="law-detail-title">{version.taxYear}년 귀속 v{version.versionNo} · {version.status === 'DRAFT' ? '초안' : '적용 · 읽기 전용'}</h2>
        <HelpButton title="세법 수치">
          총급여가 급여구간 경계 금액 이하이면 "경계 이하", 넘으면 "경계 초과"의 기본한도와 추가한도 상한을 씁니다. 추가한도 상한은 기본한도를 넘은 전통시장·대중교통·문화체육 공제액을 더 인정하는 최대 금액입니다. 문화체육 공제율은 경계 이하에만 적용됩니다(계산 알고리즘에 고정). 자녀등 조건이 없는 연도는 세 단계에 같은 값을 넣습니다.
        </HelpButton>
      </div>
      <p className={ui.muted}>계산 알고리즘 버전 {version.algorithmVersion} (고정)</p>
      <p className={ui.muted}>{lawHistory(version)}</p>
    </div>
  )
}

function show(kind: (typeof LAW_FIELDS)[number]['kind'], value: number | string | null) {
  if (value === null || value === '') return '—'
  if (kind === 'pct') return `${value}%`
  if (kind === 'won') return formatWon(Number(value))
  // http(s)만 링크로 그린다. 초안이나 손으로 고친 값에 javascript: 같은 주소가 있어도 링크가 되지 않는다.
  if (kind === 'url' && /^https?:\/\//i.test(String(value))) return <a href={String(value)} target="_blank" rel="noreferrer">{value}</a>
  return value
}

/** 버전을 글로만 보인다. 적용본은 고칠 수 없으므로 입력란 없이 읽기 전용 텍스트다(UI 표준: 고칠 수 없는 값은 읽기 전용 텍스트). */
export default function LawVersionFacts({ version }: { version: LawVersion }) {
  return (
    <section aria-labelledby="law-detail-title" className={ui.card}>
      <LawDetailHeading version={version} />
      {version.status === 'APPLIED' && <p className={ui.status}>적용된 버전은 고칠 수 없습니다. 바꾸려면 새 초안을 만듭니다.</p>}
      <dl className={inputs.facts}>
        {LAW_FIELDS.map((f) => (
          <Fragment key={f.field}>
            <dt>{f.label}</dt>
            <dd className={f.kind === 'won' ? inputs.amount : undefined}>{show(f.kind, f.get(version))}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  )
}
```

`apps/web/src/tax/law/LawVersionList.tsx` (새 파일):

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../common/errorMessage'
import Icon from '../../common/Icon'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import { taxApi, taxKeys } from '../taxApi'
import { lawTime, taxLawApi, taxLawKeys, type LawVersion } from './taxLawApi'
import styles from './law.module.css'

type Props = { year: number; versions: LawVersion[]; selectedId: number | undefined; onSelect: (id: number) => void }

/** 한 귀속연도의 버전 목록(번호 내림차순, 서버 순서 그대로). 초안이 있어도 새 초안을 만들 수 있다(TAX-72). */
export default function LawVersionList({ year, versions, selectedId, onSelect }: Props) {
  const client = useQueryClient()
  // 현재 적용 버전은 서버 규칙(가장 늦게 적용한 것)을 따른다. 화면에서 다시 판단하지 않는다.
  const current = useQuery({ queryKey: taxKeys.currentLaw(year), queryFn: () => taxApi.currentLaw(year) })
  const create = useMutation({
    mutationFn: () => taxLawApi.create(year),
    onSuccess: (created) => {
      client.setQueryData<LawVersion[]>(taxLawKeys.list(year), (old) => [created, ...(old ?? [])])
      onSelect(created.id)
    },
  })
  const drafts = versions.filter((v) => v.status === 'DRAFT').length
  const applied = current.isSuccess ? (current.data ? `현재 적용 v${current.data.versionNo}` : '적용 버전 없음(회원 화면은 "세법 준비 중")') : null
  return (
    <section aria-labelledby="law-versions-title" className={ui.card}>
      <div className={inputs.split}>
        <div className={inputs.rowInfo}>
          <h2 id="law-versions-title">{year}년 버전</h2>
          <p className={ui.muted}>{[applied, `초안 ${drafts}개`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className={inputs.actions}>
          <button type="button" className={ui.button} disabled={create.isPending} onClick={() => create.mutate()}>
            <Icon name="plus" size={18} />새 초안 만들기
          </button>
        </div>
      </div>
      {create.error && <p role="alert" className={ui.alert}>{errorMessage(create.error)}</p>}
      {versions.length === 0 ? (
        <p className={ui.status}>{year}년 귀속 세법 버전이 없습니다. [새 초안 만들기]로 시작합니다.</p>
      ) : (
        <ul className={`${inputs.list} ${styles.versions}`}>
          {versions.map((v) => (
            <li key={v.id} className={inputs.split}>
              <button type="button" className={styles.version} aria-current={v.id === selectedId ? 'true' : undefined} onClick={() => onSelect(v.id)}>
                <span className={inputs.name}>v{v.versionNo} · {v.status === 'DRAFT' ? '초안' : v.id === current.data?.id ? '현재 적용' : '적용'}</span>
                <span className={ui.muted}>
                  {v.appliedAt ? `적용 ${v.appliedByNickname ?? '—'} · ${lawTime(v.appliedAt)}` : `작성 ${v.createdByNickname ?? '—'} · ${lawTime(v.createdAt)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

`apps/web/src/tax/law/TaxLawPage.tsx` (새 파일):

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/errors'
import { menuLabel } from '../../app/menu'
import { useAuth } from '../../auth/AuthProvider'
import Icon from '../../common/Icon'
import PageHeader from '../../common/PageHeader'
import Skeleton, { SkeletonRegion } from '../../common/Skeleton'
import ui from '../../common/ui.module.css'
import { usePageTitle } from '../../common/usePageTitle'
import inputs from '../inputs/inputs.module.css'
import TaxHeader from '../TaxHeader'
import TaxTabs from '../TaxTabs'
import { useTaxYear } from '../TaxYearProvider'
import LawVersionFacts from './LawVersionFacts'
import LawVersionList from './LawVersionList'
import { taxLawApi, taxLawKeys } from './taxLawApi'
import styles from './law.module.css'

/**
 * 소득공제 › 연도별 세법 관리(서비스 관리자 전용, TAX-04·11). 메뉴를 숨기는 것은 편의이고 권한은 서버가 요청마다 판단한다.
 * 관리자가 아니면(`/me`의 serviceAdmin, 또는 서버 403) 요청 없이 권한 없음 화면을 보인다(TAX-06).
 */
export default function TaxLawPage() {
  const title = menuLabel('/tax/law')
  usePageTitle(`${title} · 소득공제`)
  const { me } = useAuth()
  const admin = me?.serviceAdmin === true
  const { year } = useTaxYear()
  const list = useQuery({ queryKey: taxLawKeys.list(year), queryFn: () => taxLawApi.list(year), enabled: admin })
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (!admin || (list.error instanceof ApiError && list.error.status === 403)) return <NoPermission title={title} />
  const versions = list.data ?? []
  // 고른 버전이 목록에 없으면(연도를 바꿨거나 지워짐) 가장 최근 번호를 연다.
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0]
  return (
    <div className={inputs.page}>
      <TaxHeader title={title} note="모든 회원의 계산에 쓰는 기준 · 서비스 관리자 전용" />
      <TaxTabs />
      {list.isPending && <SkeletonRegion label="세법 버전 불러오는 중"><Skeleton height={160} radius="var(--radius-md)" /></SkeletonRegion>}
      {list.isError && (
        <div className={inputs.split}>
          <p role="alert" className={ui.alert}>세법 버전을 불러오지 못했습니다.</p>
          <div className={inputs.actions}>
            <button type="button" className={ui.button} onClick={() => void list.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
          </div>
        </div>
      )}
      {list.isSuccess && (
        <div className={styles.columns}>
          <LawVersionList year={year} versions={versions} selectedId={selected?.id} onSelect={setSelectedId} />
          {selected && <LawVersionFacts version={selected} />}
        </div>
      )}
    </div>
  )
}

function NoPermission({ title }: { title: string }) {
  return (
    <div className={inputs.page}>
      <PageHeader title={title} />
      <section aria-labelledby="law-forbidden-title" className={`${ui.card} ${inputs.empty}`}>
        <h2 id="law-forbidden-title">권한 없음</h2>
        <p>이 화면은 서비스 관리자만 볼 수 있습니다.</p>
        <Link to="/tax/inputs" className={`${ui.button} ${ui.linkButton}`}>입력자료로 가기</Link>
      </section>
    </div>
  )
}
```

- [ ] **Step 7: 통과 확인**

Run: `cd apps/web && npx vitest run src/app/AppRoutes.test.tsx src/app/BottomTabBar.test.tsx src/tax && npx tsc -b && npx oxlint src/tax src/app src/test src/auth`
Expected: 9파일 100건 PASS(`AppRoutes` 38건, `TaxLawPage` 9건 포함), 타입 오류 없음, lint 경고 없음. 이 Task 뒤 초안도 읽기 전용 보기로 열린다(편집은 6.2).

- [ ] **Step 8: 커밋(컨트롤러)** — Codex는 커밋하지 않는다. 컨트롤러가 보고와 diff를 확인한 뒤 커밋한다.

### Task 6.2: 초안 편집·검증·적용·초안 삭제 (TAX-04, 60~64, 72, 76, AC-21 화면, AC-39, AC-44)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Create: `apps/web/src/tax/law/LawVersionForm.tsx`
- Modify: `apps/web/src/tax/law/taxLawApi.ts`, `LawVersionList.tsx`, `TaxLawPage.tsx`, `law.module.css`
- Test: `apps/web/src/tax/law/LawVersionForm.test.tsx`(새 파일, 12건)

**Interfaces:**
- Consumes: Task 6.1의 `taxLawKeys`·`LawVersion`·`LAW_FIELDS`·`LawDetailHeading`·`renderTaxLaw`·`serveLaw`·`lawDraft`; `PUT /tax/admin/law-versions/{id}`(본문 `LawValues` + `rowVersion`, 적용본·`rowVersion` 불일치 409), `POST …/{id}/validate` → `{ errors: [{ field, message }] }`, `POST …/{id}/apply { rowVersion }`(검증 실패 400 `VALIDATION_FAILED`, 409, 404), `DELETE …/{id}?rowVersion=`(204, 적용본 409, 404); `taxApi`의 `isStale`·`actionError`·`taxKeys`; 공용 `MoneyField`·`TextField`·`TextAreaField`·`DateTimePicker`(`granularity="day"`)·`Dialog`/`ConfirmDialog`의 `centered`·`toast`.
- Produces: `taxLawApi.update(id, body)`·`validate(id)`·`apply(id, rowVersion)`·`remove(id, rowVersion)`, 타입 `LawUpdate`·`LawFieldError`, `LAW_LABEL`(검증 오류 필드 → 화면 이름); `LawVersionForm({ version, onReload })`(default); 목록 행의 초안 [삭제](`v<n> 초안 삭제`). `TaxLawPage`는 초안이면 폼, 적용본이면 읽기 전용 보기를 연다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/tax/law/LawVersionForm.test.tsx` (새 파일):

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { lawDraft, lawVersion, renderTaxLaw, serveLaw } from '../../test/taxLawFixtures'

const v1 = lawVersion()
// v2는 v1을 복사해 만든 초안이다. 기본한도(경계 초과 · 자녀등 1명)와 메모만 비어 있다.
const v2 = lawDraft({ id: 2, versionNo: 2, rowVersion: 21, basicLimitHigh: [2_500_000, null, 3_000_000], memo: null, createdByNickname: '관리자다' })
const v3 = lawDraft({ id: 3, versionNo: 3, rowVersion: 31, createdByNickname: '관리자라' })

const conflict = (status: number) => HttpResponse.json({ code: status === 404 ? 'NOT_FOUND' : 'CONFLICT', message: 'x' }, { status })

async function openDraft(no: number) {
  const view = renderTaxLaw()
  const list = await screen.findByRole('region', { name: '2026년 버전' })
  await view.user.click(within(list).getByRole('button', { name: new RegExp(`^v${no} · `) }))
  const form = screen.getByRole('region', { name: new RegExp(`2026년 귀속 v${no} · 초안`) })
  return { ...view, list, form }
}

const field = (form: HTMLElement, group: string, label: string) => within(within(form).getByRole('group', { name: group })).getByLabelText(label)

describe('LawVersionForm — 초안 편집', () => {
  it('saves the whole draft with the rowVersion it opened with and only then allows validate and apply', async () => {
    serveLaw([v3, v2, v1])
    let body: unknown
    server.use(http.put('*/api/tax/admin/law-versions/2', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(lawDraft({ ...v2, rowVersion: 22, rateCreditPct: 20, basicLimitHigh: [2_500_000, 2_750_000, 3_000_000], memo: '자녀등 한도 반영' }))
    }))
    const { user, form } = await openDraft(2)

    expect(form).toHaveTextContent('계산 알고리즘 버전 1 (고정)')
    expect(within(form).getByRole('button', { name: '검증' })).toBeEnabled()
    await user.clear(field(form, '비율 (%)', '신용카드 공제율'))
    await user.type(field(form, '비율 (%)', '신용카드 공제율'), '20')
    await user.type(field(form, '기본한도 · 경계 초과 (원)', '자녀등 1명'), '2750000')
    await user.type(within(form).getByLabelText('메모 (선택)'), '  자녀등 한도 반영  ')
    await user.tab()

    expect(form).toHaveTextContent('저장하지 않은 변경이 있습니다. 초안을 저장한 뒤 검증·적용할 수 있습니다.')
    expect(within(form).getByRole('button', { name: '검증' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: '적용' })).toBeDisabled()
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({
      rowVersion: 21, minSpendRatePct: 25, bracketBoundary: 70_000_000,
      rateCreditPct: 20, rateDebitCashPct: 30, rateCulturePct: 30, rateMarketPct: 40, rateTransitPct: 40,
      basicLimitLow: [3_000_000, 3_500_000, 4_000_000], basicLimitHigh: [2_500_000, 2_750_000, 3_000_000],
      extraLimitLow: 3_000_000, extraLimitHigh: 2_000_000,
      basisLawName: '조세특례제한법', basisArticle: '제126조의2', basisUrl: 'https://www.law.go.kr/',
      periodStart: '2026-01-01', periodEnd: '2026-12-31', memo: '자녀등 한도 반영',
    })
    expect(await screen.findByText('2026년 귀속 v2 초안을 저장했습니다.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: '검증' })).toBeEnabled()
    expect(field(form, '비율 (%)', '신용카드 공제율')).toHaveValue('20')
  })

  it('sends the next save with the rowVersion the server returned', async () => {
    serveLaw([v2, v1])
    const sent: unknown[] = []
    server.use(http.put('*/api/tax/admin/law-versions/2', async ({ request }) => {
      const body = await request.json() as { rowVersion: number }
      sent.push(body.rowVersion)
      return HttpResponse.json(lawDraft({ ...v2, rowVersion: body.rowVersion === 21 ? 900 : 901, memo: 'a' }))
    }))
    const { user, form } = await openDraft(2)

    await user.type(within(form).getByLabelText('메모 (선택)'), 'a')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(sent).toEqual([21]))
    await user.type(within(form).getByLabelText('메모 (선택)'), 'b')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    await waitFor(() => expect(sent).toEqual([21, 900]))
  })

  it('validates the saved draft and lists failures with field names, then a pass', async () => {
    serveLaw([v2, v1])
    let errors = [
      { field: 'rateCulturePct', message: '0~100 사이여야 합니다' },
      { field: 'basicLimitHigh[1]', message: '값을 입력해야 합니다' },
    ]
    server.use(http.post('*/api/tax/admin/law-versions/2/validate', () => HttpResponse.json({ errors })))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '검증' }))

    const failed = await within(form).findByRole('alert')
    expect(failed).toHaveTextContent('검증 실패 — 적용할 수 없습니다.')
    expect(within(failed).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '문화체육 공제율: 0~100 사이여야 합니다',
      '기본한도 · 경계 초과 · 자녀등 1명: 값을 입력해야 합니다',
    ])
    errors = []
    await user.click(within(form).getByRole('button', { name: '검증' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('검증 통과 — 적용할 수 있습니다.')
  })

  it('keeps the input after a stale save and reloads the draft on request', async () => {
    const calls = serveLaw([v2, v1])
    server.use(http.put('*/api/tax/admin/law-versions/2', () => conflict(409)))
    const { user, form } = await openDraft(2)

    await user.clear(field(form, '비율 (%)', '신용카드 공제율'))
    await user.type(field(form, '비율 (%)', '신용카드 공제율'), '20')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('다른 곳에서 수정·적용되거나 삭제됐습니다. 저장하지 않았습니다.')
    expect(field(form, '비율 (%)', '신용카드 공제율')).toHaveValue('20')
    await user.click(within(form).getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => expect(calls.list).toBe(2))
    const reloaded = screen.getByRole('region', { name: /2026년 귀속 v2 · 초안/ })
    await waitFor(() => expect(field(reloaded, '비율 (%)', '신용카드 공제율')).toHaveValue('15'))
    expect(within(reloaded).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the input and says so when the server cannot be reached', async () => {
    serveLaw([v2, v1])
    server.use(http.put('*/api/tax/admin/law-versions/2', () => HttpResponse.error()))
    const { user, form } = await openDraft(2)

    await user.type(within(form).getByLabelText('메모 (선택)'), '합성')
    await user.click(within(form).getByRole('button', { name: '초안 저장' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 입력한 값은 그대로 있습니다.')
    expect(within(form).getByLabelText('메모 (선택)')).toHaveValue('합성')
  })
})

describe('LawVersionForm — 적용', () => {
  it('applies a draft after one centered confirmation that says other drafts stay drafts', async () => {
    mockViewport(true)
    const calls = serveLaw([v3, v2, v1])
    let body: unknown
    server.use(http.post('*/api/tax/admin/law-versions/2/apply', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(lawVersion({ ...v2, status: 'APPLIED', rowVersion: 22, appliedByNickname: '관리자나', appliedAt: '2026-11-21T01:00:00Z' }))
    }))
    const { user, list, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '적용' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v2 적용' })
    expect(dialog.parentElement).toHaveClass('modal')
    expect(dialog).toHaveTextContent('적용하면 이 버전은 고치거나 삭제할 수 없습니다.')
    expect(dialog).toHaveTextContent('다른 초안은 초안으로 남습니다.')
    await user.click(within(dialog).getByRole('button', { name: '적용' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ rowVersion: 21 })
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('v2 · 적용')
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('v3 · 초안')
    const detail = screen.getByRole('region', { name: /2026년 귀속 v2 · 적용/ })
    expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: 'v2 초안 삭제' })).not.toBeInTheDocument()
    // 회원 화면의 현재 적용 세법을 다시 읽는다.
    await waitFor(() => expect(calls.current).toBe(2))
  })

  it('keeps the dialog open when the draft fails validation on apply', async () => {
    serveLaw([v2, v1])
    server.use(http.post('*/api/tax/admin/law-versions/2/apply', () =>
      HttpResponse.json({ code: 'VALIDATION_FAILED', message: 'basicLimitHigh[1]: 값을 입력해야 합니다' }, { status: 400 })))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '적용' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v2 적용' })
    await user.click(within(dialog).getByRole('button', { name: '적용' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('검증을 통과하지 못해 적용하지 않았습니다. [검증]으로 이유를 확인해 주세요.')
  })

  it.each([409, 404])('reloads the list after a %i apply', async (status) => {
    const calls = serveLaw([v2, v1])
    server.use(http.post('*/api/tax/admin/law-versions/2/apply', () => conflict(status)))
    const { user, form } = await openDraft(2)

    await user.click(within(form).getByRole('button', { name: '적용' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v2 적용' })
    await user.click(within(dialog).getByRole('button', { name: '적용' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.')
    await waitFor(() => expect(calls.list).toBe(2))
  })
})

describe('LawVersionList — 초안 삭제', () => {
  it('deletes a draft after one centered confirmation with its rowVersion and has no delete for applied versions', async () => {
    mockViewport(true)
    serveLaw([v3, v2, v1])
    let url = ''
    server.use(http.delete('*/api/tax/admin/law-versions/3', ({ request }) => {
      url = request.url
      serveLaw([v2, v1])
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    expect(within(list).queryByRole('button', { name: 'v1 초안 삭제' })).not.toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'v3 초안 삭제' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 v3 초안을 삭제할까요?' })
    expect(dialog.parentElement).toHaveClass('modal')
    expect(dialog).toHaveTextContent('이 초안에 입력한 값이 지워집니다. 적용된 버전과 다른 초안은 남습니다. 복구할 수 없습니다.')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
    expect(new URL(url).search).toBe('?rowVersion=31')
    expect(screen.getByRole('region', { name: /2026년 귀속 v2 · 초안/ })).toBeInTheDocument()
  })

  it.each([409, 404])('reloads and explains a %i draft delete', async (status) => {
    const calls = serveLaw([v3, v1])
    server.use(http.delete('*/api/tax/admin/law-versions/3', () => conflict(status)))
    const { user } = renderTaxLaw()

    const list = await screen.findByRole('region', { name: '2026년 버전' })
    await user.click(within(list).getByRole('button', { name: 'v3 초안 삭제' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.')
    await waitFor(() => expect(calls.list).toBe(2))
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/tax/law`
Expected: `LawVersionForm.test.tsx` 12건 모두 FAIL — `Unable to find … role "button" and name "적용"`(4건)·`"v3 초안 삭제"`(3건)·`"검증"`(2건), `Unable to find a label with the text of: 메모 (선택)`(2건), `role "group" and name "비율 (%)"`(1건). `TaxLawPage.test.tsx` 9건 PASS.

- [ ] **Step 3: API·목록·화면 고침**

`git apply`:

```diff
diff --git a/apps/web/src/tax/law/LawVersionList.tsx b/apps/web/src/tax/law/LawVersionList.tsx
index 4e9bdc0..2a836e0 100644
--- a/apps/web/src/tax/law/LawVersionList.tsx
+++ b/apps/web/src/tax/law/LawVersionList.tsx
@@ -1,9 +1,10 @@
 import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
+import ConfirmDialog from '../../common/ConfirmDialog'
 import { errorMessage } from '../../common/errorMessage'
 import Icon from '../../common/Icon'
 import ui from '../../common/ui.module.css'
 import inputs from '../inputs/inputs.module.css'
-import { taxApi, taxKeys } from '../taxApi'
+import { actionError, isStale, taxApi, taxKeys } from '../taxApi'
 import { lawTime, taxLawApi, taxLawKeys, type LawVersion } from './taxLawApi'
 import styles from './law.module.css'
 
@@ -49,6 +50,7 @@ export default function LawVersionList({ year, versions, selectedId, onSelect }:
                   {v.appliedAt ? `적용 ${v.appliedByNickname ?? '—'} · ${lawTime(v.appliedAt)}` : `작성 ${v.createdByNickname ?? '—'} · ${lawTime(v.createdAt)}`}
                 </span>
               </button>
+              {v.status === 'DRAFT' && <div className={inputs.actions}><DeleteDraft version={v} /></div>}
             </li>
           ))}
         </ul>
@@ -56,3 +58,21 @@ export default function LawVersionList({ year, versions, selectedId, onSelect }:
     </section>
   )
 }
+
+/** 초안 삭제는 확인 한 번(TAX-72). 적용본에는 이 버튼이 없다. 삭제는 204라 목록을 다시 읽는다. */
+function DeleteDraft({ version }: { version: LawVersion }) {
+  const client = useQueryClient()
+  const reload = () => client.invalidateQueries({ queryKey: taxLawKeys.list(version.taxYear) })
+  const remove = useMutation({
+    mutationFn: () => taxLawApi.remove(version.id, version.rowVersion),
+    onSuccess: () => reload(),
+    onError: (error) => { if (isStale(error)) void reload() },
+  })
+  const name = `${version.taxYear}년 귀속 v${version.versionNo}`
+  return (
+    <ConfirmDialog centered triggerLabel="삭제" triggerAriaLabel={`v${version.versionNo} 초안 삭제`}
+      title={`${name} 초안을 삭제할까요?`} description="이 초안에 입력한 값이 지워집니다. 적용된 버전과 다른 초안은 남습니다. 복구할 수 없습니다."
+      confirmLabel="삭제" isPending={remove.isPending} error={remove.error ? actionError(remove.error) : null}
+      onOpen={() => remove.reset()} onConfirm={(close) => remove.mutate(undefined, { onSuccess: close })} />
+  )
+}
diff --git a/apps/web/src/tax/law/TaxLawPage.tsx b/apps/web/src/tax/law/TaxLawPage.tsx
index a4150f4..7c70cde 100644
--- a/apps/web/src/tax/law/TaxLawPage.tsx
+++ b/apps/web/src/tax/law/TaxLawPage.tsx
@@ -1,4 +1,4 @@
-import { useQuery } from '@tanstack/react-query'
+import { useQuery, useQueryClient } from '@tanstack/react-query'
 import { useState } from 'react'
 import { Link } from 'react-router'
 import { ApiError } from '../../api/errors'
@@ -14,6 +14,7 @@ import TaxHeader from '../TaxHeader'
 import TaxTabs from '../TaxTabs'
 import { useTaxYear } from '../TaxYearProvider'
 import LawVersionFacts from './LawVersionFacts'
+import LawVersionForm from './LawVersionForm'
 import LawVersionList from './LawVersionList'
 import { taxLawApi, taxLawKeys } from './taxLawApi'
 import styles from './law.module.css'
@@ -30,6 +31,10 @@ export default function TaxLawPage() {
   const { year } = useTaxYear()
   const list = useQuery({ queryKey: taxLawKeys.list(year), queryFn: () => taxLawApi.list(year), enabled: admin })
   const [selectedId, setSelectedId] = useState<number | null>(null)
+  const client = useQueryClient()
+  // [다시 불러오기]: 목록을 새로 받은 뒤 편집 중인 초안을 새 값으로 다시 연다.
+  const [reloads, setReloads] = useState(0)
+  const reload = () => void client.invalidateQueries({ queryKey: taxLawKeys.list(year) }).then(() => setReloads((n) => n + 1))
 
   if (!admin || (list.error instanceof ApiError && list.error.status === 403)) return <NoPermission title={title} />
   const versions = list.data ?? []
@@ -51,7 +56,8 @@ export default function TaxLawPage() {
       {list.isSuccess && (
         <div className={styles.columns}>
           <LawVersionList year={year} versions={versions} selectedId={selected?.id} onSelect={setSelectedId} />
-          {selected && <LawVersionFacts version={selected} />}
+          {selected?.status === 'DRAFT' && <LawVersionForm key={`${selected.id}:${reloads}`} version={selected} onReload={reload} />}
+          {selected?.status === 'APPLIED' && <LawVersionFacts version={selected} />}
         </div>
       )}
     </div>
diff --git a/apps/web/src/tax/law/law.module.css b/apps/web/src/tax/law/law.module.css
index ef484c4..7d8bf80 100644
--- a/apps/web/src/tax/law/law.module.css
+++ b/apps/web/src/tax/law/law.module.css
@@ -15,3 +15,8 @@
 }
 .versions .version[aria-current='true'] { border-color: var(--brand); background: var(--surface-100); }
 .versions .version:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
+
+/* 초안 입력 묶음. 칸이 9rem보다 좁아지면(320px) 한 줄에 하나씩 놓아 큰 금액이 칸 안에서 다 보이게 한다. */
+.fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr)); gap: var(--space-2) var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
+.basis { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
+.fields legend, .basis legend { padding: 0; margin-bottom: var(--space-1); font-weight: 500; }
diff --git a/apps/web/src/tax/law/taxLawApi.ts b/apps/web/src/tax/law/taxLawApi.ts
index 82d1628..49081c9 100644
--- a/apps/web/src/tax/law/taxLawApi.ts
+++ b/apps/web/src/tax/law/taxLawApi.ts
@@ -19,9 +19,18 @@ export type LawVersion = LawValues & {
 
 const BASE = '/tax/admin/law-versions'
 
+/** 초안 전체 교체 본문. 빈 값은 null이고 범위 검사는 적용할 때 서버가 한다. */
+export type LawUpdate = LawValues & { rowVersion: number }
+export type LawFieldError = { field: string; message: string }
+
 export const taxLawApi = {
   list: (year: number) => apiFetch<LawVersion[]>(`${BASE}?year=${year}`),
   create: (taxYear: number) => apiFetch<LawVersion>(BASE, { method: 'POST', json: { taxYear } }),
+  update: (id: number, body: LawUpdate) => apiFetch<LawVersion>(`${BASE}/${id}`, { method: 'PUT', json: body }),
+  /** 저장된 값을 검사한다. errors가 비면 적용할 수 있다. 상태를 바꾸지 않는다. */
+  validate: (id: number) => apiFetch<{ errors: LawFieldError[] }>(`${BASE}/${id}/validate`, { method: 'POST' }),
+  apply: (id: number, rowVersion: number) => apiFetch<LawVersion>(`${BASE}/${id}/apply`, { method: 'POST', json: { rowVersion } }),
+  remove: (id: number, rowVersion: number) => apiFetch<void>(`${BASE}/${id}?rowVersion=${rowVersion}`, { method: 'DELETE' }),
 }
 
 /** 관리자 세법 목록 키. 머리말 `tax`라 그룹 범위 키가 아니고, 로그아웃 때 queryClient.clear()로 지워진다. */
@@ -56,6 +65,9 @@ export const LAW_FIELDS: LawField[] = [
   { field: 'memo', label: '메모', kind: 'text', get: (v) => v.memo },
 ]
 
+/** 검증 오류의 필드 이름 → 화면 이름. */
+export const LAW_LABEL: Record<string, string> = Object.fromEntries(LAW_FIELDS.map((f) => [f.field, f.label]))
+
 const seoulTime = new Intl.DateTimeFormat('sv-SE', {
   timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
 })
```

- [ ] **Step 4: 초안 폼과 적용 창**

`apps/web/src/tax/law/LawVersionForm.tsx` (새 파일):

```tsx
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { FieldError, Group, Input, Label, NumberField } from 'react-aria-components'
import DateTimePicker from '../../common/DateTimePicker'
import Dialog from '../../common/Dialog'
import { errorMessage } from '../../common/errorMessage'
import fields from '../../common/Field.module.css'
import MoneyField from '../../common/MoneyField'
import money from '../../common/MoneyField.module.css'
import TextField, { TextAreaField } from '../../common/TextField'
import { toast } from '../../common/Toast'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import { actionError, isStale, taxKeys } from '../taxApi'
import { LawDetailHeading } from './LawVersionFacts'
import { LAW_LABEL, taxLawApi, taxLawKeys, type LawFieldError, type LawValues, type LawVersion } from './taxLawApi'
import styles from './law.module.css'

type TextKey = 'basisLawName' | 'basisArticle' | 'basisUrl' | 'periodStart' | 'periodEnd' | 'memo'
/** 입력 중인 값. 글 칸은 빈 문자열, 숫자 칸은 null이 "비어 있음"이다. */
type LawForm = Omit<LawValues, TextKey> & Record<TextKey, string>
type Tiers = 'basicLimitLow' | 'basicLimitHigh'

function toForm(v: LawValues): LawForm {
  return {
    minSpendRatePct: v.minSpendRatePct, bracketBoundary: v.bracketBoundary,
    rateCreditPct: v.rateCreditPct, rateDebitCashPct: v.rateDebitCashPct, rateCulturePct: v.rateCulturePct,
    rateMarketPct: v.rateMarketPct, rateTransitPct: v.rateTransitPct,
    basicLimitLow: [...v.basicLimitLow], basicLimitHigh: [...v.basicLimitHigh], extraLimitLow: v.extraLimitLow, extraLimitHigh: v.extraLimitHigh,
    basisLawName: v.basisLawName ?? '', basisArticle: v.basisArticle ?? '', basisUrl: v.basisUrl ?? '',
    periodStart: v.periodStart ?? '', periodEnd: v.periodEnd ?? '', memo: v.memo ?? '',
  }
}

function toBody(f: LawForm): LawValues {
  const text = (value: string) => value.trim() || null
  return {
    ...f, basisLawName: text(f.basisLawName), basisArticle: text(f.basisArticle), basisUrl: text(f.basisUrl),
    periodStart: text(f.periodStart), periodEnd: text(f.periodEnd), memo: text(f.memo),
  }
}

/** 버전 하나를 목록 캐시에서 바꾼다. 다른 버전은 그대로 둔다. */
function putVersion(client: QueryClient, saved: LawVersion) {
  client.setQueryData<LawVersion[]>(taxLawKeys.list(saved.taxYear), (old) => old?.map((v) => (v.id === saved.id ? saved : v)))
}

/** 0~100 정수 퍼센트. 범위는 적용할 때 서버가 검사한다(TAX-64). 비우면 null. */
function PercentField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <NumberField value={value ?? Number.NaN} onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      formatOptions={{ maximumFractionDigits: 0 }} validationBehavior="native" isWheelDisabled className={fields.field}>
      <Label className={fields.label}>{label}</Label>
      <Group className={money.money}>
        <Input className={`${fields.input} ${money.input}`} />
        <span className={money.unit} aria-hidden="true">%</span>
      </Group>
      <FieldError className={fields.error} />
    </NumberField>
  )
}

const RATES = [
  ['minSpendRatePct', '최저사용금액 비율'], ['rateCreditPct', '신용카드 공제율'], ['rateDebitCashPct', '체크카드·현금영수증 공제율'],
  ['rateCulturePct', '문화체육 공제율'], ['rateMarketPct', '전통시장 공제율'], ['rateTransitPct', '대중교통 공제율'],
] as const
const TIERS = ['자녀등 0명', '자녀등 1명', '자녀등 2명 이상']

type Props = { version: LawVersion; onReload: () => void }

/**
 * 초안 편집(TAX-62~64). 연 시점(또는 마지막 저장)의 값과 rowVersion으로 저장하고, 다른 곳에서 바뀌었으면 서버가 409로 막는다.
 * 검증·적용은 저장된 값으로 하므로 저장하지 않은 변경이 있으면 끈다.
 */
export default function LawVersionForm({ version, onReload }: Props) {
  const client = useQueryClient()
  const [base, setBase] = useState(version)
  const [values, setValues] = useState(() => toForm(version))
  const [checked, setChecked] = useState<LawFieldError[] | null>(null)
  const [applying, setApplying] = useState(false)
  const name = `${base.taxYear}년 귀속 v${base.versionNo}`
  const dirty = JSON.stringify(toBody(values)) !== JSON.stringify(toBody(toForm(base)))
  const save = useMutation({
    mutationFn: () => taxLawApi.update(base.id, { ...toBody(values), rowVersion: base.rowVersion }),
    onSuccess: (saved) => {
      putVersion(client, saved)
      setBase(saved)
      setValues(toForm(saved))
      toast(`${name} 초안을 저장했습니다.`)
    },
  })
  const validate = useMutation({
    mutationFn: () => taxLawApi.validate(base.id),
    onSuccess: (result) => setChecked(result.errors),
    onError: (error) => { if (isStale(error)) onReload() },
  })
  const busy = save.isPending || validate.isPending

  function change(next: Partial<LawForm>) {
    setValues((current) => ({ ...current, ...next }))
    setChecked(null)
  }
  const tier = (key: Tiers, i: number) => (value: number | null) => change({ [key]: values[key].map((v, j) => (j === i ? value : v)) })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <section aria-labelledby="law-detail-title" className={ui.card}>
      <LawDetailHeading version={base} />
      <form className={ui.stack} onSubmit={onSubmit}>
        <fieldset className={styles.fields}>
          <legend>비율 (%)</legend>
          {RATES.map(([key, label]) => <PercentField key={key} label={label} value={values[key]} onChange={(v) => change({ [key]: v })} />)}
        </fieldset>
        <fieldset className={styles.fields}>
          <legend>급여구간 (원)</legend>
          <MoneyField label="급여구간 경계 금액" value={values.bracketBoundary} minValue={0} onChange={(v) => change({ bracketBoundary: v })} />
        </fieldset>
        {(['basicLimitLow', 'basicLimitHigh'] as const).map((key) => (
          <fieldset key={key} className={styles.fields}>
            <legend>기본한도 · 경계 {key === 'basicLimitLow' ? '이하' : '초과'} (원)</legend>
            {TIERS.map((label, i) => <MoneyField key={label} label={label} value={values[key][i]} minValue={0} onChange={tier(key, i)} />)}
          </fieldset>
        ))}
        <fieldset className={styles.fields}>
          <legend>추가한도 상한 (원)</legend>
          <MoneyField label="경계 이하" value={values.extraLimitLow} minValue={0} onChange={(v) => change({ extraLimitLow: v })} />
          <MoneyField label="경계 초과" value={values.extraLimitHigh} minValue={0} onChange={(v) => change({ extraLimitHigh: v })} />
        </fieldset>
        <fieldset className={styles.basis}>
          <legend>근거·적용 대상 기간</legend>
          <TextField label="법령명" value={values.basisLawName} onChange={(v) => change({ basisLawName: v })} maxLength={200} />
          <TextField label="조문" value={values.basisArticle} onChange={(v) => change({ basisArticle: v })} maxLength={200} />
          <TextField label="근거 URL" value={values.basisUrl} onChange={(v) => change({ basisUrl: v })} maxLength={500} />
          <DateTimePicker label="적용 대상 기간 시작" granularity="day" value={values.periodStart} onChange={(v) => change({ periodStart: v })} />
          <DateTimePicker label="적용 대상 기간 끝" granularity="day" value={values.periodEnd} onChange={(v) => change({ periodEnd: v })} />
          <TextAreaField label="메모 (선택)" value={values.memo} onChange={(v) => change({ memo: v })} maxLength={1000} />
        </fieldset>
        {save.error && (isStale(save.error) ? (
          <div className={inputs.split}>
            <p role="alert" className={ui.alert}>다른 곳에서 수정·적용되거나 삭제됐습니다. 저장하지 않았습니다.</p>
            <div className={inputs.actions}><button type="button" className={ui.button} onClick={onReload}>다시 불러오기</button></div>
          </div>
        ) : <p role="alert" className={ui.alert}>{errorMessage(save.error)} 입력한 값은 그대로 있습니다.</p>)}
        {validate.error && <p role="alert" className={ui.alert}>{actionError(validate.error)}</p>}
        {checked && (checked.length === 0
          ? <p role="status" className={ui.status}>검증 통과 — 적용할 수 있습니다.</p>
          : (
            <div role="alert" className={ui.alert}>
              <p>검증 실패 — 적용할 수 없습니다.</p>
              <ul>{checked.map((e) => <li key={`${e.field}:${e.message}`}>{LAW_LABEL[e.field] ?? e.field}: {e.message}</li>)}</ul>
            </div>
          ))}
        <div className={inputs.split}>
          <p className={ui.muted}>{dirty ? '저장하지 않은 변경이 있습니다. 초안을 저장한 뒤 검증·적용할 수 있습니다.' : '검증과 적용은 저장한 값으로 합니다.'}</p>
          <div className={inputs.actions}>
            <button type="submit" className={ui.button} disabled={busy}>초안 저장</button>
            <button type="button" className={ui.button} disabled={busy || dirty} onClick={() => validate.mutate()}>검증</button>
            <button type="button" className={`${ui.button} ${ui.primary}`} disabled={busy || dirty} onClick={() => setApplying(true)}>적용</button>
          </div>
        </div>
      </form>
      {applying && <ApplyDialog version={base} onClose={() => setApplying(false)} />}
    </section>
  )
}

/** 적용 확인(TAX-61·72). 적용하면 상태가 바뀌어 이 화면은 읽기 전용 보기로 바뀐다. */
function ApplyDialog({ version, onClose }: { version: LawVersion; onClose: () => void }) {
  const client = useQueryClient()
  const year = version.taxYear
  const apply = useMutation({
    mutationFn: () => taxLawApi.apply(version.id, version.rowVersion),
    onSuccess: (applied) => {
      onClose()
      putVersion(client, applied)
      // 이 연도의 회원용 현재 적용 세법과, 세법이 없던 내 연도 기록(적용 때 서버가 이 버전을 붙인다)을 다시 읽는다.
      void client.invalidateQueries({ queryKey: taxKeys.currentLaw(year) })
      void client.invalidateQueries({ queryKey: taxKeys.year(year) })
      toast(`${year}년 귀속 v${applied.versionNo} 적용을 마쳤습니다.`)
    },
    onError: (error) => { if (isStale(error)) void client.invalidateQueries({ queryKey: taxLawKeys.list(year) }) },
  })
  const failure = apply.error && (isStale(apply.error)
    ? actionError(apply.error)
    : errorMessage(apply.error, { VALIDATION_FAILED: '검증을 통과하지 못해 적용하지 않았습니다. [검증]으로 이유를 확인해 주세요.' }))
  return (
    <Dialog title={`${year}년 귀속 v${version.versionNo} 적용`} onClose={onClose} closeDisabled={apply.isPending} centered>
      <p>적용하면 이 버전은 고치거나 삭제할 수 없습니다. {year}년 귀속 연도 기록에는 "새 세법 버전 있음"이 표시되고, 회원이 직접 눌러야 새 버전으로 다시 계산됩니다. 세법이 없던 기록은 바로 이 버전으로 계산됩니다.</p>
      <p>다른 초안은 초안으로 남습니다.</p>
      {failure && <p role="alert" className={ui.alert}>{failure}</p>}
      <div className={ui.confirmActions}>
        <button type="button" className={ui.button} disabled={apply.isPending} onClick={onClose}>취소</button>
        <button type="button" className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={apply.isPending} onClick={() => apply.mutate()}>적용</button>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 5: 통과와 웹 전체 확인**

Run: `cd apps/web && npx vitest run src/tax src/app && npm run typecheck && npm run lint && npm run build && npx vitest run --maxWorkers=4`
Expected: `src/tax`·`src/app` 16파일 133건 PASS(`src/tax/law` 2파일 21건 포함), typecheck 통과, lint는 기존 `imports/CoverageSection.tsx` 경고 1건 말고 새 경고 없음, build 통과(`TaxLawPage` 청크가 따로 나뉜다), 전체 87파일 726건 PASS. 전체 병렬 실행에서 소득공제와 무관한 시간 의존 테스트(이번에는 `transactions/TransactionsPage.test.tsx` 2건)가 한 번 실패했고 그 파일만 다시 돌리면 통과했다(PR 5 때와 같은 현상). 실패하면 그 파일만 다시 돌려 통과를 확인하고 보고한다.

- [ ] **Step 6: 커밋(컨트롤러)**

### Task 6.3: 검증 지도와 운영 문서 (AC-23, AC-29)

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Sonnet 5.5 (`review-task`).

**Files:**
- Create: `.claude/skills/verify/features/tax-law.md`
- Modify: `.claude/skills/verify/features/README.md`, `features/navigation.md`, `docs/deploy.md`(13절 마지막 줄)

**Interfaces:**
- Consumes: Task 6.1·6.2의 화면 이름(`소득공제 메뉴`, `YYYY년 버전`, `YYYY년 귀속 vN 적용`, `vN 초안 삭제` 등), PR 5 시드(`verify@example.test` 서비스 관리자, 올해 귀속 v1 적용), `verify2@example.test`(일반 회원).
- Produces: 검증 지도 `tax-law.md`(feature 계약의 네 H2), 관리자·회원 메뉴 목록이 맞는 `navigation.md`, 사실과 맞는 `deploy.md` 13절.

- [ ] **Step 1: 검증 지도**

`.claude/skills/verify/features/tax-law.md` (새 파일):

```markdown
# Tax law admin

소득공제 › 연도별 세법 관리 (`/tax/law`, `h1` `연도별 세법 관리` on wide screens) is for service admins only. It lists the law versions of the selected tax year (drafts and applied versions, newest number first), lets an admin create drafts, edit and save them, validate them, apply one, and delete drafts. Applied versions are read-only text with no delete. A member who is not a service admin never sees the menu or the tab, and gets the `권한 없음` screen on the address; the server also answers 403 on every admin request. Every confirm dialog opens centered at every width.

## Sub-features

- `law-menu` adds the third sub-link `연도별 세법 관리` under `소득공제` in the sidebar, for service admins only. On narrow screens a service admin sees the in-page `소득공제 메뉴` with `입력자료` and `세법 관리`; members see no in-page menu.
- `law-forbidden` shows `권한 없음`, `이 화면은 서비스 관리자만 볼 수 있습니다.`, and the link `입력자료로 가기` to a member who opens `/tax/law`. The page sends no admin request then. A 403 from the server (for example after the admin flag is revoked) shows the same screen.
- `law-list` shows `YYYY년 버전` with `현재 적용 vN · 초안 n개` (or `적용 버전 없음(회원 화면은 "세법 준비 중")`), and one row per version: `vN · 초안 | 적용 | 현재 적용`, then `작성 <nickname> · YYYY-MM-DD HH:mm` for drafts or `적용 <nickname> · …` for applied versions. `[새 초안 만들기]` stays enabled while drafts exist. Each draft row has `[삭제]` on the right; applied rows have none.
- `law-detail` opens the newest version by default; clicking a row opens it. The heading reads `YYYY년 귀속 vN · 초안` or `… · 적용 · 읽기 전용`, with `계산 알고리즘 버전 1 (고정)` and the creation and apply history. `세법 수치 도움말` explains the salary bracket and the extra limit.
- `law-edit` (drafts) has groups `비율 (%)` (6 rates), `급여구간 (원)`, `기본한도 · 경계 이하 (원)` and `기본한도 · 경계 초과 (원)` (`자녀등 0명`, `자녀등 1명`, `자녀등 2명 이상`), `추가한도 상한 (원)`, and `근거·적용 대상 기간` (법령명, 조문, 근거 URL, two dates, `메모 (선택)`). `[초안 저장]` saves the whole draft. While there are unsaved changes, `[검증]` and `[적용]` are disabled and the bottom line says why.
- `law-validate` lists failures as `<field name>: <message>` under `검증 실패 — 적용할 수 없습니다.`, or shows `검증 통과 — 적용할 수 있습니다.`.
- `law-apply` asks once in `YYYY년 귀속 vN 적용`, which says other drafts stay drafts. After applying, the row reads `vN · 현재 적용` and the detail becomes read-only.
- `law-delete` asks once in `YYYY년 귀속 vN 초안을 삭제할까요?`. Numbers are never reused.

## How to get to it (user POV)

- As a service admin on wide screens, click `연도별 세법 관리` under `소득공제` in `navigation "주 메뉴"`.
- As a service admin on narrow screens, tap the bottom tab `소득공제`, then `세법 관리` in `navigation "소득공제 메뉴"`.

## Driving it with the built-in browser

Preconditions:

- Baseline seed. `verify@example.test` is a service admin and the `YYYY` law (this Korean year) is applied as v1 with the 2026 values. `verify2@example.test` is a regular member.

- **Member.** Log in as `verify2@example.test`. At `desktop`, the sidebar reads 홈, 소득공제, 입력자료, 대시보드, … with no `연도별 세법 관리`. At `mobile`, `소득공제` shows no `소득공제 메뉴`. Type `/tax/law`: `권한 없음` shows, and the network panel has no `/api/tax/admin/` request. `입력자료로 가기` opens `/tax/inputs`.
- **Admin menu.** Log in as `verify@example.test`. At `desktop` the sidebar has `연도별 세법 관리` third under `소득공제`; clicking it shows `h1` `연도별 세법 관리` and marks the link `aria-current="page"`. At `mobile` and at 320×700, the in-page menu reads `입력자료 | 세법 관리`, the header title stays `소득공제`, and switching keeps focus on the tapped link.
- **List and read-only v1.** The list reads `현재 적용 v1 · 초안 0개`. v1 shows as text with `적용된 버전은 고칠 수 없습니다. 바꾸려면 새 초안을 만듭니다.`, no inputs, and no `[삭제]`.
- **Drafts.** Click `[새 초안 만들기]` twice: v2 and v3 appear as drafts copied from v1, and the button stays enabled. Change `신용카드 공제율` in v3: `[검증]` and `[적용]` turn off with the reason line. Save, then reload the page and confirm the value stayed.
- **Validate.** In v3, set `문화체육 공제율` to 130, clear `기본한도 · 경계 초과 (원)` › `자녀등 1명`, save, and press `[검증]`: the alert lists `문화체육 공제율: 0~100 사이여야 합니다` and `기본한도 · 경계 초과 · 자녀등 1명: 값을 입력해야 합니다`. Restore the values (30, ₩ 2,750,000), save, validate again: `검증 통과`.
- **Delete.** Delete v2 from its row (one centered confirmation at `mobile`). The list keeps v3 and v1. Creating another draft gives v4, not v2.
- **Apply.** Apply v3 at `mobile`: the dialog is centered and says `다른 초안은 초안으로 남습니다.`. After applying, v3 reads `현재 적용` and v1 reads `적용`; v4 stays a draft.
- **Help.** Tap `세법 수치 도움말`, tap again, tap outside, press Esc: it closes each time, focus returns to `?`, and no request is sent.
- **Font sizes.** In the browser, read computed sizes: version name 15px, history line 13px, card titles 16px, section buttons 14px, field labels 13px, input text 16px at `mobile`.
- **States.** Stop the stack's API briefly: the page shows `세법 버전을 불러오지 못했습니다.` with `[다시 시도]`. Saving while it is down shows the network message and keeps the input.

## Gotchas

- The admin flag comes from `/me` at sign-in, so the menu changes only after a reload. The server checks every request, so a revoked admin sees `권한 없음` on the next list request.
- Validate and apply use the saved draft, not the unsaved form. That is why both turn off while the form has changes.
- A 409 or 404 on save keeps the input and shows `[다시 불러오기]`; on apply, delete, or validate the list reloads at once with `…새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.`.
- Applying changes what every member's tax screens use. Restore by relaunching the stack for a clean DB; applied versions cannot be deleted.
- The year select offers last, this and next Korean year only, the same as the inputs page.
```

- [ ] **Step 2: 목록·셸 지도·운영 문서 고침**

`git apply`:

```diff
diff --git a/.claude/skills/verify/features/README.md b/.claude/skills/verify/features/README.md
index e34ec31..1201067 100644
--- a/.claude/skills/verify/features/README.md
+++ b/.claude/skills/verify/features/README.md
@@ -34,3 +34,4 @@ Each feature file starts with an H1 title and one paragraph describing the user-
 - [Transactions](./transactions.md): my or group transaction list, search, detail, manual add.
 - [Groups](./groups.md): create, rename, invite link, members, bans.
 - [Tax deduction inputs](./tax-inputs.md): 소득공제 › 입력자료 — basic info, card and cash-receipt statements, year totals, delete year.
+- [Tax law admin](./tax-law.md): 소득공제 › 연도별 세법 관리 — service admins only; versions per tax year, drafts, validate, apply, delete drafts, and the no-permission screen for members.
diff --git a/.claude/skills/verify/features/navigation.md b/.claude/skills/verify/features/navigation.md
index caba965..2452a89 100644
--- a/.claude/skills/verify/features/navigation.md
+++ b/.claude/skills/verify/features/navigation.md
@@ -4,8 +4,8 @@ Every signed-in page shares one shell. Wide screens get a left sidebar and a hea
 
 ## Sub-features
 
-- `nav-sidebar` shows five sidebar links on wide screens: 홈, 소득공제, 대시보드, 거래 목록, 그룹 관리. Under 소득공제 sits the indented sub-link `입력자료` (`/tax/inputs`). Under 대시보드 sit indented sub-links `대분류` (`/dashboard/major`) and `소분류` (`/dashboard/minor`). Inside the dashboard the dashboard sub-links replace history and keep `?month=`; the 소득공제 sub-link never takes `?month=`.
-- `nav-tabs` shows five bottom tabs on narrow screens: 홈, 소득공제, 대시보드, 거래, 그룹. The tabs ignore sub-links; the dashboard has its own `대시보드 메뉴` (see dashboard.md). 소득공제 has one sub-screen for now and no in-page tabs.
+- `nav-sidebar` shows five sidebar links on wide screens: 홈, 소득공제, 대시보드, 거래 목록, 그룹 관리. Under 소득공제 sits the indented sub-link `입력자료` (`/tax/inputs`), plus `연도별 세법 관리` (`/tax/law`) for service admins only. Under 대시보드 sit indented sub-links `대분류` (`/dashboard/major`) and `소분류` (`/dashboard/minor`). Inside the dashboard the dashboard sub-links replace history and keep `?month=`; the 소득공제 sub-link never takes `?month=`.
+- `nav-tabs` shows five bottom tabs on narrow screens: 홈, 소득공제, 대시보드, 거래, 그룹. The tabs ignore sub-links; the dashboard has its own `대시보드 메뉴` (see dashboard.md). 소득공제 shows the in-page `소득공제 메뉴` (`입력자료 | 세법 관리`) to service admins only; members have one sub-screen and no in-page menu (see tax-law.md).
 - `nav-active` marks the current page link with `aria-current="page"`. Home matches `/` exactly. Other links also match sub-paths, so on `/dashboard/major` both `대시보드` and `대분류` are highlighted. Only `대분류` gets `aria-current="page"`; the parent gets `aria-current="true"`. `/tax/inputs` works the same way for `소득공제` and `입력자료`.
 - `nav-account` opens the account sheet with the nickname and logout (narrow screens).
 - `nav-group` uses the header `그룹` select to change the group that group-scoped pages show.
@@ -21,7 +21,7 @@ Preconditions:
 
 - Baseline state, logged in, seed group `검증그룹` selected.
 
-- **Wide links.** Use preset `desktop`, then reload. Run `find "주 메뉴"` and click each link. Each click changes the `h1` and moves `aria-current` to the clicked link. The link list reads 홈, 소득공제, 입력자료, 대시보드, 대분류, 소분류, 거래 목록, 그룹 관리. Check the missing `세법 관리` link with a regular member account such as `verify2@example.test` after PR 6 adds that menu.
+- **Wide links.** Use preset `desktop`, then reload. Run `find "주 메뉴"` and click each link. Each click changes the `h1` and moves `aria-current` to the clicked link. As the service admin `verify@example.test` the link list reads 홈, 소득공제, 입력자료, 연도별 세법 관리, 대시보드, 대분류, 소분류, 거래 목록, 그룹 관리. As the member `verify2@example.test` it has no `연도별 세법 관리`.
 - **Narrow tabs.** Use preset `mobile`, then reload. The same nav holds 5 tab links with the short labels. The sidebar is gone from the accessibility tree.
 - **Account sheet.** In `mobile`, click the button `계정`. A sheet titled `계정` shows `검증러` and a logout button.
 
diff --git a/docs/deploy.md b/docs/deploy.md
index 6553d0b..31c2bf0 100644
--- a/docs/deploy.md
+++ b/docs/deploy.md
@@ -277,4 +277,4 @@ SELECT id, email, service_admin FROM users WHERE id = <회원 id>;
 - `UPDATE` 결과가 1행인지 확인한다. 0행이면 회원 id 또는 지정 조건을 다시 확인한다.
 - 가입 때 이메일 소유를 확인하지 않으므로, 비밀번호로 먼저 가입된 계정(다른 사람이 선점했을 수 있음)은 지정하지 않는다. 비밀번호가 있는 계정을 관리자로 쓰려면 먼저 그 계정 처리(비밀번호 제거 등)를 별도로 정한다.
 - API는 세법 관리 요청마다 DB의 이 값을 읽는다. 다시 로그인하지 않아도 다음 요청부터 반영된다.
-- 웹은 `/me`의 `serviceAdmin`으로 메뉴를 보인다(PR 5부터). 화면의 메뉴는 새로 고친 뒤에 바뀐다.
+- 웹은 `/me`의 `serviceAdmin`으로 "연도별 세법 관리" 메뉴와 좁은 화면의 화면 안 탭을 보인다(PR 6부터). 메뉴는 새로 고친 뒤에 바뀐다. 회수한 뒤 열어 둔 세법 관리 화면은 다음 요청의 403으로 권한 없음 화면이 된다.
```

- [ ] **Step 3: 확인** — 문서만 바꾼다. 링크와 이름을 화면 코드와 대조한다.

Run: `grep -n "tax-law.md" .claude/skills/verify/features/README.md .claude/skills/verify/features/navigation.md && grep -c "^## " .claude/skills/verify/features/tax-law.md`
Expected: 두 파일에서 링크·언급 각 1줄, H2 4개(`Sub-features`, `How to get to it (user POV)`, `Driving it with the built-in browser`, `Gotchas`). 여정의 실제 실행은 PR 마무리의 verify에서 한다.

- [ ] **Step 4: 커밋(컨트롤러)**

### PR 6 마무리 (컨트롤러)

1. **웹 검증 4종**: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`. 흔들린 테스트는 그 파일만 다시 돌린 결과와 함께 보고한다.
2. **verify**(`.claude/skills/verify`, `features/tax-law.md`·`navigation.md`). 375px(`mobile`)·320×700·데스크톱 각각, 관리자 `verify@example.test`와 일반 회원 `verify2@example.test` 둘 다:
   - 회원: 사이드바에 "연도별 세법 관리" 없음, 좁은 화면에 `소득공제 메뉴` 없음, `/tax/law` 주소로 권한 없음 화면과 `/api/tax/admin/` 요청 0건, [입력자료로 가기].
   - 관리자: 사이드바 세 번째 하위 링크와 `aria-current`, 좁은 화면 탭 `입력자료 | 세법 관리`(320px에서 한 줄·44px), 탭 전환 뒤 포커스가 누른 링크에 남음, 앱 머리 제목 "소득공제", 넓은 화면 `h1` "연도별 세법 관리".
   - 목록·읽기 전용 v1(입력란·[삭제] 없음), [새 초안 만들기] 두 번(v2·v3, 버튼 계속 켜짐), 저장하지 않은 변경 때 [검증]·[적용] 꺼짐과 이유, 저장 뒤 새로 고쳐도 값 유지, 검증 실패 목록(문화체육 130%, 빈 기본한도)과 통과, v2 삭제(가운데 창 한 번) 뒤 새 초안이 v4, v3 적용(가운데 창, "다른 초안은 초안으로 남습니다") 뒤 v3 "현재 적용"·v1 "적용"·v4 초안 유지.
   - 글자 크기를 브라우저 computed 값으로 잰다: 카드 제목 16px, 버전 이름·본문 15px, 버전 행 보조·입력 라벨·머리 아래 줄 13px(상위 `.page section button`·`.page p`에 덮이지 않는지), 섹션 버튼 14px, 좁은 화면 입력 글자 16px.
   - 320px에서 큰 금액(₩ 9,999,999,999,999)이 칸 안에 다 보이고 페이지 가로 스크롤이 없음, 긴 법령명·메모(40자) 줄바꿈, 글자 확대.
   - `세법 수치 도움말`: 누르기·다시 누르기·바깥 누르기·Esc·포커스 복귀, 요청 없음.
   - 상태: 로딩, 목록 오류와 [다시 시도](API를 잠깐 멈춤), 저장 중 버튼 꺼짐, 통신 오류 때 입력 유지. 브라우저 두 탭으로 같은 초안을 고쳐 두 번째 저장이 409와 [다시 불러오기]가 되는지.
   - PR용 375px 이전(`main`: 관리자의 입력자료 화면, 화면 안 탭 없음)·이후(관리자 입력자료의 `입력자료 | 세법 관리` 탭, 세법 관리 목록·초안 폼, 적용 확인 창, 회원의 권한 없음 화면) 캡처를 `pr-assets` 브랜치 `pr-<번호>/`에 올린다. 화면은 시드 합성값만 쓴다.
3. **브랜치 최종 리뷰 — Claude Opus 5.5 한 번**(`review-final`). 볼 항목:
   - 권한 표시: 관리자 아님이면 `/tax/admin/` 요청이 없는지(`enabled`), 403이면 같은 권한 없음 화면, 메뉴·탭 숨김이 서버 권한을 대신한다고 쓴 곳이 없는지, `Me.serviceAdmin`을 메뉴·진입 판단 밖에서 쓰지 않는지.
   - 계약: `rowVersion`을 응답 값 그대로 보내는지(저장은 마지막 응답, 적용은 연 시점·마지막 저장, 삭제는 목록 값; 계산·+1 없음), `DELETE`에 `?rowVersion=`, 적용 본문 `{ rowVersion }`, `PUT` 본문이 `LawValues` 키만 담고 빈 글 칸이 `null`인지.
   - 409·404 두 흐름이 입력을 잃지 않는지, 목록 재조회가 편집 중인 폼을 다시 열지 않는지, [다시 불러오기]가 새 값으로 다시 여는지.
   - 삭제·적용: 초안만 [삭제], 확인 한 번, 적용본 삭제·편집 수단 없음, 적용 창 문구(고칠 수 없음, 다른 초안은 남음, "새 세법 버전 있음"과 세법 없던 기록의 자동 반영), 적용 뒤 `taxKeys.currentLaw`·`taxKeys.year` 무효화.
   - 개인정보·캐시: `['tax', 'admin', 'law', year]` 키, 로그아웃 때 비움(`ClearCacheOnSignOut`), 브라우저 저장소 사용 없음, `useGroups()` 없음.
   - 보안: 근거 URL은 `http(s)`일 때만 링크, `rel="noreferrer"`, `dangerouslySetInnerHTML` 없음.
   - 공용 변경 범위: `menuLabel`이 하위 메뉴를 찾아도 기존 호출이 같은 값, `TaxHeader` 기본값에서 입력자료 화면 불변, `renderPage` 기본 `me`가 기존 테스트를 바꾸지 않는지, `AppLayout`의 대시보드 `?month=` 규칙 불변.
   - UI 표준: 정보 왼쪽·조작 오른쪽(목록 머리 [새 초안 만들기], 행 [삭제], 폼 하단 [초안 저장] [검증] [적용]), 글자 토큰, 44px, 확인 창 `centered`, 실행 불가 이유를 화면에 적음.
4. **반론 리뷰(Codex 템플릿 F)는 하지 않는다.** 이유: 권한·삭제·동시 수정의 판단은 모두 서버(PR 2, 반론 리뷰 완료)에 있고 이 PR은 서버를 바꾸지 않는다. 메뉴·탭 숨김과 권한 없음 화면은 편의이고, 숨김이 뚫려도 서버가 요청마다 DB로 403을 준다. 화면이 새로 만드는 위험(관리자 값의 링크 렌더링, 관리자 아닌 회원의 요청 발생, 캐시 키)은 Task 6.1 테스트(`never turns a non-http basis address into a link`, `…without asking the admin API`)와 위 3의 권한·보안 항목으로 대신한다. 리뷰 중 서버 동작을 바꿔야 하는 문제가 나오면 그때 반론 리뷰 대상으로 올린다.
5. **PR 본문** — 무엇: 관리자 전용 하위 메뉴와 좁은 화면 안 탭(`TaxTabs`, 관리자 2개), 권한 없음 화면(요청 없음·403 동일), 버전 목록·읽기 전용 적용본·초안 편집·검증·적용·초안 삭제, `Me.serviceAdmin`, `docs/deploy.md` 13절 정정, verify 지도, "계획 초안에서 달라진 점"과 "결정이 필요한 점"의 기본값, **분석·지출계획은 PR 7**. 확인: 웹 4종 결과와 흔들린 테스트, verify 375px·320px·데스크톱 × 관리자·회원 결과와 이전·이후 캡처 표, 글자 computed 측정값, 브라우저 확인과 실기기(iOS·Android 설치형 PWA) 미확인 구분. 리뷰: Task 리뷰(Sonnet 5.5) 3회와 최종 리뷰(Opus 5.5) 결과, 반론 리뷰를 하지 않은 이유. 참고: 이 계획, PRD, 와이어프레임, 그리고 **병합 뒤 운영자가 할 일** — ① `docs/deploy.md` 13절 SQL로 관리자 지정(구글 전용 계정 조건 확인, `UPDATE` 1행 확인) ② 그 관리자가 새로 고친 뒤 "연도별 세법 관리"에서 2026 귀속 초안을 만들고 PRD 8.1절 값(최저사용금액 25%, 공제율 15/30/30/40/40, 경계 70,000,000원, 기본한도 3,000,000·3,500,000·4,000,000 / 2,500,000·2,750,000·3,000,000원, 추가한도 3,000,000·2,000,000원, 근거 조세특례제한법 제126조의2와 국가법령정보센터 URL, 기간 2026-01-01~2026-12-31)을 넣어 검증·적용 ③ 적용 전까지 회원 입력자료 화면에는 "세법 준비 중" 안내가 보인다. 맨 끝에 `## 소모값`(`python3 scripts/pr_usage.py`).

---

# PR 7 — 분석·지출계획 화면

① 결제수단 비율은 웹이 `totals`로 계산한다. 서버의 `methodShare`는 계획 저장 시에만 내려오므로 ①도 소수 첫째 자리 `HALF_UP`으로 반올림한다.

**이 PR에 착수할 때 컨트롤러가 Task 상세를 채운다.** 화면 PR이다.

브랜치 예: `feat/tax-analysis`. 검증: 웹 4종 + verify.

### Task 7.1: 단계 화면 틀·진입 규칙·상태 알림 (TAX-10, 13, 27, 36, 38, 65, 66, 68, 73)

**담당:** Codex `gpt-6-astra` / `medium` (`write`, 설계 판단이 큼), 태그 `impl-web-common`. 리뷰: Claude Sonnet 5.5.

- Files: Create `tax/analysis/TaxAnalysisPage.tsx`, `StepTabs.tsx`, 테스트. Modify `tax/TaxIndexRedirect.tsx`(TAX-68), `app/menu.ts`·`tax/TaxTabs.tsx`(하위 메뉴 "분석·지출계획"을 두 번째에), `app/AppRoutes.tsx`, `tax/taxApi.ts`(`analysis(year)`, `savePlan`, `refreshLawVersion`).
- 쿼리 키: `['tax', 'analysis', year]`. 입력자료·지출계획 저장과 `refresh` 뒤 무효화한다.
- 테스트 대상(AC-34, 41, 30, 31, 19 화면): "소득공제"를 누르면 `hasInputs`인 연도는 `/tax/analysis` ① 현황, 연도 기록 없음·자료 없음이면 `/tax/inputs`, 기억한 연도가 없으면 올해 기준, 한 번에 한 단계만 보이고 단계 탭·[이전]·[다음]으로 이동, 처음은 ①, 데스크톱 1단 가운데·최대 폭 제한, 적용 세법(귀속연도·버전·적용일)·자료 기준일·예상 총급여 한 줄, "추정"과 이유·"근로기간 확인 필요"·"새 세법 버전 있음 + [새 버전으로 다시 계산]"(누르기 전 결과 유지), 연도 기록 없음이면 입력자료로 가는 안내, "개인 자료 · 그룹과 무관".

### Task 7.2: ① 현황 (TAX-32~35, 37, 38, 43, 55, 71)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Sonnet 5.5.

- Files: Create `tax/analysis/StatusStep.tsx`, 테스트.
- 테스트 대상(AC-16, 32, 38): 요약 4칸(소득공제액 "과세표준에서 빼는 금액 · 환급액 아님", 최저사용금액 달성, 기본한도 사용, 추가한도 사용), 소비구분별·결제수단별 사용 비율(분모 문장 명시, 소수 첫째 자리, 공제율·한도 사용률과 구별), 합계 0원이면 빈 차트, [계산 과정 보기]는 처음에 접혀 있고 펼치면 최저사용금액 차감 → 공제율 → 한도 순이며 마지막 금액 = 소득공제액, 최저사용금액 미달이면 0원과 남은 금액(권유 문구 없음), "참고: 한도까지 남은 공제 여유", 미완료·세법 준비 중이면 숫자 대신 안내, 금액은 "지출" 가림.

### Task 7.3: ② 지출계획 (TAX-29, 51, 70, 75)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Sonnet 5.5.

- Files: Create `tax/analysis/PlanStep.tsx`, 테스트.
- 테스트 대상(AC-33, 36, 43): 소비구분 4행 × (신용카드 고정 / 체크카드·현금영수증 고정 / 바꿀 수 있음), 합계 자동, 고치기만 하면 저장 요청이 없고 ③이 그대로, [계산하기]를 누르면 저장하고 ③으로 넘어감, 다시 열면 저장 값, 미완료·세법 준비 중에도 입력은 열려 있고 [계산하기]는 저장만, 409면 "다른 곳에서 수정됨, 다시 불러오기", 375px에서 소비구분별 묶음으로 쌓임.

### Task 7.4: ③ 추천 (TAX-37, 50, 53, 54, 69, 75)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Sonnet 5.5.

- Files: Create `tax/analysis/RecommendStep.tsx`, `reasonText.ts`(이유 코드 → 문장), 테스트.
- 테스트 대상(AC-17, 35, 43): "현재 계획: 지금까지의 결제수단 비율(신용 n% · 체크 n% · 현금 n%)" 한 줄(연도 전체 비율), 현재 계획과 추천 배분 표·총액 같음·연말 예상 소득공제액·차이(`formatSignedWon`)·이유·가정(총급여·세법 버전·자료 기준일, 카드 혜택 미고려), 차이 0이면 "차이 없음"과 이유, 미완료면 "자료를 완료하면 계산합니다"·빈 칸 수·[입력자료로 가기], 세법 준비 중이면 "세법 준비 중"만, 계획 미저장이면 ②로 가는 안내. 이유 문장은 응답의 코드·숫자에서만 만든다.

### Task 7.5: 검증 지도와 문서 마무리 (AC-02, AC-23)

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Sonnet 5.5.

- Files: Create `.claude/skills/verify/features/tax-analysis.md`. Modify `features/README.md`, 저장소 `README.md`(주요 기능에 소득공제), `docs/backlog.md`(후속: 그룹 합산, 가계부 자동 합산, 미확인 법령 항목 D03·D08·D09 확인), `docs/superpowers/plans/2026-11-11-tax-planning/README.md` 진행표.

### PR 7 마무리 (컨트롤러)

- 웹 검증 4종, verify 375px·데스크톱(와이어프레임 합성 숫자: 현황 1,475,000원, 현재 계획 1,997,272원, 추천 2,150,000원, 차이 +152,728원이 화면에 나오는지), 캡처, "UI 표준 적용" 절의 검증 항목, 브랜치 최종 리뷰 Claude Opus 5.5 한 번.

---

## 디자인 일관성 후속 백로그 (2026-11-14)

홈·업로드는 현재 PR 1의 메뉴 통합 작업을 우선한다. 이번 대시보드 개선에서는
홈·업로드 코드를 수정하지 않으며, 아래 항목은 통합 완료 후 별도 작업으로 진행한다.
기존 업로드 화면을 다시 만드는 방향으로 적용하지 않는다.

- [ ] 통합된 홈의 요약·월별 등록 현황·업로드 이력과 파일 업로드 창을
  [UI 표준](../../ui-standards.md)에 맞춰 점검한다.
- [ ] 카드 제목 16px, 주요 내용 15px, 버튼 14px, 보조 정보 13px를 기존 토큰으로 적용한다.
  월별 현황처럼 정보가 밀집한 영역은 실제 320px 화면에서 읽기·줄바꿈을 확인한다.
- [ ] 제목·설명은 좌측, 실행 버튼은 소속 카드·행의 우측 끝에 둔다.
  긴 파일명·상태·오류가 버튼을 밀어내지 않게 한다.
- [ ] 설명은 짧게 정리하고 상세 절차는 눌러 여는 도움말로 제공한다.
  파일 형식·용량·기간 제한, 개인정보 처리, 실패 이유·복구 방법과 삭제 결과는 직접 표시한다.
- [ ] 로딩·빈 상태·오류·재시도·업로드 중·긴 이름을 320px/375px/데스크톱에서 확인한다.
  모바일 입력 16px·터치 영역 44px, 안전 영역·키보드·포커스 동작을 유지한다.
- [ ] 구현 때 현재 화면으로 전후 샘플을 다시 확인한다. 기존 홈·업로드 샘플의 타이포그래피·
  정렬 방향만 참고하고, 메뉴 구조·등록 상태 판정·업로드·삭제 동작은 통합 결과를 따른다.

## 알려진 제약

이 계획을 쓰며 코드와 PRD를 대조해 찾은 것이다. 1~4번은 2026-11-13 사용자가 기본값(추천안)으로 확정했고 PRD TAX-63·TAX-76·AC-07에 반영했다.

1. **확정 (2026-11-13, 기본값) (PR 5 전) — "가운데 창"과 현재 `Dialog`의 차이.** PRD D26·TAX-76·AC-44는 좁은 화면에서도 가운데 창이라고 하고 근거로 "홈의 업로드·데이터 관리 창도 이미 `Dialog`"를 든다. 그런데 `common/Dialog.tsx`의 `DialogFrame`은 좁은 화면에서 아래에서 올라오는 시트로 그린다(`Dialog.tsx:23, 40-46`). 기본값: `Dialog`에 `centered` 선택지를 더해 소득공제 창만 가운데로 연다(Task 5.1). 다른 선택: 기존 `Dialog` 모양(좁은 화면 시트)을 그대로 쓰고 AC-44를 고친다.
2. **확정 (2026-11-13, 기본값) (PR 4 전) — AC-07과 TAX-45.** AC-07은 "1원 초과면 0원보다 크다"인데, 원 미만을 버리면(TAX-45) 신용카드 1원 초과는 0.15원이라 0원이다. 기본값: TAX-45를 따르고 테스트는 "같음 → 0원, 1원 초과 → 0원, 7원 초과 → 1원"으로 쓴다.
3. **확정 (2026-11-13, 기본값) (PR 2 전) — 적용에 메모가 필수인가.** TAX-63은 "근거, 적용 대상 기간, 메모를 적어야"이고 AC-21은 "근거·적용 대상 기간이 비었거나"다. 기본값: 근거 3항목과 기간은 필수, 메모는 선택.
4. **확정 (2026-11-13, 기본값) (PR 5 전) — 중간 노출.** 웹은 `main` 병합 즉시 배포되므로 PR 5 병합부터 PR 7 병합 전까지 회원은 소득공제 메뉴에서 입력자료만 본다. PR 1 병합부터 PR 5 병합 전까지 하단 탭은 4칸이다. 기본값: 받아들인다. 다른 선택: PR 7까지 소득공제 메뉴를 서비스 관리자에게만 보인다.
5. **해석 — 공제율이 서로 다를 때의 차감 순서.** PRD 7.1절 3번 식은 직불등과 문화체육, 전통시장과 대중교통의 공제율이 같다고 놓았다. 관리자는 5종을 따로 설정할 수 있으므로(8.2절) 알고리즘 버전 1은 차감 순서를 A → B → M → T → P로 고정했다. 2025·2026 값에서는 PRD 식과 결과가 같다.
6. **해석 — 공제율·비율은 정수 퍼센트.** 소수 공제율(예: 12.5%)이 생기면 migration과 계산기 변경이 필요하다.
7. **해석 — 세법 버전 기억 시점.** 연도 기록을 만들 때 현재 적용 버전을 기억하고, 적용 버전이 없던 연도는 첫 버전이 적용될 때 자동으로 그 버전을 기억한다(회원이 누르지 않아도 "세법 준비 중"이 풀린다). 이미 버전이 있는 연도 기록만 [새 버전으로 다시 계산]을 기다린다. 적용과 연도 기록 만들기가 겹쳐도 빠지는 기록이 없도록 귀속연도별 advisory lock을 쓴다(PR 3 "소유권·동시성 설계").
8. **해석 — 자녀등 입력란.** 세법 버전의 자녀등 단계별 기본한도가 서로 다를 때만 보인다(별도 설정값 없음). 적용 버전이 없는 연도는 입력란이 없고 0으로 저장한다.
9. **해석 — 선택 연도 기억.** 메모리(React 상태)에만 둔다. 새로 고치면 올해로 돌아간다.
10. PR 1 뒤 홈의 넓은 화면은 문서 순서(요약 → 등록 현황)와 보이는 순서(등록 현황 왼쪽)가 다르다. 와이어프레임이 정한 배치이고 키보드 순서는 문서 순서를 따른다.
11. 계획의 PR 1 코드는 임시 복사본에서 테스트·typecheck·lint·build까지 확인했지만 화면은 띄워 보지 않았다. PR 2의 코드는 임시 복사본에서 `./gradlew test`(320건)까지 실행해 확인했다(2.2·2.3의 RED 컴파일 오류 문구는 실행하지 않고 적음). PR 3의 코드는 임시 복사본에서 Task 순서대로 실패 확인(3.1: 15건 중 13건, 3.2: 14건 중 13건, 3.3: 11건 중 9건 실패)과 `./gradlew cleanTest test`(3.3 뒤 369건)까지 실행해 확인했고, 계획에 실은 코드 블록을 차례로 넣으면 그 상태와 같아지는 것도 확인했다(2026-11-16, `2987768` 기준). PR 4의 코드는 임시 복사본에서 Task 순서대로 실패 확인(4.1: 10건 중 10건, 4.2: 16건 중 16건, 4.3: 7건 중 7건 실패)과 `./gradlew cleanTest test`(4.1 뒤 385건, 4.2 뒤 401건, 4.3 뒤 408건)까지 실행해 확인했다(2026-11-17, `f908524` 기준). `memoryTest`와 실제 서버 기동은 하지 않았다. PR 5의 웹 코드는 임시 복사본에서 Task 순서대로 실패 확인(5.1: 새 5건 중 3건, 5.2: 7건과 새 파일 2개, 5.3: 12건, 5.4: 12건, 5.5: 5건 실패)과 `typecheck`·`lint`·`build`·전체 `vitest run --maxWorkers=4`(85파일 684건)까지 실행했고, 계획의 코드 블록을 차례로 넣으면 그 상태와 같아지는 것도 확인했다(2026-11-20, `4aecc38` 기준). 화면과 verify 시드(`seed.sh`·`doctor.sh`는 `bash -n`만)는 실행하지 않았다. PR 6의 웹 코드는 임시 복사본에서 Task 순서대로 실패 확인(6.1: 테스트 파일 2개가 import 해석 실패로 파일째, 6.2: 새 12건 실패)과 `typecheck`·`lint`·`build`·전체 `vitest run --maxWorkers=4`(87파일 726건)까지 실행했고, 계획의 코드 블록을 차례로 넣으면 그 상태와 같아지는 것도 확인했다(2026-11-21, `15b38dc` 기준). 화면은 띄워 보지 않았다. PR 7의 설계는 실행해 보지 않았다.
12. 세법 수치와 7.1절 산식은 독립적인 세무 검증을 거치지 않았다(PRD 14장). D03(합산 기간)·D08(원 단위)·D09(귀속 시점)의 법령 기준은 미확인이고 임시 규칙이다. PR 4 착수 전 조문 대조(2026-11-17)에서 PRD와 다른 값은 없었다: 최저사용금액 25%, 공제율 15/30/30/40/40, 7천만원 경계, 차감액 3경우, 기본한도 300만·250만과 2026 귀속 자녀등 350만·400만 / 275만·300만, 추가한도 300만·200만이 국세청 안내(https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2469&cntntsId=7794)와 조문 열람 사이트(https://casenote.kr/법령/조세특례제한법/제126조의2)의 내용과 같다. 다만 국가법령정보센터 원문은 이번 도구로 읽지 못했고 두 자료 모두 요약 도구를 거쳐 읽었으며, 자녀등 한도는 국세청 안내에 없어 조문 열람 사이트와 2차 자료로만 확인했다. 상세는 PR 4 "조문 대조".
13. 회원 탈퇴 기능이 없어 `ON DELETE CASCADE`에 따른 소득공제 자료 삭제는 검증 대상이 아니다(PRD 2장 비범위).
14. 후속: 관리자 인가를 인터셉터에서 Spring Security 필터 체인으로 옮긴다. 현재는 지원하지 않는 HTTP 메서드의 405 응답으로 라우트 구조가 드러날 수 있다.
15. **2027 귀속 세법(미확정).** 2026.8.3. 발표된 세제개편안은 2027년 사용분부터 대중교통 우대 폐지, 추가한도 축소, 문화체육 30%의 7천만원 요건 폐지를 담고 있다(https://news.mtn.co.kr/news-detail/2026080315521251297 , 확인 시점에 국회 미확정). 2026 귀속에는 영향이 없다. 확정되면 "문화체육 우대는 낮은 급여구간만"이 계산기(알고리즘 버전 1)에 고정돼 있어 2027 귀속 세법 버전을 값만으로 등록할 수 없고 알고리즘 버전 2가 필요하다(PRD 8.2절).
16. **해석 — 분석의 과정 값과 추천 탐색(PR 4).** 계산 과정 값은 표시용으로 각각 원 미만을 버리되 `remainingToThreshold`는 최저사용금액을 넘기 위해 더 쓸 최소 정수 원(이미 넘었으면 0)이며, 소득공제액만 계산 결과다. 추천은 소비구분을 하나씩 보는 탐색이고, 신용카드 공제율이 직불등보다 높게 설정된 세법에서는 최댓값을 놓칠 수 있다(2025·2026 값에서는 16개 조합의 최댓값과 같음을 테스트로 고정). 상세와 다른 선택은 PR 4 "결정이 필요한 점".
