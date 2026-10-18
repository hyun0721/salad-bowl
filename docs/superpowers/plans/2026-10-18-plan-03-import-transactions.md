# Plan 03 — 뱅크샐러드 import·거래 API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 뱅크샐러드 엑셀(.xlsx)을 업로드하면 거래로 병합하고(중복은 건너뛰고, 웹에서 고친 값은 보존), 내 거래와 그룹 거래를 월별로 조회하고, 수동 거래를 추가하고, 권한에 맞게 거래를 수정하고(수정 이력 기록), 그룹의 월간 요약을 보는 API를 만든다.

**Architecture:** 두 패키지를 추가한다.
- `importer`: 엑셀 파싱(`BanksaladParser`, 순수 로직), 중복 키 계산(`DedupKeys`), 병합(`MergeService`), 업로드 orchestration(`ImportService`, `ImportController`)
- `transaction`: 거래 엔티티 `LedgerTransaction`, 조회·수정·요약 서비스와 컨트롤러

그룹 권한은 Plan 02의 `GroupAccess`만 사용한다. 화면에 보이는 카테고리는 `LedgerTransaction.displayCategory()` 한 곳에서 정한다(스펙 9.1의 그룹 카테고리 매핑을 나중에 여기에 붙인다).

**Tech Stack:** Java 21, Spring Boot 4.1.1, Spring Data JPA(Hibernate 7), Flyway, PostgreSQL 16, Apache POI 5.4.1, JUnit 5, MockMvc, Testcontainers 2

**선행 조건:** Plan 02(PR hyun0721/salad-bowl#2)가 `main`에 머지되어 있다. `main`에서 `feat/plan-03-import-transactions` 브랜치를 딴다.

## 설계 결정 (스펙 보완)

| 항목 | 결정 |
|---|---|
| 엔티티 이름 | `Transaction`은 Spring·Hibernate의 타입 이름과 헷갈리므로 엔티티를 `LedgerTransaction`(테이블 `transactions`)으로 한다. |
| 거래 시각 | 뱅크샐러드 시각은 한국 시간 기준 로컬 시각이다. `LocalDateTime` / `TIMESTAMP`(시간대 없음)로 저장하고, 엑셀 시간 값은 초 단위로 반올림한다. |
| 금액 | `NUMERIC(15,2)` / `BigDecimal`(소수 2자리로 정규화). 부호는 뱅크샐러드 그대로다(지출은 음수, 환불은 양수). |
| 중복 키 | `dedup_key = SHA-256(owner, 일시, 금액, 내용, 결제수단, seq)`의 hex 64자. `seq`는 한 파일 안에서 앞의 다섯 값이 같은 행의 순번(0부터)이다. 수동 거래는 키가 없다(NULL). |
| 재 import | 같은 키가 있으면 키에 포함되지 않은 원본 필드(타입, 대·소분류, 화폐, 원본 메모)만 갱신한다. 사용자 수정 필드(`*_override`, `hidden`)는 건드리지 않는다. 새 파일에 없는 기존 거래는 지우지 않는다. |
| 원본 필드 수정 | 원본 필드는 누구도 API로 바꿀 수 없다. 화면 값은 override로만 바꾼다(카테고리, 메모). 빈 문자열을 보내면 override를 지운다. |
| 숨김 | `hidden`은 **소유자만** 바꿀 수 있다. 숨긴 거래는 그룹 화면·요약에서 빠지고, 내 화면에서는 보인다. |
| 그룹 화면 | 그 그룹에서 공개 중인 멤버의 거래만 보인다(`GroupAccess.sharedOwnerIds`). 숨긴 거래는 빠진다. |
| 조회·수정 권한 | 볼 수 없는 거래는 `404`, 볼 수는 있지만 수정할 수 없으면 `403`이다(그룹의 존재 숨김 규칙과 같다). 그룹 범위 API는 항상 `GroupAccess.requireMember`를 먼저 호출한다. |
| 수동 거래 | `POST /me/transactions`로 추가한다. 추가 후에는 override로만 수정한다. 삭제는 **수동 거래만, 소유자만** 할 수 있다(import 거래는 숨김을 쓴다, `409 CANNOT_DELETE_IMPORTED`). |
| 수정 이력 | 소유자를 포함해 모든 수정을 필드 단위로 `transaction_audits`에 남긴다. |
| 월간 요약 | KRW만 집계한다. 이체와 숨긴 거래는 제외한다. 지출은 양수 합계다(환불은 차감). 카테고리별 지출과 멤버별 수입·지출을 돌려준다. |
| 업로드 | `.xlsx`만, 최대 5MB. 원본 파일은 저장하지 않는다. `뱅샐현황` 시트(개인정보)는 읽지 않는다. |
| 테스트 비용 | 테스트에서만 BCrypt cost를 4로 낮춘다(`src/test/resources/config/application.yml`). 테스트용 Spring context를 늘리는 `@MockitoBean`·`@TestPropertySource`는 쓰지 않는다. |

## API 요약

| Method | Path | 권한 | 성공 | 주요 에러 |
|---|---|---|---|---|
| POST | `/imports` (multipart `file`) | 로그인 | 201 `ImportResult` | 400 `INVALID_FILE_FORMAT`, 413 `FILE_TOO_LARGE` |
| GET | `/imports` | 로그인 | 200 `ImportBatchView[]`(최근 20개) | |
| GET | `/me/transactions?month=YYYY-MM` | 로그인 | 200 `TransactionView[]` | 400 |
| POST | `/me/transactions` | 로그인 | 201 `TransactionView` | 400 |
| GET | `/groups/{groupId}/transactions?month=YYYY-MM[&memberId=]` | 멤버 | 200 `TransactionView[]` | 400, 404 |
| PATCH | `/transactions/{id}` | 소유자, 또는 공개 그룹의 ADMIN | 200 `TransactionView` | 400, 403, 404 |
| DELETE | `/transactions/{id}` | 소유자(수동 거래만) | 204 | 403, 404, 409 `CANNOT_DELETE_IMPORTED` |
| GET | `/transactions/{id}/audits` | 볼 수 있는 회원 | 200 `AuditView[]` | 404 |
| GET | `/groups/{groupId}/summary?month=YYYY-MM` | 멤버 | 200 `MonthlySummary` | 400, 404 |

## Global Constraints

- Java 21, Spring Boot 4.1.1, Gradle Groovy DSL, base package `com.saladbowl.api`
- 이 계획의 코드는 Boot 4 기준이다. Jackson이 필요하면 Jackson 3(`tools.jackson.*`)를 쓴다. 통합 테스트는 `com.saladbowl.api.support.IntegrationTest`(MockMvc)를 상속한다.
- 스키마는 Flyway로만 변경한다(`ddl-auto: validate`). 새 마이그레이션은 `V4__create_transactions.sql`이다.
- 공통 에러 응답 형식: `{ "code": "...", "message": "..." }`. 새 에러 코드는 `ErrorCode` enum의 `CONFLICT` 바로 위에 추가하고, 기존 항목의 status는 바꾸지 않는다.
- 인증된 사용자 id는 컨트롤러에서 `@CurrentUser Long userId`로 받는다.
- 그룹 범위 API는 항상 `GroupAccess.requireMember`(또는 `requireAdmin`)를 먼저 호출한다.
- 통합 테스트는 각 테스트 전에 모든 테이블을 비운다. 테스트끼리 데이터를 공유하지 않는다. 테스트용 Spring context를 새로 만드는 설정(`@MockitoBean`, `@TestPropertySource`, 새 `@Import`)을 추가하지 않는다.
- 실제 뱅크샐러드 파일이나 개인정보를 저장소에 커밋하지 않는다. 테스트용 엑셀은 테스트 코드에서 만든다(`support.BanksaladWorkbook`).
- 커밋 메시지 끝에 `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>`

---

### Task 1: 조회 권한(`canViewOwnedBy`)과 테스트 BCrypt cost

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/group/GroupMemberRepository.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/group/GroupAccess.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/auth/SecurityConfig.java`
- Modify: `apps/api/src/main/resources/application.yml`
- Create: `apps/api/src/test/resources/config/application.yml`
- Test: `apps/api/src/test/java/com/saladbowl/api/group/GroupAccessTest.java` (테스트 추가)
- Test: `apps/api/src/test/java/com/saladbowl/api/auth/PasswordEncoderStrengthTest.java`

**Interfaces:**
- Consumes: Plan 02의 `GroupAccess`(`requireMember`, `requireAdmin`, `sharedOwnerIds`, `canEditOwnedBy`), `GroupMemberRepository`, `GroupAccessTest`의 `setUp`(admin, sharing, hiding, groupId)
- Produces:
  - `GroupMemberRepository.existsSharedWith(Long viewerId, Long ownerId)` → `boolean`
  - `GroupAccess.canViewOwnedBy(long viewerId, long ownerId)` → `boolean`: 본인이거나, 소유자가 공개 중인 그룹에 함께 속해 있으면 true
  - 설정 `app.security.bcrypt-strength`(기본 10, 테스트 4)

- [ ] **Step 1: `GroupAccessTest`에 실패하는 테스트 추가**

기존 테스트 아래에 추가한다.

```java
    @Test
    void memberCanViewDataOfMemberWhoShares() {
        assertThat(access.canViewOwnedBy(sharing.id(), admin.id())).isTrue();
    }

    @Test
    void memberCannotViewDataOfMemberWhoTurnedSharingOff() {
        assertThat(access.canViewOwnedBy(sharing.id(), hiding.id())).isFalse();
    }

    @Test
    void outsiderCannotView() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        assertThat(access.canViewOwnedBy(outsider.id(), sharing.id())).isFalse();
    }

    @Test
    void permissionsAreEvaluatedPerGroup() throws Exception {
        // hiding은 이 그룹에서는 비공개지만, 다른 그룹 B에서는 공개(기본값)한다.
        AuthedUser adminB = TestAuth.signupAndLogin(mvc, "adminb@test.com", "B관리자");
        long groupB = TestGroups.createGroup(mvc, adminB, "B네");
        TestGroups.join(mvc, adminB, hiding, groupB);

        assertThat(access.canEditOwnedBy(adminB.id(), hiding.id())).isTrue();
        assertThat(access.canViewOwnedBy(adminB.id(), hiding.id())).isTrue();
        assertThat(access.canEditOwnedBy(admin.id(), hiding.id())).isFalse();
        assertThat(access.canViewOwnedBy(sharing.id(), hiding.id())).isFalse();
    }
```

- [ ] **Step 2: `PasswordEncoderStrengthTest.java` 작성**

```java
package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordEncoderStrengthTest extends IntegrationTest {

    @Autowired
    PasswordEncoder passwordEncoder;

    @Test
    void testsUseLowBcryptCost() {
        assertThat(passwordEncoder.encode("password123")).startsWith("$2a$04$");
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*GroupAccessTest' --tests '*PasswordEncoderStrengthTest'`
Expected: `canViewOwnedBy`가 없어 컴파일 실패

- [ ] **Step 4: `GroupMemberRepository`에 쿼리 추가**

`existsAdminOverSharedMember` 아래에 추가한다.

```java
    @Query("""
            select case when count(v) > 0 then true else false end
            from GroupMember v, GroupMember o
            where v.groupId = o.groupId
              and v.userId = :viewerId
              and o.userId = :ownerId and o.shareEnabled = true
            """)
    boolean existsSharedWith(@Param("viewerId") Long viewerId, @Param("ownerId") Long ownerId);
```

- [ ] **Step 5: `GroupAccess` 수정**

`sharedOwnerIds`, `canEditOwnedBy`의 Javadoc을 아래처럼 바꾸고, 그 아래에 `canViewOwnedBy`를 추가한다.

```java
    /**
     * 그룹 화면에 데이터를 보여줄 회원 id. 공개를 끈 멤버는 빠진다.
     * 멤버십을 검사하지 않으므로, 호출 전에 {@link #requireMember}로 호출자가 멤버인지 확인한다.
     */
    public List<Long> sharedOwnerIds(long groupId) {
        return members.findSharedUserIds(groupId);
    }

    /**
     * 거래 수정 권한: 본인이거나, 소유자가 공개 중인 그룹의 ADMIN이어야 한다.
     * 본인이면 멤버십과 무관하게 true이므로 그룹 멤버십 검사 용도로 쓰지 않는다.
     */
    public boolean canEditOwnedBy(long actorId, long ownerId) {
        return actorId == ownerId || members.existsAdminOverSharedMember(actorId, ownerId);
    }

    /** 거래 조회 권한: 본인이거나, 소유자가 공개 중인 그룹에 함께 속해 있어야 한다. */
    public boolean canViewOwnedBy(long viewerId, long ownerId) {
        return viewerId == ownerId || members.existsSharedWith(viewerId, ownerId);
    }
```

- [ ] **Step 6: BCrypt cost 설정**

`SecurityConfig.passwordEncoder()`를 바꾼다(import에 `org.springframework.beans.factory.annotation.Value`가 이미 있다).

```java
    @Bean
    public PasswordEncoder passwordEncoder(@Value("${app.security.bcrypt-strength:10}") int strength) {
        return new BCryptPasswordEncoder(strength);
    }
```

`apps/api/src/main/resources/application.yml`의 `app:` 아래에 추가한다.

```yaml
  security:
    bcrypt-strength: 10
```

`apps/api/src/test/resources/config/application.yml`을 만든다. Spring Boot는 `classpath:/config/application.yml`을 기본 `application.yml`보다 우선해서 함께 읽으므로, 이 키만 덮어쓴다.

```yaml
app:
  security:
    bcrypt-strength: 4
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*GroupAccessTest' --tests '*PasswordEncoderStrengthTest'`
Expected: GroupAccessTest 10개, PasswordEncoderStrengthTest 1개 PASS

- [ ] **Step 8: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS (Plan 02까지 73개 + 5개)

```bash
git add apps/api/src
git commit -m "feat(api): add transaction view permission and lower bcrypt cost in tests"
```

---

### Task 2: 뱅크샐러드 엑셀 파서

**Files:**
- Modify: `apps/api/build.gradle`
- Modify: `apps/api/src/main/java/com/saladbowl/api/common/ErrorCode.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionType.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionData.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/ParsedRow.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/BanksaladParser.java`
- Create: `apps/api/src/test/java/com/saladbowl/api/support/BanksaladWorkbook.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/importer/BanksaladParserTest.java`

**Interfaces:**
- Consumes: `ApiException`, `ErrorCode`
- Produces:
  - `ErrorCode.INVALID_FILE_FORMAT` (400)
  - `enum TransactionType { INCOME, EXPENSE, TRANSFER }`, `TransactionType.fromLabel(String)` → `Optional<TransactionType>` (`수입`/`지출`/`이체`)
  - `record TransactionData(LocalDateTime occurredAt, TransactionType type, String categoryMajor, String categoryMinor, String description, BigDecimal amount, String currency, String paymentMethod, String memo)`. `memo`만 null을 허용한다. `amount`는 소수 2자리다.
  - `record ParsedRow(int rowNumber, TransactionData data)`. `rowNumber`는 엑셀의 1부터 시작하는 행 번호다.
  - `BanksaladParser.parse(InputStream in)` → `List<ParsedRow>`. 형식 오류는 `ApiException(INVALID_FILE_FORMAT, ...)`를 던진다. 행 오류 메시지는 `"row N: ..."`로 시작한다.
  - 테스트 헬퍼 `BanksaladWorkbook.create().row(date, time, type, major, minor, description, amount, paymentMethod, memo)...toBytes()` → `byte[]`

- [ ] **Step 1: Apache POI 의존성 추가**

`apps/api/build.gradle`의 `dependencies`에 추가한다.

```groovy
	implementation 'org.apache.poi:poi-ooxml:5.4.1'
```

- [ ] **Step 2: 테스트용 엑셀 생성기 `BanksaladWorkbook.java` 작성**

실제 export 파일과 같은 구조로 만든다. 날짜는 일련번호(날짜 서식), 시간은 하루의 비율(시간 서식)이다. 메모가 없으면 셀을 만들지 않는다. 개인정보 시트 `뱅샐현황`도 가짜 값으로 함께 넣어서, 파서가 그 시트를 읽지 않는지 확인한다.

```java
package com.saladbowl.api.support;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/** 뱅크샐러드 export와 같은 구조의 .xlsx를 테스트 코드에서 만든다. 실제 파일은 저장소에 두지 않는다. */
public final class BanksaladWorkbook {

    public static final List<String> HEADERS =
            List.of("날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모");

    private record RowSpec(String date, String time, String type, String major, String minor,
                           String description, long amount, String paymentMethod, String memo) {
    }

    private final List<RowSpec> rows = new ArrayList<>();
    private String sheetName = "가계부 내역";
    private List<String> headers = HEADERS;

    private BanksaladWorkbook() {
    }

    public static BanksaladWorkbook create() {
        return new BanksaladWorkbook();
    }

    /** date: yyyy-MM-dd, time: HH:mm:ss, memo: null이면 셀을 만들지 않는다. */
    public BanksaladWorkbook row(String date, String time, String type, String major, String minor,
                                 String description, long amount, String paymentMethod, String memo) {
        rows.add(new RowSpec(date, time, type, major, minor, description, amount, paymentMethod, memo));
        return this;
    }

    /** 내용이 하나도 없는 행. */
    public BanksaladWorkbook blankRow() {
        rows.add(null);
        return this;
    }

    public BanksaladWorkbook sheetName(String sheetName) {
        this.sheetName = sheetName;
        return this;
    }

    public BanksaladWorkbook headers(List<String> headers) {
        this.headers = headers;
        return this;
    }

    public byte[] toBytes() {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet profile = wb.createSheet("뱅샐현황");
            profile.createRow(2).createCell(1).setCellValue("1.고객정보");
            Row nameRow = profile.createRow(4);
            nameRow.createCell(1).setCellValue("이름");
            nameRow.createCell(2).setCellValue("테스트");

            CreationHelper helper = wb.getCreationHelper();
            CellStyle dateStyle = wb.createCellStyle();
            dateStyle.setDataFormat(helper.createDataFormat().getFormat("yyyy-mm-dd"));
            CellStyle timeStyle = wb.createCellStyle();
            timeStyle.setDataFormat(helper.createDataFormat().getFormat("hh:mm"));

            Sheet sheet = wb.createSheet(sheetName);
            Row header = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                header.createCell(i).setCellValue(headers.get(i));
            }
            int r = 1;
            for (RowSpec spec : rows) {
                Row row = sheet.createRow(r++);
                if (spec == null) {
                    continue;
                }
                Cell date = row.createCell(0);
                date.setCellValue(DateUtil.getExcelDate(LocalDate.parse(spec.date()).atStartOfDay()));
                date.setCellStyle(dateStyle);
                Cell time = row.createCell(1);
                time.setCellValue(LocalTime.parse(spec.time()).toSecondOfDay() / 86400.0);
                time.setCellStyle(timeStyle);
                row.createCell(2).setCellValue(spec.type());
                row.createCell(3).setCellValue(spec.major());
                row.createCell(4).setCellValue(spec.minor());
                row.createCell(5).setCellValue(spec.description());
                row.createCell(6).setCellValue(spec.amount());
                row.createCell(7).setCellValue("KRW");
                row.createCell(8).setCellValue(spec.paymentMethod());
                if (spec.memo() != null) {
                    row.createCell(9).setCellValue(spec.memo());
                }
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
```

- [ ] **Step 3: 실패하는 파서 테스트 작성**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.support.BanksaladWorkbook;
import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BanksaladParserTest {

    private final BanksaladParser parser = new BanksaladParser();

    private List<ParsedRow> parse(BanksaladWorkbook workbook) {
        return parser.parse(new ByteArrayInputStream(workbook.toBytes()));
    }

    @Test
    void parsesLedgerRowsWithSecondsPrecisionAndMissingMemo() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "19:58:25", "지출", "식비", "카페", "스타벅스", -7000, "신한카드", null)
                .row("2026-09-02", "08:00:00", "지출", "교통", "택시", "카카오T", -12300, "현대카드", "출근"));

        assertThat(rows).hasSize(2);
        ParsedRow first = rows.get(0);
        assertThat(first.rowNumber()).isEqualTo(2);
        TransactionData data = first.data();
        assertThat(data.occurredAt()).isEqualTo(LocalDateTime.of(2026, 9, 1, 19, 58, 25));
        assertThat(data.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(data.categoryMajor()).isEqualTo("식비");
        assertThat(data.categoryMinor()).isEqualTo("카페");
        assertThat(data.description()).isEqualTo("스타벅스");
        assertThat(data.amount()).isEqualByComparingTo(new BigDecimal("-7000"));
        assertThat(data.amount().scale()).isEqualTo(2);
        assertThat(data.currency()).isEqualTo("KRW");
        assertThat(data.paymentMethod()).isEqualTo("신한카드");
        assertThat(data.memo()).isNull();
        assertThat(rows.get(1).data().memo()).isEqualTo("출근");
    }

    @Test
    void mapsAllThreeTypes() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "수입", "급여", "월급", "회사", 3000000, "국민은행", null)
                .row("2026-09-01", "10:00:00", "이체", "이체", "내계좌", "적금", -500000, "국민은행", null)
                .row("2026-09-01", "11:00:00", "지출", "쇼핑", "온라인", "환불", 15000, "신한카드", null));

        assertThat(rows).extracting(r -> r.data().type())
                .containsExactly(TransactionType.INCOME, TransactionType.TRANSFER, TransactionType.EXPENSE);
    }

    @Test
    void skipsBlankRows() {
        List<ParsedRow> rows = parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .blankRow()
                .row("2026-09-01", "19:00:00", "지출", "식비", "저녁", "국밥", -9000, "현금", null));

        assertThat(rows).extracting(ParsedRow::rowNumber).containsExactly(2, 4);
    }

    @Test
    void rejectsWorkbookWithoutLedgerSheet() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create().sheetName("다른 시트")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void rejectsUnexpectedHeader() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .headers(List.of("날짜", "시간", "구분", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모"))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }

    @Test
    void unknownTypeReportsRowNumber() {
        assertThatThrownBy(() -> parse(BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .row("2026-09-01", "10:00:00", "환전", "기타", "기타", "환전", -1000, "현금", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageStartingWith("row 3:");
    }

    @Test
    void rejectsNonExcelContent() {
        assertThatThrownBy(() -> parser.parse(
                new ByteArrayInputStream("not an excel file".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.INVALID_FILE_FORMAT);
    }
}
```

- [ ] **Step 4: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*BanksaladParserTest'`
Expected: 컴파일 실패 (`BanksaladParser`, `TransactionData` 등 없음)

- [ ] **Step 5: `ErrorCode`에 `INVALID_FILE_FORMAT` 추가**

`CONFLICT` 바로 위에 추가한다.

```java
    INVALID_FILE_FORMAT(HttpStatus.BAD_REQUEST),
```

- [ ] **Step 6: `TransactionType.java`, `TransactionData.java`, `ParsedRow.java`**

```java
package com.saladbowl.api.transaction;

import java.util.Arrays;
import java.util.Optional;

public enum TransactionType {
    INCOME("수입"),
    EXPENSE("지출"),
    TRANSFER("이체");

    private final String label;

    TransactionType(String label) {
        this.label = label;
    }

    /** 뱅크샐러드 엑셀의 '타입' 값(수입/지출/이체)으로 찾는다. */
    public static Optional<TransactionType> fromLabel(String label) {
        return Arrays.stream(values()).filter(t -> t.label.equals(label)).findFirst();
    }
}
```

```java
package com.saladbowl.api.transaction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 거래의 원본 값. import와 수동 추가가 같은 형태를 쓴다. memo만 null을 허용한다. */
public record TransactionData(
        LocalDateTime occurredAt,
        TransactionType type,
        String categoryMajor,
        String categoryMinor,
        String description,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        String memo) {
}
```

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.transaction.TransactionData;

/** 엑셀 한 행. rowNumber는 엑셀 화면의 1부터 시작하는 행 번호다(헤더가 1행). */
public record ParsedRow(int rowNumber, TransactionData data) {
}
```

- [ ] **Step 7: `BanksaladParser.java`**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * 뱅크샐러드 export(.xlsx)의 '가계부 내역' 시트만 읽는다. '뱅샐현황' 시트(개인정보)는 열지 않는다.
 * 컬럼: 날짜, 시간, 타입, 대분류, 소분류, 내용, 금액, 화폐, 결제수단, 메모
 */
@Component
public class BanksaladParser {

    static final String SHEET_NAME = "가계부 내역";
    static final List<String> HEADERS =
            List.of("날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모");

    private static final int SECONDS_PER_DAY = 86_400;

    public List<ParsedRow> parse(InputStream in) {
        try (Workbook workbook = open(in)) {
            Sheet sheet = workbook.getSheet(SHEET_NAME);
            if (sheet == null) {
                throw invalid("sheet '" + SHEET_NAME + "' not found");
            }
            checkHeader(sheet.getRow(0));
            List<ParsedRow> rows = new ArrayList<>();
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isBlank(row)) {
                    continue;
                }
                rows.add(parseRow(row));
            }
            return rows;
        } catch (IOException e) {
            throw invalid("cannot read file");
        }
    }

    private static Workbook open(InputStream in) {
        try {
            return WorkbookFactory.create(in);
        } catch (IOException | RuntimeException e) {
            throw invalid("not a valid .xlsx file");
        }
    }

    private static void checkHeader(Row header) {
        if (header == null) {
            throw invalid("header row is missing");
        }
        for (int i = 0; i < HEADERS.size(); i++) {
            String actual = text(header.getCell(i));
            if (!HEADERS.get(i).equals(actual)) {
                throw invalid("unexpected header in column " + (i + 1) + ": '" + actual + "'");
            }
        }
    }

    private static ParsedRow parseRow(Row row) {
        int rowNumber = row.getRowNum() + 1;
        try {
            LocalDateTime occurredAt = LocalDateTime.of(date(row.getCell(0)), time(row.getCell(1)));
            String typeLabel = text(row.getCell(2));
            TransactionType type = TransactionType.fromLabel(typeLabel)
                    .orElseThrow(() -> new IllegalArgumentException("unknown type '" + typeLabel + "'"));
            String currency = text(row.getCell(7));
            String memo = text(row.getCell(9));
            TransactionData data = new TransactionData(
                    occurredAt,
                    type,
                    text(row.getCell(3)),
                    text(row.getCell(4)),
                    text(row.getCell(5)),
                    amount(row.getCell(6)),
                    currency.isEmpty() ? "KRW" : currency,
                    text(row.getCell(8)),
                    memo.isEmpty() ? null : memo);
            return new ParsedRow(rowNumber, data);
        } catch (IllegalArgumentException | IllegalStateException | DateTimeParseException e) {
            throw invalid("row " + rowNumber + ": " + e.getMessage());
        }
    }

    private static LocalDate date(Cell cell) {
        if (cell != null && cell.getCellType() == CellType.NUMERIC) {
            return DateUtil.getLocalDateTime(cell.getNumericCellValue()).toLocalDate();
        }
        String value = text(cell);
        if (value.isEmpty()) {
            throw new IllegalArgumentException("date is empty");
        }
        return LocalDate.parse(value);
    }

    private static LocalTime time(Cell cell) {
        if (cell != null && cell.getCellType() == CellType.NUMERIC) {
            double value = cell.getNumericCellValue();
            double fraction = value - Math.floor(value);
            long seconds = Math.round(fraction * SECONDS_PER_DAY) % SECONDS_PER_DAY;
            return LocalTime.ofSecondOfDay(seconds);
        }
        String value = text(cell);
        if (value.isEmpty()) {
            throw new IllegalArgumentException("time is empty");
        }
        return LocalTime.parse(value);
    }

    private static BigDecimal amount(Cell cell) {
        BigDecimal value;
        if (cell != null && cell.getCellType() == CellType.NUMERIC) {
            value = BigDecimal.valueOf(cell.getNumericCellValue());
        } else {
            String text = text(cell).replace(",", "");
            if (text.isEmpty()) {
                throw new IllegalArgumentException("amount is empty");
            }
            value = new BigDecimal(text);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String text(Cell cell) {
        if (cell == null) {
            return "";
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().strip();
            case NUMERIC -> BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
            case BOOLEAN -> Boolean.toString(cell.getBooleanCellValue());
            default -> "";
        };
    }

    private static boolean isBlank(Row row) {
        for (int i = 0; i < HEADERS.size(); i++) {
            Cell cell = row.getCell(i);
            if (cell != null && cell.getCellType() != CellType.BLANK && !text(cell).isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private static ApiException invalid(String message) {
        return new ApiException(ErrorCode.INVALID_FILE_FORMAT, message);
    }
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*BanksaladParserTest'`
Expected: 7 tests PASS

- [ ] **Step 9: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/build.gradle apps/api/src
git commit -m "feat(api): parse Banksalad ledger sheet from xlsx exports"
```

---

### Task 3: 거래·import 이력·수정 이력 스키마와 엔티티

**Files:**
- Create: `apps/api/src/main/resources/db/migration/V4__create_transactions.sql`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionSource.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/Category.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/LedgerTransaction.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/LedgerTransactionRepository.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionAudit.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionAuditRepository.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/ImportBatch.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/ImportBatchRepository.java`
- Create: `apps/api/src/test/java/com/saladbowl/api/support/TestLedger.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/LedgerTransactionRepositoryTest.java`

**Interfaces:**
- Consumes: `TransactionData`, `TransactionType` (Task 2), `users` 테이블
- Produces:
  - `enum TransactionSource { IMPORT, MANUAL }`
  - `record Category(String major, String minor)`
  - `LedgerTransaction.imported(long ownerId, long importBatchId, String dedupKey, TransactionData data)`, `LedgerTransaction.manual(long ownerId, TransactionData data)`
  - `LedgerTransaction.refreshOriginal(TransactionData data)` → `boolean`: 키 밖의 원본 필드(타입, 대·소분류, 화폐, 원본 메모)를 갱신하고 바뀌었는지 돌려준다
  - `displayCategory()` → `Category`(override가 있으면 override), `displayMemo()`, `isEdited()`
  - override setter: `setCategoryMajorOverride(String)`, `setCategoryMinorOverride(String)`, `setMemoOverride(String)`, `setHidden(boolean)`
  - getter: `getId()`, `getOwnerId()`, `getSource()`, `getDedupKey()`, `getOccurredAt()`, `getType()`, `getDescription()`, `getAmount()`, `getCurrency()`, `getPaymentMethod()`, `getCategoryMajorOverride()`, `getCategoryMinorOverride()`, `getMemoOverride()`, `isHidden()`
  - `LedgerTransactionRepository`: `findByOwnerIdAndDedupKeyIn(Long, Collection<String>)`, `countByOwnerId(Long)`, `findOwnedBetween(Long ownerId, LocalDateTime from, LocalDateTime to)`, `findVisibleBetween(Collection<Long> ownerIds, LocalDateTime from, LocalDateTime to)`(숨김 제외). 둘 다 `occurredAt desc, id desc` 순이다.
  - `TransactionAudit(long transactionId, long actorId, String field, String beforeValue, String afterValue)`, `TransactionAuditRepository.findByTransactionIdOrderByChangedAtAscIdAsc(Long)`
  - `ImportBatch(long ownerId, String fileName)`, `ImportBatch.record(int total, int created, int updated, int unchanged)`, `ImportBatchRepository.findTop20ByOwnerIdOrderByImportedAtDescIdDesc(Long)`
  - 테스트 헬퍼 `TestLedger.data(TransactionType, String dateTime, String categoryMajor, String description, long amount)` → `TransactionData`(소분류 "", 화폐 KRW, 결제수단 "카드", 메모 null)

- [ ] **Step 1: 테스트 헬퍼 `TestLedger.java` 작성**

```java
package com.saladbowl.api.support;

import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 테스트용 거래 원본 값. dateTime은 ISO 형식(예: 2026-09-01T12:00:00)이다. */
public final class TestLedger {

    private TestLedger() {
    }

    public static TransactionData data(TransactionType type, String dateTime, String categoryMajor,
                                       String description, long amount) {
        return new TransactionData(LocalDateTime.parse(dateTime), type, categoryMajor, "", description,
                BigDecimal.valueOf(amount).setScale(2), "KRW", "카드", null);
    }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.importer.ImportBatch;
import com.saladbowl.api.importer.ImportBatchRepository;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestLedger;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LedgerTransactionRepositoryTest extends IntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    long ownerId;
    long batchId;

    @BeforeEach
    void setUp() {
        ownerId = users.save(new User("owner@test.com", "hash", "소유자")).getId();
        batchId = batches.save(new ImportBatch(ownerId, "test.xlsx")).getId();
    }

    @Test
    void importedTransactionIsUniquePerOwnerAndKey() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        transactions.saveAndFlush(LedgerTransaction.imported(ownerId, batchId, "a".repeat(64), data));

        assertThatThrownBy(() -> transactions.saveAndFlush(
                LedgerTransaction.imported(ownerId, batchId, "a".repeat(64), data)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void manualTransactionsHaveNoKeyAndMayRepeat() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        transactions.saveAndFlush(LedgerTransaction.manual(ownerId, data));
        transactions.saveAndFlush(LedgerTransaction.manual(ownerId, data));

        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(2);
    }

    @Test
    void displayValuesPreferOverrides() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        LedgerTransaction tx = LedgerTransaction.manual(ownerId, data);
        assertThat(tx.displayCategory()).isEqualTo(new Category("식비", ""));
        assertThat(tx.isEdited()).isFalse();

        tx.setCategoryMajorOverride("외식");
        tx.setMemoOverride("점심");

        assertThat(tx.displayCategory()).isEqualTo(new Category("외식", ""));
        assertThat(tx.displayMemo()).isEqualTo("점심");
        assertThat(tx.isEdited()).isTrue();
    }

    @Test
    void refreshOriginalUpdatesNonKeyFieldsOnly() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        LedgerTransaction tx = LedgerTransaction.imported(ownerId, batchId, "b".repeat(64), data);
        tx.setCategoryMajorOverride("외식");

        TransactionData changed = new TransactionData(data.occurredAt(), data.type(), "생활", "편의점",
                data.description(), data.amount(), data.currency(), data.paymentMethod(), "메모");

        assertThat(tx.refreshOriginal(data)).isFalse();
        assertThat(tx.refreshOriginal(changed)).isTrue();
        assertThat(tx.getCategoryMajorOverride()).isEqualTo("외식");
        assertThat(tx.displayCategory()).isEqualTo(new Category("외식", "편의점"));
    }

    @Test
    void monthQueriesFilterByRangeAndHiddenAndSortNewestFirst() {
        LedgerTransaction early = transactions.save(LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-09-01T09:00:00", "식비", "아침", -3000)));
        LedgerTransaction late = transactions.save(LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-09-30T23:59:59", "식비", "야식", -9000)));
        LedgerTransaction hidden = LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-09-15T12:00:00", "식비", "점심", -8000));
        hidden.setHidden(true);
        transactions.save(hidden);
        transactions.save(LedgerTransaction.manual(ownerId,
                TestLedger.data(TransactionType.EXPENSE, "2026-10-01T00:00:00", "식비", "다음달", -1000)));
        LocalDateTime from = LocalDateTime.of(2026, 9, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 10, 1, 0, 0);

        List<LedgerTransaction> owned = transactions.findOwnedBetween(ownerId, from, to);
        List<LedgerTransaction> visible = transactions.findVisibleBetween(List.of(ownerId), from, to);

        assertThat(owned).extracting(LedgerTransaction::getDescription).containsExactly("야식", "점심", "아침");
        assertThat(visible).extracting(LedgerTransaction::getId).containsExactly(late.getId(), early.getId());
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*LedgerTransactionRepositoryTest'`
Expected: 컴파일 실패 (`LedgerTransaction` 등 없음)

- [ ] **Step 4: `V4__create_transactions.sql` 작성**

```sql
CREATE TABLE import_batches (
    id             BIGSERIAL PRIMARY KEY,
    owner_id       BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    file_name      VARCHAR(255) NOT NULL,
    total_rows     INT          NOT NULL DEFAULT 0,
    created_rows   INT          NOT NULL DEFAULT 0,
    updated_rows   INT          NOT NULL DEFAULT 0,
    unchanged_rows INT          NOT NULL DEFAULT 0,
    imported_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_batches_owner ON import_batches (owner_id, imported_at DESC);

CREATE TABLE transactions (
    id                      BIGSERIAL PRIMARY KEY,
    owner_id                BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    source                  VARCHAR(10)   NOT NULL CHECK (source IN ('IMPORT', 'MANUAL')),
    import_batch_id         BIGINT        REFERENCES import_batches (id) ON DELETE SET NULL,
    dedup_key               VARCHAR(64),
    occurred_at             TIMESTAMP     NOT NULL,
    type                    VARCHAR(10)   NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    category_major          VARCHAR(100)  NOT NULL,
    category_minor          VARCHAR(100)  NOT NULL,
    description             VARCHAR(500)  NOT NULL,
    amount                  NUMERIC(15, 2) NOT NULL,
    currency                VARCHAR(10)   NOT NULL,
    payment_method          VARCHAR(100)  NOT NULL,
    original_memo           VARCHAR(1000),
    category_major_override VARCHAR(100),
    category_minor_override VARCHAR(100),
    memo_override           VARCHAR(1000),
    hidden                  BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_transactions_owner_dedup UNIQUE (owner_id, dedup_key),
    CONSTRAINT ck_transactions_dedup_source CHECK ((source = 'IMPORT') = (dedup_key IS NOT NULL))
);

CREATE INDEX idx_transactions_owner_occurred ON transactions (owner_id, occurred_at);

CREATE TABLE transaction_audits (
    id             BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT        NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    actor_id       BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    field          VARCHAR(30)   NOT NULL,
    before_value   VARCHAR(1000),
    after_value    VARCHAR(1000),
    changed_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_audits_tx ON transaction_audits (transaction_id, changed_at);
```

- [ ] **Step 5: `TransactionSource.java`, `Category.java`**

```java
package com.saladbowl.api.transaction;

public enum TransactionSource {
    IMPORT,
    MANUAL
}
```

```java
package com.saladbowl.api.transaction;

/** 화면에 보이는 카테고리. 스펙 9.1의 그룹 카테고리 매핑을 붙일 때 이 값이 바뀐다. */
public record Category(String major, String minor) {
}
```

- [ ] **Step 6: `LedgerTransaction.java`**

```java
package com.saladbowl.api.transaction;

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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Objects;

/**
 * 회원 소유의 거래 한 건. 원본 필드는 import(또는 수동 추가) 값이고 API로 바꾸지 않는다.
 * 화면 값은 *_override와 hidden으로 바꾸며, 재 import가 이 필드를 덮어쓰지 않는다.
 */
@Entity
@Table(name = "transactions")
public class LedgerTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TransactionSource source;

    @Column(name = "import_batch_id")
    private Long importBatchId;

    @Column(name = "dedup_key", length = 64)
    private String dedupKey;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TransactionType type;

    @Column(name = "category_major", nullable = false, length = 100)
    private String categoryMajor;

    @Column(name = "category_minor", nullable = false, length = 100)
    private String categoryMinor;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(name = "payment_method", nullable = false, length = 100)
    private String paymentMethod;

    @Column(name = "original_memo", length = 1000)
    private String originalMemo;

    @Column(name = "category_major_override", length = 100)
    private String categoryMajorOverride;

    @Column(name = "category_minor_override", length = 100)
    private String categoryMinorOverride;

    @Column(name = "memo_override", length = 1000)
    private String memoOverride;

    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected LedgerTransaction() {
    }

    private LedgerTransaction(long ownerId, TransactionSource source, Long importBatchId, String dedupKey,
                              TransactionData data) {
        this.ownerId = ownerId;
        this.source = source;
        this.importBatchId = importBatchId;
        this.dedupKey = dedupKey;
        this.occurredAt = data.occurredAt();
        this.description = data.description();
        this.amount = data.amount();
        this.paymentMethod = data.paymentMethod();
        applyNonKeyFields(data);
    }

    public static LedgerTransaction imported(long ownerId, long importBatchId, String dedupKey, TransactionData data) {
        return new LedgerTransaction(ownerId, TransactionSource.IMPORT, importBatchId, dedupKey, data);
    }

    public static LedgerTransaction manual(long ownerId, TransactionData data) {
        return new LedgerTransaction(ownerId, TransactionSource.MANUAL, null, null, data);
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    /** 재 import: 중복 키에 들어가지 않는 원본 필드만 갱신한다. override와 hidden은 그대로 둔다. */
    public boolean refreshOriginal(TransactionData data) {
        boolean changed = type != data.type()
                || !categoryMajor.equals(data.categoryMajor())
                || !categoryMinor.equals(data.categoryMinor())
                || !currency.equals(data.currency())
                || !Objects.equals(originalMemo, data.memo());
        if (changed) {
            applyNonKeyFields(data);
        }
        return changed;
    }

    private void applyNonKeyFields(TransactionData data) {
        this.type = data.type();
        this.categoryMajor = data.categoryMajor();
        this.categoryMinor = data.categoryMinor();
        this.currency = data.currency();
        this.originalMemo = data.memo();
    }

    public Category displayCategory() {
        return new Category(
                categoryMajorOverride != null ? categoryMajorOverride : categoryMajor,
                categoryMinorOverride != null ? categoryMinorOverride : categoryMinor);
    }

    public String displayMemo() {
        return memoOverride != null ? memoOverride : originalMemo;
    }

    public boolean isEdited() {
        return categoryMajorOverride != null || categoryMinorOverride != null || memoOverride != null;
    }

    public void setCategoryMajorOverride(String value) { this.categoryMajorOverride = value; }
    public void setCategoryMinorOverride(String value) { this.categoryMinorOverride = value; }
    public void setMemoOverride(String value) { this.memoOverride = value; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public TransactionSource getSource() { return source; }
    public String getDedupKey() { return dedupKey; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public TransactionType getType() { return type; }
    public String getDescription() { return description; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getCategoryMajorOverride() { return categoryMajorOverride; }
    public String getCategoryMinorOverride() { return categoryMinorOverride; }
    public String getMemoOverride() { return memoOverride; }
    public boolean isHidden() { return hidden; }
}
```

- [ ] **Step 7: `LedgerTransactionRepository.java`**

```java
package com.saladbowl.api.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface LedgerTransactionRepository extends JpaRepository<LedgerTransaction, Long> {

    List<LedgerTransaction> findByOwnerIdAndDedupKeyIn(Long ownerId, Collection<String> dedupKeys);

    long countByOwnerId(Long ownerId);

    /** 소유자 본인 화면용. 숨긴 거래도 포함한다. */
    @Query("""
            select t from LedgerTransaction t
            where t.ownerId = :ownerId and t.occurredAt >= :from and t.occurredAt < :to
            order by t.occurredAt desc, t.id desc
            """)
    List<LedgerTransaction> findOwnedBetween(@Param("ownerId") Long ownerId,
                                             @Param("from") LocalDateTime from,
                                             @Param("to") LocalDateTime to);

    /** 그룹 화면·요약용. 숨긴 거래는 빠진다. ownerIds가 비어 있으면 호출하지 않는다. */
    @Query("""
            select t from LedgerTransaction t
            where t.ownerId in :ownerIds and t.hidden = false
              and t.occurredAt >= :from and t.occurredAt < :to
            order by t.occurredAt desc, t.id desc
            """)
    List<LedgerTransaction> findVisibleBetween(@Param("ownerIds") Collection<Long> ownerIds,
                                               @Param("from") LocalDateTime from,
                                               @Param("to") LocalDateTime to);
}
```

- [ ] **Step 8: `TransactionAudit.java`, `TransactionAuditRepository.java`**

```java
package com.saladbowl.api.transaction;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** 거래 수정 이력 한 줄. 필드 하나의 변경 전후 값을 남긴다. */
@Entity
@Table(name = "transaction_audits")
public class TransactionAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    @Column(nullable = false, length = 30)
    private String field;

    @Column(name = "before_value", length = 1000)
    private String beforeValue;

    @Column(name = "after_value", length = 1000)
    private String afterValue;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    protected TransactionAudit() {
    }

    public TransactionAudit(long transactionId, long actorId, String field, String beforeValue, String afterValue) {
        this.transactionId = transactionId;
        this.actorId = actorId;
        this.field = field;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
    }

    @PrePersist
    void onCreate() {
        changedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public Long getTransactionId() { return transactionId; }
    public Long getActorId() { return actorId; }
    public String getField() { return field; }
    public String getBeforeValue() { return beforeValue; }
    public String getAfterValue() { return afterValue; }
    public OffsetDateTime getChangedAt() { return changedAt; }
}
```

```java
package com.saladbowl.api.transaction;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransactionAuditRepository extends JpaRepository<TransactionAudit, Long> {

    List<TransactionAudit> findByTransactionIdOrderByChangedAtAscIdAsc(Long transactionId);
}
```

- [ ] **Step 9: `ImportBatch.java`, `ImportBatchRepository.java`**

```java
package com.saladbowl.api.importer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** 업로드 한 번의 결과. 원본 파일은 저장하지 않고 이름과 건수만 남긴다. */
@Entity
@Table(name = "import_batches")
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "total_rows", nullable = false)
    private int totalRows;

    @Column(name = "created_rows", nullable = false)
    private int createdRows;

    @Column(name = "updated_rows", nullable = false)
    private int updatedRows;

    @Column(name = "unchanged_rows", nullable = false)
    private int unchangedRows;

    @Column(name = "imported_at", nullable = false)
    private OffsetDateTime importedAt;

    protected ImportBatch() {
    }

    public ImportBatch(long ownerId, String fileName) {
        this.ownerId = ownerId;
        this.fileName = fileName;
    }

    @PrePersist
    void onCreate() {
        importedAt = OffsetDateTime.now();
    }

    public void record(int total, int created, int updated, int unchanged) {
        this.totalRows = total;
        this.createdRows = created;
        this.updatedRows = updated;
        this.unchangedRows = unchanged;
    }

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public String getFileName() { return fileName; }
    public int getTotalRows() { return totalRows; }
    public int getCreatedRows() { return createdRows; }
    public int getUpdatedRows() { return updatedRows; }
    public int getUnchangedRows() { return unchangedRows; }
    public OffsetDateTime getImportedAt() { return importedAt; }
}
```

```java
package com.saladbowl.api.importer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, Long> {

    List<ImportBatch> findTop20ByOwnerIdOrderByImportedAtDescIdDesc(Long ownerId);
}
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*LedgerTransactionRepositoryTest'`
Expected: 5 tests PASS. Flyway가 `V4`를 적용하고 `ddl-auto: validate`가 통과한다.

- [ ] **Step 11: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/src
git commit -m "feat(api): add transaction, import batch and audit schema"
```

---

### Task 4: 중복 키와 병합 (`DedupKeys`, `MergeService`, `ImportService`)

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/DedupKeys.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/MergeService.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/ImportDtos.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/ImportService.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/importer/DedupKeysTest.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/importer/ImportServiceTest.java`

**Interfaces:**
- Consumes: `BanksaladParser.parse`, `ParsedRow`, `TransactionData`(Task 2), `LedgerTransaction`, `LedgerTransactionRepository`, `ImportBatch`, `ImportBatchRepository`(Task 3), `BanksaladWorkbook`
- Produces:
  - `DedupKeys.keysFor(long ownerId, List<ParsedRow> rows)` → `List<String>`(rows와 같은 순서, SHA-256 hex 64자)
  - `MergeService.merge(long ownerId, long importBatchId, List<ParsedRow> rows)` → `MergeService.MergeCounts(int created, int updated, int unchanged)`
  - `ImportDtos.ImportResult(long batchId, int totalRows, int createdRows, int updatedRows, int unchangedRows)`
  - `ImportDtos.ImportBatchView(long batchId, String fileName, int totalRows, int createdRows, int updatedRows, int unchangedRows, OffsetDateTime importedAt)`
  - `ImportService.importFile(long ownerId, String fileName, InputStream in)` → `ImportResult`(하나의 DB 트랜잭션. 파싱이 실패하면 아무것도 쓰지 않는다)
  - `ImportService.recent(long ownerId)` → `List<ImportBatchView>`

- [ ] **Step 1: 실패하는 `DedupKeysTest` 작성**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.support.TestLedger;
import com.saladbowl.api.transaction.TransactionData;
import com.saladbowl.api.transaction.TransactionType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DedupKeysTest {

    private static ParsedRow row(int rowNumber, TransactionData data) {
        return new ParsedRow(rowNumber, data);
    }

    @Test
    void keysAreStableHex64() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);

        List<String> first = DedupKeys.keysFor(1L, List.of(row(2, data)));
        List<String> second = DedupKeys.keysFor(1L, List.of(row(7, data)));

        assertThat(first.get(0)).matches("[0-9a-f]{64}").isEqualTo(second.get(0));
    }

    @Test
    void identicalRowsInOneFileGetDifferentKeys() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);

        List<String> keys = DedupKeys.keysFor(1L, List.of(row(2, data), row(3, data)));

        assertThat(keys.get(0)).isNotEqualTo(keys.get(1));
    }

    @Test
    void categoryIsNotPartOfTheKey() {
        TransactionData a = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);
        TransactionData b = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "외식", "김밥", -4000);

        assertThat(DedupKeys.keysFor(1L, List.of(row(2, a))))
                .isEqualTo(DedupKeys.keysFor(1L, List.of(row(2, b))));
    }

    @Test
    void ownerIsPartOfTheKey() {
        TransactionData data = TestLedger.data(TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", "김밥", -4000);

        assertThat(DedupKeys.keysFor(1L, List.of(row(2, data))))
                .isNotEqualTo(DedupKeys.keysFor(2L, List.of(row(2, data))));
    }
}
```

- [ ] **Step 2: 실패하는 `ImportServiceTest` 작성**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.importer.ImportDtos.ImportResult;
import com.saladbowl.api.support.BanksaladWorkbook;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.transaction.Category;
import com.saladbowl.api.transaction.LedgerTransaction;
import com.saladbowl.api.transaction.LedgerTransactionRepository;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImportServiceTest extends IntegrationTest {

    @Autowired
    ImportService importService;

    @Autowired
    UserRepository users;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    long ownerId;

    @BeforeEach
    void setUp() {
        ownerId = users.save(new User("owner@test.com", "hash", "소유자")).getId();
    }

    private static BanksaladWorkbook september() {
        return BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .row("2026-09-02", "19:00:00", "지출", "식비", "저녁", "국밥", -9000, "신한카드", "회식")
                .row("2026-09-25", "09:00:00", "수입", "급여", "월급", "회사", 3000000, "국민은행", null);
    }

    private ImportResult importBytes(long owner, byte[] bytes) {
        return importService.importFile(owner, "september.xlsx", new ByteArrayInputStream(bytes));
    }

    @Test
    void firstImportCreatesEveryRowAndRecordsBatch() {
        ImportResult result = importBytes(ownerId, september().toBytes());

        assertThat(result.totalRows()).isEqualTo(3);
        assertThat(result.createdRows()).isEqualTo(3);
        assertThat(result.updatedRows()).isZero();
        assertThat(result.unchangedRows()).isZero();
        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(3);
        ImportBatch batch = batches.findById(result.batchId()).orElseThrow();
        assertThat(batch.getFileName()).isEqualTo("september.xlsx");
        assertThat(batch.getCreatedRows()).isEqualTo(3);
    }

    @Test
    void reimportingTheSameFileChangesNothing() {
        importBytes(ownerId, september().toBytes());

        ImportResult again = importBytes(ownerId, september().toBytes());

        assertThat(again.createdRows()).isZero();
        assertThat(again.unchangedRows()).isEqualTo(3);
        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(3);
    }

    @Test
    void reimportUpdatesOriginalCategoryButKeepsUserOverride() {
        importBytes(ownerId, september().toBytes());
        LedgerTransaction kimbap = findByDescription("김밥");
        kimbap.setMemoOverride("내가 쓴 메모");
        transactions.save(kimbap);

        ImportResult again = importBytes(ownerId, BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "외식", "분식", "김밥", -4000, "현금", "앱 메모")
                .toBytes());

        assertThat(again.updatedRows()).isEqualTo(1);
        LedgerTransaction reloaded = findByDescription("김밥");
        assertThat(reloaded.displayCategory()).isEqualTo(new Category("외식", "분식"));
        assertThat(reloaded.displayMemo()).isEqualTo("내가 쓴 메모");
    }

    @Test
    void rowsMissingFromTheNewFileAreKept() {
        importBytes(ownerId, september().toBytes());

        importBytes(ownerId, BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .toBytes());

        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(3);
    }

    @Test
    void identicalRowsInOneFileAreBothKeptAndNotDuplicatedOnReimport() {
        BanksaladWorkbook twice = BanksaladWorkbook.create()
                .row("2026-09-03", "08:30:00", "지출", "교통", "버스", "버스", -1500, "티머니", null)
                .row("2026-09-03", "08:30:00", "지출", "교통", "버스", "버스", -1500, "티머니", null);

        assertThat(importBytes(ownerId, twice.toBytes()).createdRows()).isEqualTo(2);
        assertThat(importBytes(ownerId, twice.toBytes()).createdRows()).isZero();
        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(2);
    }

    @Test
    void sameFileForAnotherOwnerIsIndependent() {
        long otherId = users.save(new User("other@test.com", "hash", "다른사람")).getId();
        importBytes(ownerId, september().toBytes());

        ImportResult other = importBytes(otherId, september().toBytes());

        assertThat(other.createdRows()).isEqualTo(3);
    }

    @Test
    void invalidFileWritesNothing() {
        assertThatThrownBy(() -> importBytes(ownerId, "garbage".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(ApiException.class);

        assertThat(batches.count()).isZero();
        assertThat(transactions.countByOwnerId(ownerId)).isZero();
    }

    private LedgerTransaction findByDescription(String description) {
        List<LedgerTransaction> all = transactions.findAll();
        return all.stream().filter(t -> t.getDescription().equals(description)).findFirst().orElseThrow();
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*DedupKeysTest' --tests '*ImportServiceTest'`
Expected: 컴파일 실패 (`DedupKeys`, `ImportService` 등 없음)

- [ ] **Step 4: `DedupKeys.java`**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.transaction.TransactionData;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * 거래 중복 키: SHA-256(owner, 일시, 금액, 내용, 결제수단, seq).
 * seq는 한 파일 안에서 앞의 다섯 값이 같은 행의 순번(0부터)이라, 같은 시각·금액의 반복 결제를 구분한다.
 * 카테고리와 메모는 키에 넣지 않는다(앱에서 바뀔 수 있다).
 */
public final class DedupKeys {

    private static final String SEPARATOR = "\u001F";

    private DedupKeys() {
    }

    public static List<String> keysFor(long ownerId, List<ParsedRow> rows) {
        Map<String, Integer> occurrences = new HashMap<>();
        List<String> keys = new ArrayList<>(rows.size());
        for (ParsedRow row : rows) {
            String identity = identity(ownerId, row.data());
            int seq = occurrences.merge(identity, 1, Integer::sum) - 1;
            keys.add(sha256(identity + SEPARATOR + seq));
        }
        return keys;
    }

    private static String identity(long ownerId, TransactionData data) {
        return String.join(SEPARATOR,
                Long.toString(ownerId),
                data.occurredAt().toString(),
                data.amount().toPlainString(),
                data.description(),
                data.paymentMethod());
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

- [ ] **Step 5: `MergeService.java`**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.transaction.LedgerTransaction;
import com.saladbowl.api.transaction.LedgerTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 파싱된 행을 소유자의 기존 거래와 병합한다. 호출자의 트랜잭션 안에서 동작한다. */
@Service
public class MergeService {

    private static final int KEY_CHUNK = 1000;

    private final LedgerTransactionRepository transactions;

    public MergeService(LedgerTransactionRepository transactions) {
        this.transactions = transactions;
    }

    public record MergeCounts(int created, int updated, int unchanged) {
    }

    @Transactional
    public MergeCounts merge(long ownerId, long importBatchId, List<ParsedRow> rows) {
        List<String> keys = DedupKeys.keysFor(ownerId, rows);
        Map<String, LedgerTransaction> existing = findExisting(ownerId, keys);
        List<LedgerTransaction> toCreate = new ArrayList<>();
        int updated = 0;
        int unchanged = 0;
        for (int i = 0; i < rows.size(); i++) {
            LedgerTransaction current = existing.get(keys.get(i));
            if (current == null) {
                toCreate.add(LedgerTransaction.imported(ownerId, importBatchId, keys.get(i), rows.get(i).data()));
            } else if (current.refreshOriginal(rows.get(i).data())) {
                updated++;
            } else {
                unchanged++;
            }
        }
        transactions.saveAll(toCreate);
        return new MergeCounts(toCreate.size(), updated, unchanged);
    }

    private Map<String, LedgerTransaction> findExisting(long ownerId, List<String> keys) {
        Map<String, LedgerTransaction> byKey = new HashMap<>();
        for (int from = 0; from < keys.size(); from += KEY_CHUNK) {
            List<String> chunk = keys.subList(from, Math.min(from + KEY_CHUNK, keys.size()));
            for (LedgerTransaction tx : transactions.findByOwnerIdAndDedupKeyIn(ownerId, chunk)) {
                byKey.put(tx.getDedupKey(), tx);
            }
        }
        return byKey;
    }
}
```

- [ ] **Step 6: `ImportDtos.java`, `ImportService.java`**

```java
package com.saladbowl.api.importer;

import java.time.OffsetDateTime;

public final class ImportDtos {

    private ImportDtos() {
    }

    public record ImportResult(long batchId, int totalRows, int createdRows, int updatedRows, int unchangedRows) {
    }

    public record ImportBatchView(long batchId, String fileName, int totalRows, int createdRows, int updatedRows,
                                  int unchangedRows, OffsetDateTime importedAt) {

        static ImportBatchView from(ImportBatch batch) {
            return new ImportBatchView(batch.getId(), batch.getFileName(), batch.getTotalRows(),
                    batch.getCreatedRows(), batch.getUpdatedRows(), batch.getUnchangedRows(), batch.getImportedAt());
        }
    }
}
```

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.importer.ImportDtos.ImportBatchView;
import com.saladbowl.api.importer.ImportDtos.ImportResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.List;

@Service
public class ImportService {

    private final BanksaladParser parser;
    private final MergeService mergeService;
    private final ImportBatchRepository batches;

    public ImportService(BanksaladParser parser, MergeService mergeService, ImportBatchRepository batches) {
        this.parser = parser;
        this.mergeService = mergeService;
        this.batches = batches;
    }

    /** 파일 하나를 하나의 트랜잭션으로 반영한다. 파싱을 먼저 끝내므로 형식 오류면 아무것도 쓰지 않는다. */
    @Transactional
    public ImportResult importFile(long ownerId, String fileName, InputStream in) {
        List<ParsedRow> rows = parser.parse(in);
        ImportBatch batch = batches.save(new ImportBatch(ownerId, fileName));
        MergeService.MergeCounts counts = mergeService.merge(ownerId, batch.getId(), rows);
        batch.record(rows.size(), counts.created(), counts.updated(), counts.unchanged());
        return new ImportResult(batch.getId(), rows.size(), counts.created(), counts.updated(), counts.unchanged());
    }

    @Transactional(readOnly = true)
    public List<ImportBatchView> recent(long ownerId) {
        return batches.findTop20ByOwnerIdOrderByImportedAtDescIdDesc(ownerId).stream()
                .map(ImportBatchView::from)
                .toList();
    }
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*DedupKeysTest' --tests '*ImportServiceTest'`
Expected: 4 + 7 = 11 tests PASS

- [ ] **Step 8: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/src
git commit -m "feat(api): merge imported rows by dedup key and keep user overrides"
```

---

### Task 5: 업로드 API (`POST /imports`, `GET /imports`)

**Files:**
- Modify: `apps/api/src/main/resources/application.yml`
- Modify: `apps/api/src/main/java/com/saladbowl/api/common/ErrorCode.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/common/GlobalExceptionHandler.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/importer/ImportController.java`
- Modify: `apps/api/src/test/java/com/saladbowl/api/common/ExceptionMappingTest.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/importer/ImportApiTest.java`

**Interfaces:**
- Consumes: `ImportService.importFile`/`recent`(Task 4), `BanksaladWorkbook`, `TestAuth`, `LedgerTransactionRepository.countByOwnerId`
- Produces:
  - `ErrorCode.FILE_TOO_LARGE` (413)
  - `MaxUploadSizeExceededException` → `413 FILE_TOO_LARGE`
  - `POST /imports` (multipart, part 이름 `file`) → `201 ImportResult`. 빈 파일이나 `.xlsx`가 아닌 이름은 `400 INVALID_FILE_FORMAT`, part가 없으면 `400 VALIDATION_FAILED`
  - `GET /imports` → `200 ImportBatchView[]`(최근 20개, 최신 순)
  - 설정 `spring.servlet.multipart.max-file-size: 5MB`, `max-request-size: 6MB`

- [ ] **Step 1: `ExceptionMappingTest`에 업로드 한도 테스트 추가**

`ThrowingController`에 엔드포인트를 추가한다(import `org.springframework.web.multipart.MaxUploadSizeExceededException`).

```java
        @GetMapping("/test-errors/too-large")
        String tooLarge() {
            throw new MaxUploadSizeExceededException(5L * 1024 * 1024);
        }
```

테스트를 추가한다.

```java
    @Test
    void uploadOverLimitReturns413() throws Exception {
        mvc.perform(get("/test-errors/too-large").with(user("tester")))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
    }
```

- [ ] **Step 2: 실패하는 `ImportApiTest` 작성**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.support.BanksaladWorkbook;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.transaction.LedgerTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.servlet.MultipartProperties;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.unit.DataSize;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ImportApiTest extends IntegrationTest {

    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    MultipartProperties multipartProperties;

    AuthedUser owner;

    @BeforeEach
    void setUp() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "owner@test.com", "소유자");
    }

    private static MockMultipartFile ledger(String fileName) {
        byte[] bytes = BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .row("2026-09-02", "19:00:00", "지출", "식비", "저녁", "국밥", -9000, "신한카드", null)
                .toBytes();
        return new MockMultipartFile("file", fileName, XLSX, bytes);
    }

    @Test
    void uploadCreatesTransactions() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("2026-09.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.batchId").isNumber())
                .andExpect(jsonPath("$.totalRows").value(2))
                .andExpect(jsonPath("$.createdRows").value(2))
                .andExpect(jsonPath("$.unchangedRows").value(0));

        assertThat(transactions.countByOwnerId(owner.id())).isEqualTo(2);
    }

    @Test
    void reuploadReportsUnchangedRows() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("a.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());

        mvc.perform(multipart("/imports").file(ledger("a.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdRows").value(0))
                .andExpect(jsonPath("$.unchangedRows").value(2));
    }

    @Test
    void nonXlsxFileNameIsRejected() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("ledger.csv")).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILE_FORMAT"));
    }

    @Test
    void garbageContentIsRejected() throws Exception {
        MockMultipartFile garbage = new MockMultipartFile("file", "fake.xlsx", XLSX,
                "not excel".getBytes(StandardCharsets.UTF_8));

        mvc.perform(multipart("/imports").file(garbage).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILE_FORMAT"));
    }

    @Test
    void emptyFileIsRejected() throws Exception {
        MockMultipartFile empty = new MockMultipartFile("file", "empty.xlsx", XLSX, new byte[0]);

        mvc.perform(multipart("/imports").file(empty).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILE_FORMAT"));
    }

    @Test
    void missingFilePartReturns400() throws Exception {
        mvc.perform(multipart("/imports").header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void uploadRequiresLogin() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("a.xlsx")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void historyListsMyBatchesNewestFirst() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("first.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());
        mvc.perform(multipart("/imports").file(ledger("second.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());

        mvc.perform(get("/imports").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].fileName").value("second.xlsx"))
                .andExpect(jsonPath("$[1].fileName").value("first.xlsx"))
                .andExpect(jsonPath("$[0].importedAt").isString());
    }

    @Test
    void uploadLimitIsFiveMegabytes() {
        assertThat(multipartProperties.getMaxFileSize()).isEqualTo(DataSize.ofMegabytes(5));
    }
}
```

`MultipartProperties`의 패키지가 Boot 4에서 다르면(모듈화로 이동했을 수 있다) 실제 패키지로 import를 고치고 리포트에 남긴다.

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*ImportApiTest' --tests '*ExceptionMappingTest'`
Expected: `/imports` 매핑이 없고 `FILE_TOO_LARGE`가 없어 FAIL

- [ ] **Step 4: 업로드 한도 설정**

`application.yml`의 `spring:` 아래에 추가한다.

```yaml
  servlet:
    multipart:
      max-file-size: 5MB
      max-request-size: 6MB
```

- [ ] **Step 5: `ErrorCode`와 `GlobalExceptionHandler`**

`ErrorCode`의 `CONFLICT` 바로 위에 추가한다.

```java
    FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE),
```

`GlobalExceptionHandler`에 import `org.springframework.web.multipart.MaxUploadSizeExceededException`을 추가하고, `handleDataIntegrity` 아래에 추가한다.

```java
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleUploadTooLarge(MaxUploadSizeExceededException e) {
        return error(ErrorCode.FILE_TOO_LARGE, "file must be 5MB or smaller");
    }
```

- [ ] **Step 6: `ImportController.java`**

```java
package com.saladbowl.api.importer;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.importer.ImportDtos.ImportBatchView;
import com.saladbowl.api.importer.ImportDtos.ImportResult;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;

@RestController
public class ImportController {

    private static final int MAX_FILE_NAME = 255;

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    @PostMapping(path = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResult> upload(@CurrentUser Long userId, @RequestParam("file") MultipartFile file)
            throws IOException {
        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().strip();
        if (file.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_FILE_FORMAT, "file is empty");
        }
        if (!fileName.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            throw new ApiException(ErrorCode.INVALID_FILE_FORMAT, "only .xlsx files are supported");
        }
        String storedName = fileName.length() > MAX_FILE_NAME ? fileName.substring(0, MAX_FILE_NAME) : fileName;
        try (InputStream in = file.getInputStream()) {
            ImportResult result = importService.importFile(userId, storedName, in);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        }
    }

    @GetMapping("/imports")
    public List<ImportBatchView> history(@CurrentUser Long userId) {
        return importService.recent(userId);
    }
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*ImportApiTest' --tests '*ExceptionMappingTest'`
Expected: ImportApiTest 9개, ExceptionMappingTest 7개 PASS

- [ ] **Step 8: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/src
git commit -m "feat(api): add Banksalad xlsx upload and import history endpoints"
```

---

### Task 6: 거래 조회와 수동 추가

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionDtos.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionViews.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionController.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/TransactionQueryApiTest.java`

**Interfaces:**
- Consumes: `GroupAccess.requireMember`/`sharedOwnerIds`/`canEditOwnedBy`(Plan 02, Task 1), `LedgerTransaction`, `LedgerTransactionRepository`(Task 3), `UserRepository`, `TestAuth`, `TestGroups`, `TestLedger`
- Produces:
  - `TransactionDtos.TransactionView(long id, long ownerId, String ownerNickname, LocalDateTime occurredAt, TransactionType type, String categoryMajor, String categoryMinor, String description, BigDecimal amount, String currency, String paymentMethod, String memo, boolean hidden, TransactionSource source, boolean edited, boolean editable)`. 카테고리와 메모는 화면 값(override 우선)이다.
  - `TransactionDtos.ManualTransactionRequest(...)`(아래 코드)
  - `TransactionViews.toViews(List<LedgerTransaction>, Predicate<Long> editableOwner)` → `List<TransactionView>`, `TransactionViews.toView(LedgerTransaction, boolean editable)`
  - `TransactionService.monthRange(YearMonth)` → `TransactionService.Range(LocalDateTime from, LocalDateTime to)`
  - `TransactionService.myTransactions(long userId, YearMonth month)`, `groupTransactions(long groupId, long userId, YearMonth month, Long memberId)`, `addManual(long userId, ManualTransactionRequest)`
  - `TransactionController`: `GET /me/transactions`, `POST /me/transactions`, `GET /groups/{groupId}/transactions`. Task 7에서 매핑을 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import com.saladbowl.api.support.TestLedger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TransactionQueryApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    AuthedUser admin;
    AuthedUser member;
    long groupId;

    @BeforeEach
    void setUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);
    }

    private LedgerTransaction save(AuthedUser owner, String dateTime, String description, long amount) {
        return transactions.save(LedgerTransaction.manual(owner.id(),
                TestLedger.data(TransactionType.EXPENSE, dateTime, "식비", description, amount)));
    }

    @Test
    void myTransactionsListTheMonthNewestFirstIncludingHidden() throws Exception {
        save(member, "2026-09-01T09:00:00", "아침", -3000);
        LedgerTransaction hidden = save(member, "2026-09-10T12:00:00", "점심", -8000);
        hidden.setHidden(true);
        transactions.save(hidden);
        save(member, "2026-10-01T09:00:00", "다음달", -1000);

        mvc.perform(get("/me/transactions").param("month", "2026-09").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].description").value("점심"))
                .andExpect(jsonPath("$[0].hidden").value(true))
                .andExpect(jsonPath("$[0].editable").value(true))
                .andExpect(jsonPath("$[0].occurredAt").value("2026-09-10T12:00:00"))
                .andExpect(jsonPath("$[1].description").value("아침"))
                .andExpect(jsonPath("$[1].amount").value(-3000.0))
                .andExpect(jsonPath("$[1].ownerNickname").value("멤버"));
    }

    @Test
    void groupTransactionsShowSharedMembersAndHideHiddenOnes() throws Exception {
        save(admin, "2026-09-01T09:00:00", "관리자 거래", -3000);
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);
        LedgerTransaction hidden = save(member, "2026-09-03T09:00:00", "숨긴 거래", -5000);
        hidden.setHidden(true);
        transactions.save(hidden);

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].description").value("멤버 거래"))
                .andExpect(jsonPath("$[0].editable").value(true))
                .andExpect(jsonPath("$[1].description").value("관리자 거래"))
                .andExpect(jsonPath("$[1].ownerNickname").value("관리자"))
                .andExpect(jsonPath("$[1].editable").value(false));
    }

    @Test
    void adminSeesMemberTransactionsAsEditable() throws Exception {
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$[0].editable").value(true));
    }

    @Test
    void membersWhoTurnedSharingOffAreExcluded() throws Exception {
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void memberFilterNarrowsTheList() throws Exception {
        save(admin, "2026-09-01T09:00:00", "관리자 거래", -3000);
        save(member, "2026-09-02T09:00:00", "멤버 거래", -4000);

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .param("memberId", Long.toString(admin.id()))
                        .header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description").value("관리자 거래"));
    }

    @Test
    void outsiderGets404() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void monthIsRequiredAndValidated() throws Exception {
        mvc.perform(get("/me/transactions").header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/me/transactions").param("month", "2026-13").header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void manualTransactionIsCreated() throws Exception {
        mvc.perform(post("/me/transactions").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"occurredAt":"2026-09-05T13:30:00","type":"EXPENSE","categoryMajor":"식비",
                                 "description":"현금 점심","amount":-6500,"paymentMethod":"현금","memo":"동료와"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.categoryMinor").value(""))
                .andExpect(jsonPath("$.amount").value(-6500.0))
                .andExpect(jsonPath("$.currency").value("KRW"))
                .andExpect(jsonPath("$.memo").value("동료와"));

        mvc.perform(get("/me/transactions").param("month", "2026-09").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void manualTransactionIsValidated() throws Exception {
        mvc.perform(post("/me/transactions").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"occurredAt":"2026-09-05T13:30:00","type":"EXPENSE","categoryMajor":"",
                                 "description":"x","amount":-6500}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TransactionQueryApiTest'`
Expected: 엔드포인트가 없어 FAIL

- [ ] **Step 3: `TransactionDtos.java`**

```java
package com.saladbowl.api.transaction;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class TransactionDtos {

    private TransactionDtos() {
    }

    /** 화면용 거래. categoryMajor/categoryMinor/memo는 override가 있으면 override 값이다. */
    public record TransactionView(
            long id,
            long ownerId,
            String ownerNickname,
            LocalDateTime occurredAt,
            TransactionType type,
            String categoryMajor,
            String categoryMinor,
            String description,
            BigDecimal amount,
            String currency,
            String paymentMethod,
            String memo,
            boolean hidden,
            TransactionSource source,
            boolean edited,
            boolean editable) {
    }

    public record ManualTransactionRequest(
            @NotNull LocalDateTime occurredAt,
            @NotNull TransactionType type,
            @NotBlank @Size(max = 100) String categoryMajor,
            @Size(max = 100) String categoryMinor,
            @NotBlank @Size(max = 500) String description,
            @NotNull @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Size(max = 100) String paymentMethod,
            @Size(max = 1000) String memo) {
    }
}
```

- [ ] **Step 4: `TransactionViews.java`**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/** 거래를 화면용 값으로 바꾼다. 소유자 닉네임은 한 번에 조회한다. */
@Component
public class TransactionViews {

    private final UserRepository users;

    public TransactionViews(UserRepository users) {
        this.users = users;
    }

    public List<TransactionView> toViews(List<LedgerTransaction> txs, Predicate<Long> editableOwner) {
        Set<Long> ownerIds = txs.stream().map(LedgerTransaction::getOwnerId).collect(Collectors.toSet());
        Map<Long, String> nicknames = users.findAllById(ownerIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
        return txs.stream()
                .map(tx -> view(tx, nicknames.get(tx.getOwnerId()), editableOwner.test(tx.getOwnerId())))
                .toList();
    }

    public TransactionView toView(LedgerTransaction tx, boolean editable) {
        String nickname = users.findById(tx.getOwnerId()).map(User::getNickname).orElse(null);
        return view(tx, nickname, editable);
    }

    private static TransactionView view(LedgerTransaction tx, String nickname, boolean editable) {
        Category category = tx.displayCategory();
        return new TransactionView(tx.getId(), tx.getOwnerId(), nickname, tx.getOccurredAt(), tx.getType(),
                category.major(), category.minor(), tx.getDescription(), tx.getAmount(), tx.getCurrency(),
                tx.getPaymentMethod(), tx.displayMemo(), tx.isHidden(), tx.getSource(), tx.isEdited(), editable);
    }
}
```

- [ ] **Step 5: `TransactionService.java`**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TransactionService {

    private final LedgerTransactionRepository transactions;
    private final TransactionViews views;
    private final GroupAccess access;

    public TransactionService(LedgerTransactionRepository transactions, TransactionViews views, GroupAccess access) {
        this.transactions = transactions;
        this.views = views;
        this.access = access;
    }

    public record Range(LocalDateTime from, LocalDateTime to) {
    }

    public static Range monthRange(YearMonth month) {
        return new Range(month.atDay(1).atStartOfDay(), month.plusMonths(1).atDay(1).atStartOfDay());
    }

    @Transactional(readOnly = true)
    public List<TransactionView> myTransactions(long userId, YearMonth month) {
        Range range = monthRange(month);
        return views.toViews(transactions.findOwnedBetween(userId, range.from(), range.to()), owner -> true);
    }

    @Transactional(readOnly = true)
    public List<TransactionView> groupTransactions(long groupId, long userId, YearMonth month, Long memberId) {
        access.requireMember(groupId, userId);
        List<Long> owners = access.sharedOwnerIds(groupId);
        if (memberId != null) {
            owners = owners.contains(memberId) ? List.of(memberId) : List.of();
        }
        if (owners.isEmpty()) {
            return List.of();
        }
        Range range = monthRange(month);
        Map<Long, Boolean> editable = new HashMap<>();
        return views.toViews(transactions.findVisibleBetween(owners, range.from(), range.to()),
                owner -> editable.computeIfAbsent(owner, id -> access.canEditOwnedBy(userId, id)));
    }

    @Transactional
    public TransactionView addManual(long userId, ManualTransactionRequest request) {
        TransactionData data = new TransactionData(
                request.occurredAt(),
                request.type(),
                request.categoryMajor().strip(),
                request.categoryMinor() == null ? "" : request.categoryMinor().strip(),
                request.description().strip(),
                request.amount().setScale(2, RoundingMode.HALF_UP),
                "KRW",
                request.paymentMethod() == null ? "" : request.paymentMethod().strip(),
                request.memo() == null || request.memo().isBlank() ? null : request.memo().strip());
        LedgerTransaction tx = transactions.save(LedgerTransaction.manual(userId, data));
        return views.toView(tx, true);
    }
}
```

- [ ] **Step 6: `TransactionController.java`**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.util.List;

@RestController
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping("/me/transactions")
    public List<TransactionView> mine(@CurrentUser Long userId, @RequestParam YearMonth month) {
        return transactionService.myTransactions(userId, month);
    }

    @PostMapping("/me/transactions")
    public ResponseEntity<TransactionView> addManual(@CurrentUser Long userId,
                                                     @Valid @RequestBody ManualTransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(transactionService.addManual(userId, request));
    }

    @GetMapping("/groups/{groupId}/transactions")
    public List<TransactionView> group(@CurrentUser Long userId, @PathVariable long groupId,
                                       @RequestParam YearMonth month,
                                       @RequestParam(required = false) Long memberId) {
        return transactionService.groupTransactions(groupId, userId, month, memberId);
    }
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*TransactionQueryApiTest'`
Expected: 9 tests PASS. `month=2026-13`이 400이 아니면(YearMonth 변환 실패가 다른 예외로 나오면) 어떤 예외가 나왔는지 리포트에 남기고, `GlobalExceptionHandler`에서 400 `VALIDATION_FAILED`로 매핑한다.

- [ ] **Step 8: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/src
git commit -m "feat(api): list my and group transactions and add manual ones"
```

---

### Task 7: 거래 수정·수정 이력·수동 거래 삭제

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/common/ErrorCode.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionDtos.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java`
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionController.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/TransactionUpdateApiTest.java`

**Interfaces:**
- Consumes: `GroupAccess.canViewOwnedBy`/`canEditOwnedBy`(Task 1), `LedgerTransaction` override setter(Task 3), `TransactionAudit`, `TransactionAuditRepository`(Task 3), `TransactionViews`(Task 6), `UserRepository`
- Produces:
  - `ErrorCode.CANNOT_DELETE_IMPORTED` (409)
  - `TransactionDtos.UpdateTransactionRequest(@Size(max=100) String categoryMajor, @Size(max=100) String categoryMinor, @Size(max=1000) String memo, Boolean hidden)`: null은 변경 없음, 공백 문자열은 override 삭제
  - `TransactionDtos.AuditView(long actorId, String actorNickname, String field, String before, String after, OffsetDateTime changedAt)`
  - `TransactionService.update(long actorId, long transactionId, UpdateTransactionRequest)` → `TransactionView`
  - `TransactionService.audits(long viewerId, long transactionId)` → `List<AuditView>`
  - `TransactionService.deleteManual(long actorId, long transactionId)`
  - 수정 이력의 `field` 값: `categoryMajor`, `categoryMinor`, `memo`, `hidden`. before/after는 override 값(`hidden`은 `"true"`/`"false"`)이다.
  - 권한: 볼 수 없으면(본인이 아니고 `canViewOwnedBy`가 false이거나 숨긴 거래) `404`, 볼 수는 있지만 수정할 수 없으면 `403`, 소유자가 아닌데 `hidden`을 보내면 `403`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.importer.ImportBatch;
import com.saladbowl.api.importer.ImportBatchRepository;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import com.saladbowl.api.support.TestLedger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TransactionUpdateApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    AuthedUser admin;
    AuthedUser member;
    long groupId;
    long memberTxId;

    @BeforeEach
    void setUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);
        memberTxId = transactions.save(LedgerTransaction.manual(member.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", "김밥", -4000))).getId();
    }

    private ResultActions patchTx(AuthedUser actor, long txId, String json) throws Exception {
        return mvc.perform(patch("/transactions/" + txId).header("Authorization", actor.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void ownerSetsAndClearsOverrides() throws Exception {
        patchTx(member, memberTxId, """
                {"categoryMajor":"외식","memo":"맛있었음"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryMajor").value("외식"))
                .andExpect(jsonPath("$.memo").value("맛있었음"))
                .andExpect(jsonPath("$.edited").value(true));

        patchTx(member, memberTxId, """
                {"categoryMajor":"  "}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryMajor").value("식비"))
                .andExpect(jsonPath("$.memo").value("맛있었음"));
    }

    @Test
    void ownerHidesTransaction() throws Exception {
        patchTx(member, memberTxId, """
                {"hidden":true}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hidden").value(true));

        mvc.perform(get("/groups/" + groupId + "/transactions").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void adminEditsSharedMemberTransactionAndAuditRecordsTheActor() throws Exception {
        patchTx(admin, memberTxId, """
                {"categoryMajor":"외식"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryMajor").value("외식"));

        mvc.perform(get("/transactions/" + memberTxId + "/audits").header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].actorId").value(admin.id()))
                .andExpect(jsonPath("$[0].actorNickname").value("관리자"))
                .andExpect(jsonPath("$[0].field").value("categoryMajor"))
                .andExpect(jsonPath("$[0].before").doesNotExist())
                .andExpect(jsonPath("$[0].after").value("외식"));
    }

    @Test
    void unchangedValuesAreNotAudited() throws Exception {
        patchTx(member, memberTxId, """
                {"memo":"메모"}
                """).andExpect(status().isOk());
        patchTx(member, memberTxId, """
                {"memo":"메모"}
                """).andExpect(status().isOk());

        mvc.perform(get("/transactions/" + memberTxId + "/audits").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void adminCannotHideSomeoneElsesTransaction() throws Exception {
        patchTx(admin, memberTxId, """
                {"hidden":true}
                """)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void memberCannotEditAdminTransaction() throws Exception {
        long adminTxId = transactions.save(LedgerTransaction.manual(admin.id(),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-03T12:00:00", "식비", "국밥", -9000))).getId();

        patchTx(member, adminTxId, """
                {"memo":"x"}
                """)
                .andExpect(status().isForbidden());
    }

    @Test
    void hiddenTransactionIsInvisibleToAdmin() throws Exception {
        patchTx(member, memberTxId, """
                {"hidden":true}
                """).andExpect(status().isOk());

        patchTx(admin, memberTxId, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
        mvc.perform(get("/transactions/" + memberTxId + "/audits").header("Authorization", admin.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminCannotSeeTransactionsOfMemberWhoTurnedSharingOff() throws Exception {
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        patchTx(admin, memberTxId, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
    }

    @Test
    void outsiderGets404() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        patchTx(outsider, memberTxId, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
        patchTx(outsider, 999_999L, """
                {"memo":"x"}
                """).andExpect(status().isNotFound());
    }

    @Test
    void ownerDeletesManualTransaction() throws Exception {
        mvc.perform(delete("/transactions/" + memberTxId).header("Authorization", member.bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/me/transactions").param("month", "2026-09").header("Authorization", member.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void importedTransactionCannotBeDeleted() throws Exception {
        long importedId = transactions.save(LedgerTransaction.imported(member.id(), importBatchFor(member), "c".repeat(64),
                TestLedger.data(TransactionType.EXPENSE, "2026-09-04T12:00:00", "식비", "라면", -1500))).getId();

        mvc.perform(delete("/transactions/" + importedId).header("Authorization", member.bearer()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANNOT_DELETE_IMPORTED"));
    }

    @Test
    void onlyOwnerCanDelete() throws Exception {
        mvc.perform(delete("/transactions/" + memberTxId).header("Authorization", admin.bearer()))
                .andExpect(status().isForbidden());
    }

    private long importBatchFor(AuthedUser owner) {
        return batches.save(new ImportBatch(owner.id(), "test.xlsx")).getId();
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TransactionUpdateApiTest'`
Expected: PATCH·DELETE·audits 매핑이 없어 FAIL

- [ ] **Step 3: `ErrorCode`에 `CANNOT_DELETE_IMPORTED` 추가**

`CONFLICT` 바로 위에 추가한다.

```java
    CANNOT_DELETE_IMPORTED(HttpStatus.CONFLICT),
```

- [ ] **Step 4: `TransactionDtos`에 DTO 추가**

import에 `java.time.OffsetDateTime`을 추가하고 `ManualTransactionRequest` 아래에 추가한다.

```java
    /** null은 변경 없음, 공백 문자열은 override 삭제. hidden은 소유자만 보낼 수 있다. */
    public record UpdateTransactionRequest(
            @Size(max = 100) String categoryMajor,
            @Size(max = 100) String categoryMinor,
            @Size(max = 1000) String memo,
            Boolean hidden) {
    }

    public record AuditView(long actorId, String actorNickname, String field, String before, String after,
                            OffsetDateTime changedAt) {
    }
```

- [ ] **Step 5: `TransactionService`에 수정·이력·삭제 추가**

생성자에 `TransactionAuditRepository audits`, `UserRepository users`를 추가한다(필드도 추가). import에 `com.saladbowl.api.common.ApiException`, `com.saladbowl.api.common.ErrorCode`, `com.saladbowl.api.transaction.TransactionDtos.AuditView`, `com.saladbowl.api.transaction.TransactionDtos.UpdateTransactionRequest`, `com.saladbowl.api.user.User`, `com.saladbowl.api.user.UserRepository`, `java.util.Objects`, `java.util.Set`, `java.util.function.Consumer`, `java.util.stream.Collectors`를 추가한다. `addManual` 아래에 추가한다.

```java
    @Transactional
    public TransactionView update(long actorId, long transactionId, UpdateTransactionRequest request) {
        LedgerTransaction tx = findVisible(actorId, transactionId);
        boolean owner = tx.getOwnerId() == actorId;
        if (!owner && !access.canEditOwnedBy(actorId, tx.getOwnerId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "cannot edit this transaction");
        }
        if (!owner && request.hidden() != null) {
            throw new ApiException(ErrorCode.FORBIDDEN, "only the owner can hide a transaction");
        }
        applyOverride(tx, actorId, "categoryMajor", tx.getCategoryMajorOverride(), request.categoryMajor(),
                tx::setCategoryMajorOverride);
        applyOverride(tx, actorId, "categoryMinor", tx.getCategoryMinorOverride(), request.categoryMinor(),
                tx::setCategoryMinorOverride);
        applyOverride(tx, actorId, "memo", tx.getMemoOverride(), request.memo(), tx::setMemoOverride);
        if (request.hidden() != null && request.hidden() != tx.isHidden()) {
            audits.save(new TransactionAudit(tx.getId(), actorId, "hidden",
                    Boolean.toString(tx.isHidden()), Boolean.toString(request.hidden())));
            tx.setHidden(request.hidden());
        }
        return views.toView(tx, true);
    }

    @Transactional(readOnly = true)
    public List<AuditView> audits(long viewerId, long transactionId) {
        LedgerTransaction tx = findVisible(viewerId, transactionId);
        List<TransactionAudit> rows = audits.findByTransactionIdOrderByChangedAtAscIdAsc(tx.getId());
        Set<Long> actorIds = rows.stream().map(TransactionAudit::getActorId).collect(Collectors.toSet());
        Map<Long, String> nicknames = users.findAllById(actorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
        return rows.stream()
                .map(a -> new AuditView(a.getActorId(), nicknames.get(a.getActorId()), a.getField(),
                        a.getBeforeValue(), a.getAfterValue(), a.getChangedAt()))
                .toList();
    }

    @Transactional
    public void deleteManual(long actorId, long transactionId) {
        LedgerTransaction tx = findVisible(actorId, transactionId);
        if (tx.getOwnerId() != actorId) {
            throw new ApiException(ErrorCode.FORBIDDEN, "only the owner can delete a transaction");
        }
        if (tx.getSource() != TransactionSource.MANUAL) {
            throw new ApiException(ErrorCode.CANNOT_DELETE_IMPORTED, "imported transactions can only be hidden");
        }
        transactions.delete(tx);
    }

    /** 볼 수 없는 거래는 존재 여부를 숨긴다(404). 숨긴 거래는 소유자만 볼 수 있다. */
    private LedgerTransaction findVisible(long viewerId, long transactionId) {
        LedgerTransaction tx = transactions.findById(transactionId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "transaction not found"));
        boolean owner = tx.getOwnerId() == viewerId;
        if (!owner && (tx.isHidden() || !access.canViewOwnedBy(viewerId, tx.getOwnerId()))) {
            throw new ApiException(ErrorCode.NOT_FOUND, "transaction not found");
        }
        return tx;
    }

    private void applyOverride(LedgerTransaction tx, long actorId, String field, String current, String requested,
                               Consumer<String> setter) {
        if (requested == null) {
            return;
        }
        String next = requested.isBlank() ? null : requested.strip();
        if (Objects.equals(current, next)) {
            return;
        }
        audits.save(new TransactionAudit(tx.getId(), actorId, field, current, next));
        setter.accept(next);
    }
```

`update`가 돌려주는 `editable`은 항상 true다(수정에 성공했으므로).

- [ ] **Step 6: `TransactionController`에 매핑 추가**

import에 `org.springframework.web.bind.annotation.DeleteMapping`, `org.springframework.web.bind.annotation.PatchMapping`, `com.saladbowl.api.transaction.TransactionDtos.AuditView`, `com.saladbowl.api.transaction.TransactionDtos.UpdateTransactionRequest`를 추가하고 `group` 아래에 추가한다.

```java
    @PatchMapping("/transactions/{transactionId}")
    public TransactionView update(@CurrentUser Long userId, @PathVariable long transactionId,
                                  @Valid @RequestBody UpdateTransactionRequest request) {
        return transactionService.update(userId, transactionId, request);
    }

    @DeleteMapping("/transactions/{transactionId}")
    public ResponseEntity<Void> delete(@CurrentUser Long userId, @PathVariable long transactionId) {
        transactionService.deleteManual(userId, transactionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/transactions/{transactionId}/audits")
    public List<AuditView> audits(@CurrentUser Long userId, @PathVariable long transactionId) {
        return transactionService.audits(userId, transactionId);
    }
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*TransactionUpdateApiTest'`
Expected: 12 tests PASS

- [ ] **Step 8: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/src
git commit -m "feat(api): edit transactions with permissions, audit trail and manual delete"
```

---

### Task 8: 그룹 월간 요약

**Files:**
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryDtos.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryService.java`
- Create: `apps/api/src/main/java/com/saladbowl/api/transaction/SummaryController.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/SummaryApiTest.java`

**Interfaces:**
- Consumes: `GroupAccess.requireMember`/`sharedOwnerIds`, `LedgerTransactionRepository.findVisibleBetween`, `TransactionService.monthRange`(Task 6), `LedgerTransaction.displayCategory()`, `UserRepository`
- Produces:
  - `GET /groups/{groupId}/summary?month=YYYY-MM` → `SummaryDtos.MonthlySummary(String month, BigDecimal income, BigDecimal expense, List<CategoryTotal> byCategory, List<MemberTotal> byMember)`
  - `SummaryDtos.CategoryTotal(String category, BigDecimal expense)`: 대분류(화면 값) 기준, 지출 큰 순
  - `SummaryDtos.MemberTotal(long userId, String nickname, BigDecimal income, BigDecimal expense)`: 공개 중인 멤버 전원(거래가 없어도 0), 합류 순
  - 규칙: KRW만, `TRANSFER`와 숨긴 거래 제외, `expense = -(EXPENSE 금액 합)`(환불은 차감), `income = INCOME 금액 합`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import com.saladbowl.api.support.TestLedger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SummaryApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    AuthedUser admin;
    AuthedUser member;
    long groupId;

    @BeforeEach
    void setUp() throws Exception {
        admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        member = TestAuth.signupAndLogin(mvc, "member@test.com", "멤버");
        groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, member, groupId);
    }

    private LedgerTransaction save(AuthedUser owner, TransactionType type, String dateTime, String category,
                                   long amount) {
        return transactions.save(LedgerTransaction.manual(owner.id(),
                TestLedger.data(type, dateTime, category, category + " 거래", amount)));
    }

    @Test
    void summarizesIncomeExpenseByCategoryAndMember() throws Exception {
        save(admin, TransactionType.INCOME, "2026-09-25T09:00:00", "급여", 3_000_000);
        save(admin, TransactionType.EXPENSE, "2026-09-01T12:00:00", "식비", -10_000);
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        save(member, TransactionType.EXPENSE, "2026-09-03T12:00:00", "교통", -5_000);
        save(member, TransactionType.EXPENSE, "2026-09-04T12:00:00", "식비", 3_000);
        save(member, TransactionType.TRANSFER, "2026-09-05T12:00:00", "이체", -500_000);
        save(member, TransactionType.EXPENSE, "2026-10-01T12:00:00", "식비", -99_000);

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-09"))
                .andExpect(jsonPath("$.income").value(3_000_000.0))
                .andExpect(jsonPath("$.expense").value(32_000.0))
                .andExpect(jsonPath("$.byCategory", hasSize(2)))
                .andExpect(jsonPath("$.byCategory[0].category").value("식비"))
                .andExpect(jsonPath("$.byCategory[0].expense").value(27_000.0))
                .andExpect(jsonPath("$.byCategory[1].category").value("교통"))
                .andExpect(jsonPath("$.byCategory[1].expense").value(5_000.0))
                .andExpect(jsonPath("$.byMember", hasSize(2)))
                .andExpect(jsonPath("$.byMember[0].nickname").value("관리자"))
                .andExpect(jsonPath("$.byMember[0].income").value(3_000_000.0))
                .andExpect(jsonPath("$.byMember[0].expense").value(10_000.0))
                .andExpect(jsonPath("$.byMember[1].nickname").value("멤버"))
                .andExpect(jsonPath("$.byMember[1].expense").value(22_000.0));
    }

    @Test
    void overrideCategoryIsUsedAndHiddenIsExcluded() throws Exception {
        LedgerTransaction lunch = save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        lunch.setCategoryMajorOverride("외식");
        transactions.save(lunch);
        LedgerTransaction secret = save(member, TransactionType.EXPENSE, "2026-09-03T12:00:00", "쇼핑", -50_000);
        secret.setHidden(true);
        transactions.save(secret);

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.expense").value(20_000.0))
                .andExpect(jsonPath("$.byCategory", hasSize(1)))
                .andExpect(jsonPath("$.byCategory[0].category").value("외식"));
    }

    @Test
    void nonKrwTransactionsAreExcluded() throws Exception {
        transactions.save(LedgerTransaction.manual(member.id(), new TransactionData(
                java.time.LocalDateTime.parse("2026-09-02T12:00:00"), TransactionType.EXPENSE, "여행", "", "호텔",
                new BigDecimal("-120.00"), "USD", "카드", null)));

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.expense").value(0.0))
                .andExpect(jsonPath("$.byCategory", hasSize(0)));
    }

    @Test
    void membersWhoTurnedSharingOffAreExcluded() throws Exception {
        save(member, TransactionType.EXPENSE, "2026-09-02T12:00:00", "식비", -20_000);
        mvc.perform(put("/groups/" + groupId + "/share").header("Authorization", member.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled":false}
                                """))
                .andExpect(status().isOk());

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.expense").value(0.0))
                .andExpect(jsonPath("$.byMember", hasSize(1)))
                .andExpect(jsonPath("$.byMember[0].nickname").value("관리자"));
    }

    @Test
    void outsiderGets404() throws Exception {
        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "out@test.com", "외부인");

        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "2026-09")
                        .header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*SummaryApiTest'`
Expected: `/summary` 매핑이 없어 FAIL

- [ ] **Step 3: `SummaryDtos.java`**

```java
package com.saladbowl.api.transaction;

import java.math.BigDecimal;
import java.util.List;

public final class SummaryDtos {

    private SummaryDtos() {
    }

    /** month는 yyyy-MM. 금액은 KRW이고 지출은 양수로 표시한다. */
    public record MonthlySummary(String month, BigDecimal income, BigDecimal expense,
                                 List<CategoryTotal> byCategory, List<MemberTotal> byMember) {
    }

    public record CategoryTotal(String category, BigDecimal expense) {
    }

    public record MemberTotal(long userId, String nickname, BigDecimal income, BigDecimal expense) {
    }
}
```

- [ ] **Step 4: `SummaryService.java`**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.transaction.SummaryDtos.CategoryTotal;
import com.saladbowl.api.transaction.SummaryDtos.MemberTotal;
import com.saladbowl.api.transaction.SummaryDtos.MonthlySummary;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 그룹 월간 요약: KRW만, 이체·숨긴 거래 제외, 지출은 양수 합계(환불은 차감). */
@Service
public class SummaryService {

    static final String SUMMARY_CURRENCY = "KRW";

    private final LedgerTransactionRepository transactions;
    private final GroupAccess access;
    private final UserRepository users;

    public SummaryService(LedgerTransactionRepository transactions, GroupAccess access, UserRepository users) {
        this.transactions = transactions;
        this.access = access;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public MonthlySummary monthly(long groupId, long userId, YearMonth month) {
        access.requireMember(groupId, userId);
        List<Long> owners = access.sharedOwnerIds(groupId);
        TransactionService.Range range = TransactionService.monthRange(month);
        List<LedgerTransaction> txs = owners.isEmpty()
                ? List.of()
                : transactions.findVisibleBetween(owners, range.from(), range.to()).stream()
                        .filter(tx -> SUMMARY_CURRENCY.equals(tx.getCurrency()))
                        .filter(tx -> tx.getType() != TransactionType.TRANSFER)
                        .toList();

        BigDecimal income = sum(txs, TransactionType.INCOME);
        BigDecimal expense = sum(txs, TransactionType.EXPENSE).negate();

        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (LedgerTransaction tx : txs) {
            if (tx.getType() == TransactionType.EXPENSE) {
                byCategory.merge(tx.displayCategory().major(), tx.getAmount().negate(), BigDecimal::add);
            }
        }
        List<CategoryTotal> categories = byCategory.entrySet().stream()
                .map(e -> new CategoryTotal(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(CategoryTotal::expense).reversed()
                        .thenComparing(CategoryTotal::category))
                .toList();

        Map<Long, String> nicknames = users.findAllById(owners).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
        List<MemberTotal> members = owners.stream()
                .map(ownerId -> {
                    List<LedgerTransaction> own = txs.stream().filter(t -> t.getOwnerId().equals(ownerId)).toList();
                    return new MemberTotal(ownerId, nicknames.get(ownerId),
                            sum(own, TransactionType.INCOME), sum(own, TransactionType.EXPENSE).negate());
                })
                .toList();

        return new MonthlySummary(month.toString(), income, expense, categories, members);
    }

    private static BigDecimal sum(List<LedgerTransaction> txs, TransactionType type) {
        return txs.stream()
                .filter(tx -> tx.getType() == type)
                .map(LedgerTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
```

- [ ] **Step 5: `SummaryController.java`**

```java
package com.saladbowl.api.transaction;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.transaction.SummaryDtos.MonthlySummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;

@RestController
public class SummaryController {

    private final SummaryService summaryService;

    public SummaryController(SummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping("/groups/{groupId}/summary")
    public MonthlySummary monthly(@CurrentUser Long userId, @PathVariable long groupId,
                                  @RequestParam YearMonth month) {
        return summaryService.monthly(groupId, userId, month);
    }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd apps/api && ./gradlew test --tests '*SummaryApiTest'`
Expected: 5 tests PASS. `expense`가 `0`일 때 JSON이 `0` 또는 `0.0`으로 나와도 `jsonPath(...).value(0.0)` 비교가 실패하면, 비교를 `org.hamcrest.Matchers.closeTo`나 숫자 비교로 바꾸고 리포트에 남긴다.

- [ ] **Step 7: 전체 테스트 실행 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS

```bash
git add apps/api/src
git commit -m "feat(api): add monthly group summary"
```
