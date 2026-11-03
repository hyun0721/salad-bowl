# 재사용 가능한 테스트 데이터

실제 개인정보 없이 로컬 기능 점검·버그 재현에 쓰는 합성 데이터다. `scripts/test_data.py`는 Python 3.10 이상 표준 라이브러리만 사용한다. 애플리케이션 코드·스키마·운영 데이터는 변경하지 않는다.

## 검증 스택 시드와의 차이

[검증 스택 시드](development.md#검증-스택과-시드)(`.claude/skills/verify/bin/seed.sh`)는 화면 확인용이다. 계정 4개, 그룹 1개에 대분류 45개 × 소분류 24개를 넣어 차트와 목록의 모양을 고정된 값으로 비교한다. 이 문서의 스크립트는 API 동작을 점검하는 시나리오 데이터다. 권한, 그룹 상태, 업로드 실패·재업로드, 경계값을 재현하는 데 쓴다. 둘은 서로 대체하지 않는다.

## 실행

파일만 생성하려면 저장소 루트에서 실행한다. 기본 기준 월은 실행한 날짜의 현재 월이며, 고정된 버그 재현에는 `--month`를 지정한다.

```bash
python3 scripts/test_data.py --month 2026-10
```

`tmp/test-data/`에 49개 `.xlsx`와 `manifest.json`이 생긴다. 기준 월을 포함한 최근 12개월을 만들며, 업로드 가능한 파일은 모두 월별·512KB 미만이다. 의도적으로 잘못 만든 파일은 별도 이름으로 구분한다. 날짜·시간·금액은 문자열 셀로 저장한다. 실제 export의 숫자 날짜/시간 셀은 기존 Java `BanksaladWorkbook` 테스트가 담당한다.

로컬 DB와 API를 [로컬 개발](development.md#실행)대로 실행한 다음 새 출력 폴더와 접두어로 등록한다.

```bash
python3 scripts/test_data.py --seed --month 2026-10 --prefix qa-oct --out tmp/qa-oct
```

직접 API 주소의 기본값은 `http://localhost:8080`이다. 다른 포트는 `--base-url http://localhost:18080`, Vite 프록시를 거치려면 `--base-url http://localhost:5173/api`를 사용한다. 로컬 HTTP 주소만 허용하며 프록시 환경변수와 HTTP 리다이렉트를 사용하지 않는다.

등록은 가입·초대·업로드·수정 API를 거친다. 결과를 다시 조회해 재업로드 건수, 수정값·숨김 보존, 관리자 수정 이력, 공유 범위, 정원·차단, 월간 합계, 잘못된 파일의 롤백을 검증한다. `PASS`와 `등록 완료`가 모두 출력되고 manifest의 `seedComplete`가 `true`여야 준비가 끝난 것이다.

같은 접두어의 계정이 있으면 등록 전에 중단한다. 출력 폴더가 비어 있지 않아도 중단하므로 기존 파일·manifest를 덮어쓰지 않는다. 실패할 경우 이미 성공한 API 요청은 남는다. manifest에 기록된 계정을 확인하고, 새 접두어와 새 폴더로 다시 실행한다. 데이터 삭제·DB 초기화 기능은 제공하지 않는다. 개발 DB 전체 초기화는 기존 로컬 데이터도 지우므로 필요할 때 별도로 판단한다.

## 계정과 그룹

모든 계정의 비밀번호는 `SaladTest123!`이다. 아래 `<prefix>`는 기본값 `qa` 또는 지정한 접두어다. 이메일 도메인 `example.test`는 가짜이며 외부 메시지는 보내지 않는다.

| 계정 (`<prefix>.<역할>@example.test`) | 준비 상태와 용도 |
|---|---|
| `admin` | shared/full 관리자, overlap 일반 멤버. 일반 거래·수동 거래·다른 멤버 수정 이력 |
| `member` | shared 일반 멤버, overlap 관리자. 업로드 누락·수정·숨김·재업로드 검증 |
| `private` | shared에서 공개 OFF, full에서 ON. 개인 거래는 있고 그룹별 공개 범위가 다름 |
| `banned` | shared에서 추방·차단. 개인 거래는 남고 재가입은 거부됨 |
| `empty` | empty 그룹 관리자. 거래·업로드 이력이 없는 첫 사용자 상태 |
| `outsider` | 그룹에 속하지 않음. 초대 미리보기·정원 초과·비회원 접근 확인 |
| `extra1`~`extra3` | full 그룹 정원 6명을 채우는 멤버. 거래 없음 |

| 그룹 | 최종 상태 |
|---|---|
| shared | admin/member 거래만 표시. private는 공개 OFF, banned는 추방됨 |
| overlap | member가 관리자. admin은 공개 OFF이므로 member 거래만 표시 |
| empty | 관리자 1명, 거래 없음 |
| full | 관리자 포함 6명. outsider가 초대 수락하면 `GROUP_FULL` |

manifest에는 계정, 그룹 ID, 초대 토큰, 수정·숨김·수동 거래 ID가 기록된다. 접근 토큰은 저장하지 않는다. 웹에서 해당 계정으로 로그인하고 기준 월을 선택한다. 초대 화면은 manifest의 토큰으로 `/invite/<token>`에 접근한다. 초대는 생성 후 7일간 유효하다.

## 기능별 데이터 지도

화면 확인 절차는 [검증 기능 지도](../.claude/skills/verify/features/README.md)가 따로 관리한다. 이 표는 API 동작과 권한, 상태를 기준으로 [기능 설계](superpowers/specs/2026-10-18-salad-bowl-design.md), [화면 설계](superpowers/specs/2026-10-19-web-screen-design.md)와 현재 Controller/Service 및 테스트에서 작성했다. 오래된 설계의 업로드 제한보다 현재 구현인 512KB·92일 제한을 따른다.

| 기능 | 준비한 데이터 / 확인할 동작 |
|---|---|
| 가입·로그인·새 사용자 | 9계정, empty/outsider의 그룹·거래 빈 상태. 잘못된 비밀번호·로그아웃·새로고침은 화면에서 확인 |
| 그룹 관리·권한 | 관리자/일반 멤버/비회원/차단 사용자, 1명·3명·6명 그룹. full에서 추방·차단 해제·재가입 연습 가능 |
| 그룹별 공개 | private는 shared OFF/full ON. admin은 shared ON/overlap OFF. 공개 토글 전후 개인 거래 보존 확인 |
| 초대 | shared/overlap/empty/full의 유효 토큰. 이미 가입·차단·정원 초과 상태. 만료/동시 수락은 기존 Invite/ConcurrentAccept 테스트 담당 |
| 개인 거래·필터·긴 목록 | 사용자마다 월별 29행, 8종 생활 소분류, 긴 내용·여러 줄 메모·특수문자·소분류 빈 값. 날짜 경계 1일 00:00:00/말일 23:59:59 |
| 수동 추가·삭제 | admin 기준 월의 `수동입력 삭제 연습`. import 거래 삭제 거부와 구분 |
| 수정·이력·숨김 | member의 2일 거래를 admin이 분류·메모 수정. 3일 지출은 member가 숨김. 재업로드 후 override/hidden 유지 |
| 업로드·coverage | admin/private/banned 11개월, member 9개월. 전체가 비는 월은 기준 월 -4개월, member는 추가로 -9/-8개월 누락 |
| 중복·원본 갱신 | 같은 시각·금액·내용의 결제 2행 보존. 기준 월 파일 재업로드는 29행 unchanged. `member-reimport.xlsx`는 최초 적용 시 신규 1/갱신 1/동일 28 |
| 월간 합계 | 수입·음수 지출·양수 환불·0원·이체·USD 소수금액. 그룹에서는 공유 OFF/차단/숨김 제외, 합계에서는 이체·외화 제외 |
| 소분류 추이 | 12개월의 월별 변동·빈 월·멤버 누락·사용자 수정 분류. 최근 6개월 차트와 빈 월 0 처리 확인 |
| 업로드 실패·원자성 | invalid-header/sheet/last-row, not-an-excel, period-too-long. 거부 후 거래와 업로드 이력이 바뀌지 않아야 함 |

`member-reimport.xlsx`는 seed 과정에서 이미 적용한다. 준비 완료 후 다시 올리면 30행 전부 unchanged가 맞다. 새 원본 갱신을 재현하려면 empty 계정에 `member-<기준월>.xlsx` → `member-reimport.xlsx` 순서로 올린다. 파일에서 빠진 거래를 유지하는 동작은 이후 `empty.xlsx`를 업로드해 확인한다. 파일만 생성할 때는 모든 파일이 미적용 상태다.

기본 등록은 약 1,220행을 만든다. 생성된 상태를 수동으로 변경하면 위 기대값도 달라진다. 자동화에서 공유 DB를 재사용하기보다 별도 로컬 DB 또는 실행별 접두어를 사용한다. 현재 스크립트는 만료된 초대나 동시 요청을 SQL로 조작하지 않는다.

## 기존 도우미와 검증

| 위치 | 용도 |
|---|---|
| `apps/api/src/test/.../support/BanksaladWorkbook.java` | 숫자 날짜·시간, 잘못된 헤더/시트 등 API 테스트용 엑셀 builder |
| `apps/api/src/test/.../support/LargeBanksaladWorkbook.java` | 업로드 상한 근처 대용량 합성 엑셀 |
| `apps/api/src/test/.../support/TestAuth.java`, `TestGroups.java`, `TestLedger.java` | API 테스트 내부 계정·그룹·거래 도우미 |
| `scripts/smoke.sh` | 배포 health·프록시·인증 오류 점검. 데이터 등록은 하지 않음 |

```bash
# DB 없이 생성·경계값·XML·로컬 주소 제한 검사
python3 -m unittest discover -s scripts -v

# 기존 대용량 테스트 데이터 생성 (JDK 21 필요)
cd apps/api
./gradlew largeWorkbook -Pout=/tmp/salad-large.xlsx
# 기존 회귀 테스트 (Docker 필요)
./gradlew test memoryTest
```

새 기능을 구현하거나 버그를 고치면 이 지도의 해당 행과 생성 데이터를 함께 갱신한다. 구체적인 버그 회귀 검증은 기존 Java/Vitest 테스트에도 남긴다. 이 데이터 세트는 화면 점검 준비와 넓은 동작 확인을 돕고 세부 단위·통합 테스트를 대체하지 않는다.
