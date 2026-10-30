# Salad Bowl

뱅크샐러드 엑셀을 가져와 그룹과 가계부를 함께 보는 웹 서비스다.

뱅크샐러드는 다른 사람과 가계부를 공유할 수 없다. Salad Bowl은 뱅크샐러드 앱에서 내려받은 엑셀을 그대로 가져와, 가족이나 친구 같은 그룹 단위로 가계부를 함께 볼 수 있게 한다.

## 주요 기능

- **엑셀 가져오기**: 뱅크샐러드 엑셀을 올리면 기존 거래와 병합한다. 웹에서 고친 내용은 다음 가져오기에서 덮어쓰지 않는다.
- **가계부**: 업로드 화면에서 월별 등록 현황을 확인하고, 거래 목록에서 거래를 추가·수정한다.
- **그룹 공유**: 그룹을 만들고 초대 링크로 최대 6명까지 모은다. 내 거래를 공개할 그룹을 고른다.
- **PWA**: 모바일 홈 화면에 추가해 앱처럼 실행한다.

## 문서

[개발자 가이드 사이트](https://hyun0721.github.io/salad-bowl/)에서
[시작하기](https://hyun0721.github.io/salad-bowl/development.html) ·
[시스템 구조](https://hyun0721.github.io/salad-bowl/architecture.html) ·
[배포·운영](https://hyun0721.github.io/salad-bowl/deploy.html) ·
[인증과 권한](https://hyun0721.github.io/salad-bowl/auth.html) ·
[버전 관리](https://hyun0721.github.io/salad-bowl/pr38-update.html)를 읽을 수 있다.
새 문서는 main 반영 후 게시된다.

| 문서 | 내용 |
|---|---|
| [시스템 아키텍처](docs/architecture.md) | 요청 흐름, 저장소 구조, 인증, 스키마 관리, 배포 자동화 |
| [로컬 개발](docs/development.md) | 개발 환경 준비, 실행, 테스트, 개인정보 규칙 |
| [에이전트 공통 규칙](docs/agent-guidelines.md) | Claude·Codex의 작업 범위, 협업, 검증 기준 |
| [에이전트 도구](docs/agent-tools.md) | Codex 설정과 Graphify·Archify·Ponytail 호환성 |
| [Graphify 사용](docs/graphify.md) | 공용 그래프 조회, 갱신, 환경과 공유 방법 |
| [한계점](docs/limits.md) | 무료 티어 조건, 콜드스타트, 메모리, 업로드 한도, 용량 |
| [배포 절차서](docs/deploy.md) | 초기 배포, 이후 배포, 설정 변경, 되돌리기, 문제 해결 |
| [잔여 작업](docs/backlog.md) | 나중에 진행하기로 한 작업 |
