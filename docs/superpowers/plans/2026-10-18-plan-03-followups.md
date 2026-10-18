# Plan 03 후속 과제

Plan 03(뱅크샐러드 import·거래 API)의 Task별 리뷰와 최종 리뷰에서 나왔지만 이후 계획으로 넘긴 항목이다. [plan-01-followups.md](2026-10-18-plan-01-followups.md), [plan-02-followups.md](2026-10-18-plan-02-followups.md)와 함께 본다.

## 배포 차단 (Plan 05 전에 반드시)

**엑셀 파싱 메모리**
- `WorkbookFactory.create`(XSSF)는 파일 전체를 메모리에 올린다.
- 최종 리뷰 실험 결과:
  - 4.9MB(10만 행) 파일에 heap 약 840MB가 필요했다.
  - heap 384MB 이하에서는 `OutOfMemoryError`가 났다.
  - 대략 행당 8.5KB, xlsx 1MB당 170MB꼴이다.
- Render 무료 인스턴스(512MB)에서 5MB 한도는 버티지 못한다. 로그인한 회원 누구나 정상 파일로 인스턴스를 불안정하게 만들 수 있다.
- 해결:
  - `가계부 내역` 시트만 스트리밍으로 읽는다(`XSSFReader` + `XSSFSheetXMLHandler`). 그러면 `뱅샐현황` 시트를 아예 파싱하지 않는다는 Javadoc 설명도 사실이 된다.
  - 그 전까지는 업로드 한도를 약 1MB로 낮춘다.
- 실제 export는 1개월 168행, 21KB 수준이라 지금 쓰는 데는 문제가 없다.

## Plan 04 (웹앱)
- **화면이 알아야 할 API 규칙**
  - `TransactionView.amount`는 부호가 있다(지출은 음수). 요약의 `expense`는 양수다.
  - `occurredAt`에는 시간대가 없다(한국 시간 로컬 값). `month`는 입력과 출력 모두 `yyyy-MM`이다.
  - 그룹 화면의 `editable`은 보고 있는 그룹과 무관하다. 다른 그룹의 ADMIN이면 true일 수 있다.
  - 숨김은 `ownerId == 나`일 때만 가능하다. 삭제는 거기에 더해 `source == MANUAL`이어야 한다.
- **수동 거래 부호 규칙**: 지금은 지출을 양수로 넣어도 받아들인다. 수동 추가 UI를 만들기 전에 타입에 맞춰 부호를 정규화할지, 거부할지 정한다.
- **숨김 이력 노출**: 숨겼다가 해제한 거래는 `hidden` 수정 이력이 ADMIN에게 보인다. 이력 공개 범위를 제품 차원에서 정한다.
- **업로드 파일 이름**: 클라이언트가 보낸 경로까지 그대로 저장한다(예: `C:\...\a.xlsx`). 마지막 경로 조각만 저장하고, 255자로 자를 때 서로게이트 쌍이 갈리지 않게 한다.
- **계정 삭제 기능을 만들 때**: 수정 이력의 `actor_id`가 ON DELETE CASCADE라서 이력이 함께 지워진다. SET NULL로 바꿀지 정한다.

## Plan 05 (배포·운영)
- **동시 수정 덮어쓰기**: `LedgerTransaction`에 `@Version`(낙관적 락)이 없다.
  - 동시 PATCH는 나중에 커밋한 쪽이 이긴다.
  - import 중에 사용자가 메모를 고치면 사용자의 override가 사라질 수 있다.
  - 수정 이력 체인도 어긋난다.
- **import 처리 방식**
  - IDENTITY id라 JDBC batch insert가 되지 않는다.
  - 파싱이 DB 트랜잭션 안에서 돌아서 커넥션을 오래 잡는다.
  - 같은 회원이 동시에 import하면 409 `CONFLICT`가 난다(깨끗하게 롤백된다).
  - 스트리밍 파서로 바꿀 때 함께 정리한다.
- **`DataIntegrityViolationException` 매핑**(Plan 02 후속에서 넘어옴): unique 위반(SQLState 23505)만 409로 보내고 나머지는 500으로 보낸다. Plan 03에서 컬럼 초과는 파서 검증으로 막았다.
- **예외 원인 보존**: `ApiException`에 cause를 남긴다(파서의 IOException 등).

## 나중에 (사소함)
- **파서 견고성**
  - 1904 날짜 체계 파일은 거부한다(`isDate1904()`).
  - 헤더 비교에서 NBSP를 허용한다. `text()`는 중복 키와 묶여 있으니 건드리지 않는다.
  - 수식 셀에 대해 "empty" 대신 정확한 메시지를 낸다.
  - 메시지가 null인 예외가 `row N: null`로 나간다.
- **테스트 보강**
  - **Plan 02에서 넘어온 항목**: rename 저장값, 초대 만료 경계, `ALREADY_MEMBER`와 `GROUP_FULL`의 우선순위, 비멤버 DELETE 404, cascade·check 제약
  - **이번 계획에서 나온 항목**: `memberId` 필터가 비공개 멤버를 가리킬 때, 월 경계(말일 23:59:59 / 다음 달 1일 00:00:00), 수동 거래 정규화, 일반 MEMBER가 숨긴 거래를 찔렀을 때 404, 숨김·삭제 이력 값, 삭제 시 이력 cascade, 실패한 PATCH의 롤백, 빈 owner·거래 0건 멤버의 요약, 화폐 길이 초과, JSON으로 `/imports` POST 시 415, 중간 실패 롤백, 1000개 키 경계
- `@Size`가 strip 전에 검사돼서 앞뒤 공백 때문에 거부될 수 있다(과잉 거부만 일어나서 무해하다).
