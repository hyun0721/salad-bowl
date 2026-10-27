# 홈 화면 앱 상태바와 새 버전 알림 설계

- 작성일: 2026-10-27
- 상태: 승인됨
  - 상태바: "상태바 뒤만 브랜드 초록"
  - 새 버전: "감지될 때만 알림"
  - 올릴 곳: "새 브랜치·새 PR"
- 브랜치: `claude/pwa-statusbar-update` (PR #30 브랜치 위)

## 1. 홈 화면 앱 상태바

**문제**
- 홈 화면에 추가한 앱(iOS standalone)에는 상태바 설정이 없다.
- 그래서 iOS가 상태바 영역을 헤더와 다른 색(어두운 테마에서 거의 검정)으로 따로 칠한다. 화면 위가 그림자로 덮인 것처럼 보인다.

**바꿀 것**
- `index.html`에 `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`를 더한다.
  - 앱이 상태바 뒤까지 그리게 되고, 상태바 글자는 흰색이 된다.
- 상태바 뒤 색 토큰 `--status-bar`를 둔다.
  - 밝은 테마: `var(--brand)`(#2f6b4f). 흰 글자가 보이고, 앱 아이콘·`theme-color`와 같은 색이다.
  - 어두운 테마: `var(--surface-000)`. 헤더와 같은 색이라 헤더가 상태바 뒤까지 이어져 보인다.
- `base.css`
  - `body { padding-top: env(safe-area-inset-top, 0px); }`
    - 모든 화면(로그인, 시작 로더, 초대 화면 포함)이 상태바 아래에서 시작한다.
    - 상태바가 없는 환경(데스크톱, 일반 Safari 세로)에서는 0이라 바뀌지 않는다.
  - `body::before`
    - 화면 맨 위에 높이 `env(safe-area-inset-top)`인 고정 띠를 두고, 배경은 `var(--status-bar)`, `z-index: 40`이다.
    - 스크롤한 내용이 상태바 글자 뒤로 비치지 않게 한다.
    - `pointer-events: none`이다.
- `AppLayout.module.css`
  - 좁은 화면 `.header`의 `padding-top: max(var(--space-3), env(safe-area-inset-top, 0px))`를 `var(--space-3)`로 바꾼다. body가 이미 띄우므로 두 번 띄우지 않으려는 것이다.
- 다른 곳
  - 전체 높이 시트(`.fullSheet`)의 `padding-top: env(safe-area-inset-top)`는 그대로 둔다. 시트는 화면 맨 위부터 그려지므로 필요하다.
- 확인
  - 실기기(iOS 홈 화면 앱)는 사용자가 직접 확인한다.
  - 개발 쪽에서는 Playwright에서 safe-area를 흉내 낼 수 없다. 대신 `env()` 대체값을 강제로 준 CSS 한 줄로 레이아웃이 겹치지 않는지 본다(임시, 커밋 안 함).

## 2. 새 버전 알림

**문제**
- PWA가 `registerType: 'autoUpdate'`라서, 새 서비스워커는 설치되어도 열린 화면은 옛 코드를 계속 쓴다.
- 홈 화면 앱은 완전히 닫았다 열어야 새 버전이 보인다.

**바꿀 것**
- `vite.config.ts`
  - `registerType: 'prompt'`
  - `injectRegister: false`(앱 코드에서 등록)
- `package.json` devDependencies에 `workbox-window`를 명시한다.
  - 이미 `vite-plugin-pwa`의 의존성으로 설치된 7.4.1이다.
  - 플러그인 문서가 직접 의존성으로 두라고 한다. 새 패키지가 아니다.
- 타입: `src/vite-env.d.ts`(없으면 만든다)에 `/// <reference types="vite-plugin-pwa/react" />`를 넣는다.
- `app/useAppUpdate.ts`
  - `virtual:pwa-register/react`의 `useRegisterSW`를 감싼다.
  - 등록되면 아래 두 경우에 `registration.update()`를 부른다.
    - 1시간마다
    - 화면이 다시 보일 때(`visibilitychange` → `visible`)
  - 반환값: `{ needRefresh: boolean, update: () => void, dismiss: () => void }`
    - `update`는 `updateServiceWorker(true)`다. 새 서비스워커를 켜고 페이지를 새로 고친다.
    - `dismiss`는 이번 알림만 닫는다. 다음 새 버전이 나오면 다시 뜬다.
- `app/UpdatePrompt.tsx`
  - `needRefresh`일 때만 화면 위쪽 가운데에 카드를 띄운다.
  - 위치: `top: calc(env(safe-area-inset-top, 0px) + var(--space-2))`, `z-index: 30`
  - 카드 내용
    - 문구: "새 버전이 있어요"
    - 버튼: "새로고침"(`ui.primary`), "나중에"(`ui.button`)
  - 접근성: 카드는 `role="status"`라 나타날 때 스크린리더가 읽는다. 버튼은 일반 `button`이다(RAC 아님).
  - `App.tsx`의 `ToastRegion` 옆에 둔다(로그인 화면에서도 보임).
- 문구
  - "새 버전이 있어요"
  - "새로고침"
  - "나중에"
  - 새로고침하면 작성 중인 입력이 사라질 수 있다. 그래서 사용자가 누를 때만 새로 고친다.
- 테스트
  - `virtual:pwa-register/react`는 테스트 환경에 없다. `vite.config.ts`의 `test.alias`로 `src/test/pwaRegisterStub.ts`에 연결한다.
  - stub은 `useRegisterSW`를 내보내고, 테스트가 `needRefresh` 상태를 바꿀 수 있게 한다.
  - `UpdatePrompt`
    - 새 버전이 없으면 아무것도 없다.
    - 있으면 문구와 두 버튼이 보인다.
    - "새로고침"이면 `updateServiceWorker(true)`가 불린다.
    - "나중에"면 카드가 닫힌다.
  - `useAppUpdate`: 등록 콜백에서 `visibilitychange`(visible)와 1시간 타이머가 `update()`를 부른다(가짜 타이머).

## 3. 범위 밖

- "업데이트 확인" 상시 버튼(사용자가 고르지 않음)
- 오프라인 지원, 버전 번호 표시
- 데스크톱 브라우저 탭의 강제 새로고침
  - 서비스워커가 같은 방식으로 알림을 띄우므로 따로 하지 않는다.
