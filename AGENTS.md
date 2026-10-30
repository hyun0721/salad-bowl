# Salad Bowl — Codex

작업 전에 [공통 작업 규칙](docs/agent-guidelines.md)을 읽고 따른다.
개발 명령은 [docs/development.md](docs/development.md), 구조는
[docs/architecture.md](docs/architecture.md), 잔여 작업은
[docs/backlog.md](docs/backlog.md)을 기준으로 한다.

- 저장소 전용 skill은 `.agents/skills/salad-bowl-workflow/SKILL.md`다.
- Codex가 직접 시작한 작업은 Codex가 담당한다. Claude 전용
  `.claude/skills/codex-collab/`을 Codex의 역할 분담 규칙으로 불러오거나,
  자신에게 같은 일을 맡기기 위해 `codex-run.sh`를 재귀 호출하지 않는다.
- Claude가 넘긴 작업이면 전달된 brief·범위·보고 경로를 따른다. 커밋·브랜치·
  push 제한이 명시되어 있으면 유지하고, 범위를 임의로 넓히지 않는다.
- 모델과 실행 권한은 현재 세션 설정을 따른다. 예전 계획에 적힌 모델명이나
  샌드박스 관찰 결과로 전역 설정을 덮어쓰지 않는다.
- 선택 도구의 지원 범위와 설치 방법은
  [docs/agent-tools.md](docs/agent-tools.md)을 참고한다. 도구가 없어도 일반 작업은 진행한다.

검증 스택과 공용 시드는 [검증 스택과 시드](docs/development.md#검증-스택과-시드)를 따른다.
