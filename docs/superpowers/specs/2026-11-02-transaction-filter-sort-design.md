# 거래 목록 필터·정렬 부품 설계

## 목표

거래 목록과 대시보드 분포 팝업에서 쓰는 재사용 가능한 필터·정렬 버튼을 만든다.
모바일(375px) 우선이며, 적용 상태는 별도 텍스트 공간 없이 버튼 모양으로 표시한다.

## 결정 사항

- 필터·정렬은 서버 쿼리 파라미터로 처리한다.
- 필터는 항목별 다중 선택, 모달 안에서 임시 선택 후 '적용'으로 반영한다.
- 필터·정렬 모달에는 각각 '초기화'와 '적용' 버튼이 있다. 초기화는 임시 선택을
  기본값(필터 없음 / 최신순)으로 되돌리며, 적용을 눌러야 반영된다.
- 적용 상태 표시: 아이콘 교체 + 서식(옅은 주 색상 배경·테두리·주 색상 아이콘).

## API

대상 엔드포인트:

- `GET /me/transactions`
- `GET /groups/{groupId}/transactions`
- `GET /groups/{groupId}/summary/transactions` (정렬만)

추가 파라미터:

| 이름 | 형식 | 의미 |
|---|---|---|
| `major` | 반복 가능 문자열 | 대분류 중 하나와 일치 |
| `minor` | 반복 가능 문자열 | 소분류 중 하나와 일치 (summary 엔드포인트의 기존 단일 `minor`는 그대로 둔다) |
| `type` | 반복 가능 `TransactionType` | 거래 타입 중 하나와 일치 |
| `sort` | `date_desc`(기본) · `date_asc` · `amount_desc` · `amount_asc` | 정렬 |

- 같은 항목 안은 OR, 항목 사이는 AND.
- 빈 소분류(미분류)는 빈 문자열 값으로 선택한다.
- 금액 정렬은 절댓값 기준이고, 같은 값이면 날짜 내림차순·id 내림차순으로 고정한다.
- 허용하지 않은 `sort`·`type` 값은 400(기존 `GlobalExceptionHandler` 경로).
- 기존 공개 범위·소유권 판단 쿼리는 바꾸지 않는다. 필터는 그 결과 범위 안에서만 좁힌다.
  월 단위 결과를 서비스에서 거르는 방식과 쿼리 조건 추가 중 계획 단계에서 현재
  `TransactionService` 구조에 맞는 쪽을 고른다.

## 웹 공용 부품 (`src/common/`)

### `FilterButton`

```ts
type FilterGroup = { key: string; label: string; options: { value: string; label: string }[] }
type FilterValue = Record<string, string[]>
props: { groups: FilterGroup[]; value: FilterValue; onApply(next: FilterValue): void }
```

- 아이콘 버튼. 기본은 `funnel` 외곽선, 하나라도 선택되면 채운 깔때기(`funnel-filled`) + 적용 서식.
- 누르면 `ResponsiveOverlay`(모바일 하단 시트). 그룹별 체크박스 목록, 하단에 초기화·적용.
- 그룹 의존(소분류가 고른 대분류로 좁혀짐)은 부품이 모른다. 호출 쪽이 임시 선택을
  받아 `groups`를 다시 계산할 수 있도록 `onDraftChange?(draft)`를 둔다.
- `aria-label`: "필터" / "필터, N개 적용됨". `aria-pressed`는 쓰지 않는다(누르면 열리는 버튼).

### `SortButton`

```ts
props: { options: { value: string; label: string; direction: 'asc' | 'desc' }[];
         value: string; defaultValue: string; onApply(next: string): void }
```

- 기본값이면 `arrow-up-down`, 아니면 방향에 따라 `arrow-down-wide-narrow` /
  `arrow-up-narrow-wide` + 적용 서식.
- 모달은 react-aria `RadioGroup`, 하단에 초기화(defaultValue로)·적용.
- `aria-label`: "정렬, {선택 라벨}".

### 아이콘

`Icon.tsx`에 Lucide 1.61.0 경로로 `funnel`, `arrow-up-down`, `arrow-down-wide-narrow`,
`arrow-up-narrow-wide`를 추가하고, `funnel` 경로에 `fill="currentColor"`를 준
`funnel-filled`를 도메인 아이콘으로 추가한다.

### 적용 서식

기존 디자인 토큰의 주 색상·옅은 주 색상 배경을 쓴다. 색만으로 상태를 전달하지 않도록
아이콘 모양 변화와 함께 쓴다.

## 화면 적용

- **거래목록**: 필터 줄에 두 버튼. 필터 그룹은 대분류·소분류(`/me/categories`)·타입.
  필터·정렬 값을 `transactionsApi`에 넘기고 쿼리 키에 포함한다. 기존 검색어 필터는 유지한다.
- **분포 팝업** (`CategoryTransactionsDialog`): 분류가 이미 고정이므로 `SortButton`만 둔다.
  합계는 정렬과 무관하다.

## 테스트

- API: 필터 조합(OR/AND), 미분류 선택, 각 정렬과 동률 처리, 잘못된 값 400,
  그룹 공개 범위 밖 거래가 필터로 드러나지 않음.
- 웹: 부품 단위로 열기·임시 선택·초기화·적용·닫으면 임시 선택 폐기, 적용 상태 아이콘과
  `aria-label`. 화면 단위로 쿼리 파라미터 전달.

## PR 구성

1. API 파라미터 추가.
2. 공용 부품 + 아이콘 + 거래목록·분포 팝업 적용 (375px 이전·이후 캡처 포함).

## 범위 밖

URL에 필터 상태 저장, 필터 프리셋 저장, 분포 팝업의 필터.
