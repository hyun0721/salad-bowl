# Salad Bowl 설계 문서

- 작성일: 2026-10-18
- 상태: 승인 대기 (사용자 리뷰)

## 1. 개요

뱅크샐러드 앱에서 내려받은 엑셀 파일을 그대로 import해 가계부를 관리하고, **다른 회원과 그룹 단위로 가계부를 공유**하는 웹 서비스다. 뱅크샐러드는 타인과 가계부를 공유할 수 없다는 점을 보완하는 것이 목적이다.

- 사용자는 뱅크샐러드 앱에서 가계부를 계속 쓰고, 주기적으로 엑셀을 다시 import한다.
- 웹에서 직접 거래를 추가·수정할 수 있고, 수정 내용은 다음 import 때 덮어써지지 않는다.
- 반응형 웹 + PWA로 모바일에서도 앱처럼 사용한다. 네이티브 앱은 만들지 않는다.

## 2. 기능 요구사항

### 2.1 회원·그룹
- 이메일/비밀번호로 회원가입·로그인한다.
- 회원은 그룹(가계부 공유 공간)을 생성할 수 있고, 생성자가 그룹의 **관리자(ADMIN)** 가 된다.
- 관리자는 **초대 URL**(토큰, 7일 만료)을 발급하고, 다른 회원이 이를 수락하면 **멤버(MEMBER)** 로 합류한다.
- 그룹당 최대 인원은 **6명**(관리자 포함)이다. 초대 수락 시 검사한다.
- 한 회원은 여러 그룹에 속할 수 있다.
- 관리자는 멤버를 추방하고 그룹 설정을 변경할 수 있다.
- 추방된 회원은 관리자가 차단을 해제하기 전까지 어떤 초대로도 다시 합류할 수 없다. 스스로 탈퇴한 회원은 다시 초대받을 수 있다.

### 2.2 데이터 소유와 공유 (회원 소유 + 그룹 공개)
- 거래는 **회원 소유**다. 한 번만 저장되고, 회원이 속한 그룹별로 공개 여부(on/off)를 정한다.
- 한 번 import하면 공개한 모든 그룹에 반영된다.
- 그룹을 나가도 거래는 회원에게 남는다.

### 2.3 권한
| 행위 | 본인 | 그룹 ADMIN | 그룹 MEMBER |
|---|---|---|---|
| 내 엑셀 import | O | - | - |
| 본인 거래 수정·추가 | O | - | - |
| 그룹에 공개된 타인 거래 조회 | - | O | O |
| 그룹에 공개된 타인 거래 수정 | - | O (AuditLog 기록) | X |
| 멤버 초대·추방, 그룹 설정 | - | O | X |

- 관리자의 수정은 원본 거래를 수정하므로, 그 거래가 공개된 다른 그룹에서도 수정된 값으로 보인다.

## 3. 뱅크샐러드 엑셀 포맷

실제 export 파일(1개월분, 21KB)을 기준으로 확인한 구조:

- 시트 `가계부 내역`: 거래 데이터. 컬럼은 `날짜, 시간, 타입, 대분류, 소분류, 내용, 금액, 화폐, 결제수단, 메모`
  - 날짜·시간은 엑셀 일련번호(예: `46295`, `0.8322…`)로 저장되어 있어 변환이 필요하다.
  - 금액은 지출이 음수다.
- 시트 `뱅샐현황`: 이름, 성별, 연령, 신용점수, 이메일, 자산현황 등 민감정보다. **읽지 않고 무시한다.**
- 원본 파일은 파싱 후 즉시 폐기하며, 서버·DB에 저장하지 않는다.

## 4. 도메인 모델

```
User ─┬─< GroupMember >── Group (최대 6명)
      │   (role: ADMIN | MEMBER,  └─< Invite (token, expires_at; 만료 전 다회 사용)
      │    share_enabled)          ← 그룹별 공개 설정(GroupShare)을 멤버십 컬럼으로 둔다
      ├─< ImportBatch (파일명, 업로드 시각, 신규/갱신/중복 건수)
      └─< Transaction (owner = User)
AuditLog (actor, transaction, 변경 필드, before/after, 시각)
```

`Transaction` 필드:
- 원본 필드: `occurred_at`, `type`(수입/지출/이체), `category_major`, `category_minor`, `description`, `amount`, `currency`, `payment_method`, `original_memo`
- 사용자 수정 필드: `category_major_override`, `category_minor_override`, `memo_override`, `hidden`
- `source`: `IMPORT` | `MANUAL`
- `dedup_key`: owner 범위 내 unique (IMPORT 거래만)
- `import_batch_id`, `created_at`, `updated_at`

카테고리는 **회원 개인의 원본 문자열**로 저장한다(Phase 2 매핑 대비, 9장 참고).

## 5. Import 병합 규칙

1. 파서가 `가계부 내역` 시트를 `ParsedRow` 목록으로 변환한다.
2. 각 행에 `dedup_key = hash(owner, occurred_at, amount, description, payment_method, seq)`를 계산한다. `seq`는 한 파일 안에서 앞의 다섯 값이 동일한 행의 순번(0부터)으로, 같은 시각·금액의 반복 결제를 구분한다.
3. **신규 키**: 거래를 추가한다.
4. **기존 키**: 원본 필드만 갱신한다. `*_override`, `hidden` 등 사용자 수정 필드는 건드리지 않는다.
5. 이전에 import했지만 새 파일에 없는 거래는 **삭제하지 않는다.**
6. 화면 표시 값은 `override ?? 원본`이다.
7. 한 파일의 import는 하나의 DB 트랜잭션으로 처리하며, 실패하면 전부 롤백한다.
8. 결과로 신규·갱신·변경없음 건수를 `ImportBatch`에 기록하고 응답으로 반환한다.

## 6. 아키텍처

### 6.1 저장소 구조 (mono-repo)
```
salad-bowl/
├─ apps/web/            React + Vite + TypeScript, PWA
├─ apps/api/            Spring Boot 3 (Java 21), Gradle
├─ docs/
├─ docker-compose.yml   로컬 개발용 Postgres
└─ .github/workflows/   경로 기반 CI/CD
```

### 6.2 BE (`apps/api`)
기능 단위 패키지:
- `auth`: 가입, 로그인, JWT access 토큰 + refresh 토큰(HttpOnly 쿠키), BCrypt
- `group`: 그룹 CRUD, 멤버 관리, 초대
- `share`: 그룹별 공개 설정
- `transaction`: 조회, 수정, 수동 추가
- `importer`: `BanksaladParser`(순수 함수, Apache POI) → `MergeService`
- `audit`: 관리자 수정 이력
- 스키마는 Flyway로 관리한다. JPA와 표준 SQL 위주로 작성해 DB 이전 비용을 낮춘다.

주요 API:
| Method | Path | 설명 |
|---|---|---|
| POST | `/auth/signup`, `/auth/login`, `/auth/refresh` | 인증 |
| POST | `/groups` | 그룹 생성 |
| POST | `/groups/{id}/invites` | 초대 URL 발급 |
| POST | `/invites/{token}/accept` | 초대 수락 (정원 검사) |
| DELETE | `/groups/{id}/members/{userId}` | 멤버 추방 (ADMIN) |
| PUT | `/groups/{id}/share` | 내 데이터 공개 on/off |
| POST | `/imports` | 엑셀 업로드 (multipart) |
| GET | `/groups/{id}/transactions?from&to&member&category` | 그룹 거래 조회 |
| GET | `/me/transactions?from&to` | 내 거래 조회 |
| POST | `/me/transactions` | 수동 거래 추가 |
| PATCH | `/transactions/{id}` | 거래 수정 (본인 또는 그룹 ADMIN) |
| GET | `/groups/{id}/summary?month` | 월간 카테고리별 합계 |

### 6.3 FE (`apps/web`)
- React Router, TanStack Query, Tailwind
- `vite-plugin-pwa`로 홈 화면 설치를 지원한다(오프라인 기능 제외).
- 화면: 로그인·가입, 그룹 목록·생성, 초대 수락, 거래 목록(월별·멤버 필터), 거래 수정, import 업로드·결과, 월간 요약
- Render 콜드스타트 대비 "서버 깨우는 중" 로딩 상태를 표시한다.

### 6.4 배포 (무료 티어)
| 구성 | 서비스 | 비고 |
|---|---|---|
| FE | Cloudflare Pages | 정적 호스팅 + CDN |
| BE | Render 무료 Web Service (Docker) | 15분 유휴 시 sleep, 512MB → `-XX:MaxRAMPercentage=75` |
| DB | Supabase Postgres 무료 | 500MB, 7일 비활성 시 일시정지 |

무료 티어 조건은 변경될 수 있으므로 구축 시점에 최신 조건을 확인한다. BE는 Docker 이미지 기반이라 필요하면 다른 호스팅(예: Oracle Cloud VM)으로 코드 변경 없이 옮길 수 있다.

### 6.5 용량 산정
- 실측: 1인 1개월 거래 168건 → 3년 약 6,050건
- 행당 약 0.6KB(인덱스 포함) + 부가 데이터 50% → **1인 3년 약 5~6MB**
- 6인 그룹 3년 약 35MB, Supabase 500MB로 약 75~80명분 3년치 수용
- 이용자가 약 50명을 넘으면 상위 플랜이나 대용량 무료 DB(CockroachDB 등) 이전을 검토한다.

### 6.6 CI/CD (GitHub Actions)
- `apps/web/**` 변경: 빌드 → Cloudflare Pages 배포
- `apps/api/**` 변경: 테스트 → Render deploy hook 호출
- 모든 PR: lint + 테스트
- 주간 cron: API health 호출(Supabase 일시정지 방지)

## 7. 에러 처리·보안
- 공통 에러 응답 형식: `{ code, message }`
- 업로드 제한: 5MB, `.xlsx`만 허용. 시트 `가계부 내역`이나 필수 컬럼이 없으면 `INVALID_FORMAT`으로 거부한다.
- `뱅샐현황` 시트는 읽지 않고, 원본 파일은 저장하지 않는다.
- 비밀번호는 BCrypt로 저장한다.
- CORS는 Cloudflare Pages 도메인만 허용한다.
- 그룹 데이터 접근 시 멤버십과 공개 설정을 서버에서 항상 검사한다.

## 8. 테스트
- `BanksaladParser`: 개인정보를 마스킹한 샘플 xlsx 픽스처로 단위 테스트
- `MergeService`, 권한 검사: Testcontainers Postgres 통합 테스트
- FE: Vitest로 핵심 컴포넌트 테스트

## 9. MVP 범위 밖 (고도화)

### 9.1 Phase 2: 그룹 카테고리 마스터와 매핑
뱅크샐러드의 대분류·소분류는 개인별로 변경할 수 있으므로, 그룹 단위 집계를 위해 그룹 카테고리 마스터와 개인 카테고리 매핑을 도입한다.

```
GroupCategory   (group, 대분류, 소분류, 정렬순서)        관리자가 관리
CategoryMapping (group, user, 내 대분류/소분류 → GroupCategory)
```
- 그룹에서 보이는 카테고리 = `매핑된 GroupCategory ?? 개인 카테고리(override ?? 원본)`
- 매핑이 없으면 "미분류"로 표시하고 매핑을 안내한다.
- 매핑은 그룹별이며 조회 시점에 적용한다. 거래 데이터는 바꾸지 않는다.
- MVP 준비 사항: 카테고리는 개인 원본 문자열로 저장하고, 표시 카테고리 결정 로직을 하나의 함수로 모은다.

### 9.2 기타
- 소셜 로그인
- 그룹별 부분 공개(카테고리 단위)
- 예산·알림
- 오프라인 모드
