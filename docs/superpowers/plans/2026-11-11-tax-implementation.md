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

**PR 3~7의 Task 상세는 그 PR에 착수할 때 컨트롤러가 채운다(PR 2는 2026-11-14에 채웠다).** 뒤 PR의 코드는 앞 PR 결과(실제 엔티티·응답 필드 이름)에 의존하기 때문이다. 이 문서에는 PR 2~7의 Task 목록·파일·인터페이스·테스트 대상·검증 명령까지 적었다. PR 1은 실행 가능한 상세까지 적었다.

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
| `GET /tax/law-versions/current?year=YYYY` | 로그인 | 그 연도의 현재 적용 버전(가장 최근 `applied_at`). 없으면 404 `NOT_FOUND`. `createdByNickname`·`appliedByNickname`은 항상 `null` |
| `GET /tax/admin/law-versions?year=YYYY` | 서비스 관리자 | 그 연도의 모든 버전(초안·적용), 번호 내림차순 |
| `POST /tax/admin/law-versions` `{taxYear}` | 서비스 관리자 | 새 초안 201. 현재 적용 버전의 설정값·근거·기간을 복사(메모 제외), 없으면 빈 값. 번호는 카운터 + 1 |
| `GET /tax/admin/law-versions/{id}` | 서비스 관리자 | 버전 하나. 없으면 404 |
| `PUT /tax/admin/law-versions/{id}` | 서비스 관리자 | 초안 전체 교체(본문에 `rowVersion` 필수, 없는 값은 빈 값이 된다). 적용본이면 409 `CONFLICT`, `rowVersion`이 다르면 409, 형태 오류(단계가 3칸이 아님, 길이 초과, 숫자 아님)는 400 `VALIDATION_FAILED`. 범위 검사는 하지 않는다(적용할 때 한다) |
| `POST /tax/admin/law-versions/{id}/validate` | 서비스 관리자 | `{errors: [{field, message}]}` (빈 배열이면 통과). 상태를 바꾸지 않는다 |
| `POST /tax/admin/law-versions/{id}/apply` | 서비스 관리자 | 검증 통과 시 적용(상태·`applied_by`·`applied_at`) 200. 검증 실패 400 `VALIDATION_FAILED`(메시지는 첫 오류 `필드: 설명`), 이미 적용본이면 409 `CONFLICT`, 없으면 404 |
| `DELETE /tax/admin/law-versions/{id}` | 서비스 관리자 | 초안이면 204, 적용본이면 409 `CONFLICT`, 없으면 404 |

`/tax/admin/**`은 비로그인 401 `UNAUTHORIZED`, 서비스 관리자가 아니면(일반 회원·그룹 ADMIN) 403 `FORBIDDEN`이다. `year`·`taxYear`는 1000~9999 정수이고 아니면 400 `VALIDATION_FAILED`다.

버전 응답(`VersionResponse`) 필드: `id, taxYear, versionNo, status, algorithmVersion, minSpendRatePct, bracketBoundary, rateCreditPct, rateDebitCashPct, rateCulturePct, rateMarketPct, rateTransitPct, basicLimitLow[3], basicLimitHigh[3], extraLimitLow, extraLimitHigh, childTiersApply, basisLawName, basisArticle, basisUrl, periodStart, periodEnd, memo, createdByNickname, appliedByNickname, createdAt, appliedAt, rowVersion`. `childTiersApply`는 자녀등 단계 값이 서로 다른지이고 웹이 자녀등 입력란을 보일지 판단한다(알려진 제약 8번).

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

**이 PR에 착수할 때 컨트롤러가 Task 상세를 채운다.** 화면 PR이다(375px 이전·이후 캡처).

브랜치 예: `feat/tax-inputs`. 검증: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build` + verify 스킬.

웹 설계

- 라우트(모두 기존 `RequireAuth > GroupProvider > AppLayout` 아래): `/tax`(진입: 이 PR에서는 `/tax/inputs`로 보냄, PR 7에서 TAX-68 규칙), `/tax/inputs`. PR 6이 `/tax/law`, PR 7이 `/tax/analysis`를 더한다.
- 메뉴: `MENU`의 두 번째에 `{ to: '/tax', label: '소득공제', shortLabel: '소득공제', … children: [{ to: '/tax/inputs', label: '입력자료' }] }`. `children` 항목에 `adminOnly?: boolean`을 두고 `AppLayout`이 `me.serviceAdmin`으로 거른다(PR 6에서 사용). 하단 탭은 5칸이 된다(AC-25).
- 좁은 화면의 하위 화면 전환은 화면 안 탭 `TaxTabs`(링크 nav, `dashboard/DashboardMenu.tsx`와 같은 방식).
- 선택 연도: `TaxYearProvider`(React 상태, 메모리만). 로그인 레이아웃 안에 두어 로그아웃하면 사라진다. 기억한 값이 없으면 올해. 브라우저 저장소에 두지 않는다.
- 쿼리 키: `['tax', 'year', year]`, `['tax', 'law', 'current', year]`. `GET /tax/years/{year}`의 404는 "연도 기록 없음" 화면 상태다.
- 화면은 `useGroups()`를 쓰지 않는다. 머리에 "개인 자료 · 그룹과 무관"을 적는다(TAX-13).

### Task 5.1: `Dialog` 가운데 창 선택지와 도움말 부품 공용화 (TAX-76, UI 표준)

**담당:** Codex `gpt-6-astra` / `medium` (`write`), 태그 `impl-web-common`. 리뷰: Claude Fable 5.2.

- 배경: 현재 `common/Dialog.tsx`의 `DialogFrame`은 좁은 화면에서 아래에서 올라오는 시트(`styles.modalSheet`)로 그린다. PRD D26·AC-44의 "가운데 창"을 만족하려면 선택지가 필요하다("알려진 제약" 1번, 2026-11-13 확정).
- Files: Modify `apps/web/src/common/Dialog.tsx`, `Overlay.module.css`, `Dialog.test.tsx`. 도움말: Create `common/HelpButton.tsx`(+ 스타일은 `common/ui.module.css` 또는 새 `HelpButton.module.css`로 `GroupsPage.module.css`의 `helpButton`·`helpPopover`·`helpContent`를 옮김), Delete `groups/GroupHelp.tsx`, Modify 그 import 사용처와 테스트.
- Interfaces — Produces: `Dialog`와 `DialogFrame`에 `centered?: boolean`(기본 false, 기존 화면 동작 불변). true면 좁은 화면에서도 `styles.backdrop`·`styles.modal`을 쓰고, `AriaDialog`의 `styles.content`·`styles.typography`는 그대로 둔다. `HelpButton({ title, children })` — `GroupHelp`와 같은 props·동작.
- 테스트 대상(AC-44): 좁은 폭(`mockViewport(true)`)에서 `centered`면 시트 클래스가 아니라 가운데 창 클래스이고 `typography` 클래스가 남음, `centered`가 없으면 기존대로 시트. 그룹 화면의 기존 도움말 테스트가 `HelpButton`으로 바꾼 뒤에도 그대로 통과. 긴 내용이 창 안에서 스크롤되는지는 verify에서 본다.

### Task 5.2: 메뉴·라우트·선택 연도·API 모듈과 캐시 규칙 (TAX-03, 07, 10, 12, 13, 19, 68 일부)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `apps/web/src/tax/taxApi.ts`, `TaxYearProvider.tsx`, `TaxTabs.tsx`, `TaxHeader.tsx`, `TaxIndexRedirect.tsx`와 각 테스트. Modify `app/menu.ts`, `app/AppRoutes.tsx`, `app/AppLayout.tsx`(하위 메뉴 `adminOnly` 거르기, 소득공제 하위 링크), `auth/authApi.ts`(`Me.serviceAdmin`), `common/Icon.tsx`(메뉴 아이콘), `test/renderPage.tsx`(`testMe.serviceAdmin`), `app/BottomTabBar.test.tsx`, `app/AppRoutes.test.tsx`, `api/queryClient.test.ts`.
- Interfaces — Produces: `taxApi.year(year)`, `saveBasicInfo`, `deleteYear`, `addCard`, `saveCard`, `deleteCard`, `saveCashReceipt`, `currentLaw(year)`와 타입 `TaxYearView`(PR 3 응답과 같은 필드). `useTaxYear(): { year: number; setYear(year: number): void; choices: number[] }`(올해·전년도·다음 해).
- 테스트 대상(AC-06, 25, 29 일부): 하단 탭 5칸·순서 홈·소득공제·대시보드·거래·그룹, 사이드바에 소득공제와 들여 쓴 하위 링크, 회원에게 세법 관리 링크가 없음, `isGroupScopedKey(['tax', 'year', 2026])`가 false이고 `tax` 쿼리의 404가 `['groups']`를 다시 부르지 않음, 로그아웃 뒤 `client.getQueryData(['tax', 'year', 2026])`가 undefined이고 다른 회원으로 로그인하면 이전 회원 값이 화면에 없음, 소득공제 화면을 쓴 뒤 `localStorage`·`sessionStorage`에 총급여·금액 문자열이 없음, 헤더의 그룹을 바꿔도 `tax` 요청이 다시 나가지 않고 내용이 같음.

### Task 5.3: 입력자료 화면 — 연도 선택·기본정보·연도 기록 삭제 (TAX-20, 28, 31, 37)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/inputs/TaxInputsPage.tsx`, `BasicInfoDialog.tsx`, `DeleteYearDialog.tsx`, CSS, 테스트.
- 테스트 대상(AC-30, 40, 32 일부): 연도 기록 없음 → 빈 상태와 [기본정보 입력], 총급여·근로기간(시작월 ≤ 종료월)·자녀등 수 저장, 자녀등 입력란은 현재 적용 세법의 `childTiersApply`일 때만 보이고 요건 3가지는 라벨 옆 `HelpButton`("자녀등 수 도움말")으로 열림, 근로기간이 전체가 아니면 "근로기간 확인 필요" 표시, 총급여는 "수입" 가림을 따르고 입력 중인 필드는 가리지 않음, 연도 기록 삭제 창의 [삭제]는 귀속연도를 똑같이 입력해야 켜지고 다시 열면 입력이 비어 있음, 세법 준비 중인 연도의 저장 가능 안내, 409면 "다른 곳에서 수정됨, 다시 불러오기", 통신 오류 때 입력값 유지.

### Task 5.4: 카드 자료·현금영수증 자료 (TAX-21~25, 28, 29, 30)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/inputs/CardStatementList.tsx`, `CardStatementDialog.tsx`, `CashReceiptSection.tsx`, `CashReceiptDialog.tsx`, `AmountGrid.tsx`(8칸·4칸 입력표), 테스트.
- 테스트 대상(AC-14, 28, 33, 37, 40): 8칸(행 소비구분 4 × 열 신용카드/체크카드)·4칸 입력, 빈 칸과 0 구별·미완료 표시와 빈 칸 수, [빈 칸 0원으로 채우기], 같은 카드사명 두 건 저장되고 경고 없음, 결제수단 명칭이 신용카드·체크카드·현금영수증, "일반" 한 줄 안내와 상세 `HelpButton`, 카드사 행의 [편집]·[삭제]가 행 오른쪽 끝(긴 카드사명에서도), 음수·연도 밖 기준일은 필드 오류로 저장 안 함, 카드 자료 삭제는 입력 없이 확인 한 번, 현금영수증에는 삭제가 없고 편집만, 저장 409 안내, 모든 창이 `centered`.

### Task 5.5: 연도 합계표·경고·금액 가림 (TAX-26, 27, 30, 31, 37)

**담당:** Codex `gpt-6-sol` / `medium` (`write`), 태그 `impl-web`. 리뷰: Claude Fable 5.2.

- Files: Create `tax/inputs/YearTotalsTable.tsx`, 테스트. Modify `TaxInputsPage.tsx`.
- 테스트 대상(AC-15, 31, 32): 합계표가 응답의 `totals` 12칸을 보여 줌(웹에서 다시 더하지 않는다), 375px 배치(행 합계 열 대신 소비구분 이름 아래 "계 n"), 미입력 경고·기준일 불일치 경고, 자료 없음이면 "—", 공제대상액이 "지출" 가림을 따름.

### Task 5.6: verify 시드·검증 지도 (AC-02, AC-23)

**담당:** Codex `gpt-6-luna` / `low` (`write`), 태그 `docs`. 리뷰: Claude Fable 5.2.

- Files: Modify `.claude/skills/verify/bin/seed.sh`(검증 계정 하나를 SQL로 서비스 관리자 지정, 관리자 API로 2026 세법 초안 생성·적용, 회원 API로 합성 연도 기록·카드 자료 2건·현금영수증·지출계획 등록), `bin/doctor.sh`, `features/README.md`, `features/navigation.md`. Create `features/tax-inputs.md`.
- 검증 여정: 375px와 데스크톱에서 메뉴 진입, 8칸·4칸 입력과 합계표에 가로 스크롤 없음(AC-23), 그룹 없는 계정(`verify4` 등)으로 등록·조회, 그룹 전환 뒤 같은 내용(AC-02), 창이 가운데(AC-44).

### PR 5 마무리 (컨트롤러)

- 웹 검증 4종, verify 375px·데스크톱, 이전·이후 캡처, "UI 표준 적용" 절의 검증 항목(320px, 긴 카드사명, 도움말 조작). 브랜치 최종 리뷰 Claude Fable 5.2 한 번. PR 본문에 "분석·지출계획은 뒤 PR"임을 적는다.

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

- 웹 검증 4종, verify(관리자 계정과 일반 계정 둘 다), 캡처, "UI 표준 적용" 절의 검증 항목, 브랜치 최종 리뷰 Claude Fable 5.2 한 번. 병합 뒤 운영자가 관리자 지정 SQL과 2026 귀속 세법 등록을 해야 한다는 점을 PR "참고"에 적는다.

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

- 웹 검증 4종, verify 375px·데스크톱(와이어프레임 합성 숫자: 현황 1,475,000원, 현재 계획 1,997,272원, 추천 2,150,000원, 차이 +152,728원이 화면에 나오는지), 캡처, "UI 표준 적용" 절의 검증 항목, 브랜치 최종 리뷰 Claude Fable 5.2 한 번.

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
11. 계획의 PR 1 코드는 임시 복사본에서 테스트·typecheck·lint·build까지 확인했지만 화면은 띄워 보지 않았다. PR 2의 코드는 임시 복사본에서 `./gradlew test`(320건)까지 실행해 확인했다(2.2·2.3의 RED 컴파일 오류 문구는 실행하지 않고 적음). PR 3~7의 설계는 실행해 보지 않았다.
12. 세법 수치와 7.1절 산식은 독립적인 세무 검증을 거치지 않았다(PRD 14장). D03(합산 기간)·D08(원 단위)·D09(귀속 시점)의 법령 기준은 미확인이고 임시 규칙이다.
13. 회원 탈퇴 기능이 없어 `ON DELETE CASCADE`에 따른 소득공제 자료 삭제는 검증 대상이 아니다(PRD 2장 비범위).
