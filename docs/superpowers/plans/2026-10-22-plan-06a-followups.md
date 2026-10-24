# Plan 06a 후속 과제

Plan 06a(모바일 내비게이션, PR #15)의 Task별 리뷰, 브라우저 확인, 최종 리뷰(opus)에서 나왔지만 넘긴 항목이다. PR #12(React Aria PoC) 리뷰에서 넘긴 항목도 함께 적는다. 실기기 확인을 하면 결과를 이 문서에 덧붙인다.

## 실행 중 바뀐 결정 (기록용)
- **계획 번호**: 이 계획을 `plan-06a`로 지었지만, 06은 [Plan 05 후속 과제](2026-10-20-plan-05-followups.md)의 "Plan 06 (운영·보안 보강)"과 겹친다. React Aria 단계 1~3의 계획은 Plan 07a·07b·07c로 이어 붙인다. 이 파일들은 이름을 바꾸지 않는다(PR·커밋에서 이미 이 이름으로 가리킨다).
- **jsdom과 RAC Sheet**: jsdom에서는 RAC `Sheet`가 닫힘 완료(IntersectionObserver 콜백)를 알 수 없어 DOM이 남는다. 테스트는 `aria-expanded`만 확인하고, 실제로 닫히는 것·포커스 복귀·화면 폭 전체로 열리는 것은 브라우저에서 확인했다. `test/setup.ts`가 jsdom에 없는 `matchMedia`·`IntersectionObserver`·`scrollTo`·`getAnimations`를 테스트에서만 채운다(node 환경 테스트를 위해 `window`가 있을 때만).
- **BottomSheet 포커스**: 스크린리더 탭처럼 포커스 없이 누르면 RAC가 돌려줄 포커스 대상이 body가 된다. 열기 직전에 트리거에 포커스를 두도록 고쳤다(`BottomSheet.tsx`의 `onOpenChange`).
- **안전 영역**: `viewport-fit=cover`를 넣으면서 넓은 화면 레이아웃(`.nav`·`.header`·`.content`·`.logoutError`)과 시트 내용에도 `env(safe-area-inset-*)`를 적용했다(가로 모드 iPhone의 노치).
- **Codex 협업**: Codex가 Task 2 도중 사용량 한도에 걸렸다. 이후 구현과 리뷰는 Claude 모델끼리(Sonnet ↔ Opus) 다른 모델로 진행했고, Codex 브랜치 리뷰는 돌리지 못했다.
- **번들**: JS gzip 165.62 kB → 172.23 kB(`docs/ui-library-poc.md`). 500 kB 청크 경고는 단계 3의 화면 단위 지연 로딩에서 없앤다.

## 실기기에서 확인할 것
미리보기 배포(`https://<branch>.salad-bowl-dey.pages.dev`)나 운영 주소에서 본다.
- iOS Safari: 계정 시트를 아래로 쓸어서 닫기, 홈 인디케이터 위 하단 탭 여백, 가로 모드 노치 쪽 여백(넓은 화면 레이아웃 포함), 시트 열고 닫는 속도(포그라운드 Chrome 측정: 열기 약 520ms, 닫기 약 110ms).
- iOS VoiceOver·Android TalkBack: 하단 탭을 "주 메뉴" 내비게이션으로 읽는지, 현재 화면을 알려주는지, 계정 시트가 "계정" 대화상자로 열리고 닫힌 뒤 계정 버튼으로 돌아오는지.
- Android Chrome: 하단 탭 터치 영역(56px), 뒤로 가기로 시트 닫기.
- Windows NVDA(넓은 화면): 기존 사이드바·상단 바 동작이 그대로인지.
- "동작 줄이기" 설정에서 탭 표시선이 애니메이션 없이 옮겨 가는지(미리보기 브라우저에서 흉내 내지 못해 확인하지 않았다).

## 단계 1~3 계획에 더할 것
- 로그아웃 실패 문구(`logoutError`)가 시트를 닫았다 다시 열어도 남는다. 넓은 화면도 같다(다음 시도 때 지워진다). 단계 2에서 Toast·오류 표시를 정리할 때 시트를 닫으면 지우도록 한다.
- 시트·대화상자의 실제 닫힘과 포커스 복귀를 자동으로 확인할 방법이 없다. 단계 2에서 `Dialog`·`ConfirmDialog`를 RAC `Sheet`로 만들면 같은 한계가 생기므로, 브라우저 확인 절차를 계획에 넣거나 Playwright 같은 실제 브라우저 테스트 도입을 검토한다.
- `test/mockViewport.ts`의 `set()`(열린 채로 폭 바꾸기)을 쓰는 테스트가 없다. 회전 시 계정 시트가 닫히는지(넓은 화면으로 바뀌면 `AccountSheet`가 사라진다)를 단계 3의 모바일 패널 작업 때 함께 확인한다.
- PR #12 업로드 칸: `DropZone`의 끌어다 놓기 경로(`onDrop`)는 테스트가 없다. 파일이 아닌 항목을 놓으면 아무 반응이 없고, 여러 개를 놓으면 첫 파일만 쓴다. 단계 1에서 폼 오류 표시를 정리할 때 안내 문구를 더한다.

## 나중에 (사소함)
- `BottomSheet.test.tsx`의 Esc 테스트는 `aria-expanded`만 본다.
- `test/setup.ts`의 `scrollTo` 보충이 모든 요소에서 `scrollend`를 보낸다. 스크롤 타이밍을 보는 테스트가 생기면 다시 본다.
- `BottomSheet.module.css`의 `.title { font-size: 18px }`처럼 글자 크기는 토큰이 없어 숫자로 쓴다(기존 `.logo`도 같다).
- `BottomTabBar.test.tsx`의 표시선 확인은 RAC가 선택되지 않은 표시선을 렌더하지 않는다는 점에 기댄다.
- 그룹이 없을 때 상단 바의 "그룹 없음 · 만들기 또는 초대받기" 링크는 말줄임 없이 320px 폭에서 두 줄이 된다(넘치지는 않는다).
