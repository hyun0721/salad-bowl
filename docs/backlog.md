# 잔여 작업 (Backlog)

나중에 진행하기로 한 작업이다. 계획(Plan)에 들어가면 해당 계획 문서로 옮기고 여기서 지운다.

## 디자인
- **아이콘 세트**: 기본 아이콘은 오픈소스 라인 아이콘(Lucide 또는 Tabler, MIT)을 쓰고, 로고와 도메인 아이콘(샐러드볼 로고, 엑셀 업로드 등)만 직접 디자인한다.
  - 규칙: 24px 그리드, 선 굵기 1.75~2px, 둥근 끝처리, `currentColor`
  - 이모지는 쓰지 않는다.
  - Claude Design System에 아이콘 목록과 사용 규칙을 담고, React에서는 `<Icon name="..." />` 컴포넌트로 같은 원본을 쓴다.
  - 시점: 세부 디자인 보완 단계
- **모바일 우선 PWA(하단 탭 등)**: 1차는 PC 우선. 모바일 전용 UX는 고도화 단계에서 진행한다.

## 인프라
- **개인 도메인(B안)**: 1차는 Cloudflare Pages 프록시(A안)로 간다. 전환할 때는 쿠키 Path와 SameSite 설정, `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS` 값만 바꾼다.
