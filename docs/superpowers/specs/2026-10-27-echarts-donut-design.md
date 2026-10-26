# 대시보드 도넛을 ECharts로 교체 설계

- 작성일: 2026-10-27
- 상태: 승인됨 (2026-10-27, 사용자가 A안·"모든 조각에 라벨"을 선택)
- 관련 문서:
  - [차트 라이브러리 재검토](../../chart-library-research.md) (ECharts 1순위, 사용자가 ECharts로 결정)
  - [대시보드 도넛 설계](2026-10-25-dashboard-category-donut-design.md) (3장 "직접 SVG" 결정을 이 문서가 번복한다)
  - [Plan 09 후속](../plans/2026-10-25-plan-09-followups.md)

## 1. 목표

`common/DonutChart`의 직접 SVG 구현을 ECharts로 바꾼다. 해결할 문제는 세 가지다.
- 바깥 라벨이 겹치는 문제
- 지시선이 서로 교차하는 문제
- 좁은 폭에서 라벨이 잘리는 문제

화면 구성은 그대로 둔다: 도넛, 대분류·금액·비율 목록, 거래 모달, 접근성 구조. 앞으로 넣을 꺾은선·비교군 선택이 같은 래퍼를 쓰도록 래퍼를 공용으로 만든다.

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 라이브러리 | ECharts `6.1.0`(정확한 버전 고정). `echarts-for-react`는 쓰지 않는다. |
| 구현 방식 | A안: `common/echarts.ts`(모듈 등록) + `common/EChart.tsx`(공용 래퍼) + `common/DonutChart.tsx`(옵션 생성 + 래퍼 사용). |
| import | `echarts/core`와 필요한 모듈만: `PieChart`, `TooltipComponent`, `GraphicComponent`, `LabelLayout`, `SVGRenderer`. 꺾은선은 그때 등록에 한 줄 더한다. |
| 작은 조각 라벨 | **모두 표시.** 겹침 피하기를 켜고, 넓이가 모자라면 이름을 `…`로 줄인다. 비율은 둘째 줄에 둬서 잘리지 않게 한다. |
| 접근성 | 지금 구조를 유지한다. 목록 행 `button`이 키보드·스크린리더 컨트롤이고, 차트 컨테이너는 `aria-hidden="true"`다. ECharts `aria` 모듈은 쓰지 않는다. |
| 범위 밖 | 꺾은선 차트, 비교군 선택, 범례. 래퍼만 이를 받을 수 있게 만든다. |

## 3. 구성

| 파일 | 책임 |
|---|---|
| `common/echarts.ts` | `echarts/core`에 모듈을 등록하고 `echarts`를 다시 내보낸다. 다른 파일은 `echarts`를 직접 import하지 않는다. |
| `common/chartTheme.ts` | `readChartTheme(): ChartTheme`. CSS 토큰에서 색을 읽는다: `--chart-1`~`8`, `--surface-000`, `--ink`, `--ink-muted`, `--line`, `--font-sans`. `useChartTheme()`은 라이트·다크가 바뀌면 다시 읽는다. 바뀌는 경우는 `prefers-color-scheme` 변경과 `<html data-theme>` 변경이다. |
| `common/EChart.tsx` | 공용 래퍼. 아래 표 참고. |
| `common/DonutChart.tsx` | 도넛 옵션을 만드는 순수 함수와, 이를 래퍼에 넘기는 컴포넌트. 아래 표 참고. Plan 09의 직접 배치 코드는 모두 지운다: `GEOMETRY`, `layoutLabels`, 호 계산, `<pattern>`. |
| `dashboard/CategoryBreakdown.tsx` | props는 그대로다. 높이·레이아웃 CSS만 맞춘다. |

**`EChart.tsx`가 하는 일**
- props: `option`, `onEvents`(이벤트 이름 → 핸들러), `height`, `className`
- `ref`로 ECharts 인스턴스를 내보낸다.
- 생성: `echarts.init(el, null, { renderer: 'svg' })`
- 크기 변경: `ResizeObserver`로 `resize()`
- 옵션 반영: `setOption(option, { notMerge: true })`
- 정리: 언마운트 때 `dispose()`
- 애니메이션: `prefers-reduced-motion: reduce`이면 끈다(`animation: false`).
- 컨테이너는 `aria-hidden="true"`다.

**`DonutChart.tsx`가 내보내는 것**
- `buildDonutOption(slices, { centerLabel, centerValue, compact, theme })`: 순수 함수
- `sliceStyle`: 목록 색 표지가 쓴다. 지금 규칙 그대로다.
- `donutHeight(count, compact)`: 순수 함수. 차트 높이를 계산한다.
- 기본 컴포넌트: `EChart`에 옵션을 넘긴다. props는 지금과 같다: `slices`, `centerLabel`, `centerValue`, `activeId`, `onActiveChange`, `onSelect`, `compact`, `className`.

## 4. 모양

- **반지름**: 넓은 화면은 안쪽 34%·바깥 52%, 좁은 화면은 30%·46%다. 라벨 자리를 남기려는 것이다. 정확한 값은 브라우저 확인에서 다듬는다.
- **라벨**: rich text 두 줄이다.
  - 1줄: 이름. 넓은 화면 13px, 좁은 화면 12px, `--ink`
  - 2줄: 비율. 11px, `--ink-muted`
  - 비율 문자열은 `DonutSlice.detail`을 그대로 쓴다(예: "14%", "1% 미만").
  - 이름은 `overflow: 'truncate'`로 줄인다. 폭은 넓은 화면 84px, 좁은 화면 56px 안팎이다.
- **배치**: `avoidLabelOverlap: true`, `label.alignTo: 'labelLine'`, `bleedMargin` 4, `labelLine.length`·`length2` 짧게, `maxSurfaceAngle` 80.
- **높이**: 라벨이 한쪽에 몰려도 겹치지 않을 만큼 `donutHeight`가 높이를 정한다. 조각이 적으면 기본 높이를 쓴다(넓은 화면 280px, 좁은 화면 240px). 조각 수에 따라 늘리되 상한을 둔다. 공식은 브라우저 확인으로 정하고 테스트로 고정한다.
- **가운데 문구**: `graphic` 텍스트 두 줄이다. "총지출"은 `--ink-muted`, "₩ N"은 `--ink` 굵게. 좁은 화면에서는 안쪽 지름에 맞게 글자를 줄인다.
- **색**:
  - 조각은 `theme.chart[slot-1]`이다.
  - 조각 테두리는 `--surface-000` 2px다(조각 사이 간격).
  - 9번째 조각부터는 `itemStyle.decal`로 빗금을 넣는다. 선 색은 `--surface-000`, 방향은 `sliceStyle`의 `diag45`·`diag135`와 같다. 목록 색 표지와 같은 방향이다.
- **강조(emphasis)**: `scale: true`, `scaleSize: 6`, `focus: 'self'`. 강조된 조각의 라벨은 굵게 한다.
- **툴팁**: `trigger: 'item'`. 내용은 "이름", "₩ 금액 · 비율"이다. 금액은 `formatWon`과 같은 형식을 쓴다. 툴팁은 컨테이너 안에 그린다(`appendTo` 기본값). 그래서 스크린리더에도 숨겨진다.

## 5. 동작

| 사용자 동작 | 결과 |
|---|---|
| 조각 클릭 | `onSelect(id)` → 지금처럼 거래 모달이 열린다 |
| 조각에 마우스 올림·내림 | `mouseover` → `onActiveChange(id)`, `mouseout` → `onActiveChange(null)` |
| 목록 행에 마우스·초점 | 행이 `activeId`를 바꾼다. `DonutChart`가 이를 `dispatchAction`의 `highlight`/`downplay`로 바꿔 해당 조각을 강조한다. 바뀔 때 이전 조각은 `downplay`한다 |
| 월·그룹 변경 | 지금처럼 `key`로 다시 마운트한다. 데이터만 바뀌면 ECharts 전환 애니메이션이 돈다 |
| 지출 있는 대분류 없음 | 지금처럼 차트 없이 "지출이 없습니다." |

id는 ECharts 데이터 항목의 `name`으로 넘긴다. 대분류 이름이 곧 id다.

## 6. 테스트

- jsdom에서는 ECharts가 크기를 잴 수 없어 그리기가 불완전하다(예상). 그래서 테스트를 나눈다.
  - **`buildDonutOption` 단위 테스트**:
    - 조각 수와 데이터 이름·값
    - rich 라벨 두 줄(이름, `detail`)
    - 9·17번째 조각의 decal 방향
    - 토큰 색 적용
    - compact에서 라벨 폭·반지름이 작아지는지
    - 조각 1개
  - **`donutHeight`**: 기본값, 조각 수에 따라 늘어남, 상한
  - **`EChart`**: `echarts/core`의 `init`을 가짜 인스턴스로 바꿔 아래를 확인한다.
    - `setOption`·`resize`·`dispose` 호출
    - 이벤트 연결
    - `prefers-reduced-motion`에서 애니메이션을 끄는지
    - `aria-hidden`
  - **`DonutChart`**: 같은 가짜 인스턴스로 아래를 확인한다.
    - `click` → `onSelect`
    - `mouseover`/`mouseout` → `onActiveChange`
    - `activeId` 변경 → `highlight`·`downplay` 호출
  - **`useChartTheme`**: `data-theme` 속성 변경 때 다시 읽는지
  - **기존 테스트 유지**: `CategoryBreakdown`·`DashboardPage`의 목록 행 접근 이름, "지출이 없습니다.", 모달 열기
- **브라우저(필수)**: Playwright(`playwright-core` + 시스템 Chrome, 저장소 밖 스크립트)로 실제 렌더링 좌표를 잰다.
  - 폭: 1200·375·320px
  - 데이터: 꼬리형(60·10·5·4·3·3·2·2·2·2·1·1), 밀집형(30·20·10·8·6·5·4·4·3·3·3·2), 고르게 12개, 3개, 1개
  - 모드: 라이트·다크
  - 잴 것: 글자끼리 겹침, 선이 다른 글자를 지나는지, 선끼리 교차, 카드 밖으로 잘림, 가로 스크롤
  - 기준: **겹침·교차·잘림·가로 스크롤이 모두 0**. 비율이 `…`에 묻히지 않을 것. 실제 라벨 글자 최소 11px.
  - 그 밖에 조각 호버 강조, 목록 행 호버 → 조각 강조, 클릭 → 모달을 확인한다.

## 7. 번들

- 대시보드 청크에만 들어가야 한다. 홈 첫 진입 JS의 gzip 합계는 바뀌지 않아야 한다(지금 값은 빌드에서 다시 잰다).
- 대시보드 청크 증가분은 gzip 약 +185 kB로 예상한다(조사 문서 3.2).
- 결과는 `docs/ui-library-poc.md`에 한 줄 기록한다.
- 라이선스: ECharts는 Apache-2.0이다. Vite `build.license`가 만드는 고지 파일에 포함되는지 확인한다.

## 8. 기존 결정과 달라지는 점

- [도넛 설계](2026-10-25-dashboard-category-donut-design.md) 3장 "직접 SVG, 새 의존성 없음"을 번복한다. 그 문서 3장에 이 문서로 가는 각주를 단다.
- 같은 문서 6.4(접근성)와 6.5(모달)는 그대로 유지한다.
