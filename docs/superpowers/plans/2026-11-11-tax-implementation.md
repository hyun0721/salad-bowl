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
- UI는 기존 디자인 토큰과 `apps/web/src/common/` 부품을 먼저 쓴다. 금액 입력은 `MoneyField`(`minValue={0}`), 금액 표시는 `useAmountFormatter`(총급여 `'income'`, 공제대상액·공제액 `'expense'`).
- 검증: 웹 변경은 `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`, API 변경은 `cd apps/api && ./gradlew test`(업로드 한도·파서·메모리 변경이 있을 때만 `./gradlew memoryTest`도). 화면이 바뀌면 `.claude/skills/verify` 스킬로 375px와 데스크톱을 확인하고 PR용 이전·이후 캡처를 만든다.
- PR: 제목 `type(scope): 한국어 요약`, 본문 `무엇 / 확인 / 리뷰 / 참고 / 소모값`. 화면이 바뀐 PR은 375px 이전·이후 캡처를 `pr-assets` 브랜치 `pr-<번호>/`에 올린다. 구현하지 않은 쪽의 리뷰 없이 PR을 올리지 않는다. 사용자가 요청하지 않으면 병합하지 않는다.

## PR 분할

| PR | 목적 | 포함 TAX-ID | 의존 PR | 위험 영역(반론 리뷰) | 화면 변화(375px 캡처) |
|---|---|---|---|---|---|
| 1 `feat(web)` | 업로드 메뉴·화면 제거, 월별 등록 현황·업로드 이력을 홈으로 이동, 옛 `/upload` 주소 처리 | TAX-14, 15, 16, 17, 18, 74 (TAX-12 중 "업로드 없음") | 없음 | 아니오. 월 데이터 삭제 창은 위치만 옮기고 코드는 그대로다 | 예 (홈, 하단 탭) |
| 2 `feat(api)` | 서비스 관리자 권한, 세법 버전 저장·관리 API | TAX-04, 05, 06(서버), 60, 61, 62, 63, 64, 67, 72 | 없음 | **예 — 권한(서비스 관리자), 삭제(초안)** | 아니오 |
| 3 `feat(api)` | 연도 기록·입력자료·지출계획 저장 API, 소유권, 동시 수정 409, 세법 버전 기억 | TAX-01, 02, 03, 20~24, 26~29(서버), 51, 65, 66, 70(저장) | 2 | **예 — 소유권(404 숨김), 삭제(연도 기록·카드 자료)** | 아니오 |
| 4 `feat(api)` | 계산기(7.1)·현재 계획 배분·추천(7.2) 순수 로직과 분석 조회 API | TAX-35(값), 38(상태), 40~46, 50, 52~54, 69, 71(단계 값), 75(상태) | 3 | 아니오 (조회만. 소유권 검사는 PR 3의 것을 쓴다) | 아니오 |
| 5 `feat(web)` | 소득공제 메뉴·라우트, 선택 연도, 입력자료 화면 | TAX-07, 10, 12, 13, 19, 20~31, 37, 68(일부), 76 | 3 (자녀등 입력란 판단에 2) | 아니오 (서버 권한·삭제는 PR 2·3에서 검토. 로그아웃 캐시 테스트 포함) | 예 |
| 6 `feat(web)` | 연도별 세법 관리 화면(관리자), 권한 없음 화면 | TAX-04, 06(화면), 10, 11, 19(세 번째 탭), 60~64, 67, 72 | 2, 5 | 아니오 (화면 숨김은 편의이고 권한은 서버가 판단) | 예 |
| 7 `feat(web)` | 분석·지출계획 화면(① 현황 ② 지출계획 ③ 추천), 메뉴 진입 규칙 | TAX-10, 13, 27(추정), 32~38, 43, 50~55, 65, 66, 68, 69, 70, 71, 73, 75 | 4, 5 | 아니오 | 예 |

순서와 묶음의 이유

- PR 1은 소득공제 자료와 무관한 기존 화면 변경이라 먼저 따로 낸다(PRD 4.2절). 이 PR에서 하단 탭은 4칸이 되고, 소득공제 메뉴는 화면이 생기는 PR 5에서 들어와 5칸이 된다. 빈 메뉴를 운영에 내보내지 않기 위해서다(`main` 병합 즉시 Pages가 웹을 배포한다).
- 연도 기록이 세법 버전을 FK로 가리키므로 세법 버전(PR 2)이 연도 기록(PR 3)보다 먼저다. 서비스 관리자 권한은 세법 API의 전제라 PR 2에 묶었다.
- 권한·삭제가 바뀌는 PR 2·3을 계산(PR 4)과 나눠 반론 리뷰 범위를 좁혔다. PR 4는 DB 쓰기가 없는 순수 계산과 조회라 계산 기대값 검토에 집중할 수 있다.
- 웹은 입력자료(PR 5) → 세법 관리(PR 6) → 분석(PR 7) 순이다. 분석 화면이 나가기 전에 운영자가 화면으로 2026 귀속 세법을 등록할 수 있어야 "세법 준비 중"만 보이는 기간이 없다.
- PR 5~7은 병합할 때마다 운영에 보인다. PR 5 병합 뒤 PR 7 병합 전까지 회원은 입력자료 화면만 본다(중간 노출을 받아들이는 것이 이 계획의 기본값이다. "알려진 제약" 참고).

**PR 2~7의 Task 상세는 그 PR에 착수할 때 컨트롤러가 채운다.** 뒤 PR의 코드는 앞 PR 결과(실제 엔티티·응답 필드 이름)에 의존하기 때문이다. 이 문서에는 PR 2~7의 Task 목록·파일·인터페이스·테스트 대상·검증 명령까지 적었다. PR 1은 실행 가능한 상세까지 적었다.

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

**이 PR에 착수할 때 컨트롤러가 Task 상세(테스트 코드·단계)를 채운다.** 반론 리뷰 대상이다(권한·삭제).

브랜치 예: `feat/tax-law-api`. 검증: `cd apps/api && ./gradlew test`. 업로드·파서를 건드리지 않으므로 `memoryTest`는 생략하고 PR 본문에 이유를 적는다(API CI는 둘 다 돌린다).

데이터 설계

- `V8__add_service_admin.sql`: `ALTER TABLE users ADD COLUMN service_admin BOOLEAN NOT NULL DEFAULT FALSE;`
- `V9__create_tax_law_versions.sql`
  - `tax_law_versions`: `id BIGSERIAL PK`, `tax_year INTEGER NOT NULL`, `version_no INTEGER NOT NULL`, `status VARCHAR(10) NOT NULL CHECK (status IN ('DRAFT','APPLIED'))`, `algorithm_version INTEGER NOT NULL DEFAULT 1`, 설정값(모두 NULL 허용 — 초안은 빈 값으로 시작할 수 있다): `min_spend_rate_pct`, `rate_credit_pct`, `rate_debit_cash_pct`, `rate_culture_pct`, `rate_market_pct`, `rate_transit_pct` (`INTEGER`), `bracket_boundary`, `basic_limit_low_0`, `basic_limit_low_1`, `basic_limit_low_2`, `basic_limit_high_0`, `basic_limit_high_1`, `basic_limit_high_2`, `extra_limit_low`, `extra_limit_high` (`BIGINT`), 근거: `basis_law_name VARCHAR(200)`, `basis_article VARCHAR(200)`, `basis_url VARCHAR(500)`, 적용 대상 기간: `period_start DATE`, `period_end DATE`, `memo VARCHAR(1000)`, `created_by BIGINT REFERENCES users (id) ON DELETE SET NULL`, `applied_by BIGINT REFERENCES users (id) ON DELETE SET NULL`, `created_at`, `updated_at`, `applied_at TIMESTAMPTZ`, `row_version BIGINT NOT NULL DEFAULT 0`, `UNIQUE (tax_year, version_no)`.
  - `tax_law_year_counters (tax_year INTEGER PRIMARY KEY, last_version_no INTEGER NOT NULL)`: 삭제한 번호를 다시 쓰지 않기 위한 연도별 번호 카운터.
- 서비스 관리자 지정 절차를 `docs/deploy.md`에 적는다: `UPDATE users SET service_admin = TRUE WHERE email = '<관리자 이메일>';`
- `docs/architecture.md`의 API 패키지 목록에 `tax`를 더한다.

HTTP 인터페이스 (웹 PR 5·6이 쓴다)

| 메서드·경로 | 권한 | 동작 |
|---|---|---|
| `GET /me` | 로그인 | 응답에 `serviceAdmin: boolean` 추가 |
| `GET /tax/law-versions/current?year=YYYY` | 로그인 | 그 연도의 현재 적용 버전(가장 최근 `applied_at`). 없으면 404 `NOT_FOUND` |
| `GET /tax/admin/law-versions?year=YYYY` | 서비스 관리자 | 그 연도의 모든 버전(초안·적용), 번호 내림차순 |
| `POST /tax/admin/law-versions` `{taxYear}` | 서비스 관리자 | 새 초안 201. 현재 적용 버전 값을 복사, 없으면 빈 값. 번호는 카운터 + 1 |
| `GET /tax/admin/law-versions/{id}` | 서비스 관리자 | 버전 하나 |
| `PUT /tax/admin/law-versions/{id}` | 서비스 관리자 | 초안 수정(본문에 `rowVersion`). 적용본이면 409 `CONFLICT`, `rowVersion`이 다르면 409 |
| `POST /tax/admin/law-versions/{id}/validate` | 서비스 관리자 | `{errors: [{field, message}]}` (빈 배열이면 통과) |
| `POST /tax/admin/law-versions/{id}/apply` | 서비스 관리자 | 검증 통과 시 적용(상태·`applied_by`·`applied_at`). 실패면 400 `VALIDATION_FAILED`. 이미 적용본이면 409 |
| `DELETE /tax/admin/law-versions/{id}` | 서비스 관리자 | 초안이면 204, 적용본이면 409 |

서비스 관리자가 아니면 `/tax/admin/**`은 모두 403 `FORBIDDEN`, 비로그인은 401이다. 버전 응답 필드: `id, taxYear, versionNo, status, algorithmVersion, minSpendRatePct, bracketBoundary, rateCreditPct, rateDebitCashPct, rateCulturePct, rateMarketPct, rateTransitPct, basicLimitLow[3], basicLimitHigh[3], extraLimitLow, extraLimitHigh, basisLawName, basisArticle, basisUrl, periodStart, periodEnd, memo, createdByNickname, appliedByNickname, createdAt, appliedAt, rowVersion`. `childTiersApply`(자녀등 단계 값이 서로 다른지)도 내려 웹이 자녀등 입력란을 보일지 판단한다.

### Task 2.1: 서비스 관리자 컬럼과 권한 검사 (TAX-05, 06)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `V8__add_service_admin.sql`, `user/ServiceAdminGuard.java`, 테스트용 `support/TestAdmins.java`(SQL로 관리자 지정·회수). Modify `user/User.java`(필드 `serviceAdmin`, getter), `user/MeController.java`(`MeResponse`에 `serviceAdmin`), `user/MeApiTest.java`, `docs/deploy.md`.
- Interfaces — Produces: `ServiceAdminGuard.require(long userId)`: DB에서 `service_admin`을 읽어 아니면 `ApiException(ErrorCode.FORBIDDEN, …)`. `MeResponse(long userId, String email, String nickname, boolean serviceAdmin)`.
- 테스트 대상: `/me`가 기본 `serviceAdmin=false`, DB에서 켜면 `true`. 가드는 Task 2.2의 API로 확인한다(AC-04, AC-05의 "회수하면 다음 요청부터 403": 같은 access 토큰으로 회수 전 200 → 회수 후 403). 그룹을 만들어 그룹 ADMIN이 된 회원도 403(AC-04).

### Task 2.2: 세법 버전 저장소와 초안 만들기·조회·수정·삭제 (TAX-04, 60, 61, 62, 67, 72)

**담당:** Codex `gpt-6-astra` / `medium` (`api`, 설계 판단이 큼), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `V9__create_tax_law_versions.sql`, `tax/law/TaxLawVersion.java`, `TaxLawStatus.java`, `TaxLawVersionRepository.java`, `TaxLawService.java`, `TaxLawAdminController.java`, `TaxLawDtos.java`, `tax/law/TaxLawAdminApiTest.java`. Modify `docs/architecture.md`.
- Interfaces — Consumes: `ServiceAdminGuard.require`. Produces: 위 표의 `GET(list)`, `POST`, `GET(one)`, `PUT`, `DELETE`. `TaxLawService.createDraft(long adminId, int taxYear)`, `updateDraft(long adminId, long id, TaxLawDtos.UpdateRequest)`, `deleteDraft(long adminId, long id)`.
- 번호: `INSERT INTO tax_law_year_counters … ON CONFLICT (tax_year) DO UPDATE SET last_version_no = tax_law_year_counters.last_version_no + 1 RETURNING last_version_no`로 한 문장에 받는다.
- 테스트 대상(AC-39, AC-19 일부): 초안이 있는 연도에 또 초안 생성 가능, 번호 = 지금까지 가장 큰 번호 + 1, 초안 삭제 뒤 만든 초안이 삭제한 번호를 다시 쓰지 않음, 초안 삭제 204·적용본 삭제 409, 적용본 `PUT` 409, `rowVersion` 불일치 409, 작성자 기록, 비관리자·그룹 ADMIN 403, 비로그인 401, 연도 범위 밖(4자리 아님) 400.

### Task 2.3: 검증·적용·현재 적용 버전 (TAX-63, 64, 61, 72)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Modify `TaxLawService.java`, `TaxLawAdminController.java`, `TaxLawDtos.java`. Create `tax/law/TaxLawController.java`(`/tax/law-versions/current`), `tax/law/TaxLawApplyApiTest.java`.
- Interfaces — Produces: `TaxLawService.validate(TaxLawVersion): List<FieldError>`, `apply(long adminId, long id)`, `currentApplied(int taxYear): Optional<TaxLawVersion>`. 검증 규칙: 비율 6개는 0~100 정수, 금액 9개는 0 이상 정수, 빈 값 없음, `basisLawName`·`basisArticle`·`basisUrl`·`periodStart`·`periodEnd` 필수(`periodStart ≤ periodEnd`). 메모는 선택이다("알려진 제약" 참고).
- 테스트 대상(AC-21, AC-19, AC-39): 근거·기간이 비었거나 비율·금액이 범위를 벗어난 초안은 적용 400이고 상태가 초안 그대로, `validate`가 필드별 오류를 돌려줌, 적용 뒤 적용자·시각 기록, 한 초안을 적용해도 다른 초안은 초안, 번호가 낮은 초안을 나중에 적용하면 그것이 현재 적용 버전, 새 초안이 현재 적용 버전 값을 복사, 적용 버전이 없는 연도의 `current`는 404, 일반 회원도 `current`는 200.

### PR 2 마무리 (컨트롤러)

- `cd apps/api && ./gradlew test` 확인. `~/.gradle/init.d`·`gradle.properties`가 바뀌지 않았는지 확인(`api` 모드 규칙).
- 브랜치 최종 리뷰: Claude Fable 5.2 한 번. **반론 리뷰: Codex `gpt-6-astra` / `xhigh` (`read`, 템플릿 F, 태그 `review-risk`)** — 볼 것: 관리자 검사 누락 경로, 토큰만으로 권한이 유지되는지, 초안/적용본 상태 경합(동시에 적용·삭제), 번호 카운터 경합.

---

# PR 3 — 연도 기록·입력자료·지출계획 API

**이 PR에 착수할 때 컨트롤러가 Task 상세를 채운다.** 반론 리뷰 대상이다(소유권·삭제).

브랜치 예: `feat/tax-records-api`. 검증: `cd apps/api && ./gradlew test`.

데이터 설계 (`V10__create_tax_records.sql`)

- `tax_year_records`: `id BIGSERIAL PK`, `owner_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE`, `tax_year INTEGER NOT NULL`, `total_salary BIGINT NOT NULL CHECK (total_salary >= 1)`, `work_start_month`, `work_end_month` (`INTEGER NOT NULL`, 1~12, 시작 ≤ 종료), `child_count INTEGER NOT NULL DEFAULT 0 CHECK (child_count >= 0)`, `law_version_id BIGINT REFERENCES tax_law_versions (id)`(NULL = 그 연도에 적용 버전이 아직 없음), `row_version BIGINT NOT NULL DEFAULT 0`, `created_at`, `updated_at`, `UNIQUE (owner_id, tax_year)`.
- `tax_card_statements`: `id`, `record_id BIGINT NOT NULL REFERENCES tax_year_records (id) ON DELETE CASCADE`, `issuer_name VARCHAR(50) NOT NULL`, `as_of_date DATE NOT NULL`, `memo VARCHAR(200)`, 금액 8칸 `credit_general`, `credit_market`, `credit_transit`, `credit_culture`, `debit_general`, `debit_market`, `debit_transit`, `debit_culture` (`BIGINT`, NULL = 미입력, `CHECK (… >= 0)`), `row_version`, 인덱스 `(record_id)`.
- `tax_cash_receipts`: `record_id BIGINT PRIMARY KEY REFERENCES tax_year_records (id) ON DELETE CASCADE`, `as_of_date DATE NOT NULL`, `memo VARCHAR(200)`, 금액 4칸 `general`, `market`, `transit`, `culture` (`BIGINT` NULL 허용, 0 이상), `row_version`. 행이 없으면 "한 번도 입력하지 않음 = 4칸 빈 미완료"다.
- `tax_spending_plans`: `record_id BIGINT PRIMARY KEY … ON DELETE CASCADE`, 소비구분 4 × (`_credit_fixed`, `_debit_fixed`, `_flexible`) 12칸 (`BIGINT NOT NULL DEFAULT 0`, 0 이상), `row_version`.
- PRD 9장의 "소비금액" 개념은 별도 행이 아니라 자료 행의 칸(컬럼)으로 둔다. 결제수단·소비구분 종류가 바뀌면 어차피 코드 변경이기 때문이다(PRD 8.2절).
- 금액 상한은 `MoneyField`와 같은 9,999,999,999,999원이다.

동시 수정(TAX-29): 비교 단위는 행 하나다(연도 기록 기본정보 / 카드 자료 한 건 / 현금영수증 자료 / 지출계획). 수정 요청은 읽을 때 받은 `rowVersion`을 보내고, 서버는 현재 값과 다르면 409 `CONFLICT`를 준다. 엔티티에는 JPA `@Version`을 달아 같은 순간의 경합도 막고, `ObjectOptimisticLockingFailureException`을 `GlobalExceptionHandler`에서 409 `CONFLICT`로 바꾼다.

세법 버전 기억(TAX-66): 연도 기록을 만들 때 그 연도의 현재 적용 버전이 있으면 `law_version_id`에 넣는다. 없으면 NULL이고, 관리자가 그 연도의 버전을 적용하는 트랜잭션에서 NULL인 연도 기록에 그 버전을 넣는다. 이미 버전이 있는 연도 기록은 회원이 `refresh`를 부를 때만 바뀐다.

HTTP 인터페이스 (모두 로그인 회원 본인의 자료. 경로에 회원 id가 없다)

| 메서드·경로 | 동작 |
|---|---|
| `GET /tax/years/{year}` | 연도 기록 묶음(`TaxYearView`). 없으면 404 |
| `PUT /tax/years/{year}` `{totalSalary, workStartMonth, workEndMonth, childCount, rowVersion?}` | 없으면 생성(201, 연도는 서버 기준 올해·전년도·다음 해만), 있으면 기본정보 수정(200). 범위 밖 연도 생성은 400 |
| `DELETE /tax/years/{year}` | 연도 기록과 딸린 자료·지출계획 삭제 204. 없으면 404 |
| `POST /tax/years/{year}/cards` | 카드 자료 추가 201 |
| `PUT /tax/years/{year}/cards/{cardId}` | 카드 자료 수정(`rowVersion`) |
| `DELETE /tax/years/{year}/cards/{cardId}` | 카드 자료 삭제 204 |
| `PUT /tax/years/{year}/cash-receipt` | 현금영수증 자료 생성·수정(`rowVersion?`). 삭제 경로는 없다(D19) |
| `PUT /tax/years/{year}/plan` | 지출계획 저장(`rowVersion?`) |
| `POST /tax/years/{year}/law-version/refresh` | 연도 기록의 세법 버전을 현재 적용 버전으로 바꿈 |

`TaxYearView`: `taxYear, rowVersion, totalSalary, workStartMonth, workEndMonth, childCount, lawVersion: {id, versionNo, appliedAt, childTiersApply} | null, newerLawVersion: boolean, cards: [{id, rowVersion, issuerName, asOfDate, memo, amounts(8칸, null 가능), blankCount}], cashReceipt: {rowVersion, asOfDate, memo, amounts(4칸), blankCount} | null, plan: {rowVersion, 12칸} | null, totals: 12칸(미입력은 0으로 더함), blankCount(현금영수증 미입력이면 4 포함), hasInputs, asOfDateMismatch`.

### Task 3.1: 연도 기록 만들기·조회·수정·삭제와 소유권 (TAX-01, 02, 03, 20, 28, 29, 65)

**담당:** Codex `gpt-6-astra` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `V10__create_tax_records.sql`(네 테이블 모두), `tax/record/TaxYearRecord.java`, `TaxYearRecordRepository.java`, `TaxRecordService.java`, `TaxRecordController.java`, `TaxRecordDtos.java`, `tax/record/TaxYearApiTest.java`. Modify `common/GlobalExceptionHandler.java`(낙관적 잠금 예외 → 409).
- Interfaces — Consumes: `TaxLawService.currentApplied(int)`. Produces: `TaxRecordService.requireOwned(long userId, int year): TaxYearRecord`(없으면 `NOT_FOUND` — 뒤 Task와 PR 4가 모든 접근에 쓴다), `GET/PUT/DELETE /tax/years/{year}`.
- 테스트 대상(AC-01, 02, 03, 15, 20, 22, 30, 33): 그룹 미가입 회원이 등록·조회 가능, 그룹에 가입·공개·탈퇴해도 같은 자료, 같은 그룹에서 공개 중인 회원·그룹 ADMIN·서비스 관리자가 남의 연도를 요청하면 자기 것(없으면 404)만 보임, 같은 연도 두 번 만들면 하나만 존재(두 번째는 수정), 근로기간 시작 > 종료 400, 총급여 0 이하 400, 올해±1 밖 연도 생성 400, 적용 버전 없는 연도도 저장됨(`lawVersion=null`), 삭제하면 그 연도만 지워지고 다른 연도는 남음, `rowVersion` 불일치 409이고 먼저 저장한 값 유지, 비로그인 401.

### Task 3.2: 카드 자료·현금영수증 자료와 연도 합계 (TAX-21, 22, 23, 24, 26, 27, 28)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/record/TaxCardStatement.java`, `TaxCashReceipt.java`, 저장소 2개, `SpendingTotals.java`, `tax/record/TaxStatementApiTest.java`. Modify `TaxRecordService.java`, `TaxRecordController.java`, `TaxRecordDtos.java`.
- Interfaces — Produces: `record SpendingTotals(long creditGeneral, long creditMarket, long creditTransit, long creditCulture, long debitGeneral, long debitMarket, long debitTransit, long debitCulture, long cashGeneral, long cashMarket, long cashTransit, long cashCulture)`와 `SpendingTotals.of(cards, cashReceipt)`, `blankCount`, `asOfDateMismatch` 계산. 위 표의 cards·cash-receipt 경로.
- 테스트 대상(AC-01, 14, 15, 22, 28, 31, 33, 37): 남의 `cardId`로 수정·삭제 404이고 데이터 불변, 같은 카드사명 두 건 저장 가능, 빈 칸(null)과 0 구별·`blankCount`, 현금영수증 미입력 연도의 `blankCount`에 4 포함, 0으로 채우면 0, 음수·상한 초과 400, 기준일이 귀속연도 밖이면 400, 카드사명 공백 제거·빈 값 400·50자 초과 400, 합계가 그 연도 자료의 합과 같고 다른 연도는 더하지 않음, 카드 자료 삭제 뒤 합계 감소, 현금영수증 `DELETE`는 405(경로 없음), 연도 기록 삭제 시 현금영수증도 삭제, 기준일이 서로 다르면 `asOfDateMismatch=true`·같으면 false, `rowVersion` 불일치 409.

### Task 3.3: 지출계획 저장과 세법 버전 기억·다시 계산 (TAX-51, 66, 70, 29)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/record/TaxSpendingPlan.java`, 저장소, `tax/record/TaxPlanApiTest.java`, `tax/record/TaxLawPinApiTest.java`. Modify `TaxRecordService.java`, `TaxRecordController.java`, `TaxRecordDtos.java`, `tax/law/TaxLawService.java`(`apply`에서 `law_version_id IS NULL`인 그 연도 기록에 버전 넣기).
- Interfaces — Produces: `PUT /tax/years/{year}/plan`, `POST /tax/years/{year}/law-version/refresh`, `TaxYearView.newerLawVersion`(연도 기록의 버전 ≠ 현재 적용 버전).
- 테스트 대상(AC-19, 33, 36, 01): 지출계획 12칸 저장·재조회, 음수 400, 남의 연도 404, `rowVersion` 불일치 409, 새 버전이 적용돼도 연도 기록의 `lawVersion.id`는 그대로이고 `newerLawVersion=true`, `refresh` 뒤 새 버전·`newerLawVersion=false`, 적용 버전이 없던 연도에 첫 버전이 적용되면 기존 연도 기록에 그 버전이 들어감.

### PR 3 마무리 (컨트롤러)

- `cd apps/api && ./gradlew test`. 브랜치 최종 리뷰: Claude Fable 5.2 한 번. **반론 리뷰: Codex `gpt-6-astra` / `xhigh` (`review-risk`)** — 볼 것: `owner_id` 조건 없이 id만으로 읽는 쿼리, 404/403/409 응답 차이로 남의 자료 존재가 새는지, 삭제 연쇄 범위, `apply` 때 NULL 채우기가 다른 연도·이미 버전이 있는 기록을 건드리는지, 낙관적 잠금 우회.

---

# PR 4 — 계산기·추천·분석 조회 API

**이 PR에 착수할 때 컨트롤러가 Task 상세를 채운다.** 착수 전에 PRD 7.1절 산식을 8.1절 출처의 조문과 한 번 더 대조한다(PRD 14장).

브랜치 예: `feat/tax-analysis-api`. 검증: `cd apps/api && ./gradlew test`.

계산 규칙 (알고리즘 버전 1)

- 입력: 총급여 S, 자녀등 수, `SpendingTotals` 12칸, `TaxLawValues`. 체크카드와 현금영수증은 "직불등"으로 묶는다.
- S ≤ `bracketBoundary`면 낮은 구간(문화체육 우대 적용), 초과면 높은 구간(문화체육을 원래 결제수단의 일반으로 보고 M = 0).
- 최저사용금액 L = S × `minSpendRatePct` ÷ 100. 전체가 L 이하면 0원.
- 공제 가능 금액 = Σ(구분 금액 × 그 공제율) − 차감액. 차감액은 L을 A(신용) → B(직불등) → M(문화체육) → T(전통시장) → P(대중교통) 순으로 채우며 각 구간에 그 공제율을 곱한 합이다. 2025·2026 값(B와 M 30%, T와 P 40%)에서는 PRD 7.1절 3번 식과 같다.
- 기본한도 H = 구간 × 자녀등 단계(0 / 1 / 2명 이상). 추가 인정액 = min(공제 가능 금액 − H, T·P·M의 공제율 곱 합계, 구간별 추가한도 상한), 공제 가능 금액 ≤ H면 0. 소득공제액 = min(공제 가능 금액, H) + 추가 인정액.
- 정수 연산: 중간값은 원×10,000 `long`(금액 상한 약 10^13 × 100 × 100 = 10^17 < 2^63). 최종 소득공제액에서 10,000으로 나눠 한 번 내린다. 현재 계획 배분의 `V × 입력액 ÷ 합`만 `BigInteger`로 계산한다(곱이 `long`을 넘을 수 있다).
- 현재 계획 배분: PRD 7.2절 규칙 1~5.
- 추천: 현재 계획에서 시작해 소비구분을 일반 → 문화체육 → 전통시장 → 대중교통 순으로 보며, 그 소비구분의 "바꿀 수 있는 금액"을 전부 신용카드 / 전부 체크카드·현금영수증에 둔 두 후보를 같은 계산기로 계산해 지금까지의 최댓값보다 엄격히 클 때만 바꾼다. 같으면 현재 계획의 배분을 유지한다. 근사식을 쓰지 않는다.
- 이유는 문장이 아니라 코드와 숫자로 내려 준다(문장은 웹이 만든다): `CREDIT_OVER_THRESHOLD`, `BELOW_THRESHOLD`, `LIMIT_REACHED`, `METHOD_NEUTRAL`, `NO_FLEXIBLE_AMOUNT`.

HTTP 인터페이스: `GET /tax/years/{year}/analysis` (본인 연도 기록만, 없으면 404)

`status`: `NO_INPUT`(입력자료 없음) → `INCOMPLETE`(빈 칸 있음, `blankCount`) → `LAW_PENDING`(자료 완료, 연도 기록에 세법 버전 없음) → `READY` 순으로 판정한다. 공통 필드: `taxYear, status, blankCount, totals, totalSalary, estimated(=asOfDateMismatch), asOfDateMin, asOfDateMax, partialYear(근로기간이 1~12월 전체가 아님), law: {id, taxYear, versionNo, appliedAt} | null, newerLawVersion, planSaved`. `READY`일 때만 `deduction: {highBracket, A, B, M, T, P, total, threshold, thresholdReached, remainingToThreshold, beforeThresholdCut, thresholdCut, deductible, basicLimit, basicUsed, extraCap, extraEligible, extraUsed, amount}`와, 지출계획이 저장돼 있으면 `recommendation: {methodShare: {creditPct, debitPct, cashPct}(연도 전체, 소수 첫째 자리), current: {allocation(소비구분 4 × 신용/체크/현금), yearEndDeduction}, recommended: {allocation(소비구분 4 × 신용/체크·현금), yearEndDeduction}, difference, reasons: [{code, category?, amount?}]}`.

### Task 4.1: `DeductionCalculator` (TAX-35, 40, 41, 42, 45, 46, 71)

**담당:** Codex `gpt-6-astra` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/calc/TaxLawValues.java`, `DeductionCalculator.java`, `DeductionResult.java`, `tax/calc/DeductionCalculatorTest.java`(순수 단위 테스트, Spring 없음).
- Interfaces — Consumes: `SpendingTotals`(PR 3). Produces: `static DeductionResult DeductionCalculator.calculate(long totalSalary, int childCount, SpendingTotals totals, TaxLawValues law)`, `TaxLawValues.from(TaxLawVersion)`.
- 테스트 기대값(손계산, 2026 값: 25% / 경계 70,000,000 / 15·30·30·40·40 / 기본한도 낮은 구간 300·350·400만, 높은 구간 250·275·300만 / 추가한도 300만·200만. 2025 값은 기본한도가 자녀등과 무관하게 300만·250만). 테스트 코드는 이 표의 숫자를 직접 적고, 계산기를 불러 기대값을 만들지 않는다.

| 사례 | 입력 | 기대 소득공제액 | 대응 |
|---|---|---|---|
| PRD 합성 예시 1 | S 4,000만, 신용 일반 1,200만, 직불등 일반 300만, 문화체육 50만, 전통시장 100만, 대중교통 50만 | 1,950,000 | AC-13, AC-08(L ≤ A) |
| PRD 합성 예시 2 | S 8,000만, 신용 일반 3,000만, 체크 일반 1,000만, 체크 문화체육 100만, 전통시장 200만, 대중교통 100만 | 3,700,000 | AC-13, AC-10, AC-12(추가한도가 공제액 합계로 제한) |
| 와이어프레임 현황 | S 5,000만, 일반 1,400만/200만/50만, 전통시장 30만/20만/10만, 대중교통 20만/30만/0, 문화체육 10만/10만/0 | 1,475,000 | 화면 숫자 |
| 최저사용금액과 같음 | S 4,000만, 신용 일반 10,000,000 | 0 | AC-07 |
| 1원 초과 | S 4,000만, 신용 일반 10,000,001 | 0 (0.15원 → 원 미만 버림) | AC-07, TAX-45 ("알려진 제약" 참고) |
| 7원 초과 | S 4,000만, 신용 일반 10,000,007 | 1 (1.05원) | AC-07 |
| A < L ≤ A+B+M | S 4,000만, 신용 일반 600만, 체크 일반 500만, 체크 문화체육 100만, 전통시장 100만 | 1,000,000 (차감 2,100,000) | AC-08 |
| L > A+B+M | S 4,000만, 신용 일반 400만, 체크 일반 300만, 체크 문화체육 100만, 전통시장 300만, 대중교통 100만 | 800,000 (차감 2,600,000) | AC-08 |
| 경계 정확히 | S 70,000,000, 신용 일반 2,000만, 신용 문화체육 100만 | 675,000 | AC-09 |
| 경계 + 1원 | S 70,000,001, 같은 입력 | 524,999 (524,999.9625) | AC-09, AC-10 |
| 기본한도 낮은 구간 | S 5,000만, 신용 일반 1억, 자녀등 0 / 1 / 2 / 3 | 3,000,000 / 3,500,000 / 4,000,000 / 4,000,000 | AC-11 |
| 기본한도 높은 구간 | S 8,000만, 신용 일반 1억, 자녀등 0 / 1 / 2 | 2,500,000 / 2,750,000 / 3,000,000 | AC-11 |
| 2025 값 | 위 두 줄을 2025 값으로, 자녀등 0 / 2 | 3,000,000 / 3,000,000, 2,500,000 / 2,500,000 | AC-11 |
| 기본한도 정확히 | S 4,000만, 신용 일반 3,000만 | 3,000,000 (추가 0) | AC-12 |
| 추가가 초과분으로 제한 | S 4,000만, 신용 일반 2,000만, 전통시장 500만 | 3,500,000 (추가 500,000) | AC-12 |
| 추가가 상한으로 제한 | S 4,000만, 신용 일반 3,000만, 전통시장 1,000만 | 6,000,000 (추가 3,000,000) | AC-12 |

- 단계 값(TAX-71)도 예시 1에서 확인한다: 차감액 1,500,000, 공제 가능 금액 1,950,000, 기본한도 3,000,000, 추가 0, 마지막 금액 = 소득공제액.

### Task 4.2: 현재 계획 배분과 추천 (TAX-46, 50, 52, 53, 54, 69)

**담당:** Codex `gpt-6-astra` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/calc/PlanAllocator.java`, `Recommender.java`, `Recommendation.java`, `tax/calc/PlanAllocatorTest.java`, `RecommenderTest.java`.
- Interfaces — Consumes: `DeductionCalculator.calculate`, `TaxSpendingPlan`의 12칸. Produces: `record PlanAmounts`(소비구분 4 × `creditFixed`, `debitFixed`, `flexible`)와 `PlanAmounts.from(TaxSpendingPlan)`, `record Allocation`(소비구분 4 × `credit`, `debit`, `cash`), `PlanAllocator.currentPlan(SpendingTotals totals, PlanAmounts plan): Allocation`, `Recommender.recommend(long totalSalary, int childCount, SpendingTotals totals, PlanAmounts plan, TaxLawValues law): Recommendation`.
- 테스트 기대값(손계산)

| 사례 | 기대 | 대응 |
|---|---|---|
| PRD 합성 예시 3: 일반 입력액 3,000,000 / 1,000,000 / 0, V 1,000,001 | 750,001 / 250,000 / 0 | AC-35 |
| PRD 합성 예시 4: 그 소비구분 입력액 0, 연도 전체 6,000,000 / 3,000,000 / 1,000,000, V 333,333 | 200,001 / 99,999 / 33,333 | AC-35 |
| PRD 합성 예시 5: 연도 전체 0, V 500,000 | 500,000 / 0 / 0 | AC-35 |
| 와이어프레임: 위 현황 입력 + 계획(일반 50만/30만/120만, 전통시장 0/10만/10만, 대중교통 10만/0/0, 문화체육 0/0/10만) | 현재 계획 배분 일반 1,018,183 / 145,454 / 36,363, 전통시장 50,001 / 33,333 / 16,666, 문화체육 50,000 / 50,000 / 0. 현재 계획 연말 1,997,272, 추천 연말 2,150,000, 차이 152,728. 추천은 일반 1,200,000만 체크·현금으로 옮기고 다른 소비구분은 현재 계획 그대로 | AC-17, AC-18, AC-35 |
| 모든 사례 | 현재 계획과 추천의 총액·소비구분별 합이 같다. 세 배분의 합 = V | AC-17, AC-35 |
| 차이 없음: 최저사용금액 미달 / 한도 도달 / 바꿀 수 있는 금액이 전통시장·대중교통뿐 / 바꿀 수 있는 금액 0 | `difference = 0`, 추천 배분 = 현재 계획, 이유 코드가 각각 `BELOW_THRESHOLD` / `LIMIT_REACHED` / `METHOD_NEUTRAL` / `NO_FLEXIBLE_AMOUNT` | AC-17 |
| 탐색 검증 | 소비구분 4개를 전부 신용/전부 직불등으로 둔 16개 조합과 현재 계획을 테스트 안에서 계산기로 돌린 최댓값이 추천의 연말 공제액과 같다(여러 합성 입력) | TAX-52 |

### Task 4.3: 분석 조회 API (TAX-24, 35, 36, 38, 44, 50, 65, 75)

**담당:** Codex `gpt-6-sol` / `medium` (`api`), 태그 `impl-api`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/calc/TaxAnalysisService.java`, `TaxAnalysisController.java`, `TaxAnalysisDtos.java`, `tax/calc/TaxAnalysisApiTest.java`.
- Interfaces — Consumes: `TaxRecordService.requireOwned`, `SpendingTotals.of`, 계산기·추천. Produces: `GET /tax/years/{year}/analysis`(위 필드).
- 테스트 대상(AC-01, 20, 30, 43, 13): 남의 연도·없는 연도 404, 상태 판정 순서(자료 없음 / 미완료와 빈 칸 수 / 세법 준비 중 / READY), 미완료·세법 준비 중이면 `deduction`·`recommendation`이 없음, 빈 칸을 채우면 저장해 둔 계획으로 추천이 나옴, 지출계획이 없으면 `recommendation` 없음·`planSaved=false`, 예시 1 입력의 응답 `deduction.amount = 1950000`, 근로기간이 전체가 아니면 `partialYear=true`이고 금액은 그대로, 기준일 불일치면 `estimated=true`이고 금액은 그대로, 연도 기록이 기억한 버전으로 계산(새 버전 적용 뒤에도 결과 불변, `refresh` 뒤 바뀜 — AC-19), 응답을 만드는 동안 DB에 쓰지 않음.

### PR 4 마무리 (컨트롤러)

- `cd apps/api && ./gradlew test`. 브랜치 최종 리뷰: Claude Fable 5.2 한 번 — 기대값 표가 구현과 독립인지(AC-24), 조문 대조 결과를 본다. 반론 리뷰 대상이 아니다.

---

# PR 5 — 소득공제 메뉴와 입력자료 화면

**이 PR에 착수할 때 컨트롤러가 Task 상세를 채운다.** 화면 PR이다(375px 이전·이후 캡처).

브랜치 예: `feat/tax-inputs`. 검증: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build` + verify 스킬.

웹 설계

- 라우트(모두 기존 `RequireAuth > GroupProvider > AppLayout` 아래): `/tax`(진입: 이 PR에서는 `/tax/inputs`로 보냄, PR 7에서 TAX-68 규칙), `/tax/inputs`. PR 6이 `/tax/law`, PR 7이 `/tax/analysis`를 더한다.
- 메뉴: `MENU`의 두 번째에 `{ to: '/tax', label: '소득공제', shortLabel: '소득공제', … children: [{ to: '/tax/inputs', label: '입력자료' }] }`. `children` 항목에 `adminOnly?: boolean`을 두고 `AppLayout`이 `me.serviceAdmin`으로 거른다(PR 6에서 사용). 하단 탭은 5칸이 된다(AC-25).
- 좁은 화면의 하위 화면 전환은 화면 안 탭 `TaxTabs`(링크 nav, `dashboard/DashboardMenu.tsx`와 같은 방식).
- 선택 연도: `TaxYearProvider`(React 상태, 메모리만). 로그인 레이아웃 안에 두어 로그아웃하면 사라진다. 기억한 값이 없으면 올해. 브라우저 저장소에 두지 않는다.
- 쿼리 키: `['tax', 'year', year]`, `['tax', 'law', 'current', year]`. `GET /tax/years/{year}`의 404는 "연도 기록 없음" 화면 상태다.
- 화면은 `useGroups()`를 쓰지 않는다. 머리에 "개인 자료 · 그룹과 무관"을 적는다(TAX-13).

### Task 5.1: `Dialog`를 좁은 화면에서도 가운데 창으로 여는 선택지 (TAX-76)

**담당:** Codex `gpt-6-astra` / `medium` (`write`), 태그 `impl-web-common`. 리뷰: Claude Fable 5.2.

- 배경: 현재 `common/Dialog.tsx`의 `DialogFrame`은 좁은 화면에서 아래에서 올라오는 시트(`styles.modalSheet`)로 그린다. PRD D26·AC-44의 "가운데 창"을 만족하려면 선택지가 필요하다("알려진 제약" 1번, 2026-11-13 확정).
- Files: Modify `apps/web/src/common/Dialog.tsx`, `Overlay.module.css`, `Dialog.test.tsx`.
- Interfaces — Produces: `Dialog`와 `DialogFrame`에 `centered?: boolean`(기본 false, 기존 화면 동작 불변). true면 좁은 화면에서도 `styles.backdrop`·`styles.modal`을 쓴다.
- 테스트 대상(AC-44): 좁은 폭(`mockViewport(true)`)에서 `centered`면 시트 클래스가 아니라 가운데 창 클래스, `centered`가 없으면 기존대로 시트. 긴 내용이 창 안에서 스크롤되는지는 verify에서 본다.

### Task 5.2: 메뉴·라우트·선택 연도·API 모듈과 캐시 규칙 (TAX-03, 07, 10, 12, 13, 19, 68 일부)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `apps/web/src/tax/taxApi.ts`, `TaxYearProvider.tsx`, `TaxTabs.tsx`, `TaxHeader.tsx`, `TaxIndexRedirect.tsx`와 각 테스트. Modify `app/menu.ts`, `app/AppRoutes.tsx`, `app/AppLayout.tsx`(하위 메뉴 `adminOnly` 거르기, 소득공제 하위 링크), `auth/authApi.ts`(`Me.serviceAdmin`), `common/Icon.tsx`(메뉴 아이콘), `test/renderPage.tsx`(`testMe.serviceAdmin`), `app/BottomTabBar.test.tsx`, `app/AppRoutes.test.tsx`, `api/queryClient.test.ts`.
- Interfaces — Produces: `taxApi.year(year)`, `saveBasicInfo`, `deleteYear`, `addCard`, `saveCard`, `deleteCard`, `saveCashReceipt`, `currentLaw(year)`와 타입 `TaxYearView`(PR 3 응답과 같은 필드). `useTaxYear(): { year: number; setYear(year: number): void; choices: number[] }`(올해·전년도·다음 해).
- 테스트 대상(AC-06, 25, 29 일부): 하단 탭 5칸·순서 홈·소득공제·대시보드·거래·그룹, 사이드바에 소득공제와 들여 쓴 하위 링크, 회원에게 세법 관리 링크가 없음, `isGroupScopedKey(['tax', 'year', 2026])`가 false이고 `tax` 쿼리의 404가 `['groups']`를 다시 부르지 않음, 로그아웃 뒤 `client.getQueryData(['tax', 'year', 2026])`가 undefined이고 다른 회원으로 로그인하면 이전 회원 값이 화면에 없음, 소득공제 화면을 쓴 뒤 `localStorage`·`sessionStorage`에 총급여·금액 문자열이 없음, 헤더의 그룹을 바꿔도 `tax` 요청이 다시 나가지 않고 내용이 같음.

### Task 5.3: 입력자료 화면 — 연도 선택·기본정보·연도 기록 삭제 (TAX-20, 28, 31, 37)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/inputs/TaxInputsPage.tsx`, `BasicInfoDialog.tsx`, `DeleteYearDialog.tsx`, CSS, 테스트.
- 테스트 대상(AC-30, 40, 32 일부): 연도 기록 없음 → 빈 상태와 [기본정보 입력], 총급여·근로기간(시작월 ≤ 종료월)·자녀등 수 저장, 자녀등 입력란은 현재 적용 세법의 `childTiersApply`일 때만 보이고 요건 3가지 안내가 붙음, 근로기간이 전체가 아니면 "근로기간 확인 필요" 표시, 총급여는 "수입" 가림을 따르고 입력 중인 필드는 가리지 않음, 연도 기록 삭제 창의 [삭제]는 귀속연도를 똑같이 입력해야 켜지고 다시 열면 입력이 비어 있음, 세법 준비 중인 연도의 저장 가능 안내, 409면 "다른 곳에서 수정됨, 다시 불러오기", 통신 오류 때 입력값 유지.

### Task 5.4: 카드 자료·현금영수증 자료 (TAX-21~25, 28, 29, 30)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/inputs/CardStatementList.tsx`, `CardStatementDialog.tsx`, `CashReceiptSection.tsx`, `CashReceiptDialog.tsx`, `AmountGrid.tsx`(8칸·4칸 입력표), 테스트.
- 테스트 대상(AC-14, 28, 33, 37, 40): 8칸(행 소비구분 4 × 열 신용카드/체크카드)·4칸 입력, 빈 칸과 0 구별·미완료 표시와 빈 칸 수, [빈 칸 0원으로 채우기], 같은 카드사명 두 건 저장되고 경고 없음, 결제수단 명칭이 신용카드·체크카드·현금영수증, "일반" 안내 문구, 음수·연도 밖 기준일은 필드 오류로 저장 안 함, 카드 자료 삭제는 입력 없이 확인 한 번, 현금영수증에는 삭제가 없고 편집만, 저장 409 안내, 모든 창이 `centered`.

### Task 5.5: 연도 합계표·경고·금액 가림 (TAX-26, 27, 30, 31, 37)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/inputs/YearTotalsTable.tsx`, 테스트. Modify `TaxInputsPage.tsx`.
- 테스트 대상(AC-15, 31, 32): 합계표가 응답의 `totals` 12칸을 보여 줌(웹에서 다시 더하지 않는다), 375px 배치(행 합계 열 대신 소비구분 이름 아래 "계 n"), 미입력 경고·기준일 불일치 경고, 자료 없음이면 "—", 공제대상액이 "지출" 가림을 따름.

### Task 5.6: verify 시드·검증 지도 (AC-02, AC-23)

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Fable 5.2.

- Files: Modify `.claude/skills/verify/bin/seed.sh`(검증 계정 하나를 SQL로 서비스 관리자 지정, 관리자 API로 2026 세법 초안 생성·적용, 회원 API로 합성 연도 기록·카드 자료 2건·현금영수증·지출계획 등록), `bin/doctor.sh`, `features/README.md`, `features/navigation.md`. Create `features/tax-inputs.md`.
- 검증 여정: 375px와 데스크톱에서 메뉴 진입, 8칸·4칸 입력과 합계표에 가로 스크롤 없음(AC-23), 그룹 없는 계정(`verify4` 등)으로 등록·조회, 그룹 전환 뒤 같은 내용(AC-02), 창이 가운데(AC-44).

### PR 5 마무리 (컨트롤러)

- 웹 검증 4종, verify 375px·데스크톱, 이전·이후 캡처. 브랜치 최종 리뷰 Claude Fable 5.2 한 번. PR 본문에 "분석·지출계획은 뒤 PR"임을 적는다.

---

# PR 6 — 연도별 세법 관리 화면

**이 PR에 착수할 때 컨트롤러가 Task 상세를 채운다.** 화면 PR이다.

브랜치 예: `feat/tax-law-admin`. 검증: 웹 4종 + verify.

### Task 6.1: 관리자 메뉴 노출·권한 없음 화면·버전 목록 (TAX-06, 10, 11, 19, 67, 72)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/law/TaxLawPage.tsx`, `LawVersionList.tsx`, `tax/law/taxLawApi.ts`, 테스트. Modify `app/menu.ts`(`{ to: '/tax/law', label: '연도별 세법 관리', adminOnly: true }`), `app/AppRoutes.tsx`, `tax/TaxTabs.tsx`(관리자에게 세 번째 탭 "세법 관리").
- 쿼리 키: `['tax', 'admin', 'law', year]`.
- 테스트 대상(AC-29, 39 일부): 회원에게 하위 메뉴 2개(PR 7 뒤)·관리자에게 +1, 일반 회원이 `/tax/law`로 들어오면 권한 없음 화면(요청 403도 같은 화면), 375px 세 번째 탭 라벨 "세법 관리"·화면 제목과 사이드바 "연도별 세법 관리", 연도 목록과 버전 목록(초안 여러 개·적용, 작성자·적용자·시각), [새 초안 만들기]는 초안이 있어도 켜져 있음.

### Task 6.2: 초안 편집·검증·적용·삭제 (TAX-04, 60~64, 72, 76)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/law/LawVersionForm.tsx`, 테스트.
- 테스트 대상(AC-21, 39, 44): 수치 입력(비율 6, 경계, 기본한도 2 × 3, 추가한도 2, 근거·기간·메모), 알고리즘 버전은 고정 표시, [초안 저장]·[검증](실패 목록 표시)·[적용](확인 창에 "다른 초안은 초안으로 남습니다"), 적용본은 모든 입력이 꺼진 읽기 전용이고 삭제 없음, 초안 삭제는 확인 한 번, 확인 창은 `centered`, 409·통신 오류 안내.

### Task 6.3: 검증 지도 (AC-23)

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Fable 5.2.

- Files: Create `.claude/skills/verify/features/tax-law.md`. Modify `features/README.md`, `features/navigation.md`.

### PR 6 마무리 (컨트롤러)

- 웹 검증 4종, verify(관리자 계정과 일반 계정 둘 다), 캡처, 브랜치 최종 리뷰 Claude Fable 5.2 한 번. 병합 뒤 운영자가 관리자 지정 SQL과 2026 귀속 세법 등록을 해야 한다는 점을 PR "참고"에 적는다.

---

# PR 7 — 분석·지출계획 화면

**이 PR에 착수할 때 컨트롤러가 Task 상세를 채운다.** 화면 PR이다.

브랜치 예: `feat/tax-analysis`. 검증: 웹 4종 + verify.

### Task 7.1: 단계 화면 틀·진입 규칙·상태 알림 (TAX-10, 13, 27, 36, 38, 65, 66, 68, 73)

**담당:** Codex `gpt-6-astra` / `medium` (`write`, 설계 판단이 큼), 태그 `impl-web-common`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/analysis/TaxAnalysisPage.tsx`, `StepTabs.tsx`, 테스트. Modify `tax/TaxIndexRedirect.tsx`(TAX-68), `app/menu.ts`·`tax/TaxTabs.tsx`(하위 메뉴 "분석·지출계획"을 두 번째에), `app/AppRoutes.tsx`, `tax/taxApi.ts`(`analysis(year)`, `savePlan`, `refreshLawVersion`).
- 쿼리 키: `['tax', 'analysis', year]`. 입력자료·지출계획 저장과 `refresh` 뒤 무효화한다.
- 테스트 대상(AC-34, 41, 30, 31, 19 화면): "소득공제"를 누르면 `hasInputs`인 연도는 `/tax/analysis` ① 현황, 연도 기록 없음·자료 없음이면 `/tax/inputs`, 기억한 연도가 없으면 올해 기준, 한 번에 한 단계만 보이고 단계 탭·[이전]·[다음]으로 이동, 처음은 ①, 데스크톱 1단 가운데·최대 폭 제한, 적용 세법(귀속연도·버전·적용일)·자료 기준일·예상 총급여 한 줄, "추정"과 이유·"근로기간 확인 필요"·"새 세법 버전 있음 + [새 버전으로 다시 계산]"(누르기 전 결과 유지), 연도 기록 없음이면 입력자료로 가는 안내, "개인 자료 · 그룹과 무관".

### Task 7.2: ① 현황 (TAX-32~35, 37, 38, 43, 55, 71)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/analysis/StatusStep.tsx`, 테스트.
- 테스트 대상(AC-16, 32, 38): 요약 4칸(소득공제액 "과세표준에서 빼는 금액 · 환급액 아님", 최저사용금액 달성, 기본한도 사용, 추가한도 사용), 소비구분별·결제수단별 사용 비율(분모 문장 명시, 소수 첫째 자리, 공제율·한도 사용률과 구별), 합계 0원이면 빈 차트, [계산 과정 보기]는 처음에 접혀 있고 펼치면 최저사용금액 차감 → 공제율 → 한도 순이며 마지막 금액 = 소득공제액, 최저사용금액 미달이면 0원과 남은 금액(권유 문구 없음), "참고: 한도까지 남은 공제 여유", 미완료·세법 준비 중이면 숫자 대신 안내, 금액은 "지출" 가림.

### Task 7.3: ② 지출계획 (TAX-29, 51, 70, 75)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/analysis/PlanStep.tsx`, 테스트.
- 테스트 대상(AC-33, 36, 43): 소비구분 4행 × (신용카드 고정 / 체크카드·현금영수증 고정 / 바꿀 수 있음), 합계 자동, 고치기만 하면 저장 요청이 없고 ③이 그대로, [계산하기]를 누르면 저장하고 ③으로 넘어감, 다시 열면 저장 값, 미완료·세법 준비 중에도 입력은 열려 있고 [계산하기]는 저장만, 409면 "다른 곳에서 수정됨, 다시 불러오기", 375px에서 소비구분별 묶음으로 쌓임.

### Task 7.4: ③ 추천 (TAX-37, 50, 53, 54, 69, 75)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/analysis/RecommendStep.tsx`, `reasonText.ts`(이유 코드 → 문장), 테스트.
- 테스트 대상(AC-17, 35, 43): "현재 계획: 지금까지의 결제수단 비율(신용 n% · 체크 n% · 현금 n%)" 한 줄(연도 전체 비율), 현재 계획과 추천 배분 표·총액 같음·연말 예상 소득공제액·차이(`formatSignedWon`)·이유·가정(총급여·세법 버전·자료 기준일, 카드 혜택 미고려), 차이 0이면 "차이 없음"과 이유, 미완료면 "자료를 완료하면 계산합니다"·빈 칸 수·[입력자료로 가기], 세법 준비 중이면 "세법 준비 중"만, 계획 미저장이면 ②로 가는 안내. 이유 문장은 응답의 코드·숫자에서만 만든다.

### Task 7.5: 검증 지도와 문서 마무리 (AC-02, AC-23)

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Fable 5.2.

- Files: Create `.claude/skills/verify/features/tax-analysis.md`. Modify `features/README.md`, 저장소 `README.md`(주요 기능에 소득공제), `docs/backlog.md`(후속: 그룹 합산, 가계부 자동 합산, 미확인 법령 항목 D03·D08·D09 확인), `docs/superpowers/plans/2026-11-11-tax-planning/README.md` 진행표.

### PR 7 마무리 (컨트롤러)

- 웹 검증 4종, verify 375px·데스크톱(와이어프레임 합성 숫자: 현황 1,475,000원, 현재 계획 1,997,272원, 추천 2,150,000원, 차이 +152,728원이 화면에 나오는지), 캡처, 브랜치 최종 리뷰 Claude Fable 5.2 한 번.

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
7. **해석 — 세법 버전 기억 시점.** 연도 기록을 만들 때 현재 적용 버전을 기억하고, 적용 버전이 없던 연도는 첫 버전이 적용될 때 자동으로 그 버전을 기억한다(회원이 누르지 않아도 "세법 준비 중"이 풀린다). 이미 버전이 있는 연도 기록만 [새 버전으로 다시 계산]을 기다린다.
8. **해석 — 자녀등 입력란.** 세법 버전의 자녀등 단계별 기본한도가 서로 다를 때만 보인다(별도 설정값 없음). 적용 버전이 없는 연도는 입력란이 없고 0으로 저장한다.
9. **해석 — 선택 연도 기억.** 메모리(React 상태)에만 둔다. 새로 고치면 올해로 돌아간다.
10. PR 1 뒤 홈의 넓은 화면은 문서 순서(요약 → 등록 현황)와 보이는 순서(등록 현황 왼쪽)가 다르다. 와이어프레임이 정한 배치이고 키보드 순서는 문서 순서를 따른다.
11. 계획의 PR 1 코드는 임시 복사본에서 테스트·typecheck·lint·build까지 확인했지만 화면은 띄워 보지 않았다. PR 2~7의 설계는 실행해 보지 않았다.
12. 세법 수치와 7.1절 산식은 독립적인 세무 검증을 거치지 않았다(PRD 14장). D03(합산 기간)·D08(원 단위)·D09(귀속 시점)의 법령 기준은 미확인이고 임시 규칙이다.
13. 회원 탈퇴 기능이 없어 `ON DELETE CASCADE`에 따른 소득공제 자료 삭제는 검증 대상이 아니다(PRD 2장 비범위).
