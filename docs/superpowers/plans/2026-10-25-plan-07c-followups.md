# Plan 07c 후속 과제

Plan 07c(목록·모바일 패널·지연 로딩)의 Task별 리뷰(Codex 구현 ↔ Sonnet 리뷰), 브라우저 확인, 최종 리뷰(Opus)에서 나왔지만 넘긴 항목이다. React Aria 전면 적용(스펙 단계 0~3)은 이 계획으로 끝난다.

## 실행 중 바뀐 결정 (기록용)
- **Codex 협업 방식**: 이 계획부터 이중 리뷰를 없앴다. Codex는 서브에이전트 하나처럼 쓰고, 작업 유형별로 모델을 정한다(`codex-collab` 3장 표). 공용 부품(Task 1·2)은 `gpt-6-astra`, 화면(Task 3~5)은 `gpt-6-sol`이 구현했다. Task 리뷰는 Claude Sonnet, 최종 리뷰는 Claude Opus가 한 번만 했다. Codex 계획 검토와 Codex 브랜치 리뷰는 하지 않았다.
- **현재 행 표시**: 브라우저 확인에서, 행을 눌러도 선택 행 배경(`--brand-tint`)이 옮겨 가지 않는 것을 찾았다. RAC 컬렉션은 item이 같으면 행을 다시 그리지 않는다. `TableBody`·`GridList`에 `dependencies`를 넣어 고쳤다. jsdom 테스트는 처음 렌더에서만 `currentId`를 넘겨 이 문제를 놓쳤다. 지금은 `rerender` 테스트가 있다.
- **패널 머리글**: 제목·닫기를 `TransactionPanel`·`ManualTransactionForm` 밖(`TransactionsPage`)으로 옮겼다. 넓은 화면 `aside`와 좁은 화면 시트가 같은 본문을 쓰게 하려는 것이다. `TransactionPanel`의 `onClose`는 `onDeleted`가 됐다.
- **지연 로딩과 포커스**: 화면 전환 때 제목으로 포커스를 옮기는 effect를 `Suspense` 경계 안으로 옮겼다. 밖에 두면 fallback 동안 `h1`이 없어 포커스를 옮기지 못한다.
- **번들**: 홈 첫 진입 JS는 gzip 223.63 kB(단일 청크)에서 182.00 kB로 줄었다. 가장 큰 청크는 338.93 kB(gzip 106.16 kB)라 500 kB 경고가 사라졌다. 거래 화면 청크는 gzip 64.34 kB이고 DatePicker를 포함한다(`docs/ui-library-poc.md`).

## 실기기 확인 목록 (사용자가 직접)
미리보기 배포(`https://<branch>.salad-bowl-dey.pages.dev`)나 운영 주소에서 본다. 이번에 브라우저 패널이 숨겨져 있어 시트 닫힘을 확인하지 못했으니, 아래 "좁은 화면 시트" 항목을 먼저 본다.

**좁은 화면 시트 (이번 단계, 미리보기 브라우저에서도 확인 못 함)**
- 거래 카드를 누르면 전체 높이 시트로 열리고, 닫기·Esc·아래로 쓸기로 닫히며, 닫힌 뒤 포커스가 그 카드로 돌아오는지.
- 시트에서 삭제 → 확인을 누르면 시트가 닫히고 포커스가 "거래 목록" 제목으로 가는지(body가 아닌지). 넓은 화면은 확인했다.
- 거래 추가 시트에 입력하던 중 기기를 돌려도 시트와 입력이 그대로인지, 닫을 때 시트 애니메이션으로 사라지는지. Select·DatePicker 시트도 같은지(07b 후속의 모양 고정).
- 좁은 화면에서 다른 달 거래를 수동으로 추가한 뒤, 새 달 목록을 불러오는 동안 시트가 닫혔다 다시 열리는 깜박임이 있는지.
- iOS Safari에서 주소창이 줄어들 때 전체 높이 시트(`100dvh`)의 위아래가 잘리지 않는지, 노치 쪽 여백.

**스크린리더**
- VoiceOver·TalkBack: 카드 목록을 "거래 목록"으로 읽는지, 카드를 열 수 있는지.
- NVDA(넓은 화면): 표의 열 이름, 정렬 상태("오름차순"), 행 이동, Enter로 상세 열기.

**Plan 06a·07b에서 넘어온 항목**
- [Plan 06a 후속](2026-10-22-plan-06a-followups.md)의 "실기기에서 확인할 것" 전체(계정 시트 쓸어 닫기, 하단 탭 여백, 가로 모드 노치, 뒤로 가기로 시트 닫기, 동작 줄이기).
- [Plan 07b 후속](2026-10-24-plan-07b-followups.md): 시트 배경 진하기.

## 넘긴 항목
- 멤버 내보내기 뒤 포커스가 body로 간다(Plan 07b 후속). 거래 삭제와 같은 방식(목록 제목으로 옮기기)으로 고칠 수 있다.
- 입력이 있는 시트(그룹 이름, 월 삭제 확인 문구)는 바깥을 누르면 닫혀 입력을 잃는다(Plan 07b 후속).
- [Plan 07b 후속](2026-10-24-plan-07b-followups.md) "나중에" 목록의 테스트 보강.
- 대시보드 표 정렬(스펙 8장, 범위 밖).

## 나중에 (사소함, Task 리뷰에서 넘긴 것)
- `TransactionList`가 열 정의를 렌더마다 새로 만들어, `dependencies` 때문에 부모가 렌더될 때마다 모든 행이 다시 그려진다. 목록이 커지면 `useMemo`로 묶는다.
- `DataTable` 문자열 정렬이 `<` 비교다. 문자열 열을 정렬하게 되면 `localeCompare`를 쓴다(지금은 ISO 일시와 숫자뿐이다).
- 정렬을 키보드로 하는 경우와, 다른 열로 정렬을 옮길 때 이전 열의 `aria-sort`가 풀리는지 테스트가 없다(브라우저에서는 확인했다).
- `TransactionsPage.module.css`의 `.listCard > :is(p, div[class]:not([role="grid"]))` 선택자가 넓다.
- 좁은 화면 추가 폼 테스트에서 RAC 대화상자 제목 경고가 난다. DateTimePicker 달력 `Dialog`로 추정한다.
- 시트 닫기 동작은 jsdom 한계로 테스트가 없다. 지연 로딩 fallback이 보이는지 확인하는 테스트도 없다.
- `Dialog.test.tsx`의 회전 테스트가 `describe` 블록 밖에 있다. `CardList` 주석의 "왜"가 약하다.
- `docs/ui-library-poc.md`: 합계가 행별 반올림 값의 합이라는 설명이 없다.
