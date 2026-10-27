# Plan 14 후속

## 브라우저 확인 (Playwright + 시스템 Chrome, 가짜 API로 실제 App을 띄운 임시 미리보기)
- 디자인 토큰 전후: 홈·대시보드·업로드·로그인, 데스크톱·모바일, 밝은·어두운 테마. 글자 1~2px 차이 외에는 같고, 비활성 "업로드" 버튼이 회색으로 분명해졌다.
- 도넛 조각 3·6·10개(데스크톱·모바일): 라벨 잘림·겹침 없음.
- 모바일 홈 달력: 미등록 칸은 "미등록"만 보인다.
- 모바일 대시보드의 RAC "Dialog 제목" 경고: 원인은 `ResponsiveOverlay` 모바일 분기(`Select`·`DateTimePicker`)였다. 보이는 제목을 `aria-labelledby`로 연결했다.

## 나중에 (사소함)
- 모바일 홈 달력의 등록된 칸도 "등록됨 · 120건"이 두 줄로 끊긴다. 미등록 칸과 같은 방식(좁은 칸에서는 건수만)을 검토한다.
- 3개 조각 도넛은 위아래 빈 공간이 아직 조금 남는다. 조각 수에 따라 높이를 더 줄이는 방안을 검토한다.
- `Field`·`SegmentedControl`의 비활성 모양은 아직 `opacity: 0.6`이다.
- 테스트: 비활성 규칙 순서(`.primary:disabled`가 뒤)를 소스 정규식으로만 확인한다. `ResponsiveOverlay` 테스트는 `aria-labelledby === heading.id`를 직접 보지 않는다. 달력 테스트는 숨김 클래스를 확인하지 않는다.
- `MonthPicker`의 기본 label `'월'` 리터럴이 두 번 나온다.
- 달력 미등록 칸: `.state`의 inline-flex gap 때문에 "미등록"과 "· 업로드하기" 사이 간격이 조금 넓다(`CoverageCalendar.tsx:48`).
- 도넛 가운데 금액 글자가 높이 축소로 약 1px 작아졌다. 해당 테스트 이름이 기대값과 맞지 않는다(`DonutChart.tsx:60`).
- 테스트 정리: `SlowServerOverlay.test.tsx`의 모듈 `status`와 `DateTimePicker.test.tsx`의 spy를 마지막 줄에서만 되돌린다. `afterEach`로 옮긴다. 'stays closed' 테스트는 대조군(같은 조건에서 signedIn이면 열림)이 없다.
- `AppRoutes.test.tsx:172` 로그인 경로 테스트는 지연이 300ms라 3초 임계값에 닿지 않는다. 복원 중 덮개 억제는 `SlowServerOverlay` 단위 테스트로만 확인된다.
- 단계별 반복 모션(E): 드레싱 단계가 끝나거나 완료가 시작되면 animation 이름이 `pour-loop`→`pour`로 바뀌어 드레싱이 한 번 더 그려진다. 8초 단계 전환이 잎이 뛰어오른 중간에 오면 잎이 바로 내려앉는다. 테스트는 `data-motion`만 확인한다.
- 전역 덮개는 `ErrorBoundary` 밖에 있다(오류 화면 위에도 뜬다. 의도에 가까움).
