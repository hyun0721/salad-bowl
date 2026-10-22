# UI 컴포넌트 라이브러리 PoC (React Aria Components)

2026-10-22. 헤더 그룹 셀렉트와 업로드 칸을 `react-aria-components`(Apache-2.0)로 바꿔 보고, 계속 쓸지 판단할 근거를 남긴다.

## 바꾼 것
- `src/common/Select.tsx`: 공용 셀렉트. 폭 820px 초과는 트리거 아래 팝오버, 이하는 화면 하단 시트.
  - 하단 시트는 RAC `Popover`를 하단에 고정해서 만들었다. Select 안에 `ModalOverlay`를 쓰면 닫힌 동안 항목을 수집하지 못해 선택값이 비어 보인다(설치된 1.22.1 기준).
- `src/imports/UploadForm.tsx`: `DropZone` + `FileTrigger`. 기본 file input 문구가 보이지 않고, 고른 파일은 이름·크기·선택 취소 칩으로 보인다. 모바일 폭에서는 드래그 안내를 뺀다.
- `accept`에 MIME 타입을 함께 넣었다(`ACCEPTED_UPLOAD_FILE_TYPES`). iOS 파일 선택기가 확장자만으로 거르지 못하는 경우를 막는다.
- `main.tsx`: `I18nProvider locale="ko-KR"`. 브라우저 언어와 상관없이 RAC 기본 문구를 한국어로 맞춘다.
- 거래 화면의 멤버·타입 셀렉트는 그대로다. 계속 쓰기로 하면 공용 Select로 옮긴다.

## 번들 크기 (`npm run build`, 단일 JS 청크)

| 상태 | JS | JS gzip | CSS gzip |
|---|---|---|---|
| 변경 전 | 361.97 kB | 110.07 kB | 3.70 kB |
| RAC 적용 | 646.23 kB | 188.20 kB | 4.16 kB |
| + 한국어 외 문구 제거(`@react-aria/optimize-locales-plugin`), 리뷰 수정 반영 | 546.15 kB | **165.62 kB** | 4.21 kB |
| + 모바일 내비게이션(Plan 06a: Sheet, SelectionIndicator) | 568.64 kB | **172.23 kB** | 4.63 kB |

- 최종 증가분은 gzip 약 +56 kB(+50%)다. Select·ListBox·Popover·DropZone이 공유하는 포커스·키보드·컬렉션·오버레이 계층이 대부분이고, 컴포넌트를 더 써도 이 기반은 다시 늘지 않는다.
- 줄일 방법: 화면 단위 지연 로딩(`React.lazy`)으로 업로드·거래 화면을 첫 화면 청크에서 빼기. 이번 PoC 범위 밖이다.
- Vite가 500 kB 초과 청크 경고를 낸다. 지연 로딩을 하면 함께 사라진다.

## 라이선스 고지
- Vite 8 내장 `build.license`로 빌드할 때 `dist/third-party-licenses.md`를 만든다. 번들에 들어간 의존성 12개(Apache-2.0 4개: `react-aria-components`, `react-aria`, `react-stately`, `@internationalized/string` / MIT 8개)의 이름·버전·라이선스 전문이 들어가고, 배포하면 `/third-party-licenses.md`로 열린다.
- Apache-2.0 의무 중 해당하는 것은 라이선스 사본 포함뿐이다. `adobe/react-spectrum`에는 NOTICE 파일이 없고, 라이브러리 소스를 고치지 않았으므로 수정 표시 의무도 없다.
- 소스를 옮겨 온 Lucide 아이콘 경로는 이 파일에 잡히지 않으므로 `THIRD_PARTY_NOTICES.md`에 계속 둔다.

## 확인한 것
- 자동: typecheck, 테스트 152개, lint, build 통과.
- 열린 동안 화면 폭이 820px을 넘나들어도(회전 등) 팝오버와 시트를 바꾸지 않는다. 바꾸면 포커스가 사라진다.
- 브라우저(데스크톱 폭 1200px, 좁은 폭 453px): 데스크톱은 목록이 트리거 아래에 펼쳐지고, 좁은 폭은 하단 시트로 뜬다.
- 실기기(iOS Safari·Android Chrome·Windows 스크린리더)는 확인하지 않았다.
