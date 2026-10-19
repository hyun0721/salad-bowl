# Plan 04c — 그룹 화면·초대·PWA·Pages 프록시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹앱의 남은 화면(그룹 대시보드, 그룹 관리, 초대 수락, 그룹 없음 안내)을 실제 API에 연결하고, PWA 설치와 Cloudflare Pages Functions 프록시를 더해 배포(Plan 05) 직전 상태로 만든다. 04a·04b 후속 과제 중 04c로 넘긴 항목도 함께 처리한다.

**Architecture:** 기능별 폴더를 둔다.
- `dashboard`: 그룹 월간 요약 API와 대시보드 화면
- `groups`: 그룹 관리 API·변경 훅·화면 조각(내 그룹, 설정, 멤버, 초대 링크, 차단 목록)
- `invite`: 초대 수락 화면
- `proxy` + `functions`: Pages Functions가 `/api/*`를 Render API로 넘기는 코드

서버 데이터는 TanStack Query로 가져오고 쿼리 키 규칙(Global Constraints)을 따른다. 그룹 범위 쿼리가 404이면(추방·탈퇴로 더 이상 멤버가 아님) 그룹 목록을 다시 불러온다.

**Tech Stack:** React 19.3, react-router 8.4, TanStack Query 5, Vite 8, Vitest 4(jsdom), MSW 2, TypeScript 6, oxlint, vite-plugin-pwa 2.0. API는 Spring Boot 4.1.1이다.

**선행 조건:** Plan 04b(PR hyun0721/salad-bowl#6)가 머지되어 있다. `main`에서 `feat/plan-04c-groups-invite-pwa` 브랜치를 딴다.

## 설계 결정

| 항목 | 결정 |
|---|---|
| 그룹에서 빠졌을 때 | API는 멤버가 아닌 회원의 그룹 조회에 **404**를 준다(403 `REMOVED_FROM_GROUP`은 차단된 회원의 초대 미리보기·수락에만 쓴다). 그룹 범위 쿼리(`['groups', id]`, `['summary', …]`, `['bans', …]`, `['transactions', 'group', …]`)가 404이면 QueryCache에서 `['groups']`를 무효화한다. 목록에서 그 그룹이 빠지면 `GroupProvider`가 다른 그룹을 고른다 |
| 대시보드 막대 | inline style을 쓰지 않기 위해 `<meter>`로 카테고리 비율을 그린다 |
| 월 선택 | `MonthPicker`(이전 달·다음 달 버튼 + `type="month"` 입력)를 대시보드와 거래 목록에서 함께 쓴다. `type="month"`를 글자 칸으로 보여주는 브라우저(Firefox, 데스크톱 Safari)에서 덜 입력된 값은 반영하지 않고 형식을 안내한다 |
| 위험한 작업 | 멤버 내보내기, 그룹 나가기는 화면 안에서 한 번 더 확인한다(`confirm()`는 쓰지 않는다) |
| 초대 링크 | 주소는 `${window.location.origin}/invite/${token}`. 복사는 `navigator.clipboard.writeText`, 실패하면 주소 칸을 직접 복사하도록 안내한다 |
| 초대 수락 후 | 선택 그룹을 저장소(`saladbowl.selectedGroupId`)에 기록하고 `['groups']`를 무효화한 뒤 대시보드로 간다. 초대 화면은 `GroupProvider` 밖이라 저장소를 직접 쓴다 |
| 로그인 탭 | `aria-pressed` 버튼으로 바꾸면 "로그인" 탭과 "로그인" 제출 버튼의 이름이 겹친다. 탭 패턴을 완성한다(`tabpanel`, 화살표·Home·End 키, roving tabindex) |
| 세션 복원 실패 | 재시도 후에도 일시적 실패(5xx, 네트워크, JSON이 아닌 응답)면 `unavailable` 상태로 "서버에 연결하지 못했습니다 + 다시 시도"를 보여준다. 4xx면 로그아웃 상태다 |
| 회원가입 부분 실패 | 가입은 됐는데 이어진 로그인이 실패하면 `SignupLoginError`를 던진다. 로그인 화면은 로그인 탭으로 바꾸고 "가입은 완료되었습니다. 로그인해 주세요."를 보여준다 |
| 프록시 응답 | JSON이 아닌 5xx(Pages·Render의 HTML 502·524)는 `SERVER_UNAVAILABLE`, JSON이 아닌 성공 응답(Function 경로가 빗나가 SPA가 HTML을 돌려준 경우)은 `REQUEST_FAILED` `ApiError`로 바꾼다 |
| PWA | vite-plugin-pwa(generateSW). 앱 셸만 precache하고 `/api/*`는 캐시·폴백하지 않는다. 오프라인 기능은 없다. 아이콘은 임시 로고 SVG에서 만든다(정식 로고는 [잔여 작업](../../backlog.md)) |
| Pages 프록시 | `functions/api/[[path]].ts`가 `proxy/forward.ts`를 부른다. `/api` 접두어를 떼고 환경변수 `API_ORIGIN`(Render 주소)으로 보낸다. 메서드·헤더(쿠키 포함)·본문을 넘기고 응답(Set-Cookie 포함)을 그대로 돌려준다. API에 닿지 못하면 502 `{code: 'SERVER_UNAVAILABLE'}` |

## Global Constraints

- 웹앱은 `apps/web`. 새 패키지는 Task 10의 `vite-plugin-pwa@2.0.0`(devDependency)만 설치한다. 로컬 Node 23에서는 `npm install --legacy-peer-deps`. 아이콘 생성기 `@vite-pwa/assets-generator@2.0.0`은 `npx`로 한 번만 실행하고 설치하지 않는다.
- API 주소는 `apiFetch`(`src/api/client.ts`)만 쓴다. 직접 `fetch`하지 않는다(프록시 코드 `proxy/`, `functions/`는 예외).
- **쿼리 키 규칙**(무효화에 쓴다):
  - `['groups']`(내 그룹 목록), `['groups', groupId]`(그룹 상세)
  - `['summary', groupId, month]`, `['bans', groupId]`, `['invite', token]`
  - `['coverage', year]`, `['imports']`, `['transactions', 'mine', month]`, `['transactions', 'group', groupId, month, memberId]`, `['audits', transactionId]`
- **로딩·오류**: 데이터가 아직 없음은 `isPending`으로 판단한다. 실패는 `isError`로 오류 문구와 `refetch`하는 재시도 버튼을 보여준다. 한 화면에 재시도 버튼이 여럿이면 이름을 다르게 한다(예: "그룹 정보 다시 시도"). 계획의 화면 코드와 이 규칙이 다르면 이 규칙을 따른다.
- **스타일**
  - 색·간격·모서리·글자는 `src/styles/tokens.css`의 CSS 변수를 쓴다.
  - 컴포넌트 스타일은 CSS Modules로 쓰고, 공용 클래스는 `src/common/ui.module.css`에 둔다. inline style은 쓰지 않는다.
- **문구**: 한국어, 합니다체. 이모지는 쓰지 않는다. 아이콘은 인라인 SVG(`currentColor`, 장식용은 `aria-hidden="true"`)로 그린다.
- **접근성**
  - 실제 `<button>`, `<a>`, `<label>`+`<input>`을 쓴다. 누르는 영역은 40px 이상, 주요 버튼은 44px 이상이다.
  - 화면마다 `usePageTitle`로 `document.title`을 정한다.
- **금액·날짜 표기**: `src/common/format.ts`만 쓴다. 합계는 `formatWon`(부호 없음). 시각(`expiresAt`, `joinedAt`, `bannedAt`처럼 오프셋이 있는 값)은 `formatInstant`로 보여준다.
- **테스트**
  - 화면 테스트는 `src/test/renderPage.tsx`의 `renderPage`를 쓴다(로그인 상태, Query, Group, Router 포함). 전체 라우팅이 필요하면 `src/app/AppRoutes.test.tsx`의 `renderApp`을 쓴다.
  - MSW 핸들러 URL은 `*/api/...` 형식이다. `type="month"` 입력은 `fireEvent.change`로 바꾼다.
  - `GroupProvider`가 고른 그룹이 테스트 사이에 남지 않게, 그룹을 고르는 테스트 파일은 `beforeEach`에서 `localStorage`를 비운다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>`

## API 계약 (이미 있음)

| 호출 | 응답 |
|---|---|
| `GET /groups` | `[{groupId, name, myRole: 'ADMIN'|'MEMBER', memberCount}]` |
| `POST /groups` `{name}`(1~50자) | `201 {groupId, name, myRole, memberCount}` |
| `GET /groups/{id}` | `{groupId, name, myRole, members: [{userId, nickname, role, shareEnabled, joinedAt}]}` · 멤버가 아니면 `404 NOT_FOUND` |
| `PATCH /groups/{id}` `{name}` | `GroupDetail` · 관리자만(`403 FORBIDDEN`) |
| `PUT /groups/{id}/share` `{enabled}` | `{shareEnabled}` (내 공개 설정) |
| `DELETE /groups/{id}/members/me` | `204` · 관리자는 `409 ADMIN_CANNOT_LEAVE` |
| `DELETE /groups/{id}/members/{userId}` | `204`(내보낸 회원은 차단된다) · 관리자만 · 관리자를 내보내면 `409 CANNOT_REMOVE_ADMIN` |
| `GET /groups/{id}/bans` | `[{userId, nickname, bannedAt}]` · 관리자만 |
| `DELETE /groups/{id}/bans/{userId}` | `204` · 관리자만 |
| `POST /groups/{id}/invites` | `201 {token, expiresAt}`(7일) · 관리자만 |
| `GET /invites/{token}` | `{groupName, memberCount, maxMembers, expiresAt, alreadyMember}` · `404 INVITE_NOT_FOUND`, `410 INVITE_EXPIRED`, `403 REMOVED_FROM_GROUP` |
| `POST /invites/{token}/accept` | `{groupId}` · 위 오류 + `409 ALREADY_MEMBER`, `409 GROUP_FULL` |
| `GET /groups/{id}/summary?month=YYYY-MM` | `{month, income, expense, byCategory: [{category, expense}], byMember: [{userId, nickname, income, expense}]}` — KRW만, 이체·숨긴 거래 제외, 공개를 끈 멤버 제외, 지출은 양수 |

합류한 멤버의 공개 설정 기본값은 켜짐(`shareEnabled = true`)이다. 그룹 최대 인원은 6명이다.

---

### Task 1: 월 파라미터 범위 검증 (API)

`month`가 0000-01이면 그대로 조회되고, `+999999999-12`처럼 큰 값은 `plusMonths`가 넘쳐 500이 된다. 04b에서 `year`에 넣은 규칙(1..9999)을 `month`에도 적용한다. `monthRange`는 내 거래·그룹 거래·그룹 요약이 함께 쓰므로 한 곳에서 검사한다.

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java` (`monthRange`, 약 48행)
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/TransactionQueryApiTest.java`

**Interfaces:**
- Produces: `TransactionService.monthRange(YearMonth)`가 연도 1..9999 밖이면 `ApiException(VALIDATION_FAILED, "month must be between 0001-01 and 9999-12")`

- [ ] **Step 1: 실패하는 테스트 작성** — `monthIsRequiredAndValidated` 아래에 추가한다.

```java
    @Test
    void monthOutsideSupportedRangeIsRejected() throws Exception {
        for (String month : new String[] {"0000-01", "+999999999-12"}) {
            mvc.perform(get("/me/transactions").param("month", month).header("Authorization", member.bearer()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        mvc.perform(get("/groups/" + groupId + "/summary").param("month", "0000-01")
                        .header("Authorization", member.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*TransactionQueryApiTest'`
Expected: FAIL — `0000-01`은 200, `+999999999-12`는 500이다.

- [ ] **Step 3: 구현** — `monthRange`를 바꾼다(`ApiException`, `ErrorCode`는 이미 import되어 있다).

```java
    public static Range monthRange(YearMonth month) {
        if (month.getYear() < 1 || month.getYear() > 9999) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "month must be between 0001-01 and 9999-12");
        }
        return new Range(month.atDay(1).atStartOfDay(), month.plusMonths(1).atDay(1).atStartOfDay());
    }
```

- [ ] **Step 4: 통과 확인** — 같은 명령으로 PASS, 이어서 `./gradlew test` 전체가 통과하는지 본다.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java apps/api/src/test/java/com/saladbowl/api/transaction/TransactionQueryApiTest.java
git commit -m "fix(api): validate month range for transaction and summary queries"
```

---

### Task 2: 응답 처리 보강 (프록시 오류 응답, 오류 문구, 그룹에서 빠졌을 때)

**Files:**
- Modify: `apps/web/src/api/client.ts` (`refreshAccessToken`, `apiFetch`, `toError`)
- Modify: `apps/web/src/api/client.test.ts`
- Modify: `apps/web/src/common/errorMessage.ts`, `apps/web/src/common/errorMessage.test.ts`
- Modify: `apps/web/src/api/queryClient.ts`, `apps/web/src/api/queryClient.test.ts`

**Interfaces:**
- Produces:
  - `ApiError` 코드 `SERVER_UNAVAILABLE`(JSON이 아닌 5xx)
  - `errorMessage`의 새 코드: `SERVER_UNAVAILABLE`, `INVITE_NOT_FOUND`, `INVITE_EXPIRED`, `ALREADY_MEMBER`, `GROUP_FULL`, `REMOVED_FROM_GROUP`, `CANNOT_REMOVE_ADMIN`, `ADMIN_CANNOT_LEAVE`
  - `isGroupScopedKey(key: readonly unknown[]): boolean` (`api/queryClient.ts`)
  - `createQueryClient()`가 그룹 범위 쿼리의 404에서 `['groups']`(exact)를 무효화한다

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/api/client.test.ts`의 `describe` 안에 추가한다(파일 상단 import에 `refreshAccessToken`이 없으면 더한다).

```ts
  it('reports an HTML 5xx from the proxy as SERVER_UNAVAILABLE', async () => {
    server.use(http.get('*/api/me', () =>
      new HttpResponse('<html>502 Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } })))

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 502, code: 'SERVER_UNAVAILABLE' })
  })

  it('keeps the JSON error code of a 5xx from the API', async () => {
    server.use(http.get('*/api/me', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'boom' }, { status: 500 })))

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 500, code: 'INTERNAL_ERROR' })
  })

  it('turns a non-JSON success (SPA fallback) into an ApiError', async () => {
    server.use(http.get('*/api/me', () =>
      new HttpResponse('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })))

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 200, code: 'REQUEST_FAILED' })
  })

  it('rejects a non-JSON refresh success as a transient error and keeps the token', async () => {
    setAccessToken('old')
    server.use(http.post('*/api/auth/refresh', () =>
      new HttpResponse('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })))

    await expect(refreshAccessToken()).rejects.toMatchObject({ code: 'REQUEST_FAILED' })
    expect(getAccessToken()).toBe('old')
  })
```

`apps/web/src/common/errorMessage.test.ts`에 추가한다.

```ts
  it('maps group and invite codes', () => {
    expect(errorMessage(new ApiError(410, 'INVITE_EXPIRED', 'x'))).toBe('초대 링크가 만료되었습니다. 관리자에게 새 링크를 요청해 주세요.')
    expect(errorMessage(new ApiError(409, 'GROUP_FULL', 'x'))).toBe('그룹 정원(6명)이 찼습니다.')
    expect(errorMessage(new ApiError(502, 'SERVER_UNAVAILABLE', 'x'))).toBe('서버를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.')
  })
```

`apps/web/src/api/queryClient.test.ts`에 추가한다(상단 import에 `isGroupScopedKey`를 더한다).

```ts
describe('isGroupScopedKey', () => {
  it('matches queries that belong to one group', () => {
    expect(isGroupScopedKey(['groups', 10])).toBe(true)
    expect(isGroupScopedKey(['summary', 10, '2026-10'])).toBe(true)
    expect(isGroupScopedKey(['bans', 10])).toBe(true)
    expect(isGroupScopedKey(['transactions', 'group', 10, '2026-10', null])).toBe(true)
    expect(isGroupScopedKey(['groups'])).toBe(false)
    expect(isGroupScopedKey(['transactions', 'mine', '2026-10'])).toBe(false)
  })
})

describe('createQueryClient', () => {
  it('refreshes the group list when a group query answers 404', async () => {
    const client = createQueryClient()
    client.setQueryData(['groups'], [{ groupId: 10, name: '우리집', myRole: 'MEMBER', memberCount: 2 }])

    await client.prefetchQuery({
      queryKey: ['summary', 10, '2026-10'],
      queryFn: () => Promise.reject(new ApiError(404, 'NOT_FOUND', 'group not found')),
    })

    expect(client.getQueryState(['groups'])?.isInvalidated).toBe(true)
  })

  it('leaves the group list alone for other errors', async () => {
    const client = createQueryClient()
    client.setQueryData(['groups'], [])

    await client.prefetchQuery({
      queryKey: ['transactions', 'mine', '2026-10'],
      queryFn: () => Promise.reject(new ApiError(404, 'NOT_FOUND', 'x')),
    })

    expect(client.getQueryState(['groups'])?.isInvalidated).toBe(false)
  })
})
```

`ApiError` import(`./errors`)가 없으면 더한다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/api src/common/errorMessage.test.ts`
Expected: FAIL — HTML 502는 `REQUEST_FAILED`, 200 HTML은 `SyntaxError`, `isGroupScopedKey`가 없음, 문구 없음.

- [ ] **Step 3: 구현**

`apps/web/src/api/client.ts` — JSON 읽기를 한 함수로 모으고 `toError`가 응답 형식을 본다.

```ts
const FAILED_MESSAGE = '요청을 처리하지 못했습니다.'

/** 성공 응답의 JSON. JSON이 아니면(프록시 경로가 빗나가 SPA가 HTML을 돌려준 경우 등) ApiError로 바꾼다. */
async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError(res.status, 'REQUEST_FAILED', FAILED_MESSAGE)
  }
}

async function toError(res: Response): Promise<ApiError> {
  const isJson = res.headers.get('content-type')?.includes('json') ?? false
  if (isJson) {
    try {
      const body = (await res.json()) as { code?: string; message?: string }
      return new ApiError(res.status, body.code ?? 'REQUEST_FAILED', body.message ?? FAILED_MESSAGE)
    } catch {
      // 본문이 깨졌으면 아래 규칙으로 판단한다.
    }
  }
  // Pages·Render가 돌려주는 HTML 502·503·524 등: API가 응답하지 못한 것이다.
  if (res.status >= 500) return new ApiError(res.status, 'SERVER_UNAVAILABLE', '서버를 사용할 수 없습니다.')
  return new ApiError(res.status, 'REQUEST_FAILED', FAILED_MESSAGE)
}
```

- `refreshAccessToken`의 `const body = (await res.json()) as { accessToken?: unknown }`를 `const body = await readJson<{ accessToken?: unknown }>(res)`로 바꾼다. 같은 함수의 `'요청을 처리하지 못했습니다.'` 리터럴은 `FAILED_MESSAGE`로 바꾼다.
- `apiFetch`의 마지막 줄 `return (await res.json()) as T`를 `return readJson<T>(res)`로 바꾼다.
- 기존 `toError`는 위 코드로 바꾼다.

`apps/web/src/common/errorMessage.ts`의 `MESSAGES`에 추가한다.

```ts
  SERVER_UNAVAILABLE: '서버를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  INVITE_NOT_FOUND: '초대 링크를 찾을 수 없습니다. 주소를 다시 확인해 주세요.',
  INVITE_EXPIRED: '초대 링크가 만료되었습니다. 관리자에게 새 링크를 요청해 주세요.',
  ALREADY_MEMBER: '이미 이 그룹의 멤버입니다.',
  GROUP_FULL: '그룹 정원(6명)이 찼습니다.',
  REMOVED_FROM_GROUP: '이 그룹에서 내보내져 다시 합류할 수 없습니다. 관리자에게 문의해 주세요.',
  CANNOT_REMOVE_ADMIN: '관리자는 내보낼 수 없습니다.',
  ADMIN_CANNOT_LEAVE: '관리자는 그룹을 나갈 수 없습니다.',
```

`apps/web/src/api/queryClient.ts`를 바꾼다.

```ts
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

/** 4xx는 다시 보내도 같은 결과라 재시도하지 않는다. 서버·네트워크 오류는 한 번만 다시 시도한다. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

/** 그룹 하나에 속한 쿼리인지. 이런 쿼리의 404는 "더 이상 그 그룹의 멤버가 아님"이다. */
export function isGroupScopedKey(key: readonly unknown[]): boolean {
  const [head, second] = key
  if (head === 'groups') return key.length > 1
  if (head === 'transactions') return second === 'group'
  return head === 'summary' || head === 'bans'
}

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 추방·탈퇴로 그룹에서 빠지면 목록을 다시 받아 헤더와 선택 그룹을 바로잡는다.
        if (error instanceof ApiError && error.status === 404 && isGroupScopedKey(query.queryKey)) {
          void client.invalidateQueries({ queryKey: ['groups'], exact: true })
        }
      },
    }),
    defaultOptions: { queries: { retry: shouldRetry, refetchOnWindowFocus: false } },
  })
  return client
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/api src/common/errorMessage.test.ts`
Expected: PASS. 이어서 `npm test`(기존 테스트 중 JSON이 아닌 5xx에 `REQUEST_FAILED`를 기대하던 것이 있으면 `SERVER_UNAVAILABLE`로 맞춘다), `npm run typecheck`, `npm run lint`.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/api apps/web/src/common/errorMessage.ts apps/web/src/common/errorMessage.test.ts
git commit -m "feat(web): map proxy HTML errors, add group and invite messages, refresh groups on 404"
```

---

### Task 3: 월 선택 컴포넌트 (`MonthPicker`)와 거래 목록 적용

**Files:**
- Modify: `apps/web/src/common/format.ts`, `apps/web/src/common/format.test.ts` (`shiftMonth`)
- Create: `apps/web/src/common/MonthPicker.tsx`, `apps/web/src/common/MonthPicker.module.css`, `apps/web/src/common/MonthPicker.test.tsx`
- Create: `apps/web/src/common/icons.tsx` (`ChevronLeft`, `ChevronRight`)
- Modify: `apps/web/src/transactions/TransactionsPage.tsx`, `apps/web/src/transactions/TransactionsPage.test.tsx`

**Interfaces:**
- Produces:
  - `shiftMonth(month: string, delta: number): string` — `'2026-01', -1` → `'2025-12'`
  - `MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void })` — 버튼 이름 "이전 달"·"다음 달", 입력 라벨 "월"
  - `ChevronLeft`, `ChevronRight` — 16px 장식용 SVG(`aria-hidden="true"`)

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/format.test.ts`에 추가한다(import에 `shiftMonth`를 더한다).

```ts
  it('shifts a YYYY-MM month across years', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
```

`apps/web/src/common/MonthPicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MonthPicker from './MonthPicker'

describe('MonthPicker', () => {
  it('moves one month back and forth', async () => {
    const onChange = vi.fn()
    render(<MonthPicker month="2026-12" onChange={onChange} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await user.click(screen.getByRole('button', { name: '다음 달' }))

    expect(onChange.mock.calls).toEqual([['2026-11'], ['2027-01']])
  })

  it('reports a complete month typed into the input', () => {
    const onChange = vi.fn()
    render(<MonthPicker month="2026-10" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('월'), { target: { value: '2026-03' } })

    expect(onChange).toHaveBeenCalledWith('2026-03')
  })

  it('ignores an incomplete value and shows the expected format', () => {
    const onChange = vi.fn()
    render(<MonthPicker month="2026-10" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('월'), { target: { value: '' } })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('2026-10처럼 연도와 월을 입력해 주세요.')).toBeInTheDocument()
    expect(screen.getByLabelText('월')).toHaveAttribute('aria-invalid', 'true')
  })

  it('follows a month changed by the parent', () => {
    const { rerender } = render(<MonthPicker month="2026-10" onChange={() => {}} />)

    rerender(<MonthPicker month="2025-01" onChange={() => {}} />)

    expect(screen.getByLabelText('월')).toHaveValue('2025-01')
  })
})
```

`apps/web/src/transactions/TransactionsPage.test.tsx`의 `describe` 안에 추가한다(`waitFor` import가 없으면 더한다).

```tsx
  it('moves to the previous month with the month buttons', async () => {
    const months: string[] = []
    server.use(http.get('*/api/me/transactions', ({ request }) => {
      months.push(new URL(request.url).searchParams.get('month')!)
      return HttpResponse.json([])
    }))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await screen.findByText('이 달에 거래가 없습니다.')
    await user.click(screen.getByRole('button', { name: '이전 달' }))

    await waitFor(() => expect(months).toContain('2026-09'))
    expect(screen.getByLabelText('월')).toHaveValue('2026-09')
  })
```

(`groups`는 이 파일에 이미 있는 그룹 목록 상수다. 없으면 `[]`를 넘긴다.)

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common src/transactions/TransactionsPage.test.tsx`
Expected: FAIL — `shiftMonth`, `MonthPicker`, "이전 달" 버튼이 없음.

- [ ] **Step 3: 구현**

`apps/web/src/common/format.ts`에 추가한다.

```ts
/** `YYYY-MM`을 delta개월 옮긴다. */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const index = year * 12 + (m - 1) + delta
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}
```

`apps/web/src/common/icons.tsx`:

```tsx
// 장식용 라인 아이콘. 색은 글자색(currentColor)을 따르고, 이름은 버튼의 aria-label이 맡는다.
export function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
```

`apps/web/src/common/MonthPicker.tsx`:

```tsx
import { useId, useState } from 'react'
import { shiftMonth } from './format'
import { ChevronLeft, ChevronRight } from './icons'
import styles from './MonthPicker.module.css'
import ui from './ui.module.css'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

type Props = { month: string; onChange: (month: string) => void }

/**
 * 이전·다음 달 버튼과 월 입력. 완전한 `YYYY-MM`일 때만 onChange를 부른다.
 * type="month"를 글자 칸으로 보여주는 브라우저에서 덜 입력된 값으로 조회하지 않기 위해서다.
 */
export default function MonthPicker({ month, onChange }: Props) {
  const hintId = useId()
  const [draft, setDraft] = useState(month)
  const [shown, setShown] = useState(month)
  if (shown !== month) {
    // 부모가 월을 바꾸면(버튼, 수동 추가 후 이동 등) 입력도 따라간다.
    setShown(month)
    setDraft(month)
  }
  const valid = MONTH.test(draft)

  return (
    <div className={styles.picker}>
      <button type="button" className={`${ui.button} ${styles.step}`} aria-label="이전 달"
        onClick={() => onChange(shiftMonth(month, -1))}><ChevronLeft /></button>
      <label className={styles.field}>
        <span>월</span>
        <input type="month" className={ui.input} value={draft} aria-invalid={!valid}
          aria-describedby={valid ? undefined : hintId}
          onChange={(e) => {
            setDraft(e.target.value)
            if (MONTH.test(e.target.value)) onChange(e.target.value)
          }} />
      </label>
      <button type="button" className={`${ui.button} ${styles.step}`} aria-label="다음 달"
        onClick={() => onChange(shiftMonth(month, 1))}><ChevronRight /></button>
      {!valid && <p id={hintId} className={`${ui.muted} ${styles.hint}`}>2026-10처럼 연도와 월을 입력해 주세요.</p>}
    </div>
  )
}
```

`apps/web/src/common/MonthPicker.module.css`:

```css
.picker { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.step { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; padding: 0; }
.field { display: flex; align-items: center; gap: var(--space-2); }
.field > span { font-size: 13px; color: var(--ink-muted); }
.hint { margin: 0; width: 100%; }
```

`apps/web/src/transactions/TransactionsPage.tsx`:
- import에 `import MonthPicker from '../common/MonthPicker'`를 더한다.
- 월 입력 `<label className={styles.inlineField}><span>월</span><input type="month" … /></label>`을 `<MonthPicker month={month} onChange={setMonth} />`로 바꾼다.
- `useQuery`의 `enabled: /^\d{4}-\d{2}$/.test(month),` 줄을 지운다(`MonthPicker`는 완전한 값만 넘긴다).
- 범위 버튼의 눌림 상태를 실제 조회 범위로 계산한다. 그룹 거래를 보다가 선택 그룹이 없어지면 데이터는 내 거래로 바뀌므로 버튼도 따라가야 한다.

```tsx
          <button type="button" aria-pressed={!inGroup} className={styles.scopeButton}
            onClick={() => changeScope('mine')}>내 거래</button>
          <button type="button" aria-pressed={inGroup} className={styles.scopeButton}
            disabled={selectedGroupId === null} onClick={() => changeScope('group')}>그룹 거래</button>
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/common src/transactions`
Expected: PASS(기존 거래 목록 테스트의 `fireEvent.change(screen.getByLabelText('월'), …)`도 그대로 통과한다). 이어서 `npm run typecheck && npm run lint`.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/common apps/web/src/transactions
git commit -m "feat(web): month picker with previous and next month buttons"
```

---

### Task 4: 그룹 대시보드와 그룹 없음 안내

**Files:**
- Create: `apps/web/src/dashboard/dashboardApi.ts`
- Create: `apps/web/src/dashboard/DashboardPage.tsx`, `apps/web/src/dashboard/DashboardPage.module.css`, `apps/web/src/dashboard/DashboardPage.test.tsx`
- Create: `apps/web/src/groups/NoGroupNotice.tsx`
- Modify: `apps/web/src/common/ui.module.css` (`linkButton`)
- Modify: `apps/web/src/app/AppRoutes.tsx` (`dashboard` 경로)

**Interfaces:**
- Consumes: `MonthPicker`(Task 3), `useGroups()`, `formatWon`, `formatMonthLabel`, `currentYearMonth`
- Produces:
  - `type MonthlySummary = { month: string; income: number; expense: number; byCategory: { category: string; expense: number }[]; byMember: { userId: number; nickname: string; income: number; expense: number }[] }`
  - `dashboardApi.summary(groupId: number, month: string): Promise<MonthlySummary>`
  - `NoGroupNotice()` — 그룹이 없을 때의 안내 카드(제목 "아직 속한 그룹이 없습니다", 링크 "그룹 만들기" → `/groups`)
  - `ui.linkButton` — 링크를 버튼 모양으로 보여주는 공용 클래스(`ui.button`과 함께 쓴다)
  - `DashboardPage({ today?: Date })`

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/src/dashboard/DashboardPage.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import DashboardPage from './DashboardPage'

const today = new Date(2026, 9, 19) // 기본 월은 2026-10
const group = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const summary = {
  month: '2026-10',
  income: 3000000,
  expense: 250000,
  byCategory: [{ category: '식비', expense: 200000 }, { category: '교통', expense: 50000 }],
  byMember: [
    { userId: 1, nickname: '나', income: 3000000, expense: 150000 },
    { userId: 2, nickname: '짝꿍', income: 0, expense: 100000 },
  ],
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('DashboardPage', () => {
  it('shows the selected group summary for this month', async () => {
    const months: string[] = []
    server.use(http.get('*/api/groups/10/summary', ({ request }) => {
      months.push(new URL(request.url).searchParams.get('month')!)
      return HttpResponse.json(summary)
    }))
    renderPage(<DashboardPage today={today} />, { groups: [group] })

    const income = await screen.findByRole('region', { name: '수입' })
    expect(await within(income).findByText('₩ 3,000,000')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '지출' })).getByText('₩ 250,000')).toBeInTheDocument()
    const categories = screen.getByRole('region', { name: '카테고리별 지출' })
    expect(within(categories).getByText('식비')).toBeInTheDocument()
    expect(within(categories).getByText('₩ 200,000')).toBeInTheDocument()
    const members = screen.getByRole('region', { name: '멤버별' })
    expect(within(members).getByRole('row', { name: /짝꿍/ })).toHaveTextContent('₩ 100,000')
    expect(months).toEqual(['2026-10'])
  })

  it('loads the previous month', async () => {
    const months: string[] = []
    server.use(http.get('*/api/groups/10/summary', ({ request }) => {
      const month = new URL(request.url).searchParams.get('month')!
      months.push(month)
      return HttpResponse.json({ ...summary, month })
    }))
    const { user } = renderPage(<DashboardPage today={today} />, { groups: [group] })

    await screen.findByRole('region', { name: '수입' })
    await user.click(screen.getByRole('button', { name: '이전 달' }))

    await waitFor(() => expect(months).toContain('2026-09'))
  })

  it('says so when nothing was shared this month', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(
      { month: '2026-10', income: 0, expense: 0, byCategory: [], byMember: [] })))
    renderPage(<DashboardPage today={today} />, { groups: [group] })

    expect(await screen.findByText('이 달에 합칠 거래가 없습니다.')).toBeInTheDocument()
    expect(screen.getByText('공개한 멤버가 없습니다.')).toBeInTheDocument()
  })

  it('retries a failed summary', async () => {
    let fail = true
    server.use(http.get('*/api/groups/10/summary', () => (fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json(summary))))
    const { user } = renderPage(<DashboardPage today={today} />, { groups: [group] })

    expect(await screen.findByText('요약을 불러오지 못했습니다.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('region', { name: '수입' })).toBeInTheDocument()
  })

  it('guides people without a group', async () => {
    renderPage(<DashboardPage today={today} />, { groups: [] })

    expect(await screen.findByRole('heading', { name: '아직 속한 그룹이 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '그룹 만들기' })).toHaveAttribute('href', '/groups')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/dashboard`
Expected: FAIL — `./DashboardPage`를 찾지 못함.

- [ ] **Step 3: 구현**

`apps/web/src/dashboard/dashboardApi.ts`:

```ts
import { apiFetch } from '../api/client'

export type CategoryTotal = { category: string; expense: number }
export type MemberTotal = { userId: number; nickname: string; income: number; expense: number }
/** KRW만, 이체·숨긴 거래·공개를 끈 멤버 제외. 지출은 양수다. */
export type MonthlySummary = {
  month: string
  income: number
  expense: number
  byCategory: CategoryTotal[]
  byMember: MemberTotal[]
}

export const dashboardApi = {
  summary: (groupId: number, month: string) =>
    apiFetch<MonthlySummary>(`/groups/${groupId}/summary?month=${month}`),
}
```

`apps/web/src/common/ui.module.css`에 추가한다.

```css
.linkButton { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
```

`apps/web/src/groups/NoGroupNotice.tsx`:

```tsx
import { Link } from 'react-router'
import ui from '../common/ui.module.css'

/** 속한 그룹이 없을 때. 그룹이 없어도 내 가계부·업로드·내 거래는 쓸 수 있다. */
export default function NoGroupNotice() {
  return (
    <section aria-labelledby="no-group-title" className={ui.card}>
      <h2 id="no-group-title">아직 속한 그룹이 없습니다</h2>
      <p className={ui.status}>
        그룹을 만들어 초대 링크로 가족·친구를 부르거나, 받은 초대 링크를 열어 합류합니다.
        그룹이 없어도 내 가계부·업로드·내 거래는 그대로 쓸 수 있습니다.
      </p>
      <div className={ui.row}>
        <Link to="/groups" className={`${ui.button} ${ui.primary} ${ui.linkButton}`}>그룹 만들기</Link>
        <Link to="/" className={`${ui.button} ${ui.linkButton}`}>내 가계부로</Link>
      </div>
    </section>
  )
}
```

`apps/web/src/dashboard/DashboardPage.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import MonthPicker from '../common/MonthPicker'
import ui from '../common/ui.module.css'
import { currentYearMonth, formatMonthLabel, formatWon } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import NoGroupNotice from '../groups/NoGroupNotice'
import styles from './DashboardPage.module.css'
import { dashboardApi, type MonthlySummary } from './dashboardApi'

type Props = { today?: Date }

export default function DashboardPage({ today }: Props) {
  usePageTitle('그룹 대시보드')
  const { groups, selectedGroupId, isLoading, isError, retry } = useGroups()
  const [month, setMonth] = useState(() => currentYearMonth(today ?? new Date()))
  const summary = useQuery({
    queryKey: ['summary', selectedGroupId, month],
    queryFn: () => dashboardApi.summary(selectedGroupId!, month),
    enabled: selectedGroupId !== null,
  })
  const groupName = groups.find((g) => g.groupId === selectedGroupId)?.name

  if (isLoading || isError || selectedGroupId === null) {
    return (
      <>
        <h1>그룹 대시보드</h1>
        {isLoading && <p className={ui.status}>불러오는 중입니다.</p>}
        {isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>그룹을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={retry}>그룹 목록 다시 시도</button>
          </div>
        )}
        {!isLoading && !isError && <NoGroupNotice />}
      </>
    )
  }

  return (
    <>
      <div className={ui.pageHeader}>
        <h1>그룹 대시보드</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <p className={ui.muted}>
        {groupName} · {formatMonthLabel(month)} · 공개를 켠 멤버의 원화 거래를 합칩니다(이체·숨긴 거래 제외).
      </p>
      {summary.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {summary.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>요약을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void summary.refetch()}>다시 시도</button>
        </div>
      )}
      {summary.data && <SummaryView summary={summary.data} />}
    </>
  )
}

function SummaryView({ summary }: { summary: MonthlySummary }) {
  const empty = summary.income === 0 && summary.expense === 0
  return (
    <>
      <div className={styles.totals}>
        <section aria-labelledby="income-title" className={ui.card}>
          <h2 id="income-title" className={styles.totalLabel}>수입</h2>
          <p className={styles.totalValue}>{formatWon(summary.income)}</p>
        </section>
        <section aria-labelledby="expense-title" className={ui.card}>
          <h2 id="expense-title" className={styles.totalLabel}>지출</h2>
          <p className={styles.totalValue}>{formatWon(summary.expense)}</p>
        </section>
      </div>
      {empty && <p className={ui.status}>이 달에 합칠 거래가 없습니다.</p>}
      <div className={styles.columns}>
        <section aria-labelledby="category-title" className={ui.card}>
          <h2 id="category-title">카테고리별 지출</h2>
          {summary.byCategory.length === 0 ? <p className={ui.status}>지출이 없습니다.</p> : (
            <ul className={styles.bars}>
              {summary.byCategory.map((c) => (
                <li key={c.category} className={styles.bar}>
                  <span className={styles.barLabel}>{c.category}</span>
                  <meter className={styles.meter} min={0} max={summary.expense} value={c.expense}
                    aria-label={`${c.category} 지출 비율`} />
                  <span className={styles.amount}>{formatWon(c.expense)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="member-title" className={ui.card}>
          <h2 id="member-title">멤버별</h2>
          {summary.byMember.length === 0 ? <p className={ui.status}>공개한 멤버가 없습니다.</p> : (
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">멤버</th><th scope="col">수입</th><th scope="col">지출</th></tr>
              </thead>
              <tbody>
                {summary.byMember.map((m) => (
                  <tr key={m.userId}>
                    <th scope="row">{m.nickname}</th>
                    <td>{formatWon(m.income)}</td>
                    <td>{formatWon(m.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  )
}
```

`apps/web/src/dashboard/DashboardPage.module.css`:

```css
.totals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.totalLabel { margin: 0; font-size: 13px; font-weight: 500; color: var(--ink-muted); }
.totalValue { margin: 0; font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
.columns { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: var(--space-6); align-items: start; }
@media (max-width: 820px) { .columns { grid-template-columns: minmax(0, 1fr); } }
.bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.bar { display: grid; grid-template-columns: 96px minmax(0, 1fr) 120px; align-items: center; gap: var(--space-3); }
.barLabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meter { width: 100%; height: 12px; accent-color: var(--brand); }
.amount { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: var(--space-2) 0; border-bottom: 1px solid var(--line); }
.table thead th { font-size: 13px; font-weight: 500; color: var(--ink-muted); text-align: right; }
.table thead th:first-child, .table tbody th { text-align: left; font-weight: 500; }
.table td { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
```

`apps/web/src/app/AppRoutes.tsx`: `import DashboardPage from '../dashboard/DashboardPage'`를 더하고 `dashboard` 경로의 `<PagePlaceholder title="그룹 대시보드" />`를 `<DashboardPage />`로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/dashboard src/app`
Expected: PASS. 이어서 `npm run typecheck && npm run lint`.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/dashboard apps/web/src/groups/NoGroupNotice.tsx apps/web/src/common/ui.module.css apps/web/src/app/AppRoutes.tsx
git commit -m "feat(web): group dashboard with monthly totals, categories and members"
```

---

### Task 5: 그룹 관리 1 — 내 그룹, 만들기, 이름 바꾸기, 공개 설정, 나가기

**Files:**
- Modify: `apps/web/src/groups/groupsApi.ts`
- Create: `apps/web/src/groups/useGroupMutations.ts`
- Create: `apps/web/src/groups/GroupsPage.tsx`, `apps/web/src/groups/GroupsPage.module.css`, `apps/web/src/groups/GroupsPage.test.tsx`
- Create: `apps/web/src/groups/CreateGroupForm.tsx`
- Create: `apps/web/src/groups/GroupDetailSection.tsx`
- Create: `apps/web/src/groups/GroupSettings.tsx` (`RenameForm`, `ShareToggle`, `LeaveGroup`)
- Create: `apps/web/src/groups/MemberList.tsx`
- Modify: `apps/web/src/app/AppRoutes.tsx` (`groups` 경로)

**Interfaces:**
- Consumes: `useGroups()`, `useAuth().me`, `errorMessage`, `formatInstant`, `ui.*`
- Produces:
  - `groupsApi.create(name)`, `groupsApi.rename(groupId, name)`, `groupsApi.setShare(groupId, enabled)`, `groupsApi.leave(groupId)`
  - `useGroupMutations()` → `{ create, rename, setShare, leave }` (TanStack `useMutation` 결과). Task 6이 `removeMember`, `unban`, `createInvite`를 더한다
  - `GroupDetailSection({ groupId })` — 선택한 그룹의 상세 카드. Task 6이 관리자 영역을 더한다
  - `MemberList({ group }: { group: GroupDetail })` — 멤버 목록(제목 "멤버 (n/6)"). Task 6이 내보내기를 더한다
  - `GroupsPage.module.css`의 클래스: `layout`, `groupList`, `groupButton`, `groupName`, `subTitle`, `detail`, `check`, `memberList`, `member`, `memberName`, `memberActions`, `linkInput`

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/src/groups/GroupsPage.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import GroupsPage from './GroupsPage'

const home = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const friends = { groupId: 20, name: '친구들', myRole: 'MEMBER', memberCount: 2 }
const homeDetail = {
  groupId: 10, name: '우리집', myRole: 'ADMIN',
  members: [
    { userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-01T00:00:00Z' },
    { userId: 2, nickname: '짝꿍', role: 'MEMBER', shareEnabled: true, joinedAt: '2026-09-02T00:00:00Z' },
  ],
}
const friendsDetail = {
  groupId: 20, name: '친구들', myRole: 'MEMBER',
  members: [
    { userId: 3, nickname: '친구', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-03T00:00:00Z' },
    { userId: 1, nickname: '나', role: 'MEMBER', shareEnabled: false, joinedAt: '2026-09-04T00:00:00Z' },
  ],
}

/** 그룹 상세와, 관리자 화면이 부르는 차단 목록. */
function detailHandlers() {
  server.use(
    http.get('*/api/groups/10', () => HttpResponse.json(homeDetail)),
    http.get('*/api/groups/20', () => HttpResponse.json(friendsDetail)),
    http.get('*/api/groups/10/bans', () => HttpResponse.json([])),
  )
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('GroupsPage', () => {
  it('lists my groups and shows the selected group', async () => {
    detailHandlers()
    const { user } = renderPage(<GroupsPage />, { groups: [home, friends] })

    const list = await screen.findByRole('region', { name: '내 그룹' })
    expect(await within(list).findByRole('button', { name: /우리집/ })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { level: 2, name: '우리집' })).toBeInTheDocument()
    expect(screen.getByText('짝꿍')).toBeInTheDocument()

    await user.click(within(list).getByRole('button', { name: /친구들/ }))

    expect(await screen.findByRole('heading', { level: 2, name: '친구들' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /친구들/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('creates a group and selects it', async () => {
    let created = false
    let body: unknown
    const newGroup = { groupId: 30, name: '새 그룹', myRole: 'ADMIN', memberCount: 1 }
    const { user } = renderPage(<GroupsPage />, { groups: [] })
    server.use(
      http.get('*/api/groups', () => HttpResponse.json(created ? [newGroup] : [])),
      http.post('*/api/groups', async ({ request }) => {
        body = await request.json()
        created = true
        return HttpResponse.json(newGroup, { status: 201 })
      }),
      http.get('*/api/groups/30', () => HttpResponse.json({
        groupId: 30, name: '새 그룹', myRole: 'ADMIN',
        members: [{ userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-10-19T00:00:00Z' }],
      })),
      http.get('*/api/groups/30/bans', () => HttpResponse.json([])),
    )

    expect(await screen.findByText(/아직 속한 그룹이 없습니다/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('그룹 이름'), '새 그룹')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('heading', { level: 2, name: '새 그룹' })).toBeInTheDocument()
    expect(body).toEqual({ name: '새 그룹' })
  })

  it('lets the admin rename the group', async () => {
    detailHandlers()
    let body: unknown
    server.use(http.patch('*/api/groups/10', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...homeDetail, name: '우리 가족' })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    const input = await screen.findByLabelText('새 이름')
    await user.clear(input)
    await user.type(input, '우리 가족')
    await user.click(screen.getByRole('button', { name: '이름 바꾸기' }))

    expect(await screen.findByText('이름을 바꿨습니다.')).toBeInTheDocument()
    expect(body).toEqual({ name: '우리 가족' })
  })

  it('turns my sharing off for the group', async () => {
    detailHandlers()
    let body: unknown
    server.use(http.put('*/api/groups/10/share', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ shareEnabled: false })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    const toggle = await screen.findByRole('checkbox', { name: '내 거래를 이 그룹에 공개' })
    expect(toggle).toBeChecked()
    await user.click(toggle)

    await waitFor(() => expect(body).toEqual({ enabled: false }))
  })

  it('lets a member leave only after confirming', async () => {
    detailHandlers()
    let left = false
    server.use(http.delete('*/api/groups/20/members/me', () => {
      left = true
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [friends] })

    expect(await screen.findByRole('heading', { level: 2, name: '친구들' })).toBeInTheDocument()
    expect(screen.queryByLabelText('새 이름')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))
    expect(left).toBe(false)
    await user.click(screen.getByRole('button', { name: '나가기 확인' }))

    await waitFor(() => expect(left).toBe(true))
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/groups`
Expected: FAIL — `./GroupsPage`를 찾지 못함.

- [ ] **Step 3: 구현**

`apps/web/src/groups/groupsApi.ts`의 `groupsApi`에 추가한다.

```ts
  create: (name: string) => apiFetch<GroupSummary>('/groups', { method: 'POST', json: { name } }),
  rename: (groupId: number, name: string) =>
    apiFetch<GroupDetail>(`/groups/${groupId}`, { method: 'PATCH', json: { name } }),
  setShare: (groupId: number, enabled: boolean) =>
    apiFetch<{ shareEnabled: boolean }>(`/groups/${groupId}/share`, { method: 'PUT', json: { enabled } }),
  leave: (groupId: number) => apiFetch<void>(`/groups/${groupId}/members/me`, { method: 'DELETE' }),
```

`apps/web/src/groups/useGroupMutations.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGroups } from './GroupProvider'
import { groupsApi } from './groupsApi'

/** 그룹 관리 화면의 변경 요청. 성공하면 쿼리 키 규칙에 따라 관련 데이터를 다시 불러온다. */
export function useGroupMutations() {
  const queryClient = useQueryClient()
  const { selectGroup } = useGroups()
  const refreshList = () => queryClient.invalidateQueries({ queryKey: ['groups'], exact: true })

  const create = useMutation({
    mutationFn: (name: string) => groupsApi.create(name),
    onSuccess: async (group) => {
      selectGroup(group.groupId)
      await refreshList()
    },
  })
  const rename = useMutation({
    mutationFn: ({ groupId, name }: { groupId: number; name: string }) => groupsApi.rename(groupId, name),
    onSuccess: (_detail, { groupId }) => Promise.all([
      refreshList(),
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] }),
    ]),
  })
  const setShare = useMutation({
    mutationFn: ({ groupId, enabled }: { groupId: number; enabled: boolean }) => groupsApi.setShare(groupId, enabled),
    onSuccess: (_result, { groupId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] }),
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] }),
      queryClient.invalidateQueries({ queryKey: ['transactions', 'group', groupId] }),
    ]),
  })
  const leave = useMutation({
    mutationFn: (groupId: number) => groupsApi.leave(groupId),
    onSuccess: async (_result, groupId) => {
      queryClient.removeQueries({ queryKey: ['groups', groupId] })
      await refreshList()
    },
  })
  return { create, rename, setShare, leave }
}
```

`apps/web/src/groups/GroupsPage.tsx`:

```tsx
import ui from '../common/ui.module.css'
import { usePageTitle } from '../common/usePageTitle'
import CreateGroupForm from './CreateGroupForm'
import GroupDetailSection from './GroupDetailSection'
import { useGroups } from './GroupProvider'
import styles from './GroupsPage.module.css'

export default function GroupsPage() {
  usePageTitle('그룹 관리')
  const { groups, selectedGroupId, selectGroup, isLoading, isError, retry } = useGroups()

  return (
    <>
      <h1>그룹 관리</h1>
      <div className={styles.layout}>
        <section aria-labelledby="my-groups-title" className={ui.card}>
          <h2 id="my-groups-title">내 그룹</h2>
          {isLoading && <p className={ui.status}>불러오는 중입니다.</p>}
          {isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>그룹을 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} onClick={retry}>그룹 목록 다시 시도</button>
            </div>
          )}
          {!isLoading && !isError && groups.length === 0 && (
            <p className={ui.status}>아직 속한 그룹이 없습니다. 그룹을 만들거나, 받은 초대 링크를 열어 합류합니다.</p>
          )}
          {groups.length > 0 && (
            <ul className={styles.groupList}>
              {groups.map((g) => (
                <li key={g.groupId}>
                  <button type="button" aria-pressed={g.groupId === selectedGroupId} className={styles.groupButton}
                    onClick={() => selectGroup(g.groupId)}>
                    <span className={styles.groupName}>{g.name}</span>
                    <span className={ui.muted}>{g.myRole === 'ADMIN' ? '관리자' : '멤버'} · {g.memberCount}/6명</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <CreateGroupForm />
        </section>
        {selectedGroupId !== null && <GroupDetailSection key={selectedGroupId} groupId={selectedGroupId} />}
      </div>
    </>
  )
}
```

`apps/web/src/groups/CreateGroupForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

export default function CreateGroupForm() {
  const { create } = useGroupMutations()
  const [name, setName] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate(name.trim(), { onSuccess: () => setName('') })
  }

  return (
    <form className={ui.stack} aria-labelledby="create-group-title" onSubmit={onSubmit}>
      <h3 id="create-group-title" className={styles.subTitle}>새 그룹 만들기</h3>
      <label className={ui.field}>
        <span>그룹 이름</span>
        <input className={ui.input} required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit" className={`${ui.button} ${ui.primary}`}
        disabled={create.isPending || name.trim() === ''}>만들기</button>
      {create.isError && <p role="alert" className={ui.alert}>{errorMessage(create.error)}</p>}
    </form>
  )
}
```

`apps/web/src/groups/GroupSettings.tsx`:

```tsx
import { useState } from 'react'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

export function RenameForm({ groupId, name }: { groupId: number; name: string }) {
  const { rename } = useGroupMutations()
  const [value, setValue] = useState(name)
  const trimmed = value.trim()

  return (
    <form className={ui.row} onSubmit={(e) => { e.preventDefault(); rename.mutate({ groupId, name: trimmed }) }}>
      <label className={ui.field}>
        <span>새 이름</span>
        <input className={ui.input} required maxLength={50} value={value}
          onChange={(e) => { setValue(e.target.value); rename.reset() }} />
      </label>
      <button type="submit" className={ui.button}
        disabled={rename.isPending || trimmed === '' || trimmed === name}>이름 바꾸기</button>
      {rename.isSuccess && <p role="status" className={ui.status}>이름을 바꿨습니다.</p>}
      {rename.isError && <p role="alert" className={ui.alert}>{errorMessage(rename.error)}</p>}
    </form>
  )
}

export function ShareToggle({ groupId, enabled }: { groupId: number; enabled: boolean }) {
  const { setShare } = useGroupMutations()
  return (
    <div className={ui.stack}>
      <label className={styles.check}>
        <input type="checkbox" checked={enabled} disabled={setShare.isPending}
          onChange={(e) => setShare.mutate({ groupId, enabled: e.target.checked })} />
        <span>내 거래를 이 그룹에 공개</span>
      </label>
      <p className={ui.muted}>끄면 이 그룹의 대시보드와 그룹 거래에서 내 거래가 빠집니다. 숨긴 거래는 켜도 보이지 않습니다.</p>
      {setShare.isError && <p role="alert" className={ui.alert}>{errorMessage(setShare.error)}</p>}
    </div>
  )
}

export function LeaveGroup({ groupId, name }: { groupId: number; name: string }) {
  const { leave } = useGroupMutations()
  const [confirming, setConfirming] = useState(false)
  return (
    <div className={ui.stack}>
      {confirming ? (
        <div className={ui.row}>
          <p className={ui.status}>{name}에서 나가면 다시 초대받아야 합류할 수 있습니다. 나갈까요?</p>
          <button type="button" className={`${ui.button} ${ui.danger}`} disabled={leave.isPending}
            onClick={() => leave.mutate(groupId)}>나가기 확인</button>
          <button type="button" className={ui.button} onClick={() => setConfirming(false)}>취소</button>
        </div>
      ) : (
        <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setConfirming(true)}>그룹 나가기</button>
      )}
      {leave.isError && <p role="alert" className={ui.alert}>{errorMessage(leave.error)}</p>}
    </div>
  )
}
```

`apps/web/src/groups/MemberList.tsx`:

```tsx
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import type { GroupDetail } from './groupsApi'
import styles from './GroupsPage.module.css'

export default function MemberList({ group }: { group: GroupDetail }) {
  return (
    <section aria-labelledby="members-title" className={ui.stack}>
      <h3 id="members-title" className={styles.subTitle}>멤버 ({group.members.length}/6)</h3>
      <ul className={styles.memberList}>
        {group.members.map((m) => (
          <li key={m.userId} className={styles.member}>
            <span className={styles.memberName}>{m.nickname}</span>
            <span className={ui.muted}>
              {m.role === 'ADMIN' ? '관리자' : '멤버'} · {m.shareEnabled ? '공개' : '비공개'} · {formatInstant(m.joinedAt)} 합류
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

`apps/web/src/groups/GroupDetailSection.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import ui from '../common/ui.module.css'
import { LeaveGroup, RenameForm, ShareToggle } from './GroupSettings'
import { groupsApi } from './groupsApi'
import styles from './GroupsPage.module.css'
import MemberList from './MemberList'

export default function GroupDetailSection({ groupId }: { groupId: number }) {
  const { me } = useAuth()
  const detail = useQuery({ queryKey: ['groups', groupId], queryFn: () => groupsApi.detail(groupId) })

  if (detail.isPending) {
    return <section className={ui.card}><p className={ui.status}>불러오는 중입니다.</p></section>
  }
  if (detail.isError) {
    return (
      <section className={ui.card}>
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>그룹 정보를 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void detail.refetch()}>그룹 정보 다시 시도</button>
        </div>
      </section>
    )
  }

  const group = detail.data
  const isAdmin = group.myRole === 'ADMIN'
  const mine = group.members.find((m) => m.userId === me?.userId)
  return (
    <section aria-labelledby="group-detail-title" className={`${ui.card} ${styles.detail}`}>
      <h2 id="group-detail-title">{group.name}</h2>
      {isAdmin && <RenameForm groupId={groupId} name={group.name} />}
      {mine && <ShareToggle groupId={groupId} enabled={mine.shareEnabled} />}
      <MemberList group={group} />
      {!isAdmin && <LeaveGroup groupId={groupId} name={group.name} />}
    </section>
  )
}
```

`apps/web/src/groups/GroupsPage.module.css`:

```css
.layout { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(0, 2fr); gap: var(--space-6); align-items: start; }
@media (max-width: 820px) { .layout { grid-template-columns: minmax(0, 1fr); } }
.groupList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.groupButton { width: 100%; min-height: 48px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: var(--space-2) var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); color: var(--ink); text-align: left; cursor: pointer; }
.groupButton[aria-pressed="true"] { border-color: var(--brand); background: var(--brand-tint); }
.groupName { font-weight: 700; }
.subTitle { margin: 0; font-size: 15px; }
.detail { gap: var(--space-6); }
.check { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; cursor: pointer; }
.check > input { width: 20px; height: 20px; }
.memberList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.member { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--line); }
.memberName { min-width: 96px; font-weight: 500; }
.memberActions { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.linkInput { min-width: 280px; }
```

`apps/web/src/app/AppRoutes.tsx`: `import GroupsPage from '../groups/GroupsPage'`를 더하고 `groups` 경로의 `<PagePlaceholder title="그룹 관리" />`를 `<GroupsPage />`로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/groups src/app`
Expected: PASS. 이어서 `npm run typecheck && npm run lint`.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/groups apps/web/src/app/AppRoutes.tsx
git commit -m "feat(web): group management with create, rename, sharing and leave"
```

---

### Task 6: 그룹 관리 2 — 관리자: 멤버 내보내기, 초대 링크, 차단 목록

**Files:**
- Modify: `apps/web/src/groups/groupsApi.ts`, `apps/web/src/groups/useGroupMutations.ts`
- Modify: `apps/web/src/groups/MemberList.tsx`, `apps/web/src/groups/GroupDetailSection.tsx`
- Create: `apps/web/src/groups/InviteSection.tsx`, `apps/web/src/groups/BanList.tsx`
- Test: `apps/web/src/groups/GroupsAdmin.test.tsx`

**Interfaces:**
- Consumes: Task 5의 `useGroupMutations`, `MemberList`, `GroupDetailSection`, `GroupsPage.module.css`
- Produces:
  - 타입 `BanRow = { userId: number; nickname: string; bannedAt: string }`, `InviteResponse = { token: string; expiresAt: string }`
  - `groupsApi.removeMember(groupId, userId)`, `groupsApi.bans(groupId)`, `groupsApi.unban(groupId, userId)`, `groupsApi.createInvite(groupId)`
  - `useGroupMutations()`에 `removeMember`, `unban`, `createInvite`
  - `MemberList({ group, canRemove }: { group: GroupDetail; canRemove: boolean })`

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/src/groups/GroupsAdmin.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import GroupsPage from './GroupsPage'

const home = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const me = { userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-01T00:00:00Z' }
const partner = { userId: 2, nickname: '짝꿍', role: 'MEMBER', shareEnabled: true, joinedAt: '2026-09-02T00:00:00Z' }
const homeDetail = { groupId: 10, name: '우리집', myRole: 'ADMIN', members: [me, partner] }

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('group admin tools', () => {
  it('removes a member after confirming and lists them as banned', async () => {
    let removed = false
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json(removed ? { ...homeDetail, members: [me] } : homeDetail)),
      http.get('*/api/groups/10/bans', () => HttpResponse.json(
        removed ? [{ userId: 2, nickname: '짝꿍', bannedAt: '2026-10-19T03:00:00Z' }] : [])),
      http.delete('*/api/groups/10/members/2', () => {
        removed = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    expect(screen.queryByRole('button', { name: '나 내보내기' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '짝꿍 내보내기' }))
    expect(removed).toBe(false)
    await user.click(screen.getByRole('button', { name: '짝꿍 내보내기 확인' }))

    const bans = await screen.findByRole('region', { name: '차단 목록' })
    expect(await within(bans).findByText('짝꿍')).toBeInTheDocument()
    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: /^멤버/ })).queryByText('짝꿍')).not.toBeInTheDocument())
  })

  it('creates an invite link and copies it', async () => {
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json(homeDetail)),
      http.get('*/api/groups/10/bans', () => HttpResponse.json([])),
      http.post('*/api/groups/10/invites', () =>
        HttpResponse.json({ token: 'abc123', expiresAt: '2026-10-26T03:00:00Z' }, { status: 201 })),
    )
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    await user.click(await screen.findByRole('button', { name: '초대 링크 만들기' }))

    const link = `${window.location.origin}/invite/abc123`
    expect(await screen.findByLabelText('초대 주소')).toHaveValue(link)
    expect(screen.getByText('10-26 12:00까지')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '링크 복사' }))
    expect(await screen.findByText('링크를 복사했습니다.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(link)
  })

  it('does not offer new invites when the group is full', async () => {
    const members = [me, ...Array.from({ length: 5 }, (_, i) => ({ ...partner, userId: i + 2, nickname: `멤버${i + 2}` }))]
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json({ ...homeDetail, members })),
      http.get('*/api/groups/10/bans', () => HttpResponse.json([])),
    )
    renderPage(<GroupsPage />, { groups: [{ ...home, memberCount: 6 }] })

    expect(await screen.findByRole('button', { name: '초대 링크 만들기' })).toBeDisabled()
    expect(screen.getByText(/정원\(6명\)이 찼습니다/)).toBeInTheDocument()
  })

  it('lifts a ban', async () => {
    let unbanned = false
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json(homeDetail)),
      http.get('*/api/groups/10/bans', () => HttpResponse.json(
        unbanned ? [] : [{ userId: 5, nickname: '예전멤버', bannedAt: '2026-10-01T03:00:00Z' }])),
      http.delete('*/api/groups/10/bans/5', () => {
        unbanned = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    await user.click(await screen.findByRole('button', { name: '예전멤버 차단 해제' }))

    expect(await screen.findByText('차단한 사람이 없습니다.')).toBeInTheDocument()
    expect(unbanned).toBe(true)
  })

  it('hides admin tools from members', async () => {
    server.use(http.get('*/api/groups/20', () => HttpResponse.json({
      groupId: 20, name: '친구들', myRole: 'MEMBER',
      members: [{ ...partner, userId: 3, nickname: '친구', role: 'ADMIN' }, { ...me, role: 'MEMBER' }],
    })))
    renderPage(<GroupsPage />, { groups: [{ groupId: 20, name: '친구들', myRole: 'MEMBER', memberCount: 2 }] })

    expect(await screen.findByRole('heading', { level: 2, name: '친구들' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '초대 링크 만들기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '차단 목록' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '친구 내보내기' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/groups/GroupsAdmin.test.tsx`
Expected: FAIL — 내보내기·초대·차단 목록이 없음.

- [ ] **Step 3: 구현**

`apps/web/src/groups/groupsApi.ts`에 타입과 함수를 추가한다.

```ts
export type BanRow = { userId: number; nickname: string; bannedAt: string }
export type InviteResponse = { token: string; expiresAt: string }
```

```ts
  removeMember: (groupId: number, userId: number) =>
    apiFetch<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  bans: (groupId: number) => apiFetch<BanRow[]>(`/groups/${groupId}/bans`),
  unban: (groupId: number, userId: number) =>
    apiFetch<void>(`/groups/${groupId}/bans/${userId}`, { method: 'DELETE' }),
  createInvite: (groupId: number) => apiFetch<InviteResponse>(`/groups/${groupId}/invites`, { method: 'POST' }),
```

`apps/web/src/groups/useGroupMutations.ts`의 `return` 앞에 추가하고, 반환값에 넣는다(`return { create, rename, setShare, leave, removeMember, unban, createInvite }`).

```ts
  const removeMember = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) => groupsApi.removeMember(groupId, userId),
    onSuccess: (_result, { groupId }) => Promise.all([
      refreshList(),
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] }),
      queryClient.invalidateQueries({ queryKey: ['bans', groupId] }),
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] }),
      queryClient.invalidateQueries({ queryKey: ['transactions', 'group', groupId] }),
    ]),
  })
  const unban = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) => groupsApi.unban(groupId, userId),
    onSuccess: (_result, { groupId }) => queryClient.invalidateQueries({ queryKey: ['bans', groupId] }),
  })
  const createInvite = useMutation({ mutationFn: (groupId: number) => groupsApi.createInvite(groupId) })
```

`apps/web/src/groups/MemberList.tsx`를 바꾼다(관리자는 관리자가 아닌 멤버를 내보낼 수 있다).

```tsx
import { useState } from 'react'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import type { GroupDetail, GroupMember } from './groupsApi'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

type Props = { group: GroupDetail; canRemove: boolean }

export default function MemberList({ group, canRemove }: Props) {
  return (
    <section aria-labelledby="members-title" className={ui.stack}>
      <h3 id="members-title" className={styles.subTitle}>멤버 ({group.members.length}/6)</h3>
      <ul className={styles.memberList}>
        {group.members.map((m) => (
          <MemberRow key={m.userId} groupId={group.groupId} member={m} canRemove={canRemove && m.role !== 'ADMIN'} />
        ))}
      </ul>
    </section>
  )
}

function MemberRow({ groupId, member, canRemove }: { groupId: number; member: GroupMember; canRemove: boolean }) {
  const { removeMember } = useGroupMutations()
  const [confirming, setConfirming] = useState(false)
  return (
    <li className={styles.member}>
      <span className={styles.memberName}>{member.nickname}</span>
      <span className={ui.muted}>
        {member.role === 'ADMIN' ? '관리자' : '멤버'} · {member.shareEnabled ? '공개' : '비공개'} · {formatInstant(member.joinedAt)} 합류
      </span>
      {canRemove && (
        <span className={styles.memberActions}>
          {confirming ? (
            <>
              <span className={ui.muted}>내보내면 차단되어 다시 합류할 수 없습니다.</span>
              <button type="button" className={`${ui.button} ${ui.danger}`} disabled={removeMember.isPending}
                aria-label={`${member.nickname} 내보내기 확인`}
                onClick={() => removeMember.mutate({ groupId, userId: member.userId })}>내보내기 확인</button>
              <button type="button" className={ui.button} onClick={() => setConfirming(false)}>취소</button>
            </>
          ) : (
            <button type="button" className={`${ui.button} ${ui.danger}`} aria-label={`${member.nickname} 내보내기`}
              onClick={() => setConfirming(true)}>내보내기</button>
          )}
        </span>
      )}
      {removeMember.isError && <p role="alert" className={ui.alert}>{errorMessage(removeMember.error)}</p>}
    </li>
  )
}
```

`apps/web/src/groups/InviteSection.tsx`:

```tsx
import { useState } from 'react'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

const MAX_MEMBERS = 6

export default function InviteSection({ groupId, memberCount }: { groupId: number; memberCount: number }) {
  const { createInvite } = useGroupMutations()
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  const invite = createInvite.data
  const link = invite ? `${window.location.origin}/invite/${invite.token}` : null
  const full = memberCount >= MAX_MEMBERS

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <section aria-labelledby="invite-title" className={ui.stack}>
      <h3 id="invite-title" className={styles.subTitle}>초대 링크</h3>
      <p className={ui.muted}>링크는 7일 동안 쓸 수 있습니다. 받은 사람은 로그인하거나 가입한 뒤 합류합니다.</p>
      {full && <p className={ui.status}>그룹 정원(6명)이 찼습니다. 멤버를 내보내야 새로 초대할 수 있습니다.</p>}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={full || createInvite.isPending}
          onClick={() => { setCopied(null); createInvite.mutate(groupId) }}>
          {link ? '새 링크 만들기' : '초대 링크 만들기'}
        </button>
      </div>
      {invite && link && (
        <div className={ui.row}>
          <label className={ui.field}>
            <span>초대 주소</span>
            <input className={`${ui.input} ${styles.linkInput}`} readOnly value={link}
              onFocus={(e) => e.currentTarget.select()} />
          </label>
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => void copy(link)}>링크 복사</button>
          <span className={ui.muted}>{formatInstant(invite.expiresAt)}까지</span>
        </div>
      )}
      {copied === 'done' && <p role="status" className={ui.status}>링크를 복사했습니다.</p>}
      {copied === 'failed' && <p role="alert" className={ui.alert}>복사하지 못했습니다. 주소 칸을 눌러 직접 복사해 주세요.</p>}
      {createInvite.isError && <p role="alert" className={ui.alert}>{errorMessage(createInvite.error)}</p>}
    </section>
  )
}
```

`apps/web/src/groups/BanList.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import { groupsApi } from './groupsApi'
import styles from './GroupsPage.module.css'
import { useGroupMutations } from './useGroupMutations'

export default function BanList({ groupId }: { groupId: number }) {
  const bans = useQuery({ queryKey: ['bans', groupId], queryFn: () => groupsApi.bans(groupId) })
  const { unban } = useGroupMutations()

  return (
    <section aria-labelledby="bans-title" className={ui.stack}>
      <h3 id="bans-title" className={styles.subTitle}>차단 목록</h3>
      <p className={ui.muted}>내보낸 사람은 초대 링크로 다시 합류할 수 없습니다. 차단을 해제하면 다시 초대할 수 있습니다.</p>
      {bans.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {bans.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>차단 목록을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void bans.refetch()}>차단 목록 다시 시도</button>
        </div>
      )}
      {bans.data?.length === 0 && <p className={ui.status}>차단한 사람이 없습니다.</p>}
      {bans.data && bans.data.length > 0 && (
        <ul className={styles.memberList}>
          {bans.data.map((b) => (
            <li key={b.userId} className={styles.member}>
              <span className={styles.memberName}>{b.nickname}</span>
              <span className={ui.muted}>{formatInstant(b.bannedAt)} 차단</span>
              <span className={styles.memberActions}>
                <button type="button" className={ui.button} disabled={unban.isPending}
                  aria-label={`${b.nickname} 차단 해제`}
                  onClick={() => unban.mutate({ groupId, userId: b.userId })}>차단 해제</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {unban.isError && <p role="alert" className={ui.alert}>{errorMessage(unban.error)}</p>}
    </section>
  )
}
```

`apps/web/src/groups/GroupDetailSection.tsx`의 본문을 바꾼다(import에 `InviteSection`, `BanList`를 더한다).

```tsx
      <MemberList group={group} canRemove={isAdmin} />
      {isAdmin && <InviteSection groupId={groupId} memberCount={group.members.length} />}
      {isAdmin && <BanList groupId={groupId} />}
      {!isAdmin && <LeaveGroup groupId={groupId} name={group.name} />}
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/groups`
Expected: PASS(Task 5 테스트도 통과한다). 이어서 `npm run typecheck && npm run lint`.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/groups
git commit -m "feat(web): admin tools for removing members, invite links and bans"
```

---

### Task 7: 초대 수락 화면

**Files:**
- Create: `apps/web/src/invite/inviteApi.ts`
- Create: `apps/web/src/invite/InvitePage.tsx`, `apps/web/src/invite/InvitePage.module.css`, `apps/web/src/invite/InvitePage.test.tsx`
- Modify: `apps/web/src/groups/GroupProvider.tsx` (`rememberSelectedGroup` 내보내기)
- Modify: `apps/web/src/app/AppRoutes.tsx` (`/invite/:token`)

**Interfaces:**
- Consumes: `ApiError`, `errorMessage`(Task 2의 초대 코드), `formatInstant`, `ui.linkButton`(Task 4)
- Produces:
  - `type InvitePreview = { groupName: string; memberCount: number; maxMembers: number; expiresAt: string; alreadyMember: boolean }`
  - `inviteApi.preview(token)`, `inviteApi.accept(token): Promise<{ groupId: number }>`
  - `rememberSelectedGroup(groupId: number): void` (`GroupProvider.tsx`) — `GroupProvider` 밖에서 다음에 고를 그룹을 저장한다

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/src/invite/InvitePage.test.tsx`

```tsx
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import InvitePage from './InvitePage'

const preview = { groupName: '우리집', memberCount: 3, maxMembers: 6, expiresAt: '2026-10-26T03:00:00Z', alreadyMember: false }

function renderInvite() {
  return renderPage(
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/dashboard" element={<p>대시보드 화면</p>} />
    </Routes>,
    { path: '/invite/abc' },
  )
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('InvitePage', () => {
  it('shows the invite and joins the group', async () => {
    let accepted = false
    server.use(
      http.get('*/api/invites/abc', () => HttpResponse.json(preview)),
      http.post('*/api/invites/abc/accept', () => {
        accepted = true
        return HttpResponse.json({ groupId: 30 })
      }),
    )
    const { user } = renderInvite()

    expect(await screen.findByText('우리집')).toBeInTheDocument()
    expect(screen.getByText('3/6명')).toBeInTheDocument()
    expect(screen.getByText('10-26 12:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '그룹에 합류하기' }))

    expect(await screen.findByText('대시보드 화면')).toBeInTheDocument()
    expect(accepted).toBe(true)
    expect(window.localStorage.getItem('saladbowl.selectedGroupId')).toBe('30')
  })

  it('tells an existing member and links to the dashboard', async () => {
    server.use(http.get('*/api/invites/abc', () => HttpResponse.json({ ...preview, alreadyMember: true })))
    renderInvite()

    expect(await screen.findByText('이미 이 그룹의 멤버입니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '대시보드로 가기' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('button', { name: '그룹에 합류하기' })).not.toBeInTheDocument()
  })

  it('does not offer to join a full group', async () => {
    server.use(http.get('*/api/invites/abc', () => HttpResponse.json({ ...preview, memberCount: 6 })))
    renderInvite()

    expect(await screen.findByText('그룹 정원이 찼습니다. 관리자에게 문의해 주세요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '그룹에 합류하기' })).not.toBeInTheDocument()
  })

  it('explains an expired link without a retry button', async () => {
    server.use(http.get('*/api/invites/abc', () =>
      HttpResponse.json({ code: 'INVITE_EXPIRED', message: 'invite expired' }, { status: 410 })))
    renderInvite()

    expect(await screen.findByRole('alert')).toHaveTextContent('초대 링크가 만료되었습니다. 관리자에게 새 링크를 요청해 주세요.')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '내 가계부로' })).toHaveAttribute('href', '/')
  })

  it('explains that a removed member cannot rejoin', async () => {
    server.use(http.get('*/api/invites/abc', () =>
      HttpResponse.json({ code: 'REMOVED_FROM_GROUP', message: 'removed' }, { status: 403 })))
    renderInvite()

    expect(await screen.findByRole('alert')).toHaveTextContent('이 그룹에서 내보내져 다시 합류할 수 없습니다.')
  })

  it('offers a retry when the server fails', async () => {
    let fail = true
    server.use(http.get('*/api/invites/abc', () => (fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json(preview))))
    const { user } = renderInvite()

    await screen.findByRole('alert')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('우리집')).toBeInTheDocument()
  })

  it('shows why joining failed', async () => {
    server.use(
      http.get('*/api/invites/abc', () => HttpResponse.json(preview)),
      http.post('*/api/invites/abc/accept', () =>
        HttpResponse.json({ code: 'GROUP_FULL', message: 'group is full' }, { status: 409 })),
    )
    const { user } = renderInvite()

    await user.click(await screen.findByRole('button', { name: '그룹에 합류하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('그룹 정원(6명)이 찼습니다.')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/invite`
Expected: FAIL — `./InvitePage`를 찾지 못함.

- [ ] **Step 3: 구현**

`apps/web/src/groups/GroupProvider.tsx`: `writeStored`를 내보내는 이름으로 바꾼다.

```tsx
/** 다음에 고를 그룹을 기억한다. 초대 수락처럼 GroupProvider 밖에서 그룹을 정할 때도 쓴다. */
// oxlint-disable-next-line react/only-export-components
export function rememberSelectedGroup(id: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // 저장소를 못 쓰면 이번 세션 동안만 기억한다.
  }
}
```

`selectGroup` 안의 `writeStored(id)`를 `rememberSelectedGroup(id)`로 바꾸고, 기존 `writeStored` 함수는 지운다.

`apps/web/src/invite/inviteApi.ts`:

```ts
import { apiFetch } from '../api/client'

export type InvitePreview = {
  groupName: string
  memberCount: number
  maxMembers: number
  expiresAt: string
  alreadyMember: boolean
}

export const inviteApi = {
  preview: (token: string) => apiFetch<InvitePreview>(`/invites/${encodeURIComponent(token)}`),
  accept: (token: string) =>
    apiFetch<{ groupId: number }>(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
}
```

`apps/web/src/invite/InvitePage.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/errors'
import { errorMessage } from '../common/errorMessage'
import { formatInstant } from '../common/format'
import ui from '../common/ui.module.css'
import { usePageTitle } from '../common/usePageTitle'
import { rememberSelectedGroup } from '../groups/GroupProvider'
import { inviteApi, type InvitePreview } from './inviteApi'
import styles from './InvitePage.module.css'

export default function InvitePage() {
  usePageTitle('그룹 초대')
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const preview = useQuery({ queryKey: ['invite', token], queryFn: () => inviteApi.preview(token) })
  const accept = useMutation({
    mutationFn: () => inviteApi.accept(token),
    onSuccess: async ({ groupId }) => {
      rememberSelectedGroup(groupId)
      await queryClient.invalidateQueries({ queryKey: ['groups'], exact: true })
      navigate('/dashboard', { replace: true })
    },
  })

  return (
    <div className={styles.page}>
      <main className={`${ui.card} ${styles.card}`}>
        <span className={styles.brand}>Salad Bowl</span>
        <h1>그룹 초대</h1>
        {preview.isPending && <p className={ui.status}>초대 정보를 불러오는 중입니다.</p>}
        {preview.isError && <InviteError error={preview.error} onRetry={() => void preview.refetch()} />}
        {preview.data && (
          <InviteDetails preview={preview.data} joining={accept.isPending} onJoin={() => accept.mutate()} />
        )}
        {accept.isError && <p role="alert" className={ui.alert}>{errorMessage(accept.error)}</p>}
      </main>
    </div>
  )
}

function InviteError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // 4xx(없음·만료·차단)는 다시 시도해도 같다. 서버·네트워크 오류만 다시 시도를 보여준다.
  const final = error instanceof ApiError && error.status >= 400 && error.status < 500
  return (
    <>
      <p role="alert" className={ui.alert}>{errorMessage(error)}</p>
      <div className={ui.row}>
        {!final && <button type="button" className={ui.button} onClick={onRetry}>다시 시도</button>}
        <Link to="/" className={`${ui.button} ${ui.linkButton}`}>내 가계부로</Link>
      </div>
    </>
  )
}

function InviteDetails({ preview, joining, onJoin }: { preview: InvitePreview; joining: boolean; onJoin: () => void }) {
  const full = preview.memberCount >= preview.maxMembers
  return (
    <>
      <p className={styles.groupName}>{preview.groupName}</p>
      <dl className={styles.facts}>
        <div><dt>인원</dt><dd>{preview.memberCount}/{preview.maxMembers}명</dd></div>
        <div><dt>링크 만료</dt><dd>{formatInstant(preview.expiresAt)}</dd></div>
      </dl>
      {preview.alreadyMember ? (
        <>
          <p className={ui.status}>이미 이 그룹의 멤버입니다.</p>
          <Link to="/dashboard" className={`${ui.button} ${ui.primary} ${ui.linkButton}`}>대시보드로 가기</Link>
        </>
      ) : full ? (
        <p className={ui.status}>그룹 정원이 찼습니다. 관리자에게 문의해 주세요.</p>
      ) : (
        <button type="button" className={`${ui.button} ${ui.primary}`} disabled={joining} onClick={onJoin}>
          그룹에 합류하기
        </button>
      )}
      <p className={ui.muted}>합류하면 내 거래가 이 그룹 멤버에게 공개됩니다. 그룹 관리에서 언제든 끌 수 있습니다.</p>
    </>
  )
}
```

`apps/web/src/invite/InvitePage.module.css`:

```css
.page { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: var(--space-6) max(16px, env(safe-area-inset-left, 0px)); background: var(--surface-100); }
.card { width: 100%; max-width: 440px; }
.brand { font-size: 20px; font-weight: 700; color: var(--brand); }
.groupName { margin: 0; font-size: 22px; font-weight: 700; }
.facts { margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-6); }
.facts dt { font-size: 13px; color: var(--ink-muted); }
.facts dd { margin: 0; font-weight: 500; font-variant-numeric: tabular-nums; }
```

`apps/web/src/app/AppRoutes.tsx`: `import InvitePage from '../invite/InvitePage'`를 더하고 `/invite/:token`의 `<PagePlaceholder title="그룹 초대" />`를 `<InvitePage />`로 바꾼다(`RequireAuth`는 그대로).

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/invite src/groups src/app`
Expected: PASS. 이어서 `npm run typecheck && npm run lint`.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/invite apps/web/src/groups/GroupProvider.tsx apps/web/src/app/AppRoutes.tsx
git commit -m "feat(web): invite acceptance page"
```

---

### Task 8: 인증 보강 — 세션 복원 실패 상태, 회원가입 부분 실패, 로그인 탭 접근성

**Files:**
- Create: `apps/web/src/auth/authErrors.ts`
- Modify: `apps/web/src/auth/AuthProvider.tsx`, `apps/web/src/auth/AuthProvider.test.tsx`
- Modify: `apps/web/src/auth/LoginPage.tsx`, `apps/web/src/auth/LoginPage.module.css`, `apps/web/src/auth/LoginPage.test.tsx`
- Create: `apps/web/src/app/ServerUnavailable.tsx`, `apps/web/src/app/Gate.module.css`
- Modify: `apps/web/src/app/RequireAuth.tsx`, `apps/web/src/app/PublicOnly.tsx`
- Modify: `apps/web/src/app/AppRoutes.test.tsx`

**Interfaces:**
- Consumes: `ApiError`, InvitePage 경로(Task 7)
- Produces:
  - `useAuth()`의 `status`에 `'unavailable'` 추가, `retryRestore: () => void` 추가
  - `class SignupLoginError extends Error` (`auth/authErrors.ts`) — `signup`이 가입 후 로그인에 실패하면 던진다
  - `ServerUnavailable()` — "서버에 연결하지 못했습니다" 알림과 "다시 시도" 버튼(`retryRestore`)
  - `Gate.module.css`의 `loading`, `unavailable`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/auth/AuthProvider.test.tsx` — 상단에 `import userEvent from '@testing-library/user-event'`를 더하고, `Status` 아래에 버튼 도우미를 둔 뒤 테스트를 추가한다.

```tsx
function RetryButton() {
  const { retryRestore } = useAuth()
  return <button type="button" onClick={retryRestore}>retry</button>
}
```

```tsx
  it('offers a retry instead of signing out when the server stays unreachable', async () => {
    let calls = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        calls++
        return calls <= 3 ? new HttpResponse('down', { status: 503 }) : HttpResponse.json({ accessToken: 'a1' })
      }),
      http.get('*/api/me', () => HttpResponse.json({ userId: 1, email: 'me@test.com', nickname: '나' })),
    )
    render(<AuthProvider><Status /><RetryButton /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('unavailable:-')).toBeInTheDocument(), { timeout: 4000 })
    expect(calls).toBe(3)
    await userEvent.setup().click(screen.getByRole('button', { name: 'retry' }))

    await waitFor(() => expect(screen.getByText('signedIn:나')).toBeInTheDocument())
  })
```

`apps/web/src/auth/LoginPage.test.tsx`의 `describe` 안에 추가한다.

```tsx
  it('moves between the login and signup tabs with arrow keys', async () => {
    renderAt('/login')
    const user = userEvent.setup()

    const loginTab = await screen.findByRole('tab', { name: '로그인' })
    expect(screen.getByRole('tabpanel', { name: '로그인' })).toBeInTheDocument()
    await user.click(loginTab)
    await user.keyboard('{ArrowRight}')

    const signupTab = screen.getByRole('tab', { name: '회원가입' })
    expect(signupTab).toHaveAttribute('aria-selected', 'true')
    expect(signupTab).toHaveFocus()
    expect(loginTab).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: '회원가입' })).toBeInTheDocument()
  })

  it('asks to log in when signup worked but the login after it failed', async () => {
    server.use(
      http.post('*/api/auth/signup', () => HttpResponse.json({ userId: 1 }, { status: 201 })),
      http.post('*/api/auth/login', () => HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })),
    )
    renderAt('/login')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: '회원가입' }))
    await user.type(screen.getByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.type(screen.getByLabelText(/닉네임/), '나')
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }))

    expect(await screen.findByText('가입은 완료되었습니다. 로그인해 주세요.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '로그인' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a readable error when the email is already taken', async () => {
    server.use(http.post('*/api/auth/signup', () =>
      HttpResponse.json({ code: 'EMAIL_ALREADY_EXISTS', message: 'x' }, { status: 409 })))
    renderAt('/login')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: '회원가입' }))
    await user.type(screen.getByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.type(screen.getByLabelText(/닉네임/), '나')
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 가입된 이메일입니다.')
  })
```

`apps/web/src/app/AppRoutes.test.tsx`의 `describe` 안에 추가한다.

```tsx
  it('returns to the invite page after logging in', async () => {
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
      http.get('*/api/invites/abc', () => HttpResponse.json(
        { groupName: '우리집', memberCount: 2, maxMembers: 6, expiresAt: '2026-10-26T03:00:00Z', alreadyMember: false })),
    )
    renderApp('/invite/abc')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('heading', { level: 1, name: '그룹 초대' })).toBeInTheDocument()
    expect(await screen.findByText('우리집')).toBeInTheDocument()
  })

  it('clears cached data when the session is lost while using the app', async () => {
    let refreshes = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        refreshes++
        return refreshes === 1
          ? HttpResponse.json({ accessToken: 'a1' })
          : HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })
      }),
      http.get('*/api/me', () => HttpResponse.json(me)),
      http.get('*/api/groups', () => HttpResponse.json([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 1 }])),
      ...homeHandlers,
    )
    const client = renderApp('/')
    const user = userEvent.setup()
    await screen.findByRole('combobox', { name: '그룹' })
    server.use(http.get('*/api/imports', () =>
      HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })))

    await user.click(screen.getByRole('link', { name: '업로드' }))

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(client.getQueryData(['groups'])).toBeUndefined()
  })

  it('shows a retry screen when the server cannot be reached on startup', async () => {
    server.use(http.post('*/api/auth/refresh', () => new HttpResponse('down', { status: 503 })))
    renderApp('/')

    expect(await screen.findByText('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', {}, { timeout: 4000 }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/auth src/app/AppRoutes.test.tsx`
Expected: FAIL — `retryRestore`·`tabpanel`·가입 안내가 없음, 복원 실패가 로그인 화면으로 감.

- [ ] **Step 3: 구현**

`apps/web/src/auth/authErrors.ts`:

```ts
/** 가입은 됐지만 이어진 로그인이 실패했다. 다시 가입하면 EMAIL_ALREADY_EXISTS가 나므로 로그인으로 안내한다. */
export class SignupLoginError extends Error {
  constructor(cause: unknown) {
    super('signed up but could not log in', { cause })
    this.name = 'SignupLoginError'
  }
}
```

`apps/web/src/auth/AuthProvider.tsx`의 바뀌는 부분:

```tsx
import { ApiError } from '../api/errors'
import { SignupLoginError } from './authErrors'

type Status = 'loading' | 'signedOut' | 'signedIn' | 'unavailable'

type AuthValue = {
  status: Status
  me: Me | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, nickname: string) => Promise<void>
  logout: () => Promise<void>
  /** 'unavailable'에서 세션 복원을 다시 시도한다. */
  retryRestore: () => void
}

/** 4xx는 세션이 없다는 뜻이다. 그 밖(5xx, 네트워크, JSON이 아닌 응답)은 서버 문제라 로그인 화면 대신 다시 시도를 보여준다. */
function isPermanent(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
}
```

`AuthProvider` 안:

```tsx
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    restoreSession()
      .then((token) => (token ? authApi.me() : null))
      .then((profile) => {
        if (cancelled) return
        setMe(profile)
        setStatus(profile ? 'signedIn' : 'signedOut')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (isPermanent(error)) signOutLocally()
        else setStatus('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [attempt, signOutLocally])

  useEffect(() => onAuthLost(signOutLocally), [signOutLocally])

  const retryRestore = useCallback(() => {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }, [])
```

`signup`을 바꾼다.

```tsx
  const signup = useCallback(async (email: string, password: string, nickname: string) => {
    await authApi.signup(email, password, nickname)
    try {
      await login(email, password)
    } catch (error) {
      throw new SignupLoginError(error)
    }
  }, [login])
```

`value`에 `retryRestore`를 더한다: `useMemo(() => ({ status, me, login, signup, logout, retryRestore }), [status, me, login, signup, logout, retryRestore])`. 기존의 한 effect 안에 있던 `onAuthLost` 구독은 위처럼 별도 effect로 옮긴다.

`apps/web/src/app/Gate.module.css`:

```css
.loading { margin: 0; padding: var(--space-8); color: var(--ink-muted); }
.unavailable { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); padding: var(--space-8); }
```

`apps/web/src/app/ServerUnavailable.tsx`:

```tsx
import { useAuth } from '../auth/AuthProvider'
import ui from '../common/ui.module.css'
import styles from './Gate.module.css'

/** 세션 복원이 서버 문제로 끝나지 못했을 때. 로그인 화면으로 보내지 않고 다시 시도하게 한다. */
export default function ServerUnavailable() {
  const { retryRestore } = useAuth()
  return (
    <div className={styles.unavailable}>
      <p role="alert" className={ui.alert}>서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <button type="button" className={`${ui.button} ${ui.primary}`} onClick={retryRestore}>다시 시도</button>
    </div>
  )
}
```

`apps/web/src/app/RequireAuth.tsx` — inline style을 없애고, 로딩 문구에서 `role="status"`를 뺀다(살아 있는 안내 영역은 `SlowServerNotice` 하나만 둔다).

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import styles from './Gate.module.css'
import ServerUnavailable from './ServerUnavailable'
import SlowServerNotice from './SlowServerNotice'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading' || status === 'unavailable') {
    return (
      <>
        <SlowServerNotice />
        {status === 'loading' ? <p className={styles.loading}>불러오는 중입니다.</p> : <ServerUnavailable />}
      </>
    )
  }
  if (status === 'signedOut') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}
```

`apps/web/src/app/PublicOnly.tsx`의 반환부를 바꾼다(import에 `styles from './Gate.module.css'`, `ServerUnavailable`을 더한다).

```tsx
  return (
    <>
      <SlowServerNotice />
      {status === 'loading' && <p className={styles.loading}>불러오는 중입니다.</p>}
      {status === 'unavailable' && <ServerUnavailable />}
      {status === 'signedOut' && children}
    </>
  )
```

`apps/web/src/auth/LoginPage.tsx`를 바꾼다.

```tsx
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../common/errorMessage'
import { safeNext } from '../common/safeNext'
import { useAuth } from './AuthProvider'
import { SignupLoginError } from './authErrors'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'signup'
const MODES: Mode[] = ['login', 'signup']
const TAB_LABEL: Record<Mode, string> = { login: '로그인', signup: '회원가입' }

export default function LoginPage() {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tabs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({})

  const target = safeNext(params.get('next'))

  function changeMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  // 탭 패턴: 좌우 화살표·Home·End로 탭을 바꾸고 포커스를 옮긴다.
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = MODES.indexOf(mode)
    const next = event.key === 'ArrowRight' ? MODES[(index + 1) % MODES.length]
      : event.key === 'ArrowLeft' ? MODES[(index - 1 + MODES.length) % MODES.length]
        : event.key === 'Home' ? MODES[0]
          : event.key === 'End' ? MODES[MODES.length - 1]
            : null
    if (!next) return
    event.preventDefault()
    changeMode(next)
    tabs.current[next]?.focus()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(email, password, nickname)
      navigate(target, { replace: true })
    } catch (e) {
      if (e instanceof SignupLoginError) {
        // 계정은 만들어졌다. 다시 가입하면 '이미 가입된 이메일'이 나오므로 로그인으로 안내한다.
        setMode('login')
        setNotice('가입은 완료되었습니다. 로그인해 주세요.')
      } else {
        setError(errorMessage(e))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.name}>Salad Bowl</span>
          <p className={styles.lead}>뱅크샐러드 가계부를 가족·친구와 함께 봅니다.</p>
        </div>
        <div role="tablist" aria-label="로그인 또는 회원가입" className={styles.tabs} onKeyDown={onTabKeyDown}>
          {MODES.map((m) => (
            <button key={m} ref={(el) => { tabs.current[m] = el }} type="button" role="tab" id={`auth-tab-${m}`}
              aria-selected={mode === m} aria-controls="auth-panel" tabIndex={mode === m ? 0 : -1}
              className={styles.tab} onClick={() => changeMode(m)}>{TAB_LABEL[m]}</button>
          ))}
        </div>
        <form id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`} className={styles.form}
          onSubmit={onSubmit}>
          <label className={styles.field}>
            <span>이메일</span>
            <input type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>비밀번호{mode === 'signup' ? ' (8~64자)' : ''}</span>
            <input type="password" required minLength={mode === 'signup' ? 8 : undefined} maxLength={64}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          {mode === 'signup' && (
            <label className={styles.field}>
              <span>닉네임 (그룹에서 보이는 이름)</span>
              <input type="text" required maxLength={50} value={nickname}
                onChange={(e) => setNickname(e.target.value)} />
            </label>
          )}
          <button type="submit" className={styles.submit} disabled={busy}>
            {mode === 'login' ? '로그인' : '가입하고 시작하기'}
          </button>
          {notice && <p role="status" className={styles.notice}>{notice}</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
        <p className={styles.hint}>초대 링크로 들어왔다면 로그인 후 초대 화면으로 돌아갑니다.</p>
      </main>
    </div>
  )
}
```

`apps/web/src/auth/LoginPage.module.css`에 추가한다.

```css
.notice { margin: 0; color: var(--brand); font-size: 14px; }
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run src/auth src/app`
Expected: PASS. 이어서 `npm test`, `npm run typecheck && npm run lint`.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/auth apps/web/src/app
git commit -m "feat(web): retry screen for unreachable server, signup recovery and accessible login tabs"
```

---

### Task 9: 화면 전환 포커스, 대화상자 포커스, 스타일 정리

**Files:**
- Modify: `apps/web/src/app/AppLayout.tsx`, `apps/web/src/app/AppLayout.module.css`
- Modify: `apps/web/src/app/SlowServerNotice.tsx`; Create: `apps/web/src/app/SlowServerNotice.module.css`
- Modify: `apps/web/src/pages/PagePlaceholder.tsx`; Create: `apps/web/src/pages/PagePlaceholder.module.css`
- Modify: `apps/web/src/common/Modal.tsx`, `apps/web/src/common/Modal.module.css`, `apps/web/src/common/Modal.test.tsx`
- Modify: `apps/web/src/styles/tokens.css` (`--overlay`), `apps/web/src/styles/base.css`
- Modify: `apps/web/src/imports/useUpload.ts`, `apps/web/src/home/HomePage.tsx`, `apps/web/src/home/HomePage.test.tsx`
- Modify: `apps/web/src/app/AppRoutes.test.tsx`

**Interfaces:**
- Consumes: Task 4~8의 화면들(각 화면은 `h1`을 바로 그린다)
- Produces:
  - `Modal({ title, onClose, closeDisabled?, children })` — 닫힐 때 열기 전 포커스로 돌아가고, Tab은 대화상자 안에서 돈다. Esc는 문서 전체에서 듣는다. `closeDisabled`이면 Esc와 닫기 버튼이 막힌다
  - `useUpload()`의 `mutationKey: ['upload']`
  - CSS 변수 `--overlay`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/common/Modal.test.tsx` — import에 `useState`(`react`)를 더하고 `describe` 안에 추가한다.

```tsx
  it('returns focus to the opener when closed', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>열기</button>
          {open && <Modal title="제목" onClose={() => setOpen(false)}><button type="button">안쪽</button></Modal>}
        </>
      )
    }
    render(<Harness />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '열기' }))
    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '열기' })).toHaveFocus()
  })

  it('keeps Tab inside the dialog', async () => {
    render(<Modal title="제목" onClose={() => {}}><button type="button">안쪽</button></Modal>)
    const user = userEvent.setup()

    await user.tab()
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '안쪽' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: '안쪽' })).toHaveFocus()
  })

  it('cannot be closed while closing is disabled', async () => {
    const onClose = vi.fn()
    render(<Modal title="제목" onClose={onClose} closeDisabled><p>올리는 중</p></Modal>)
    const user = userEvent.setup()

    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled()
  })
```

`apps/web/src/home/HomePage.test.tsx` — import에 `delay`(`msw`), `waitFor`(`@testing-library/react`)를 더하고 `describe` 안에 추가한다.

```tsx
  it('keeps the upload dialog open while the file is uploading', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.post('*/api/imports', async () => {
        await delay(200)
        return HttpResponse.json({ batchId: 1, totalRows: 1, createdRows: 1, updatedRows: 0, unchangedRows: 0 }, { status: 201 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 2월 미등록, 업로드하기' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 2월 데이터 업로드' })
    await user.upload(within(dialog).getByLabelText(/파일을 끌어다 놓거나/), new File([new Uint8Array(10)], 'feb.xlsx'))
    await user.click(within(dialog).getByRole('button', { name: '업로드' }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled())
    expect(await within(dialog).findByRole('status')).toHaveTextContent('신규1건')
    expect(within(dialog).getByRole('button', { name: '닫기' })).toBeEnabled()
  })
```

`apps/web/src/app/AppRoutes.test.tsx` — import에 `waitFor`(`@testing-library/react`), `onlineManager`(`@tanstack/react-query`)를 더하고 `describe` 안에 추가한다.

```tsx
  it('moves focus to the new page heading after navigating', async () => {
    signedIn([])
    renderApp('/')
    const user = userEvent.setup()

    await screen.findByRole('heading', { level: 1, name: '내 가계부' })
    await user.click(screen.getByRole('link', { name: '거래 목록' }))

    const heading = await screen.findByRole('heading', { level: 1, name: '거래 목록' })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('shows groups as loading, not missing, while offline', async () => {
    signedIn([])
    onlineManager.setOnline(false)
    try {
      renderApp('/')

      expect(await screen.findByText('그룹 불러오는 중')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /그룹 없음/ })).not.toBeInTheDocument()
    } finally {
      onlineManager.setOnline(true)
    }
  })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/common/Modal.test.tsx src/home src/app/AppRoutes.test.tsx`
Expected: FAIL — 포커스 복귀·Tab 가두기·`closeDisabled`·화면 전환 포커스가 없음(오프라인 테스트는 이미 통과할 수 있다. 04a에서 `isPending`으로 고친 동작을 지키는 회귀 테스트다).

- [ ] **Step 3: 구현**

`apps/web/src/styles/tokens.css` — 세 블록(라이트 `:root`, `@media (prefers-color-scheme: dark)`, `:root[data-theme="dark"]`)에 각각 추가한다.

```css
  --overlay: rgb(20 24 21 / 0.45);
```

다크 두 블록에는 `--overlay: rgb(0 0 0 / 0.6);`을 넣는다.

`apps/web/src/styles/base.css`에 추가한다(코드로 포커스를 옮긴 제목에 마우스 사용자에게는 테두리를 그리지 않는다).

```css
[tabindex="-1"]:focus:not(:focus-visible) { outline: none; }
```

`apps/web/src/common/Modal.module.css`의 `.overlay` 배경을 `background: var(--overlay);`로 바꾼다.

`apps/web/src/common/Modal.tsx`:

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react'
import ui from './ui.module.css'
import styles from './Modal.module.css'

type Props = { title: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, onClose, closeDisabled = false, children }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef({ onClose, closeDisabled })
  useEffect(() => {
    latest.current = { onClose, closeDisabled }
  })

  // 열리면 대화상자로 포커스를 옮기고, 닫히면 열기 전 위치로 돌려준다.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.focus()
    return () => opener?.focus()
  }, [])

  // Esc는 포커스가 어디 있든 닫는다. Tab은 대화상자 안에서만 돈다.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!latest.current.closeDisabled) latest.current.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = ref.current
      if (!dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={styles.overlay}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.dialog}>
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={ui.button} disabled={closeDisabled} onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

`apps/web/src/imports/useUpload.ts`의 `useMutation({`에 `mutationKey: ['upload'],`를 더한다.

`apps/web/src/home/HomePage.tsx`:
- import에 `useIsMutating`(`@tanstack/react-query`)을 더한다.
- 컴포넌트 안에 `const uploading = useIsMutating({ mutationKey: ['upload'] }) > 0`을 둔다.
- `<Modal title={…} onClose={…}>`에 `closeDisabled={uploading}`을 더한다(업로드 중에 닫으면 결과를 볼 수 없다).

`apps/web/src/app/AppLayout.tsx`:
- import를 `import { useEffect, useRef, useState } from 'react'`, `import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router'`로 바꾼다.
- 컴포넌트 안에 추가한다.

```tsx
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const lastPath = useRef(location.pathname)
  useEffect(() => {
    // 메뉴로 화면을 바꾸면 새 화면 제목으로 포커스를 옮긴다(스크린리더가 바뀐 화면을 읽도록). 처음 들어올 때는 옮기지 않는다.
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    const heading = mainRef.current?.querySelector('h1')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus()
    }
  }, [location.pathname])
```

- `<main className={styles.content}>`를 `<main ref={mainRef} className={styles.content}>`로 바꾼다.
- 그룹 없음 링크를 `<Link to="/groups" className={styles.noGroup}>그룹 없음 · 만들기 또는 초대받기</Link>`로 바꾼다.

`apps/web/src/app/AppLayout.module.css`:
- `@media (max-width: 720px)`를 `@media (max-width: 820px)`로 바꾼다.
- 추가한다: `.noGroup { display: inline-flex; align-items: center; min-height: 40px; }`

`apps/web/src/app/SlowServerNotice.module.css`:

```css
.notice { margin: 0; }
.slow { padding: var(--space-3) var(--space-8); background: var(--pending-tint); color: var(--pending); }
```

`apps/web/src/app/SlowServerNotice.tsx`의 `<p>`를 바꾼다(import `styles from './SlowServerNotice.module.css'`).

```tsx
    <p role="status" className={slow ? `${styles.notice} ${styles.slow}` : styles.notice}>
      {slow ? '서버를 깨우는 중입니다. 처음 접속하면 30초쯤 걸릴 수 있습니다.' : null}
    </p>
```

`apps/web/src/pages/PagePlaceholder.module.css`:

```css
.page { display: flex; flex-direction: column; gap: var(--space-3); }
.lead { margin: 0; color: var(--ink-muted); }
```

`apps/web/src/pages/PagePlaceholder.tsx`:

```tsx
import styles from './PagePlaceholder.module.css'

export default function PagePlaceholder({ title }: { title: string }) {
  return (
    <section className={styles.page}>
      <h1>{title}</h1>
      <p className={styles.lead}>이 화면은 다음 단계에서 만듭니다.</p>
    </section>
  )
}
```

확인: `grep -rn "style={{" apps/web/src`가 아무것도 찾지 않아야 한다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npm test && npm run typecheck && npm run lint`
Expected: 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src
git commit -m "feat(web): focus management for page changes and dialogs, remove inline styles"
```

---

### Task 10: PWA 설치 (manifest, 아이콘, 서비스 워커)와 Node 버전 고정

**Files:**
- Modify: `apps/web/package.json`, `apps/web/package-lock.json` (`vite-plugin-pwa`, `engines`)
- Create: `apps/web/.nvmrc`
- Create: `apps/web/public/logo.svg` 및 생성된 아이콘(`public/pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`)
- Modify: `apps/web/vite.config.ts`, `apps/web/index.html`
- Modify: `.github/workflows/web-ci.yml`

**Interfaces:**
- Produces: 빌드 결과 `dist/manifest.webmanifest`, `dist/sw.js`, `dist/registerSW.js`. 서비스 워커는 앱 셸만 precache하고 `/api/*` 탐색 요청은 SPA로 바꾸지 않는다

- [ ] **Step 1: 패키지 설치와 Node 버전 고정**

```bash
cd apps/web
npm install -D vite-plugin-pwa@2.0.0 --legacy-peer-deps
printf '22\n' > .nvmrc
```

`apps/web/package.json`에 `"engines": { "node": ">=22.22" }`를 더한다(최상위 키, `"private"` 아래).

`.github/workflows/web-ci.yml`의 `node-version: "22"`를 `node-version-file: apps/web/.nvmrc`로 바꾼다.

- [ ] **Step 2: 임시 로고와 아이콘 만들기**

`apps/web/public/logo.svg`(브랜드 색 바탕에 그릇과 잎. 정식 로고는 잔여 작업이다):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#2f6b4f"/>
  <path d="M112 248h288c0 88-64 152-144 152s-144-64-144-152z" fill="#ffffff"/>
  <path d="M256 236c-8-64 32-108 92-116-4 60-40 104-92 116z" fill="#bfe0cc"/>
  <path d="M244 236c-44-24-60-64-48-104 40 12 60 52 48 104z" fill="#e6efe9"/>
</svg>
```

아이콘을 만든다(설치하지 않고 한 번만 실행한다).

```bash
cd apps/web
npx --yes @vite-pwa/assets-generator@2.0.0 --preset minimal-2023 public/logo.svg
ls public
```

Expected: `public`에 `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`가 생긴다. 이름이 다르면 아래 `manifest.icons`와 `index.html`의 경로를 실제 이름에 맞춘다.

- [ ] **Step 3: Vite 설정**

`apps/web/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA: 설치만 지원한다(오프라인 기능 없음). 앱 셸만 precache하고 /api/* 는 캐시하지 않는다.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'script-defer',
  includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
  manifest: {
    name: 'Salad Bowl',
    short_name: 'Salad Bowl',
    description: '뱅크샐러드 가계부를 가족·친구와 함께 봅니다.',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f4f0',
    theme_color: '#2f6b4f',
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api(\/|$)/],
    runtimeCaching: [],
  },
})

// 로컬 개발: 브라우저는 /api/* 를 호출하고, dev server가 API(8080)로 접두어를 떼고 전달한다.
// 배포(Cloudflare Pages Functions)도 같은 규칙이라 쿠키 Path(/api/auth)가 두 환경에서 같다.
export default defineConfig({
  // 테스트에서는 서비스 워커를 만들 필요가 없다.
  plugins: process.env.VITEST ? [react()] : [react(), pwa],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
```

`apps/web/index.html`의 `<head>`에 추가한다(`<title>` 위).

```html
    <meta name="description" content="뱅크샐러드 가계부를 가족·친구와 함께 봅니다." />
    <meta name="theme-color" content="#2f6b4f" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1e221f" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/logo.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 4: 빌드 결과 확인**

```bash
cd apps/web
npm run build
ls dist/manifest.webmanifest dist/sw.js dist/registerSW.js
grep -o 'manifest.webmanifest' dist/index.html
grep -o 'api' dist/sw.js | head -1
npm test && npm run typecheck && npm run lint
```

Expected: 세 파일이 있고, `index.html`이 manifest를 연결한다. `sw.js`에 `/api` 거부 규칙이 들어 있다. 테스트·타입체크·lint가 통과한다.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/.nvmrc apps/web/public apps/web/vite.config.ts apps/web/index.html .github/workflows/web-ci.yml
git commit -m "feat(web): installable PWA with manifest, icons and app-shell service worker"
```

---

### Task 11: Cloudflare Pages Functions 프록시

**Files:**
- Create: `apps/web/proxy/forward.ts`, `apps/web/proxy/forward.test.ts`
- Create: `apps/web/functions/api/[[path]].ts`
- Create: `apps/web/tsconfig.functions.json`; Modify: `apps/web/tsconfig.json` (references)

**Interfaces:**
- Produces:
  - `forward(request: Request, apiOrigin: string): Promise<Response>` — `/api` 접두어를 떼고 `apiOrigin`으로 보낸다
  - Pages Function `onRequest({ request, env })` — `env.API_ORIGIN`이 없으면 503 `SERVER_UNAVAILABLE`
  - Pages 환경변수 `API_ORIGIN`(예: `https://salad-bowl-api.onrender.com`). 설정은 Plan 05에서 한다

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/proxy/forward.test.ts`

```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/[[path]]'
import { forward } from './forward'

type FetchCall = [string, RequestInit]

afterEach(() => vi.unstubAllGlobals())

describe('forward', () => {
  it('strips /api and passes method, query, cookies and body through', async () => {
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json', 'set-cookie': 'refresh=new; Path=/api/auth; HttpOnly' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const request = new Request('https://salad.pages.dev/api/me/transactions?month=2026-10', {
      method: 'POST',
      headers: { cookie: 'refresh=old', 'content-type': 'application/json' },
      body: '{"a":1}',
    })

    const response = await forward(request, 'https://api.example.com')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/me/transactions?month=2026-10')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
    expect(new Headers(init.headers).get('cookie')).toBe('refresh=old')
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"a":1}')
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toContain('Path=/api/auth')
  })

  it('sends GET requests without a body', async () => {
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)

    await forward(new Request('https://salad.pages.dev/api/groups'), 'https://api.example.com')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/groups')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
  })

  it('answers 502 SERVER_UNAVAILABLE when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))

    const response = await forward(new Request('https://salad.pages.dev/api/me'), 'https://api.example.com')

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'SERVER_UNAVAILABLE' })
  })
})

describe('Pages Function', () => {
  it('answers 503 when API_ORIGIN is not configured', async () => {
    const response = await onRequest({ request: new Request('https://salad.pages.dev/api/me'), env: {} })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'SERVER_UNAVAILABLE' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run proxy`
Expected: FAIL — `./forward`와 Function 파일이 없음.

- [ ] **Step 3: 구현**

`apps/web/proxy/forward.ts`:

```ts
/**
 * Cloudflare Pages Functions에서 `/api/*` 요청을 API 서버로 넘긴다.
 * 브라우저는 Pages와 같은 출처만 부르므로 CORS가 없고, refresh 쿠키(Path=/api/auth)도 그대로 오간다.
 */
export async function forward(request: Request, apiOrigin: string): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(apiOrigin)
  target.pathname = incoming.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
  target.search = incoming.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  try {
    return await fetch(target.toString(), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    })
  } catch {
    return Response.json({ code: 'SERVER_UNAVAILABLE', message: 'API server is unreachable' }, { status: 502 })
  }
}
```

`apps/web/functions/api/[[path]].ts`:

```ts
import { forward } from '../../proxy/forward'

type Env = { API_ORIGIN?: string }

/** `/api` 와 `/api/*` 를 API 서버(Render)로 넘긴다. API_ORIGIN은 Pages 환경변수로 정한다. */
export async function onRequest({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.API_ORIGIN) {
    return Response.json({ code: 'SERVER_UNAVAILABLE', message: 'API_ORIGIN is not configured' }, { status: 503 })
  }
  return forward(request, env.API_ORIGIN)
}
```

`apps/web/tsconfig.functions.json`(`tsconfig.node.json`과 같은 방식으로 `tsc -b`가 검사한다):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.functions.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": [],
    "skipLibCheck": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["functions", "proxy"]
}
```

`apps/web/tsconfig.json`의 `references`에 `{ "path": "./tsconfig.functions.json" }`을 더한다.

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npx vitest run proxy && npm test && npm run typecheck && npm run lint && npm run build`
Expected: 모두 통과. 테스트 파일의 `_args` 매개변수가 `noUnusedParameters`에 걸리면 `vi.fn<(...args: FetchCall) => Promise<Response>>(async () => …)` 형태로 바꾼다.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/proxy apps/web/functions apps/web/tsconfig.functions.json apps/web/tsconfig.json
git commit -m "feat(web): Cloudflare Pages Function that proxies /api to the API server"
```

---

## 남기는 것 (Plan 05 이후)

- Pages 프로젝트 설정(루트 `apps/web`, 빌드 `npm run build`, 출력 `dist`, 환경변수 `API_ORIGIN`·`VITE_API_BASE_URL` 미설정)과 Render·Supabase 연결은 Plan 05에서 한다.
- `AbortError` 구분은 쿼리에 `signal`을 연결할 때 함께 한다(지금은 연결하지 않는다).
- 04b 후속 과제의 "화면 다듬기" 항목(비활성 버튼 모양, 달력 줄바꿈, 패널 위치, 글자 크기 토큰)은 디자인 보완 때 한다.
