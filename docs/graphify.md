# Graphify 사용

코드·설계 문서·아이콘을 `graphify-out/`의 공용 그래프로 분석한다.
Claude와 Codex는 같은 작업 폴더의 그래프를 그대로 조회할 수 있다.
별도 clone이나 worktree 사이에는 생성 파일이 자동 공유되지 않는다.

## 현재 환경

- Graphify 0.9.95와 저장소 전용 `.venv-graphify/`를 사용한다.
- 가상환경은 현재 설치된 Python 패키지를 참조하고, SQL 분석용
  `tree-sitter-sql==0.3.11`을 별도로 추가했다.
- 실제 분석 루트·인터프리터 경로는 `graphify-out/.graphify_root`와
  `graphify-out/.graphify_python`에 저장한다. 경로를 옮겼다면 다시 설정한다.
- 캐시·가상환경·생성 그래프는 `.gitignore`로 제외한다.
  팀에 전달할 때는 검토한 `graph.json`, `GRAPH_REPORT.md`, `graph.html`만 별도로 공유한다.

## 조회

저장소 루트에서 실행한다. Python 패키지를 재설치할 필요는 없다.

```bash
.venv-graphify/bin/python -m graphify query "AuthController RefreshCookie"
.venv-graphify/bin/python -m graphify explain "AuthController"
.venv-graphify/bin/python -m graphify affected "AuthService"
```

검색어는 소스에 있는 클래스·함수명을 섞으면 정확도가 높다.
`graphify-out/graph.html`은 브라우저에서 탐색할 수 있다.
의미 관계와 과거 계획은 현재 구현과 대조한다.

## 갱신

Claude 또는 Codex에 Graphify skill로 변경 파일을 증분 갱신해 달라고 요청한다.
예: `Graphify로 현재 저장소를 --update 해줘.`
코드의 구조는 AST로 추출하고, 문서·이미지 의미는 실행 중인 에이전트가 추출한다.
두 에이전트가 동시에 같은 출력 폴더에 그래프를 갱신하지 않는다.
watcher·Git hook·외부 DB·외부 LLM 연결은 기본으로 활성화하지 않는다.

## 한계와 검증

이 그래프는 소스 검색을 돕는 자료이며 런타임 실행·테스트 결과를 대신하지 않는다.
파서 경고·추출 누락·그래프 무결성 결과는 생성 보고서와
`graphify-out/SETUP.md`를 확인한다. 문서의 계획을 구현 완료 증거로 해석하지 않는다.
실제 거래 파일·비밀값을 추가하지 않고, 민감 파일 자동 제외를 유지한다.
