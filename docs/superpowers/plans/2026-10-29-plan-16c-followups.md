# Plan 16c 후속

[Plan 16c](2026-10-29-plan-16c-dashboard-routes.md) 실행 뒤 남긴 것.

## 확인한 것

- 웹 `typecheck`·테스트 416개·`lint`(기존 `CoverageSection` 경고 1건)·`build` 통과(Codex 최종 수정 보고).
- 검증 스택(`/verify`)에서 실제 브라우저로 확인:
  - 좁은 폭(375px): `/dashboard` → `/dashboard/major/share`. `추이`·`소분류` 링크는 replace라 `history.length`가 그대로이고, 포커스는 누른 링크에 남는다. `이전 달`이 `?month=`를 replace로 쓴다. 뒤로가기는 대시보드에 들어오기 전 화면(홈)으로 간다. 숨겼다가 보인 추이 차트도 크기가 맞다.
  - 넓은 폭(1280px): 사이드바에 `대분류`·`소분류`. `aria-current="page"`는 하위 링크 하나뿐이다. `/dashboard/major/trend`는 요약이 온 뒤 추이 카드로 스크롤하고, 월을 바꿔도 다시 스크롤하지 않는다.
- 기능 지도 `dashboard.md`·`navigation.md`를 갱신했다. 이 브랜치와 무관한 home·upload·transactions·groups 지도는 다시 돌리지 않았다.

## 미룬 것

- 부모 링크 `그룹 대시보드`와 하단 탭 `대시보드`를 대시보드 안에서 누르면 push로 `/dashboard`에 갔다가 리다이렉트된다. 그래서 `?month=`가 사라지고 뒤로가기 한 번이 대시보드 안에서 쓰인다. 설계 6.4는 하위 메뉴만 replace로 정했으므로 규칙 위반은 아니다. 16d 이후 대시보드 안에서는 replace와 search 유지를 줄지 정한다.
- `DashboardMenu.test.tsx`는 `major/trend` 한 경우만 본다. 다른 조합은 `DashboardPage.test.tsx`의 좁은 화면 테스트가 덮는다.
- 소분류(`/dashboard/minor/*`)는 main의 `SubcategoryTrends` 카드를 임시로 보여준다. 16d에서 소분류 분포·추이로 바꾼다.
- 실제 스크린리더로는 확인하지 않았다.
