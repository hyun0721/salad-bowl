# 문서 자동 배포

공개할 HTML과 정적 파일은 `docs/site/`에 둔다. `docs-pages` 워크플로가 이 폴더만 GitHub Pages에 게시한다. 앱의 Cloudflare Pages·Render 배포와 별개다.

## 최초 설정

1. 이 변경을 `main`에 반영한다.
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정한다.
3. **Settings → Environments → github-pages**의 배포 브랜치를 `main`으로 제한한다.
4. **Actions → docs-pages → Run workflow**에서 `main`을 선택해 최초 배포한다.
5. 성공한 실행의 `github-pages` 환경 링크에서 문서를 연다.

기본 주소는 `https://hyun0721.github.io/salad-bowl/`이고, PR #38 문서는 `pr38-update.html`에서 연다. 실제 주소는 배포 결과를 기준으로 한다. 이미 이 저장소에서 GitHub Pages 사이트를 운영한다면 이 워크플로의 배포가 그 사이트를 교체하므로 기존 게시 경로를 먼저 확인한다.

GitHub Pages 사용 가능 여부는 저장소 공개 범위와 계정 플랜에 따른다. 사용자 지정 도메인과 계정·조직 정책도 저장소 설정에서 확인한다.

## 개발자 가이드와 홈

홈 `docs/site/index.html`에서 시작하기·시스템 구조·배포·운영·인증과 권한 가이드를 연결한다.
가이드는 `development.html`, `architecture.html`, `deploy.html`, `auth.html`이며
공통 스타일은 `guide.css`다. 외부 폰트·스크립트나 별도 빌드 없이 정적 HTML로 제공한다.
`pr38-update.html`은 기존 URL을 유지한 버전 관리·PWA 업데이트 가이드다.
Archify 다이어그램은 `diagrams/`에, 본문용 정적 이미지는 `images/`에 둔다.
작은 화면에서는 그림을 가로로 스크롤하거나 확대·상호작용 보기 링크를 사용한다.

가이드 본문은 게시용 HTML에서 직접 관리한다. 기존 Markdown은 상세 절차와 참조 문서이며
자동으로 HTML에 동기화되지 않는다. 동작을 바꿀 때 해당 가이드와 관련 Markdown을 함께
확인하고, 가이드의 코드 확인일·기준 커밋·근거 링크를 갱신한다. 비밀값과 실제 개인 데이터는 넣지 않는다.

## 이후 문서 추가·수정

1. 완성한 HTML을 `docs/site/<문서명>.html`에 복사한다. 이미지 등 외부 파일이 필요하면 같은 폴더 아래에 함께 둔다.
2. `docs/site/index.html`에 상대 경로 링크를 추가한다.
3. PR에서 `docs-pages`의 파일 검사가 통과했는지 확인한다.
4. `main`에 머지하면 자동 배포된다. 삭제한 파일도 다음 배포부터 제공되지 않는다.

PR은 홈·가이드·공통 스타일·대표 문서의 존재를 검사하고 배포용 artifact를 만든다. 공개 사이트 배포는 `main`의 push 또는 수동 실행에서만 한다. HTML 렌더링·모든 링크 검증은 수행하지 않으므로 Archify 문서는 생성 시 `finalize`를 통과한 결과물을 복사한다.

현재 `.archify/`의 초안·검증 기록과 `docs/`의 나머지 Markdown은 게시하지 않는다. 이 워크플로는 정적 파일을 그대로 올리므로 Markdown을 웹페이지로 변환하지 않는다. 공개할 최종 파일만 `docs/site/`에 넣는다.

## 게시 경로 변경

`.github/workflows/docs-pages.yml`에서 아래 세 곳을 함께 수정한다.

- `push.paths`와 `pull_request.paths`의 `docs/site/**`
- `Check published documents` 단계의 검사 경로
- `upload-pages-artifact`의 `path`

## 로컬 확인

저장소 루트에서 실행한 뒤 `http://localhost:8000`으로 접속한다.

```bash
python3 -m http.server 8000 --directory docs/site
```

## 참고

- [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
