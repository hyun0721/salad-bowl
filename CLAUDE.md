# Salad Bowl — Claude Code

@docs/agent-guidelines.md

개발 명령은 `docs/development.md`, 구조는 `docs/architecture.md`,
잔여 작업은 `docs/backlog.md`를 기준으로 한다.

Claude 세션은 Codex 위임 절차 `.claude/skills/codex-collab/SKILL.md`를 따른다.
계획 실행뿐 아니라 사용자가 직접 요청한 코드 변경에도 적용한다. 구현과 리뷰를
3장 표대로 나누고, 구현하지 않은 쪽의 리뷰 없이 PR을 올리지 않는다.
Codex용 `AGENTS.md`와 `.agents/skills/`의 역할 지침은 Claude에 적용하지 않는다.

Superpowers 등 설치된 플러그인은 요청된 작업에 필요한 범위에서 사용한다.
플러그인의 일반적인 절차보다 사용자 요청과 공통 작업 규칙을 우선한다.
선택 도구의 호환성은 `docs/agent-tools.md`에 정리되어 있다.
