# 3순위 다듬기 설계 (빠른 수정·디자인 토큰·화면·로딩 모션)

- 작성일: 2026-10-27
- 상태: 범위 승인됨 (2026-10-27, 사용자가 A·B·C·D 모두 고름). 세부 결정은 이 문서로 승인받는다.
- 근거
  - Plan 04b·10·11·13 followups의 "나중에"·"화면 다듬기" 항목
  - 인증 보강(PR #27) 병합 전에 디자인·작은 요소만 처리한다는 사용자 방침
- 바꾸는 곳: 웹(`apps/web`)만

## A. 빠른 수정

1. **빌드 경고**
   - `vite.config.ts`의 `rolldownOptions.output.advancedChunks`를 `codeSplitting`으로 바꾼다. 그룹(zrender, echarts)과 조건은 그대로 둔다.
   - 완료 기준: `npm run build`에 deprecated 경고가 없고, `zrender-*.js`·`echarts-*.js` 청크가 그대로 따로 나온다.
2. **MonthPicker 버튼 이름**
   - `label`이 기본값 `'월'`이 아니면 버튼 이름을 `` `${label} 이전 달` ``·`` `${label} 다음 달` ``로 한다. 예: "시작 월 이전 달".
   - 기본값일 때는 지금처럼 "이전 달"·"다음 달"이다.
   - 직접 지정 화면에서 버튼 세 쌍을 스크린리더로 구분할 수 있게 하려는 것이다.
3. **연도 이동 버튼**
   - `HomePage`의 `‹` `›` 글자를 `Icon`의 `chevron-left`·`chevron-right`(size 18)로 바꾼다. MonthPicker와 같은 모양이다.
   - 접근 이름은 그대로 둔다.
4. **모바일 대시보드의 RAC 경고**
   - 모바일 폭 대시보드에서 콘솔에 RAC "Dialog 제목" 경고가 난다.
   - 원인 컴포넌트를 찾아 제목(`Heading slot="title"`)이나 `aria-label`을 준다.
   - 완료 기준: 해당 화면 테스트에서 `console.warn`이 불리지 않는다.

## B. 디자인 토큰

1. **간격 토큰**
   - `tokens.css`에 `--space-1: 4px`를 더한다.
   - CSS Modules의 px 리터럴 간격(gap, padding, margin)을 아래처럼 바꾼다.

| 지금 | 바꿀 값 |
|---|---|
| 4px | `var(--space-1)` |
| 6px | `var(--space-2)` |
| 10px | `var(--space-2)` |
| 14px | `var(--space-3)` |
| 2px | 그대로 둔다(테두리급 미세 간격) |
| `0px` (안전 영역 계산 등) | 그대로 둔다 |

2. **글자 크기 토큰**
   - `tokens.css`에 단계 7개를 더하고, `font-size` 리터럴을 모두 토큰으로 바꾼다. `line-height`는 그대로 둔다.
   - `base.css`의 body(15)·h1(28)·h2(18)도 토큰을 쓴다.

| 토큰 | 값 | 지금 값에서 옮기는 것 |
|---|---|---|
| `--text-xs` | 12px | 12 |
| `--text-sm` | 13px | 13, 14 |
| `--text-base` | 15px | 15 |
| `--text-md` | 18px | 18 |
| `--text-lg` | 20px | 20 |
| `--text-xl` | 24px | 22, 24 |
| `--text-2xl` | 28px | 26, 28 |

   - 14→13, 22→24, 26→28은 눈에 띄지 않을 정도로 바뀐다(추정). 바뀌기 전후 스크린샷으로 확인한다.

3. **비활성 버튼**
   - `opacity: 0.6`만으로는 활성 버튼과 거의 같아 보인다.
   - 일반 버튼(`ui.button`, `UploadForm .clear`) 비활성
     - `background: var(--surface-100)`
     - `color: var(--ink-muted)`
     - `border-color: var(--line)`
     - `opacity: 1`
     - `cursor: not-allowed`
   - 브랜드 버튼(`ui.primary`, `LoginPage .submit`) 비활성: 브랜드 색을 빼고 `background: var(--line); color: var(--ink-muted)`
   - 위 값은 밝은·어두운 테마 모두 토큰으로 정해진다.

## C. 화면 다듬기

1. **홈 달력 칸 줄바꿈**
   - 미등록 칸의 "미등록 · 업로드하기"를 `미등록`과 `· 업로드하기` 두 조각(span)으로 나눈다.
   - 칸 폭이 120px 이하이면 container query로 뒤 조각을 숨긴다(`.cell { container-type: inline-size }`).
   - 버튼 접근 이름(`aria-label`)은 지금처럼 전체 문장이다.
2. **도넛 위아래 빈 공간**
   - `donutHeight`의 기본값을 줄인다. 좁은 화면은 220→200, 넓은 화면은 260→240이다. 조각 수에 따라 늘어나는 규칙과 상한은 그대로다.
   - Playwright로 조각 3·6·10개를 넣어 라벨이 잘리거나 겹치지 않는지 확인한다. 잘리면 원래 값으로 돌리고 기록한다.

## D. 로딩 모션 사소한 지적 (Plan 13 후속)

1. **덮개 위치**
   - `SlowServerOverlay`를 `RequireAuth`·`PublicOnly`·`AppLayout` 세 곳에서 빼고, `App`의 `ToastRegion` 옆에 한 번만 둔다.
   - `active`는 `slow && status !== 'loading'`이다. 시작 화면에서는 여전히 겹치지 않는다.
   - 화면이 바뀌어도(느린 로그인 성공 → 이동) 덮개가 언마운트되지 않으므로, 완료 모션을 보여 주고 닫힌다.
2. **닫히는 중 다시 켜질 때**
   - `SaladBowlLoader`에서 `done`이 꺼졌는데 완료 중 담은 재료(`extra`)가 남아 있으면, 렌더 중에 `stage`를 지금 담긴 단계로 올리고 `extra`를 0으로 한다.
   - 볼은 그대로이고, 멘트가 볼과 맞게 된다.
3. **스크린리더 첫 멘트**
   - 덮개 `Dialog`에 `aria-describedby`로 로더의 status 영역을 잇는다.
   - 로더는 `statusId?: string` prop을 받아 status 영역의 `id`로 쓴다.
4. **빠진 테스트**
   - 닫히는 중 다시 켜지는 경로(덮개가 계속 열려 있고, 멘트가 볼 단계와 맞음)
   - `PublicOnly` loading(로더 멘트가 보이고 대화상자가 없음)
   - 앱 전역 덮개가 auth loading 중에는 열리지 않음

## 검증

- `apps/web`에서 `npm run typecheck && npm test && npm run lint && npm run build`
- Playwright(시스템 Chrome), 임시 미리보기(커밋하지 않음)
  - B 전후 스크린샷: 홈, 대시보드, 업로드, 로그인. 데스크톱·모바일, 밝은·어두운 테마
  - C 확인: 달력 좁은 폭, 도넛 조각 3·6·10개

## 범위 밖

- 1순위 데이터 안전 작업(인증 보강 병합 뒤)
- 아이콘 세트 확장, 새 화면
- 차트 테스트 보강(Plan 10·11의 테스트 관련 "나중에" 항목)
