# 대시보드 대분류별 추이(꺾은선) 설계

- 작성일: 2026-10-27
- 상태: 승인됨 (2026-10-27, 사용자가 A안·"기간 버튼 + 직접 지정"·"상위 5개 + 선택"을 고름)
- 관련 문서:
  - [ECharts 도넛 설계](2026-10-27-echarts-donut-design.md) (공용 래퍼 `common/EChart`)
  - [Plan 10 후속](../plans/2026-10-27-plan-10-followups.md) ("다음 과제: 꺾은선 차트")

## 1. 목표

대분류별 지출을 월 단위 꺾은선으로 보여준다. x축은 월이고, 전월이나 사용자가 고른 기간과 비교한다. 그룹 대시보드에 카드 하나로 더한다.

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 데이터 | 새 API `GET /groups/{groupId}/summary/trend?from=YYYY-MM&to=YYYY-MM` 한 번으로 받는다(A안) |
| 기간 | 기준 월은 대시보드 상단에서 고른 달이다. 버튼은 "전월 비교"(2개월), "3개월", "6개월"(기본), "12개월", "직접 지정". 직접 지정은 시작·끝 월을 고르고, 최대 12개월이다 |
| 대분류 | 처음에는 기간 합계 상위 5개를 켠다. 칩으로 켜고 끈다. 기간이 바뀌어도 고른 것을 유지하고, 그룹이 바뀌면 상위 5개로 되돌린다 |
| 차트 | ECharts `LineChart` + `GridComponent`를 `common/echarts.ts`에 더하고, `common/EChart` 래퍼를 쓴다 |
| 접근성 | 차트는 `aria-hidden`이다. "표로 보기"(접기)에 월 × 켜진 대분류 표를 둔다. 칩은 `aria-pressed` 버튼이고 높이 44px 이상이다 |
| 범위 밖 | 비교군을 도넛에 반영하기, 대분류별 고정 색, 수입 추이 |

## 3. API

`GET /api/groups/{groupId}/summary/trend?from=2026-05&to=2026-10`

```json
{
  "months": ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
  "categories": [
    { "category": "식비", "expenses": [310000, 280000, 0, 300000, 295000, 320000], "total": 1505000 }
  ]
}
```

- **규칙**: 요약과 같은 선별을 쓴다. 공개를 켠 멤버, 숨김·이체 제외, KRW만, 빈 대분류는 "미분류"(`SummaryService.summaryTransactions`·`majorLabel` 재사용).
  - 지출은 양수이고 환불은 차감한다.
  - 각 월 값은 그 달 `/summary`의 `byCategory[].expense`와 같아야 한다.
- **쿼리**: 기간 전체를 `findVisibleBetween(owners, from 시작, to 끝)` 한 번으로 읽는다. 월 경계는 `TransactionService.monthRange`와 같다.
- **응답 모양**
  - `months`: `from`부터 `to`까지 빠짐없이 넣는다.
  - `expenses`: `months`와 같은 길이다. 거래가 없는 달은 0이다.
  - `categories`: 기간 중 지출 거래가 한 건이라도 있는 대분류만 넣는다. `total` 내림차순, 같으면 이름순이다.
  - 기간 합계가 0 이하인 대분류(환불이 더 큰 경우)도 응답에는 넣는다. 그리지 않는 것은 웹이 정한다(6장).
- **검증**
  - `from > to`이거나 기간이 12개월을 넘으면 400 `VALIDATION_FAILED`다.
  - `from`·`to`가 없거나 형식이 틀려도 400이다.
  - 그룹 멤버가 아니면 지금 `/summary`와 같은 상태 코드다(404).

## 4. 웹 구성

| 파일 | 책임 |
|---|---|
| `common/echarts.ts` | `LineChart`, `GridComponent` 등록을 더한다 |
| `common/LineChart.tsx` (+ test) | `buildLineOption(series, months, { theme, compact })` 순수 함수와 `EChart`를 쓰는 컴포넌트. 대시보드 전용 문구는 넣지 않는다 |
| `dashboard/dashboardApi.ts` | `trend(groupId, from, to)`와 `CategoryTrend` 타입 |
| `dashboard/CategoryTrend.tsx` (+ test, css) | 카드: 기간 선택, 대분류 칩, `LineChart`, 표로 보기, 상태(불러오는 중·실패·빈 결과) |
| `dashboard/trendRange.ts` (+ test) | 기간 계산 순수 함수: 버튼 → `{from, to}`, 월 더하기·빼기, 12개월 검사 |
| `dashboard/DashboardPage.tsx` | 도넛·멤버 카드 아래에 `<CategoryTrend groupId month />`를 둔다 |

## 5. 기간 선택

- `SegmentedControl`(label "기간") 항목: `prev`(전월 비교), `3`, `6`, `12`, `custom`(직접 지정). 기본은 `6`이다.
- 버튼을 고르면 `to`는 대시보드 월, `from`은 `to - (n-1)`개월이다. `prev`는 n=2다.
- `custom`
  - 처음에는 직전 버튼의 범위로 시작한다.
  - `MonthPicker` 두 개("시작", "끝")를 둔다. 접근 이름은 각각 "시작 월", "끝 월"이다. 지금 `MonthPicker`가 이 접근 이름을 받지 못하면 `label` prop을 더한다.
  - 시작이 끝보다 늦거나 12개월을 넘으면 요청하지 않는다. "기간은 최대 12개월이고, 시작 월이 끝 월보다 늦을 수 없습니다."를 `role="alert"`로 보인다.
- 대시보드 월이 바뀌면 버튼 기간은 새 월에 맞춰 다시 계산한다. `custom`은 그대로 둔다.
- 쿼리 키는 `['summary', groupId, 'trend', from, to]`다. `summary`로 시작해야 추방·공개 전환 때 무효화되고, 404가 그룹 이탈로 처리된다.

## 6. 대분류 칩과 차트

- 칩은 응답의 `categories` 순서(기간 합계 내림차순)로 늘어놓는다. 기간 합계가 0 이하인 대분류는 칩도 선도 만들지 않는다.
- **선택 상태**: `selected: string[] | null`. `null`이면 "상위 5개"다.
  - 칩을 처음 누르면 `null`을 지금 보이는 상위 5개로 바꾼 뒤 토글한다.
  - 고른 대분류가 새 기간에 없으면 칩만 사라진다. 다시 나타나면 선택 상태로 복원한다.
  - 하나도 켜지 않으면 차트 자리에 "대분류를 하나 이상 고르세요."를 보인다.
- **색**: 칩 순서(기간 합계 순위)의 `index % 8` 슬롯으로 `--chart-n`을 쓴다. 9번째 이후는 선 모양으로 구분한다: 9~16번째는 점선(`lineStyle.type: 'dashed'`), 17번째부터는 짧은 점선(`'dotted'`). 칩 표지도 같은 모양이다.
- **`buildLineOption`**
  - `xAxis`: 범주형이다. 라벨은 "5월"이고, 1월이거나 첫 월이면서 기간이 해를 넘으면 "2026.1"이다.
  - `yAxis`: 값형이다. 라벨은 "30만"(만 원 단위, 1만 미만은 원 그대로)이고, 분할선은 `--line`이다.
  - `series`: 켜진 대분류마다 `type: 'line'`, `symbol: 'circle'`, `symbolSize` 6, `lineStyle.width` 2, `emphasis.focus: 'series'`.
  - `tooltip`: `trigger: 'axis'`. 내용은 "2026년 10월", 그 아래 켜진 대분류를 값 큰 순서로 한 줄씩(색 점, 이름, `formatWon`)이다. 이름은 HTML 이스케이프한다.
  - `grid`: 넓은 화면 `left: 48, right: 16, top: 16, bottom: 32`, 좁은 화면은 더 좁게 한다.
  - 높이: 넓은 화면 300px, 좁은 화면 240px.
  - 글자는 `textStyle.fontFamily`와 토큰 색(`ink`, `inkMuted`)을 쓴다.
- 칩·기간이 바뀌면 `setOption(notMerge)`로 전환 애니메이션이 돈다. 동작 줄이기 설정이면 래퍼가 끈다.

## 7. 표로 보기

- `<details>`의 `<summary>`는 "표로 보기"다. 안에 `<table>`을 둔다.
  - 행: 월
  - 열: 켜진 대분류
  - 셀: `formatWon`
  - 캡션: "대분류별 월 지출"
- RAC를 쓰지 않는 단순 표로 충분하다. 넓으면 가로 스크롤 영역(`overflow-x: auto`) 안에 둔다. 페이지에는 가로 스크롤이 생기지 않아야 한다.

## 8. 상태

- 불러오는 중: "불러오는 중입니다."
- 실패: `role="alert"` "추이를 불러오지 못했습니다." + "다시 시도"
- `categories`가 비었으면: "이 기간에 지출이 없습니다."

## 9. 검증

- **API**: `./gradlew test`. 아래를 테스트한다.
  - 각 월 값 = 그 달 `/summary` 대분류 지출(환불·override·미분류 포함)
  - 거래 없는 달은 0
  - 제외 규칙(이체·숨김·외화·공개 끈 멤버)
  - 정렬(합계 내림차순)
  - 400(역순, 13개월, 형식 오류)
  - 404(외부인)
- **웹**: typecheck·test·lint·build. 아래를 테스트한다.
  - `buildLineOption`: 축 라벨, 연도 표기, 시리즈 수, 9번째 점선, 툴팁 이스케이프·정렬
  - `trendRange`: 버튼별 범위, 해 넘김, 12개월 검사
  - `CategoryTrend`
    - 기본 6개월 요청(MSW가 받은 `from`/`to`), 칩 토글, 상위 5개 기본
    - 직접 지정 범위 오류 문구, 표로 보기 내용, 빈 결과·실패
  - `DashboardPage`: 카드가 보인다
- **브라우저**: Playwright(시스템 Chrome)로 본다.
  - 1200·375px, 라이트·다크
  - 툴팁, 칩 토글 전환, 직접 지정
  - 가로 스크롤 0, 콘솔 경고 0
- **번들**: 홈 첫 진입 JS gzip은 그대로여야 한다. 대시보드 청크 증가분을 `docs/ui-library-poc.md`에 적는다.
