# Claude / Codex 도구 호환성

2026-10-27 확인. 저장소와 로컬 설치본을 읽고, 프로젝트 원본 문서 및 CLI를 대조했다.
아래 버전은 확인한 로컬 설치본이며 최신 버전 또는 Codex 설치 완료를 뜻하지 않는다.

| 도구 | 확인한 버전 | Codex 활용 | 이번 검증 |
|---|---|---|---|
| Graphify (`graphifyy`) | 0.9.95 | CLI·그래프 JSON 재사용 가능. Codex용 skill/지침 설치 지원 | 패키지 버전·`graphify --help` 확인 |
| Archify | 3.2.0 | Node CLI와 skill·schemas·references·assets 전체 패키지 사용 | `doctor` 통과. 브라우저 렌더링 검증은 미실행 |
| Ponytail | 5.3.2 | Codex용 manifest·skills·lifecycle hooks 제공 | 로컬 manifest·설치 문서·hook 정의 확인. hook 실행은 미검증 |
| Superpowers | 6.2.0 | Codex App/CLI용 플러그인 제공 | 로컬 Codex manifest와 원본 설치 문서 확인 |
| frontend-design | 1.1.0 | 지침형 skill은 이식 가능 | 로컬 SKILL.md 확인. Codex 정식 설치·실행은 미검증 |
| Playwright MCP | 0.0.83 | 같은 MCP 서버를 실행기별 설정에서 사용 | `.mcp.json`과 `.codex/config.toml` 명령·버전 일치 확인. 연결은 미검증 |

## Graphify

관계 탐색·영향 분석에 적합하다. upstream은
[Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)
(기존 `safishamsi/graphify` 주소에서 이동)다.

- Claude의 `PreToolUse` hook은 Codex에 복사하지 않는다. Codex는 지침/skill 경로를 사용한다.
- 로컬 skill에는 Claude `Agent` 도구 호출·모델·사용량 필드에 묶인 의미 추출
  절차도 있다. 그대로 복제하기보다 해당 버전의 Codex 설치 경로를 사용한다.
- 기존 `graphify-out/graph.json`을 재사용할 수 있다.
  `graphify query "<question>"`과 `graphify affected "<symbol>"`로 범위를 좁히고
  현재 소스와 대조한다.
- 코드만 분석할 때 `graphify extract . --code-only --no-cluster`는 로컬 AST 경로다.
  문서 의미 추출·커뮤니티 이름 붙이기는 별도의 LLM 경로일 수 있다.
  환경에 있는 API 키를 임의로 쓰거나 외부 서버로 프로젝트 내용을 보내지 않는다.
- 설치·재생성·watcher·Git hook 설치는 이번 구성에서 수행하지 않았다.
  upstream의 현재 프로젝트 설치 예시는 `graphify install --project --platform codex`다.
  로컬 버전에 같은 옵션이 있는지 먼저 확인한다. 설치기가 AGENTS.md를 고칠 수 있으므로
  기존 진입점과 공통 규칙을 덮어쓰지 않도록 diff를 검토한다.

## Archify

[tt-a1i/archify](https://github.com/tt-a1i/archify)는 Codex를 지원한다.
로컬 설치본은 `~/.claude/skills/archify/`에 있다. 이 경로에 있다는 사실이
Claude 전용 실행 코드라는 뜻은 아니다. Node CLI는 현재 환경에서 동작했다.

- SKILL.md 한 파일만 옮기면 안 된다. schemas·renderers·assets·references가 필요하다.
- 저장소에 개인 머신의 절대 경로나 Claude 캐시를 가리키는 심볼릭 링크를 커밋하지 않는다.
- upstream 설치 예시는 `npx skills add tt-a1i/archify --agent codex`다.
  설치 후 Codex에서 skill이 발견되는지 확인한다.
- 생성은 프로젝트의 합성 데이터와 소스 근거로 수행하고, 산출물은 `.archify/`에 둔다.
  실제 전달 시 `finalize`의 품질·브라우저 검증 결과를 따른다.
- `doctor` 성공은 실제 다이어그램 생성·브라우저 검증 성공을 뜻하지 않는다.
- 전역 explainer 모드를 자동 활성화하거나 업데이트를 설치하지 않는다.
  필요하면 `ARCHIFY_UPDATE_CHECK_DISABLED=1`로 업데이트 확인 네트워크/상태 쓰기를 끌 수 있다.

## Ponytail

[설치 문서](https://github.com/DietrichGebert/ponytail/blob/main/INSTALL.md)는 Codex 설치를 제공한다.

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

이 명령은 설치가 필요할 때의 예시이며 이번 변경에서는 실행하지 않았다.
설치 후 지원되는 클라이언트에서 `/hooks`를 확인하고 hook 신뢰 설정을 직접 검토한다.
데스크톱 앱은 재시작·새 세션이 필요할 수 있다.
Codex skill 호출명은 설치된 목록을 따른다(현재 upstream 예: `$ponytail:ponytail`).

YAGNI·기존 공용 부품 우선 원칙은 공통 규칙과 맞는다. 다만 `ultra` 모드나
상시 hook을 프로젝트 기본값으로 강제하지 않는다. 간결함을 이유로 필수 테스트·
접근성·검증·요구사항을 줄이지 않는다.

## Superpowers / frontend-design

- [Superpowers](https://github.com/obra/superpowers)는 Codex 플러그인 경로가 있다.
  Codex의 Plugins에서 설치하고 새 세션의 skill 목록을 확인한다.
  설치하지 않아도 이 저장소의 Codex workflow로 기존 계획을 직접 수행할 수 있다.
- Claude의 도구명·절대 캐시 경로·모델 분담표를 Codex에 복사하지 않는다.
  프로젝트의 Task 리뷰 기준은 `docs/agent-task-review.md`로 독립시켰다.
- frontend-design은 지침을 활용할 수 있지만, Salad Bowl의 기존 토큰·공용 부품·
  화면 요구사항을 우선한다. 라이선스와 배포 경로를 확인한 후 이식한다.
  이번에는 제3자 skill 본문을 저장소에 재배포하지 않았다.

## Playwright MCP와 적용 확인

Claude는 `.mcp.json`, Codex는 신뢰한 프로젝트의 `.codex/config.toml`을 사용한다.
두 설정은 같은 `npx -y @playwright/mcp@0.0.83`를 가리킨다.
사용자 전역에 같은 이름의 서버가 있으면 중복 등록 여부를 확인한다.
처음 실행할 때 Node/npx와 패키지 다운로드 네트워크가 필요할 수 있다.

1. 이 변경이 있는 브랜치를 로컬로 체크아웃하고 저장소를 신뢰한 뒤 Codex를 새로 연다.
2. 읽힌 지침을 물어 `AGENTS.md`와 `docs/agent-guidelines.md`가 적용되는지 확인한다.
3. skill 목록에서 `salad-bowl-workflow`를 확인하고, CLI에서는 `codex mcp list`로
   Playwright 등록을 확인한다. 등록 확인과 실제 브라우저 연결 검증을 구분한다.
4. Claude 새 세션에서도 `CLAUDE.md`의 공통 문서 참조가 읽히는지 확인한다.
5. 선택 도구의 전역 설치는 별도 작업이다. 이 저장소의 설정만으로 설치 완료나
   현재 열린 세션의 즉시 활성화를 의미하지 않는다.

Codex 규칙은 [공식 지침 문서](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[skill 문서](https://learn.chatgpt.com/docs/build-skills),
[MCP 문서](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)를 기준으로 한다.
