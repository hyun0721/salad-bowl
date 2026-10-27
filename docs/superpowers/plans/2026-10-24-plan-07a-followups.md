# Plan 07a 후속 과제

Plan 07a(폼 입력과 카테고리 자동완성)의 Task별 리뷰(Claude·Codex 교차), 브라우저 확인, 최종 리뷰(opus)에서 나왔지만 넘긴 항목이다.

## 실행 중 바뀐 결정 (기록용)
- **Task 7 범위 추가**: 점검 단계에서 두 가지를 찾아 함께 고쳤다. PR #14에서 새로 생긴 월 삭제 확인 단계(`MonthDataDialog`)의 기본 체크박스·입력칸을 공용 부품으로 바꿨다. `UploadForm`이 React Aria를 직접 import하던 것을 `common/FileDropZone`으로 옮겼다. 이제 `react-aria-components`는 `common/`, 테스트, `main.tsx`(I18nProvider)에서만 import한다.
- **금액 최솟값**: RAC `NumberField`의 `minValue`는 칸을 벗어날 때 0을 1로 바꿔 버린다(1원 거래가 조용히 저장될 수 있다). `MoneyField`는 `minValue`를 RAC에 넘기지 않고 `validate`로 "1원 이상 입력하세요", 13자리 초과는 "금액이 너무 큽니다"를 보여준다.
- **번들**: JS gzip 172.23 kB → 216.87 kB(`docs/ui-library-poc.md`). RAC `DatePicker`가 `@internationalized/date`의 모든 달력 체계를 싣는다(1.22.1 `DatePicker`에는 줄이는 옵션이 없다). 스펙의 "번들 증가는 작다"는 가정이 틀렸다. 단계 3의 화면 단위 지연 로딩으로 첫 화면에서 뺀다.
- **Codex 협업**: Codex가 최종 브랜치 리뷰 도중 사용량 한도에 걸려, 최종 리뷰는 opus 단독으로 했다.

## 단계 2(Plan 07b)에 더할 것
- 넓은 화면의 Select 팝오버를 스크린리더가 "대화상자"로 읽는다. RAC의 모달 `Popover`가 스스로 `role=dialog`를 붙이기 때문이다(`react-aria-components/dist/private/Popover.mjs` 121~128줄). PR #12부터 같은 상태라 이번 회귀는 아니다. 없애려면 `isNonModal`과 바깥 누르기 닫기를 직접 만들어야 한다. 오버레이를 정리할 때 함께 본다.
- `ResponsiveOverlay`가 오버레이 스타일을 `Select.module.css`에서 가져온다. 오버레이 전용 CSS로 옮긴다.
- 공개 스위치가 저장 중 비활성인지, 초대 주소 칸이 포커스하면 전체 선택되는지 테스트가 없다(이전에도 없었다).

## 나중에 (사소함)
- `TextAreaField`에 `className`·`description`·`isRequired`가 없다. 필요한 화면이 생기면 더한다.
- ComboBox 팝오버 그림자 흐림 값에 간격 토큰(`--space-4`)을 쓴다.
- `ManualTransactionForm.test.tsx`의 "suggests" 테스트가 `/me/categories` 핸들러를 `beforeEach`와 중복으로 등록한다. `TransactionsPage.test.tsx`의 멤버 옵션 테스트는 테스트 닉네임이 "멤버"라는 데 기댄다.
- 몇몇 파일에서 `common/*` import가 `react` import보다 위에 있다.
- 파일 선택 창을 취소해도 이전 업로드 결과가 지워지지 않는다(브라우저가 취소 때 `change`를 거의 보내지 않아 실제 영향은 작다).
- `Select.test.tsx`에 빈 줄이 두 번 들어간 곳이 있다.
