---
name: salad-bowl-workflow
description: Implement, debug, or review Salad Bowl changes using the repository's shared rules, design plans, and web/API verification commands. Use for work in this repository, including briefs delegated from Claude.
---

# Salad Bowl 작업

먼저 저장소 루트의 `docs/agent-guidelines.md`를 읽는다.
이 skill은 Codex의 저장소 작업 절차이며 Claude용 `codex-collab`의 복사본이 아니다.

## 구현·진단

- 관련 설계·계획·brief를 현재 코드와 대조하고 필요한 범위만 구현한다.
  예전 계획의 `superpowers:*` 표기는 플러그인 의존성을 포함할 수 있다.
  설치되어 있으면 해당 skill을 사용하고, 없으면 요구사항·작업 순서·검증 조건을
  직접 수행하며 대체 실행 사실을 보고한다.
- 실패 수정은 재현 근거와 원인을 먼저 확인한다. 동작 변경을 확인하는 테스트를
  추가하거나 갱신하고, 공통 작업 규칙에 따라 영향 범위의 최종 검증을 수행한다.
- Claude가 brief를 넘겼다면 지정된 보고 파일과 변경 범위를 지킨다.
  원래 구현자와 수정 라운드를 이어 가되, 같은 작업을 다시 Codex CLI에 맡기지 않는다.
- 직접 시작한 작업은 현재 세션에서 완료한다. 다른 실행기의 가용성이나 특정
  모델명을 전제로 하지 않는다. 사용 가능한 경우에만 필요한 위임을 한다.

## 리뷰

`docs/agent-task-review.md`를 읽고 요구사항과 변경을 대조한다.
인증·쿠키·프록시·삭제·권한 변경은 우회·정보 노출·경합·데이터 손실의
구체적인 시나리오를 점검한다. 추측은 추측으로 표시한다.

## 선택 도구

그래프·다이어그램·단순화 리뷰가 도움이 되면 `docs/agent-tools.md`의
호환성 및 제약을 확인한다. 설치되지 않은 플러그인 호출이나 hook을 가정하지 않는다.
