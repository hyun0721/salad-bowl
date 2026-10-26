# 차트 라이브러리 재검토

- 작성일: 2026-10-26
- 계기: [Plan 09 후속](superpowers/plans/2026-10-25-plan-09-followups.md)의 "다음 과제". 도넛 조각 라벨을 직접 SVG로 배치하는 일이 커졌다. 앞으로 꺾은선 차트 등도 더할 계획이다.
- 이전 비교: [도넛 설계 3장](superpowers/specs/2026-10-25-dashboard-category-donut-design.md). 도넛 하나만 놓고 비교해 직접 SVG를 골랐다. 이번에는 라벨 품질과 앞으로 올 차트까지 놓고 다시 본다.

## 1. 결론

**1순위 ECharts, 2순위 AG Charts Community.** Recharts는 빼는 것을 권한다. 이번에 부딪힌 라벨 겹침 문제를 그대로 안고 있다.

| | ECharts 6.1 | AG Charts 14.2 Community | Recharts 3.10 |
|---|---|---|---|
| 바깥 라벨 겹침 처리 | 겹침 피하기가 기본으로 켜져 있다. 모든 라벨을 남기고, 넘치면 이름을 `…`로 줄인다 | 원 둘레에 자연스럽게 놓고, 자리가 없으면 그 라벨을 숨긴다 | 없다. 라벨이 겹친다 |
| 툴팁·범례 | 강함. 꺾은선용 축 툴팁, 범례 스크롤·페이지 | 강함. 범례 키보드 조작. 십자선은 유료 | 강함. React 컴포넌트로 직접 꾸밀 수 있다 |
| 호버 효과 | 조각 확대 + 나머지 흐림 | 나머지 흐림 | 툴팁만(강조는 직접) |
| 비교군 바꿀 때 | 부드럽게 전환(약 0.6초) | 즉시 바뀜(애니메이션은 유료) | 매번 처음부터 다시 그림 |
| 키보드·스크린리더 | 데이터 항목 키보드 이동이 없다(추측: 공식 안내에 없음). 자동 설명(aria)과 무늬(decal)가 있다 | 항목·범례를 키보드로 이동하고 낭독한다. Community에 포함된다 | 3.0부터 키보드 탐색이 기본이다 |
| 차트 2종 gzip 증가 | +185 kB | +376 kB | +105 kB |
| 라이선스 | Apache-2.0 | MIT | MIT |

- **ECharts를 1순위로 보는 이유**
  - 이번에 직접 만들던 기능이 옵션으로 있다: 바깥 라벨 겹침 피하기, 지시선 정렬, 작은 조각 라벨 숨기기, 8색을 넘는 무늬(decal).
  - 꺾은선의 축 툴팁과 범례 스크롤도 기본으로 있다.
  - 키보드 접근은 지금 구조로 보완한다. 목록 행이 접근 가능한 컨트롤이고 차트는 `aria-hidden`이다. 이 구조를 그대로 쓸 수 있다.
- **AG Charts를 2순위로 두는 이유**
  - 라벨 배치가 가장 보기 좋았다. 사용자가 원한 "원 둘레에 자연스럽게"에 가장 가깝다.
  - 키보드·스크린리더도 기본으로 된다.
  - 하지만 번들이 ECharts의 두 배다(gzip +376 kB).
  - 애니메이션·확대(zoom)·십자선(crosshair)은 유료(Enterprise)다.
- 어느 쪽이든 대시보드처럼 지연 로딩되는 청크에만 들어가야 한다. 홈 첫 진입 JS(gzip 183.61 kB)는 그대로여야 한다.

## 2. 이번에 부딪힌 문제 → 평가 기준

| # | Plan 09에서 겪은 문제 | 평가 기준 |
|---|---|---|
| 1 | 작은 조각이 몰리면 바깥 라벨끼리 겹치고, 지시선이 서로 교차하거나 다른 라벨을 지난다 | 바깥 라벨 겹침 피하기가 기본 기능인가. 지시선 모양·정렬 옵션이 있는가 |
| 2 | 겹침을 없애면 라벨이 퍼져 지시선이 최장 119~209px로 길어졌다 | 라벨이 조각 가까이에 남는가. 자리가 없을 때 숨기거나 줄이는 전략이 있는가 |
| 3 | 375·320px에서 차트가 카드보다 넓어져 가로 스크롤이 생기거나, 축소돼 글자가 9px대로 작아졌다 | 컨테이너 크기를 따라가는가. 라벨 줄임·줄바꿈·최소 글자 크기 옵션이 있는가 |
| 4 | 스크린리더 중복을 피하려고 차트는 숨기고 목록 행을 컨트롤로 두었다 | 키보드·스크린리더 지원 수준. 없더라도 지금 구조로 보완할 수 있는가 |
| 5 | 8색을 넘는 대분류는 빗금 무늬를 직접 그렸다 | 무늬(패턴) 내장 여부 |
| 6 | 라이트·다크 토큰(`--chart-1`~`8`)을 써야 한다 | 색을 CSS 변수나 테마로 바꿀 수 있는가 |
| 7 | 조각 클릭 → 모달, 행 호버 ↔ 조각 강조 | 클릭·강조 이벤트와 외부에서 강조 상태를 제어하는 API |
| 8 | 번들(지연 청크) | 도넛+꺾은선+툴팁+범례 기준 gzip 증가분 |
| + | 앞으로 꺾은선 등을 더한다(사용자 우선순위: 툴팁·범례 가독성) | 꺾은선의 축 툴팁, 범례 가독성·조작, 같은 API로 여러 차트 |

## 3. 실측

### 3.1 라벨 배치 (같은 데이터, 375px, 기본값에 가까운 설정)

임시 프로젝트(저장소 밖)에서 각 라이브러리로 같은 데이터를 그려 브라우저에서 눈으로 봤다. 데이터는 Plan 09 측정에 쓴 것과 같다.
- 꼬리형: 큰 조각 63% + 작은 조각 11개
- 고르게 12개: 14% ~ 3%

| | 꼬리형 | 고르게 12개 |
|---|---|---|
| ECharts | 12개 라벨을 모두 왼쪽에 세로로 쌓는다. 지시선 교차·겹침은 없다. 기본 설정은 양끝 라벨이 카드 밖에서 잘렸다. `alignTo: 'labelLine'`과 `bleedMargin`을 주자 잘림이 사라지고, 긴 이름은 `…`로 줄었다 | 12개를 모두 표시한다. 겹침은 없다. 오른쪽 긴 이름은 비율까지 `…`에 묻힌다(예: "교통/차…"). 두 줄 rich text로 고칠 수 있다(추측) |
| AG Charts | 들어가는 라벨만 원 둘레에 놓고 나머지는 숨긴다(이 데이터에서 교통/차량·주거·경조사·미용·여행 숨김). 남은 라벨은 겹치지 않는다 | 원 둘레에 자연스럽게 놓고 10개를 표시한다(교통/차량·카페/간식 숨김). 이름과 비율이 잘리지 않는다 |
| Recharts | 라벨이 서로 겹치고 카드 밖에서 잘린다. Plan 09 방사형 배치의 문제와 같다 | 확인하지 않았다(꼬리형에서 이미 탈락) |

- 숨겨진 라벨은 툴팁과 아래 목록으로 볼 수 있다. Plan 09처럼 "모든 조각에 라벨"을 지키려면 ECharts, "보기 좋게 일부만"이면 AG Charts가 맞다.
- 1200px과 320px, 라이트·다크, 실제 토큰 색으로는 아직 보지 않았다. 고르고 난 뒤 POC에서 Plan 09의 겹침 검사(실제 좌표로 선 교차·겹침·잘림·글자 크기·지시선 길이)로 잰다.

### 3.2 번들 (gzip -9, 도넛 + 꺾은선 + 툴팁 + 범례)

Vite 8, React 19.2 기준이다. 각 라이브러리의 권장 import 방식(가능하면 필요한 모듈만)으로 도넛 하나와 꺾은선 하나를 그렸다. React+ReactDOM만 넣은 기준(67.4 kB) 대비 증가분이다. 설계 3장(도넛 하나, 57.4 kB 기준)과 측정 조건이 달라 수치를 바로 비교하지는 않는다.

| 라이브러리 (버전) | import 방식 | 증가분 |
|---|---|---|
| Chart.js 4.6.1 + react-chartjs-2 5.3.1 | 필요한 요소만 `register` | +59.5 kB |
| Recharts 3.10.1 | 이름 있는 import | +104.5 kB |
| Highcharts 13.1.1 + 접근성 모듈 + React 래퍼 | 코어 전체 | +141.9 kB |
| MUI X Charts 9.16.0 (+ MUI·emotion) | `PieChart`, `LineChart` | +142.1 kB |
| ECharts 6.1.0 | `echarts/core` + Pie·Line·Tooltip·Legend·Aria·LabelLayout·SVG 렌더러 | +184.8 kB |
| AG Charts Community 14.2.0 | Donut·Line·Legend·축 모듈만 등록 | +376.1 kB |

- 지금 대시보드 청크는 gzip 3.76 kB, 가장 큰 청크는 약 104 kB다. ECharts를 넣으면 대시보드 청크가 앱에서 가장 큰 청크가 된다. 대시보드를 처음 열 때 받는 양이 늘어난다(예상: 느린 4G에서 1초 안팎).

### 3.3 마우스오버와 비교군 바꾸기 (420px, headless Chrome)

Playwright(`playwright-core` + 시스템 Chrome, 저장소 밖 임시 프로젝트)로 같은 페이지를 띄워 봤다.
- 구성: 대분류 6개 도넛과 6개월 꺾은선을 두었다. 버튼으로 비교군을 "전체 6개 → 상위 3개 → 식비·카페/간식 2개 → 전체" 순으로 바꿨다.
- 각 전환 뒤 0·80·160·260·400·600·1000ms에 화면을 찍어, 서로 다른 프레임이 몇 장인지 셌다.
- 내장 브라우저는 패널이 숨겨지면 애니메이션 프레임이 돌지 않는다(초당 0프레임). 그래서 이 측정은 headless Chrome으로 했다.

| | 도넛 조각 호버 | 꺾은선 호버 | 비교군 바꿀 때 도넛 | 비교군 바꿀 때 꺾은선 |
|---|---|---|---|---|
| ECharts | 조각이 커지고(`emphasis.scale`), `focus: 'self'`면 나머지 조각·라벨이 흐려진다. 툴팁 표시 | 축 툴팁: 그 달의 모든 대분류 값을 한 상자에 보여준다. 세로 점선 표시 | 애니메이션 있음(전환당 5~7프레임, 약 0.6초). 남는 조각은 각도가 이어서 바뀐다. 사라지는 조각은 흐려지고, 새 조각은 자라난다. 2개로 줄 때 중간 프레임에서 고리가 잠깐 끊겨 보인다 | 새 선이 왼쪽부터 그려지고, 빠진 선은 사라진다. 범례도 함께 바뀐다 |
| AG Charts Community | 나머지 조각과 라벨이 흐려진다(기본값). 툴팁 표시. 조각이 커지지는 않는다 | 기본은 한 점 툴팁이다. 그 선만 진하고 나머지는 흐려진다. 십자선은 Enterprise | **애니메이션 없음**(1프레임, 즉시 바뀜). 애니메이션은 Enterprise 모듈이다 | 즉시 바뀐다. 420px에서는 범례가 한 줄에 3개만 들어가 1/3 페이지로 넘긴다 |
| Recharts | 툴팁만 뜬다. 조각 강조는 직접 만들어야 한다(`shape`의 `isActive`). 기본 라벨은 이름이 아니라 값이다 | 축 툴팁: 모든 값을 한 상자에 보여준다. 세로선 표시 | 애니메이션 있음. 다만 바뀔 때마다 도넛을 처음부터 다시 그린다. 1초가 지나도 아직 그리는 중이다(기본 1.5초) | 선이 다시 그려진다. 범례는 줄바꿈된다 |

- **비교군을 고르는 방식**: ECharts와 AG Charts는 범례를 눌러 계열을 끄고 켜는 기능이 기본으로 있다. Recharts는 범례 클릭을 직접 처리해야 한다. 서비스의 "특정 대분류만 비교"를 목록 체크박스로 만들면 셋 다 데이터만 바꿔 넣으면 된다.
- **제품 쪽에서 정할 것**: 도넛에서 일부 대분류만 고르면 비율이 "고른 것끼리의 비율"로 다시 계산된다. 전체 대비 비율을 보여줄지(나머지는 "그 밖" 회색 조각), 고른 것끼리 비율을 보여줄지 정해야 한다.
- **ECharts의 2개 전환 중 끊김**: 애니메이션 종류(`animationTypeUpdate`)나 길이를 바꿔 보거나, 비교군을 바꿀 때는 `'expansion'`을 써서 다시 펼치는 편이 나을 수 있다(추측, POC에서 확인).

## 4. 후보별 정리

| 후보 | 바깥 라벨·겹침 (기준 1~3) | 접근성 (4) | 무늬 (5) | 툴팁·범례·꺾은선 (+) | 라이선스·유지 |
|---|---|---|---|---|---|
| **ECharts** | `avoidLabelOverlap` 기본 켜짐. `label.alignTo`(`none`·`labelLine`·`edge`), `edgeDistance`, `bleedMargin`, `labelLine.length`/`length2`/`maxSurfaceAngle`, `minShowLabelAngle`, `labelLayout`(hideOverlap 등) | 자동 설명은 `aria`(기본 꺼짐). 데이터 항목 키보드 이동은 공식 안내에 없다 | `aria.decal` 내장 | 축 툴팁(`trigger: 'axis'`), 범례 스크롤. 꺾은선·막대 등 종류가 많다 | Apache-2.0, 6.1.0(2026-05) |
| **AG Charts Community** | `calloutLabel.avoidCollisions`(라벨을 옮기거나 반지름을 줄임), `minAngle`, 라벨 맞춤(`truncate`·`wrapping`·`minimumFontSize`) | 화살표로 항목 이동, Enter/Space 클릭, 범례 Tab·화살표, 낭독. Community에 포함 | 확인 못 함 | 툴팁 `renderer`, 범례 페이지. 애니메이션·확대·십자선은 Enterprise | MIT, 14.2.0(2026-09). Enterprise $499/개발자 |
| **Highcharts** | 바깥 라벨에 연결선(`connectorShape`: `fixedOffset`·`straight`·`crookedLine`), `alignTo`(`connectors`·`plotEdges`) | 접근성 모듈이 모든 라이선스에 포함. 키보드 탐색, ARIA, 설명 | 무늬 모듈(별도 페이지, 확인 못 함) | 툴팁·범례 품질이 높다(추측: 이번에는 화면으로 보지 않음) | **상용.** 공개 웹은 SaaS 라이선스(Core $366/개발자~). 비상업 용도는 별도 약관이고 조건은 확인하지 못했다 |
| Recharts | `label`·`labelLine`만 있다. 겹침 피하기 없음(공식 문서에 없음, 실측에서 겹침) | 3.0부터 `accessibilityLayer` 기본, 화살표 탐색 | 없음(직접 `<pattern>`) | React 컴포넌트라 툴팁·범례를 직접 꾸미기 쉽다. CSS 변수 색을 그대로 쓴다(shadcn 차트가 이 방식) | MIT, 3.10.1(2026-10) |
| MUI X Charts | 조각 안 라벨(`arcLabel`, `arcLabelMinAngle`, `arcLabelRadius`)만 있다. 바깥 라벨·지시선은 문서에 없다 | 키보드 탐색 기본, 낭독(개발 중이라고 표시) | 문서에 없다 | 툴팁·범례 있음 | MIT. 이 앱은 MUI를 쓰지 않아 MUI·emotion이 함께 들어온다 |
| Chart.js | canvas라 바깥 라벨은 플러그인이 필요하다(외부 플러그인의 유지 상태는 확인 못 함) | canvas라 대체 콘텐츠를 직접 달아야 한다 | 없음 | 툴팁·범례 있음 | MIT. 가장 작다(+59.5 kB) |
| Nivo, amCharts 5 | Nivo: 바깥 링크 라벨이 겹친다는 이슈가 있다(`skipAngle`로 숨기는 정도). amCharts: 라벨 열 정렬 | — | — | — | Nivo 0.99.0(2025-05) 이후 릴리스 없음. amCharts는 유료 또는 로고 표시 |

## 5. 다음 단계 (제안)

1. 사용자가 ECharts와 AG Charts 중에서 고른다. 기준은 두 가지다. "모든 조각에 라벨"과 "보기 좋게 일부만" 중 어느 쪽인지, 번들 +185 kB와 +376 kB 중 어느 쪽을 받아들일지.
2. 고른 라이브러리로 POC를 만든다. `common/` 안에 래퍼를 두어 React Aria 규칙과 같게 한다.
   - 실제 토큰 색과 라이트·다크 전환(ECharts는 테마를 다시 적용해야 한다, 추측)
   - 1200·375·320px
   - Plan 09 겹침 검사(Playwright MCP로 자동화)
   - 조각 클릭 → 모달, 행 호버 ↔ 조각 강조(`dispatchAction` 또는 해당 API)
   - 꺾은선 하나의 툴팁·범례
   - 비교군 바꾸기 전환(특히 2개로 줄 때 끊김)과 "고른 것끼리 비율 vs 전체 대비 비율" 결정
3. 결과가 좋으면 설계 문서를 새로 쓰고(도넛 설계 3장 결정 번복), `DonutChart`를 바꾼다. 목록 행이 접근 가능한 컨트롤인 구조는 유지한다.

## 출처
- ECharts 파이 옵션: [echarts-doc pie.md](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/series/pie.md), 접근성: [ECharts Handbook: Aria](https://echarts.apache.org/handbook/en/best-practices/aria/)
- AG Charts: [Donut Series](https://www.ag-grid.com/charts/react/donut-series/), [Accessibility](https://www.ag-grid.com/charts/react/accessibility/), [License & Pricing](https://www.ag-grid.com/charts/license-pricing/)
- Highcharts: [Pie dataLabels alignment](https://www.highcharts.com/docs/advanced-chart-features/pie-datalabels-alignment), [Accessibility module](https://www.highcharts.com/docs/accessibility/accessibility-module), [Shop](https://shop.highcharts.com/), [License](https://shop.highcharts.com/license)
- Recharts: [Pie API](https://recharts.github.io/en-US/api/Pie/), [3.0.0 릴리스](https://newreleases.io/project/npm/recharts/release/3.0.0)
- MUI X Charts: [Pie](https://mui.com/x/react-charts/pie/), [Accessibility](https://mui.com/x/react-charts/accessibility/)
- Nivo 라벨 겹침 이슈: [lightrun 정리](https://lightrun.com/answers/plouc-nivo-pie-chart-radial-labels-overlap)
- amCharts: [Licenses explained](https://www.amcharts.com/online-store/licenses-explained/)
- AG Charts 하이라이트·애니메이션: [Series Highlighting](https://www.ag-grid.com/charts/react/series-highlighting/), [Animation(Enterprise)](https://www.ag-grid.com/charts/react/animation/)
- ECharts 이벤트·액션: [Handbook: Event](https://echarts.apache.org/handbook/en/concepts/event/)
- 버전·peer 의존성: `npm view` (2026-10-26)
