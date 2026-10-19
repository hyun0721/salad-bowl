# Plan 04b — 홈·업로드·거래 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹앱의 홈(월 커버리지 캘린더와 업로드 대화상자), 업로드 화면, 거래 목록(내 거래·그룹 거래, 상세 패널, 수동 추가)을 실제 API에 연결해 만든다. 04a 후속 과제 중 화면 공통 규칙(CI lint, 쿼리 재시도, 오류 문구, 금액 표기, 페이지 제목, 공용 UI 스타일)도 먼저 정리한다.

**Architecture:** 기능별 폴더를 둔다.
- `imports`: 업로드 API, `UploadForm`, 업로드 화면
- `home`: 커버리지 API, 캘린더, 홈 화면
- `transactions`: 거래 API, 목록, 상세 패널, 수동 추가

서버 데이터는 TanStack Query로 가져오고, 쿼리 키 규칙(아래 Global Constraints)을 따른다. 업로드나 수정에 성공하면 관련 키를 무효화한다. 공용 스타일은 `src/common/ui.module.css`, 형식 변환은 `src/common/format.ts`에 둔다.

**Tech Stack:** React 19.3, react-router 8.4, TanStack Query 5, Vite 8, Vitest 4(jsdom), MSW 2, TypeScript 6, oxlint. API는 Spring Boot 4.1.1이다.

**선행 조건:** Plan 04a(PR hyun0721/salad-bowl#5)가 머지되어 있다. `main`에서 `feat/plan-04b-home-upload-transactions` 브랜치를 딴다.

## 설계 결정

| 항목 | 결정 |
|---|---|
| 업로드 위치 | `UploadForm` 하나를 업로드 화면과 홈의 업로드 대화상자에서 함께 쓴다 |
| 업로드 사전 검사 | 브라우저에서 확장자(.xlsx), 빈 파일, 5MB를 먼저 확인한다. 서버 검사는 그대로 둔다 |
| 업로드 오류 문구 | 서버의 `row N: ...`를 `N행의 값을 읽지 못했습니다. (원문)`으로 바꿔 보여준다 |
| 홈 "이번 달 요약" | 내 거래 중 KRW만, 이체를 빼고 수입·지출을 합한다. 지출은 양수로 표시한다. 숨긴 거래도 내 것이므로 포함한다 |
| 대화상자 | jsdom이 `<dialog>.showModal`을 지원하지 않아 `role="dialog"` + `aria-modal` 컴포넌트(`Modal`)를 만든다. Esc와 닫기 버튼으로 닫고, 열리면 대화상자로 포커스를 옮긴다 |
| 거래 수정 전송 | 상세 패널은 **바뀐 필드만** PATCH한다(바뀌지 않은 값으로 override가 생기지 않게). 빈 칸으로 저장하면 `""`를 보내 원본으로 되돌린다 |
| 수동 거래 금액 부호 | 사용자는 금액을 양수로 입력한다. 지출·이체는 음수로, 수입은 양수로 저장한다(뱅크샐러드 부호와 같다) |
| 거래 삭제 | 본인의 수동 거래만 삭제할 수 있다. 화면 안에서 한 번 더 확인한다(`confirm()`는 쓰지 않는다) |
| 검색 | 이번 달 목록 안에서 내용·카테고리를 브라우저에서 거른다(서버 검색 API 없음) |

## Global Constraints

- 웹앱은 `apps/web`. 새 패키지는 설치하지 않는다. 설치가 꼭 필요하면 로컬 Node 23에서는 `npm install --legacy-peer-deps`.
- API 주소는 `apiFetch`(`src/api/client.ts`)만 쓴다. 직접 `fetch`하지 않는다.
- **쿼리 키 규칙**(무효화에 쓴다):
  - `['groups']`, `['groups', groupId]`(그룹 상세)
  - `['coverage', year]`
  - `['imports']`
  - `['transactions', 'mine', month]`, `['transactions', 'group', groupId, month, memberId]`
  - `['audits', transactionId]`
- **로딩 판단**: 데이터가 아직 없음은 `isPending`으로 판단한다. 실패는 `isError`이고, "다시 시도" 버튼으로 `refetch`한다.
- **스타일**
  - 색·간격·모서리·글자는 `src/styles/tokens.css`의 CSS 변수만 쓴다.
  - 컴포넌트 스타일은 CSS Modules로 쓰고, 공용 클래스는 `src/common/ui.module.css`에 둔다. inline style은 쓰지 않는다.
- **문구**: 한국어, 합니다체. 이모지는 쓰지 않는다. 아이콘은 인라인 SVG(`currentColor`, 장식용은 `aria-hidden="true"`)로 그린다.
- **접근성**
  - 실제 `<button>`, `<a>`, `<label>`+`<input>`을 쓴다. 누르는 영역은 40px 이상, 주요 버튼은 44px 이상이다.
  - 화면마다 `usePageTitle`로 `document.title`을 정한다.
- **금액·날짜 표기**: `src/common/format.ts`만 쓴다. 거래 금액은 부호를 붙이고(`-₩ 7,000`), 합계는 부호 없이 쓴다.
- **테스트**
  - 화면 테스트는 `src/test/renderPage.tsx`의 `renderPage`를 쓴다(로그인 상태, Query, Group, Router 포함).
  - MSW 핸들러 URL은 `*/api/...` 형식이다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>`

## API 계약 (이미 있음)

| 호출 | 응답 |
|---|---|
| `POST /imports` (multipart `file`) | `201 {batchId, totalRows, createdRows, updatedRows, unchangedRows}` · 오류 `400 INVALID_FILE_FORMAT`(message `row N: ...` 가능), `413 FILE_TOO_LARGE` |
| `GET /imports` | `[{batchId, fileName, totalRows, createdRows, updatedRows, unchangedRows, importedAt}]` 최신 순 |
| `GET /me/coverage?year=YYYY` | `[{month: "YYYY-MM", importedCount}]` |
| `GET /me/transactions?month=YYYY-MM` | `TransactionView[]` 최신 순, 숨긴 거래 포함 |
| `GET /groups/{id}/transactions?month=&memberId=` | `TransactionView[]`, 숨긴 거래 제외 |
| `GET /groups/{id}` | `{groupId, name, myRole, members: [{userId, nickname, role, shareEnabled, joinedAt}]}` |
| `POST /me/transactions` | `{occurredAt, type, categoryMajor, categoryMinor?, description, amount, paymentMethod?, memo?}` → `201 TransactionView` |
| `PATCH /transactions/{id}` | `{categoryMajor?, categoryMinor?, memo?, hidden?}`(null·생략은 변경 없음, `""`는 override 삭제) → `TransactionView` |
| `DELETE /transactions/{id}` | `204` · `409 CANNOT_DELETE_IMPORTED`, `403` |
| `GET /transactions/{id}/audits` | `[{actorId, actorNickname, field, before, after, changedAt}]` |

`TransactionView`: `{id, ownerId, ownerNickname, occurredAt, type: 'INCOME'|'EXPENSE'|'TRANSFER', categoryMajor, categoryMinor, description, amount: number, currency, paymentMethod, memo: string|null, hidden, source: 'IMPORT'|'MANUAL', edited, editable}`

---

### Task 1: 화면 공통 규칙 (CI lint, 쿼리 재시도, 오류 문구, 형식 변환, 페이지 제목, 공용 스타일, 테스트 헬퍼)

**Files:**
- Modify: `.github/workflows/web-ci.yml`
- Create: `apps/web/src/api/queryClient.ts`, `apps/web/src/api/queryClient.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/common/errorMessage.ts`, Create: `apps/web/src/common/errorMessage.test.ts`
- Create: `apps/web/src/common/format.ts`, `apps/web/src/common/format.test.ts`
- Create: `apps/web/src/common/usePageTitle.ts`
- Create: `apps/web/src/common/ui.module.css`
- Create: `apps/web/src/test/renderPage.tsx`
- Modify: `apps/web/src/test/setup.ts`

**Interfaces:**
- Consumes: `ApiError`(`src/api/errors.ts`), `AuthProvider`, `RequireAuth`, `GroupProvider`, `server`(MSW)
- Produces:
  - `shouldRetry(failureCount: number, error: unknown): boolean`: 4xx `ApiError`는 재시도하지 않는다. 그 밖의 오류는 한 번만 재시도한다.
  - `createQueryClient(): QueryClient`: `retry: shouldRetry`, `refetchOnWindowFocus: false`
  - `errorMessage`에 추가하는 코드: `INVALID_TOKEN`, `CONFLICT`, `REQUEST_FAILED`, `INVALID_FILE_FORMAT`, `FILE_TOO_LARGE`, `CANNOT_DELETE_IMPORTED`
  - `formatWon(amount: number): string`: `₩ 1,234`(부호 없음, 음수는 절댓값)
  - `formatSignedWon(amount: number): string`: `-₩ 7,000` / `+₩ 3,000,000` / `₩ 0`
  - `formatDateTime(iso: string): string`: `2026-09-10T12:00:00` → `09-10 12:00`
  - `formatMonthLabel(month: string): string`: `2026-09` → `2026년 9월`
  - `currentYearMonth(today?: Date): string`: `YYYY-MM`
  - `usePageTitle(title: string): void`: `document.title = "<title> · Salad Bowl"`
  - `ui.module.css` 클래스: `card`, `stack`, `row`, `button`, `primary`, `danger`, `field`, `input`, `alert`, `status`, `muted`, `badge`, `badgePending`, `pageHeader`
  - `renderPage(ui, { groups?, path? })` → `{ client, user }`(`client`: QueryClient, `user`: userEvent 인스턴스). 로그인 상태(`me = {userId: 1, email: 'me@test.com', nickname: '나'}`)로 렌더하고 `/auth/refresh`, `/me`, `/groups` 핸들러를 등록한다. `testMe`를 export한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/api/queryClient.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError(403, 'REMOVED_FROM_GROUP', 'x'))).toBe(false)
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false)
    expect(shouldRetry(0, new ApiError(400, 'VALIDATION_FAILED', 'x'))).toBe(false)
  })

  it('retries server and network errors once', () => {
    expect(shouldRetry(0, new ApiError(503, 'REQUEST_FAILED', 'x'))).toBe(true)
    expect(shouldRetry(0, new ApiError(0, 'NETWORK_ERROR', 'x'))).toBe(true)
    expect(shouldRetry(1, new ApiError(503, 'REQUEST_FAILED', 'x'))).toBe(false)
    expect(shouldRetry(0, new Error('boom'))).toBe(true)
  })
})
```

`src/common/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { currentYearMonth, formatDateTime, formatMonthLabel, formatSignedWon, formatWon } from './format'

describe('format', () => {
  it('formats won with and without sign', () => {
    expect(formatWon(1234000)).toBe('₩ 1,234,000')
    expect(formatWon(-7000)).toBe('₩ 7,000')
    expect(formatSignedWon(-7000)).toBe('-₩ 7,000')
    expect(formatSignedWon(3000000)).toBe('+₩ 3,000,000')
    expect(formatSignedWon(0)).toBe('₩ 0')
  })

  it('formats date time and month labels', () => {
    expect(formatDateTime('2026-09-10T12:00:00')).toBe('09-10 12:00')
    expect(formatDateTime('2026-09-10T08:05')).toBe('09-10 08:05')
    expect(formatMonthLabel('2026-09')).toBe('2026년 9월')
    expect(currentYearMonth(new Date(2026, 9, 19))).toBe('2026-10')
    expect(currentYearMonth(new Date(2026, 0, 1))).toBe('2026-01')
  })
})
```

`src/common/errorMessage.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('maps upload and transaction codes', () => {
    expect(errorMessage(new ApiError(413, 'FILE_TOO_LARGE', 'x'))).toBe('파일은 5MB 이하만 올릴 수 있습니다.')
    expect(errorMessage(new ApiError(400, 'INVALID_FILE_FORMAT', 'x'))).toBe('뱅크샐러드에서 내려받은 .xlsx 파일인지 확인해 주세요.')
    expect(errorMessage(new ApiError(409, 'CANNOT_DELETE_IMPORTED', 'x'))).toBe('엑셀로 가져온 거래는 삭제할 수 없습니다. 숨기기를 사용해 주세요.')
    expect(errorMessage(new ApiError(409, 'CONFLICT', 'x'))).toBe('다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('prefers overrides and falls back for unknown codes', () => {
    expect(errorMessage(new ApiError(404, 'NOT_FOUND', 'x'), { NOT_FOUND: '거래를 찾을 수 없습니다.' })).toBe('거래를 찾을 수 없습니다.')
    expect(errorMessage(new ApiError(418, 'TEAPOT', 'x'))).toBe('요청을 처리하지 못했습니다.')
    expect(errorMessage(new Error('x'))).toBe('요청을 처리하지 못했습니다.')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npm test -- src/api/queryClient src/common`
Expected: `./queryClient`, `./format`이 없고 새 오류 코드가 없어 FAIL

- [ ] **Step 3: `src/api/queryClient.ts`**

```ts
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

/** 4xx는 다시 보내도 같은 결과라 재시도하지 않는다. 서버·네트워크 오류는 한 번만 다시 시도한다. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry, refetchOnWindowFocus: false } },
  })
}
```

`src/App.tsx`의 `new QueryClient({...})`를 `createQueryClient()`로 바꾼다(`QueryClient` import는 지우고 `createQueryClient`를 import한다).

```tsx
  const [client] = useState(createQueryClient)
```

- [ ] **Step 4: `src/common/errorMessage.ts`의 `MESSAGES`에 추가**

```ts
  INVALID_TOKEN: '다시 로그인해 주세요.',
  CONFLICT: '다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요.',
  REQUEST_FAILED: '요청을 처리하지 못했습니다.',
  INVALID_FILE_FORMAT: '뱅크샐러드에서 내려받은 .xlsx 파일인지 확인해 주세요.',
  FILE_TOO_LARGE: '파일은 5MB 이하만 올릴 수 있습니다.',
  CANNOT_DELETE_IMPORTED: '엑셀로 가져온 거래는 삭제할 수 없습니다. 숨기기를 사용해 주세요.',
```

- [ ] **Step 5: `src/common/format.ts`**

```ts
const won = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 합계용: 부호 없이 원화 기호와 천 단위 쉼표. */
export function formatWon(amount: number): string {
  return `₩ ${won.format(Math.abs(amount))}`
}

/** 거래 금액용: 지출 -, 수입 +. */
export function formatSignedWon(amount: number): string {
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : ''
  return `${sign}${formatWon(amount)}`
}

/** API의 시간대 없는 한국 시간 `YYYY-MM-DDTHH:mm[:ss]` → `MM-DD HH:mm`. */
export function formatDateTime(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

/** `YYYY-MM` → `YYYY년 M월`. */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${year}년 ${Number(m)}월`
}

export function currentYearMonth(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}
```

- [ ] **Step 6: `src/common/usePageTitle.ts`**

```ts
import { useEffect } from 'react'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Salad Bowl`
  }, [title])
}
```

- [ ] **Step 7: `src/common/ui.module.css`**

```css
.card { background: var(--surface-000); border: 1px solid var(--line); border-radius: var(--radius-md); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.stack { display: flex; flex-direction: column; gap: var(--space-3); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.pageHeader { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); }
.button { min-height: 40px; padding: 0 var(--space-4); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); color: var(--ink); cursor: pointer; }
.button:disabled { opacity: 0.6; cursor: default; }
.primary { min-height: 44px; border: 0; background: var(--brand); color: var(--on-brand); font-weight: 700; }
.danger { border-color: var(--danger); color: var(--danger); }
.field { display: flex; flex-direction: column; gap: 4px; }
.field > span { font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-muted); }
.input { min-height: 40px; padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-000); }
textarea.input { padding: var(--space-2) var(--space-3); }
.alert { margin: 0; padding: var(--space-3); border-radius: var(--radius-sm); color: var(--danger); background: var(--surface-100); }
.status { margin: 0; color: var(--ink-muted); }
.muted { color: var(--ink-muted); font-size: 13px; line-height: 18px; }
.badge { display: inline-block; margin-left: 6px; font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.badgePending { color: var(--pending); }
```

- [ ] **Step 8: `src/test/renderPage.tsx`, `src/test/setup.ts`**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import RequireAuth from '../app/RequireAuth'
import { AuthProvider } from '../auth/AuthProvider'
import { GroupProvider } from '../groups/GroupProvider'
import { server } from './server'

export const testMe = { userId: 1, email: 'me@test.com', nickname: '나' }

type Options = { groups?: unknown[]; path?: string }

/** 로그인한 회원으로 화면 하나를 렌더한다. 화면이 쓰는 API 핸들러는 테스트에서 server.use로 더한다. */
export function renderPage(ui: ReactElement, { groups = [], path = '/' }: Options = {}) {
  server.use(
    http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'test-token' })),
    http.get('*/api/me', () => HttpResponse.json(testMe)),
    http.get('*/api/groups', () => HttpResponse.json(groups)),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <RequireAuth>
            <GroupProvider>{ui}</GroupProvider>
          </RequireAuth>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { client, user }
}
```

`src/test/setup.ts`의 `afterEach`에서 access 토큰도 지운다(테스트끼리 토큰이 남지 않게). import에 `import { setAccessToken } from '../api/client'`를 추가한다.

```ts
afterEach(() => {
  cleanup()
  server.resetHandlers()
  setAccessToken(null)
})
```

- [ ] **Step 9: web CI에 lint 추가**

`.github/workflows/web-ci.yml`의 `- run: npm run typecheck` 앞에 한 줄을 추가한다.

```yaml
      - run: npm run lint
```

- [ ] **Step 10: 테스트 통과와 전체 확인**

Run: `cd apps/web && npm test && npm run typecheck && npm run lint && npm run build`
Expected: 모두 PASS(기존 37 + 새 6)

- [ ] **Step 11: Commit**

```bash
git add apps/web .github/workflows/web-ci.yml
git commit -m "chore(web): shared UI conventions, retry rule, formatters and lint in CI"
```

---

### Task 2: 커버리지 API 연도 범위 검증

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/transaction/TransactionService.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/transaction/CoverageApiTest.java` (테스트 추가)

**Interfaces:**
- Consumes: `TransactionService.coverage(long userId, int year)`, `ApiException`, `ErrorCode.VALIDATION_FAILED`
- Produces: `GET /me/coverage?year=`에서 `year`가 1..9999 밖이면 `400 VALIDATION_FAILED`(지금은 극단값에서 500)

- [ ] **Step 1: 실패하는 테스트 추가**

`CoverageApiTest`에 추가한다.

```java
    @Test
    void yearOutsideSupportedRangeIsRejected() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");

        mvc.perform(get("/me/coverage").param("year", "0").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/me/coverage").param("year", "1000000000").header("Authorization", me.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api && ./gradlew test --tests '*CoverageApiTest'`
Expected: `year=1000000000`이 500으로 FAIL(`year=0`은 빈 목록 200으로 FAIL)

- [ ] **Step 3: `TransactionService.coverage` 맨 앞에 검증 추가**

```java
        if (year < 1 || year > 9999) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "year must be between 1 and 9999");
        }
```

`ApiException`, `ErrorCode` import는 이미 있다(없으면 추가한다).

- [ ] **Step 4: 테스트 통과와 전체 확인 후 Commit**

Run: `cd apps/api && ./gradlew test`
Expected: 모두 PASS(158 + 1)

```bash
git add apps/api/src
git commit -m "fix(api): validate coverage year range"
```

---

### Task 3: 업로드 (`importsApi`, `UploadForm`, 업로드 화면)

**Files:**
- Create: `apps/web/src/imports/importsApi.ts`
- Create: `apps/web/src/imports/useUpload.ts`
- Create: `apps/web/src/imports/UploadForm.tsx`, `apps/web/src/imports/UploadForm.module.css`
- Create: `apps/web/src/imports/UploadPage.tsx`
- Modify: `apps/web/src/app/AppRoutes.tsx` (`/upload` → `UploadPage`)
- Test: `apps/web/src/imports/UploadForm.test.tsx`, `apps/web/src/imports/UploadPage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `errorMessage`, `ApiError`, `formatDateTime`, `usePageTitle`, `ui.module.css`, `renderPage`(Task 1)
- Produces:
  - `type ImportResult = { batchId: number; totalRows: number; createdRows: number; updatedRows: number; unchangedRows: number }`
  - `type ImportBatchView = ImportResult & { fileName: string; importedAt: string }`
  - `MAX_UPLOAD_BYTES = 5 * 1024 * 1024`, `validateUploadFile(file: File): string | null`
  - `importsApi.upload(file: File): Promise<ImportResult>`, `importsApi.history(): Promise<ImportBatchView[]>`
  - `uploadErrorMessage(error: unknown): string`: `INVALID_FILE_FORMAT`의 `row N: 원문` → `N행의 값을 읽지 못했습니다. (원문)`
  - `useUpload()`: TanStack `useMutation`. 성공하면 `['coverage']`, `['imports']`, `['transactions']`를 무효화한다.
  - `<UploadForm onDone?: (result: ImportResult) => void />`: 파일 선택(끌어다 놓기 포함), 업로드, 결과(`role="status"`), 오류(`role="alert"`)
  - `UploadPage`: `/upload`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/imports/UploadForm.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import UploadForm from './UploadForm'

const xlsx = (name = '2026-09.xlsx', size = 10) =>
  new File([new Uint8Array(size)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

describe('UploadForm', () => {
  it('uploads the chosen file and shows the result', async () => {
    let receivedName: string | null = null
    server.use(http.post('*/api/imports', async ({ request }) => {
      const form = await request.formData()
      receivedName = (form.get('file') as File).name
      return HttpResponse.json({ batchId: 1, totalRows: 168, createdRows: 160, updatedRows: 3, unchangedRows: 5 }, { status: 201 })
    }))
    const onDone = vi.fn()
    const { user } = renderPage(<UploadForm onDone={onDone} />)

    await user.upload(await screen.findByLabelText(/파일을 끌어다 놓거나/), xlsx())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('전체168건')
    expect(result).toHaveTextContent('신규160건')
    expect(result).toHaveTextContent('갱신3건')
    expect(result).toHaveTextContent('변경 없음5건')
    expect(receivedName).toBe('2026-09.xlsx')
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ createdRows: 160 }))
  })

  it('rejects non-xlsx and oversized files before uploading', async () => {
    renderPage(<UploadForm />)
    const user = userEvent.setup({ applyAccept: false })
    const input = await screen.findByLabelText(/파일을 끌어다 놓거나/)

    await user.upload(input, new File(['a'], 'ledger.csv', { type: 'text/csv' }))
    expect(screen.getByRole('alert')).toHaveTextContent('.xlsx 파일만 올릴 수 있습니다.')
    expect(screen.getByRole('button', { name: '업로드' })).toBeDisabled()

    await user.upload(input, xlsx('big.xlsx', 5 * 1024 * 1024 + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('파일은 5MB 이하만 올릴 수 있습니다.')
  })

  it('shows the failing row from the server', async () => {
    server.use(http.post('*/api/imports', () =>
      HttpResponse.json({ code: 'INVALID_FILE_FORMAT', message: "row 3: unknown type '환전'" }, { status: 400 })))
    const { user } = renderPage(<UploadForm />)

    await user.upload(await screen.findByLabelText(/파일을 끌어다 놓거나/), xlsx())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("3행의 값을 읽지 못했습니다. (unknown type '환전')")
  })
})
```

`src/imports/UploadPage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import UploadPage from './UploadPage'

describe('UploadPage', () => {
  it('lists the upload history newest first and sets the title', async () => {
    server.use(http.get('*/api/imports', () => HttpResponse.json([
      { batchId: 2, fileName: '2026-09.xlsx', totalRows: 168, createdRows: 168, updatedRows: 0, unchangedRows: 0, importedAt: '2026-10-01T09:00:00+09:00' },
      { batchId: 1, fileName: '2026-08.xlsx', totalRows: 150, createdRows: 0, updatedRows: 2, unchangedRows: 148, importedAt: '2026-09-01T09:00:00+09:00' },
    ])))

    renderPage(<UploadPage />)

    const history = await screen.findByRole('region', { name: '업로드 이력' })
    const rows = await within(history).findAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('2026-09.xlsx')
    expect(rows[0]).toHaveTextContent('신규 168')
    expect(rows[1]).toHaveTextContent('2026-08.xlsx')
    expect(rows[1]).toHaveTextContent('변경 없음 148')
    expect(document.title).toBe('업로드 · Salad Bowl')
  })

  it('shows an empty history message', async () => {
    server.use(http.get('*/api/imports', () => HttpResponse.json([])))

    renderPage(<UploadPage />)

    expect(await screen.findByText('아직 올린 파일이 없습니다.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npm test -- src/imports`
Expected: 모듈이 없어 FAIL

- [ ] **Step 3: `src/imports/importsApi.ts`**

```ts
import { apiFetch } from '../api/client'
import { ApiError } from '../api/errors'
import { errorMessage } from '../common/errorMessage'

export type ImportResult = {
  batchId: number
  totalRows: number
  createdRows: number
  updatedRows: number
  unchangedRows: number
}

export type ImportBatchView = ImportResult & { fileName: string; importedAt: string }

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** 서버에 보내기 전에 거를 수 있는 것만 거른다. 내용 검사는 서버가 한다. */
export function validateUploadFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return '.xlsx 파일만 올릴 수 있습니다.'
  if (file.size === 0) return '빈 파일입니다. 다른 파일을 선택해 주세요.'
  if (file.size > MAX_UPLOAD_BYTES) return '파일은 5MB 이하만 올릴 수 있습니다.'
  return null
}

/** 서버의 `row N: 원문`을 행 번호가 보이는 문구로 바꾼다. */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'INVALID_FILE_FORMAT') {
    const match = /^row (\d+): (.*)$/.exec(error.message)
    if (match) return `${match[1]}행의 값을 읽지 못했습니다. (${match[2]})`
  }
  return errorMessage(error)
}

export const importsApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<ImportResult>('/imports', { method: 'POST', body: form })
  },
  history: () => apiFetch<ImportBatchView[]>('/imports'),
}
```

- [ ] **Step 4: `src/imports/useUpload.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importsApi } from './importsApi'

/** 업로드 후 커버리지·이력·거래 목록을 새로 가져오게 한다. */
export function useUpload() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: importsApi.upload,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coverage'] })
      void client.invalidateQueries({ queryKey: ['imports'] })
      void client.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
```

- [ ] **Step 5: `src/imports/UploadForm.tsx`, `UploadForm.module.css`**

```tsx
import { useState, type DragEvent, type FormEvent } from 'react'
import ui from '../common/ui.module.css'
import { uploadErrorMessage, validateUploadFile, type ImportResult } from './importsApi'
import styles from './UploadForm.module.css'
import { useUpload } from './useUpload'

type Props = { onDone?: (result: ImportResult) => void }

export default function UploadForm({ onDone }: Props) {
  const upload = useUpload()
  const [file, setFile] = useState<File | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function choose(next: File | null | undefined) {
    upload.reset()
    if (!next) return
    const problem = validateUploadFile(next)
    setClientError(problem)
    setFile(problem ? null : next)
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    upload.mutate(file, { onSuccess: (result) => onDone?.(result) })
  }

  const error = clientError ?? (upload.isError ? uploadErrorMessage(upload.error) : null)
  const result = upload.data

  return (
    <form className={ui.stack} onSubmit={onSubmit}>
      <label
        className={dragging ? `${styles.drop} ${styles.dragging}` : styles.drop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className={styles.dropTitle}>파일을 끌어다 놓거나 눌러서 선택</span>
        <span className={ui.muted}>.xlsx · 최대 5MB · 원본 파일과 개인정보 시트는 저장하지 않습니다</span>
        <input type="file" accept=".xlsx" className={styles.input}
          onChange={(e) => choose(e.target.files?.[0])} />
        {file && <span className={styles.fileName}>{file.name}</span>}
      </label>
      <div className={styles.actions}>
        <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={!file || upload.isPending}>
          {upload.isPending ? '올리는 중' : '업로드'}
        </button>
      </div>
      {error && <p role="alert" className={ui.alert}>{error}</p>}
      {result && (
        <div role="status" className={styles.result}>
          <p className={styles.resultTitle}>업로드가 끝났습니다.</p>
          <dl className={styles.counts}>
            <div><dt>전체</dt><dd>{result.totalRows}건</dd></div>
            <div><dt>신규</dt><dd>{result.createdRows}건</dd></div>
            <div><dt>갱신</dt><dd>{result.updatedRows}건</dd></div>
            <div><dt>변경 없음</dt><dd>{result.unchangedRows}건</dd></div>
          </dl>
        </div>
      )}
    </form>
  )
}
```

```css
.drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); min-height: 180px; padding: var(--space-4); border: 2px dashed var(--line); border-radius: var(--radius-md); background: var(--surface-100); text-align: center; cursor: pointer; }
.dragging { border-color: var(--brand); background: var(--brand-tint); }
.dropTitle { font-weight: 700; }
.input { max-width: 100%; }
.fileName { font-weight: 500; }
.actions { display: flex; justify-content: flex-end; }
.result { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-sm); background: var(--brand-tint); }
.resultTitle { margin: 0; font-weight: 700; }
.counts { margin: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); }
.counts dt { font-size: 13px; color: var(--ink-muted); }
.counts dd { margin: 0; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: `src/imports/UploadPage.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import ui from '../common/ui.module.css'
import { formatDateTime } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { importsApi } from './importsApi'
import UploadForm from './UploadForm'

export default function UploadPage() {
  usePageTitle('업로드')
  const history = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })

  return (
    <>
      <h1>뱅크샐러드 엑셀 업로드</h1>
      <section aria-labelledby="upload-title" className={ui.card}>
        <h2 id="upload-title">파일 올리기</h2>
        <ol className={ui.stack}>
          <li>뱅크샐러드 앱에서 가계부 엑셀을 내려받습니다.</li>
          <li>파일을 그대로 올립니다. 여러 달이 들어 있어도 됩니다.</li>
          <li>이미 있는 거래는 건너뛰고, 내가 고친 카테고리·메모는 유지됩니다.</li>
        </ol>
        <UploadForm />
      </section>
      <section aria-labelledby="history-title" className={ui.card}>
        <h2 id="history-title">업로드 이력</h2>
        {history.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
        {history.isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>업로드 이력을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void history.refetch()}>다시 시도</button>
          </div>
        )}
        {history.data && history.data.length === 0 && <p className={ui.status}>아직 올린 파일이 없습니다.</p>}
        {history.data && history.data.length > 0 && (
          <ul className={ui.stack}>
            {history.data.map((batch) => (
              <li key={batch.batchId} className={ui.row}>
                <strong>{batch.fileName}</strong>
                <span className={ui.muted}>{formatDateTime(batch.importedAt)}</span>
                <span className={ui.muted}>신규 {batch.createdRows} · 갱신 {batch.updatedRows} · 변경 없음 {batch.unchangedRows}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
```

`<section aria-labelledby>`는 접근성 트리에서 `region`이고, 이름은 "업로드 이력"이다. 테스트는 이 이름으로 찾는다.

- [ ] **Step 7: 라우트 연결**

`AppRoutes.tsx`의 `<Route path="upload" element={<PagePlaceholder title="업로드" />} />`를 바꾼다.

```tsx
          <Route path="upload" element={<UploadPage />} />
```

(import: `import UploadPage from '../imports/UploadPage'`)

`AppRoutes.test.tsx`의 `navigates between menu pages` 테스트는 업로드 화면의 h1을 찾는다. 기대 이름을 `'뱅크샐러드 엑셀 업로드'`로 바꾸고, 그 테스트에 `http.get('*/api/imports', () => HttpResponse.json([]))` 핸들러를 더한다.

- [ ] **Step 8: 테스트 통과와 전체 확인 후 Commit**

Run: `cd apps/web && npm test && npm run typecheck && npm run lint`
Expected: 모두 PASS(UploadForm 3, UploadPage 2 추가)

```bash
git add apps/web/src
git commit -m "feat(web): upload form and upload page with history"
```

---

### Task 4: 홈 (월 커버리지 캘린더, 업로드 대화상자, 이번 달 요약, 최근 업로드)

**Files:**
- Create: `apps/web/src/common/Modal.tsx`, `apps/web/src/common/Modal.module.css`
- Create: `apps/web/src/home/coverageApi.ts`
- Create: `apps/web/src/home/CoverageCalendar.tsx`, `apps/web/src/home/CoverageCalendar.module.css`
- Create: `apps/web/src/home/HomePage.tsx`, `apps/web/src/home/HomePage.module.css`
- Create: `apps/web/src/transactions/transactionsApi.ts`
- Create: `apps/web/src/transactions/summary.ts`, `apps/web/src/transactions/summary.test.ts`
- Modify: `apps/web/src/app/AppRoutes.tsx` (index → `HomePage`)
- Modify: `apps/web/src/app/AppRoutes.test.tsx` (홈 화면 핸들러)
- Test: `apps/web/src/home/HomePage.test.tsx`, `apps/web/src/common/Modal.test.tsx`

**Interfaces:**
- Consumes: `UploadForm`, `importsApi.history`(Task 3), `formatWon`, `formatMonthLabel`, `currentYearMonth`, `usePageTitle`, `ui.module.css`, `renderPage`(Task 1)
- Produces:
  - `<Modal title: string; onClose: () => void; children />`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Esc나 [닫기] 버튼으로 닫는다. 열릴 때 대화상자에 포커스를 옮긴다.
  - `type CoverageMonth = { month: string; importedCount: number }`, `coverageApi.get(year: number): Promise<CoverageMonth[]>`
  - `type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'`, `type TransactionView = {...}`(API 계약 그대로), `transactionsApi.mine(month: string): Promise<TransactionView[]>`. Task 5, 6에서 함수를 더한다.
  - `summarize(txs: TransactionView[]): { income: number; expense: number }`: KRW만, 이체 제외, 지출은 양수(환불은 차감)
  - `<CoverageCalendar year: number; today: Date; coverage: CoverageMonth[]; onPickMissing(month: string): void />`
  - `<HomePage today?: Date />`: 테스트에서 오늘 날짜를 넣을 수 있다. 기본값은 `new Date()`.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/transactions/summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { summarize } from './summary'
import type { TransactionView } from './transactionsApi'

const tx = (type: TransactionView['type'], amount: number, currency = 'KRW'): TransactionView => ({
  id: Math.random(), ownerId: 1, ownerNickname: '나', occurredAt: '2026-09-01T12:00:00', type,
  categoryMajor: '식비', categoryMinor: '', description: 'x', amount, currency, paymentMethod: '카드',
  memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
})

describe('summarize', () => {
  it('sums KRW income and expense, ignores transfers, subtracts refunds', () => {
    expect(summarize([
      tx('INCOME', 3000000), tx('EXPENSE', -10000), tx('EXPENSE', -5000), tx('EXPENSE', 2000),
      tx('TRANSFER', -500000), tx('EXPENSE', -120, 'USD'),
    ])).toEqual({ income: 3000000, expense: 13000 })
  })
})
```

`src/common/Modal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Modal from './Modal'

describe('Modal', () => {
  it('is a labelled modal dialog that takes focus and closes with Escape or the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal title="9월 데이터 업로드" onClose={onClose}><p>내용</p></Modal>)

    const dialog = screen.getByRole('dialog', { name: '9월 데이터 업로드' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

`src/home/HomePage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import HomePage from './HomePage'

const today = new Date(2026, 9, 19) // 2026-10-19

function handlers(coverage: { month: string; importedCount: number }[]) {
  server.use(
    http.get('*/api/me/coverage', ({ request }) => {
      const year = new URL(request.url).searchParams.get('year')
      return HttpResponse.json(year === '2026' ? coverage : [])
    }),
    http.get('*/api/me/transactions', () => HttpResponse.json([])),
    http.get('*/api/imports', () => HttpResponse.json([])),
  )
}

describe('HomePage', () => {
  it('shows registered, missing and upcoming months for the year', async () => {
    handlers([{ month: '2026-01', importedCount: 120 }, { month: '2026-09', importedCount: 168 }])

    renderPage(<HomePage today={today} />)

    const calendar = await screen.findByRole('region', { name: '월별 등록 현황' })
    expect(await within(calendar).findByText('등록됨 · 168건')).toBeInTheDocument()
    expect(within(calendar).getByText('등록됨 · 120건')).toBeInTheDocument()
    expect(within(calendar).getByRole('button', { name: '2026년 2월 미등록, 업로드하기' })).toBeInTheDocument()
    expect(within(calendar).getByRole('button', { name: '2026년 10월 미등록, 업로드하기' })).toBeInTheDocument()
    expect(within(calendar).queryByRole('button', { name: /2026년 11월/ })).not.toBeInTheDocument()
    expect(within(calendar).getAllByText('예정')).toHaveLength(2)
    expect(document.title).toBe('내 가계부 · Salad Bowl')
  })

  it('moves between years', async () => {
    handlers([{ month: '2026-09', importedCount: 168 }])
    const { user } = renderPage(<HomePage today={today} />)

    await screen.findByText('등록됨 · 168건')
    await user.click(screen.getByRole('button', { name: '이전 연도' }))

    expect(await screen.findByText('2025년')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '2025년 9월 미등록, 업로드하기' })).toBeInTheDocument()
  })

  it('opens the upload dialog from a missing month and refreshes the calendar after upload', async () => {
    let uploaded = false
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json(uploaded
        ? [{ month: '2026-02', importedCount: 90 }]
        : [])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.post('*/api/imports', () => {
        uploaded = true
        return HttpResponse.json({ batchId: 1, totalRows: 90, createdRows: 90, updatedRows: 0, unchangedRows: 0 }, { status: 201 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 2월 미등록, 업로드하기' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 2월 데이터 업로드' })
    await user.upload(within(dialog).getByLabelText(/파일을 끌어다 놓거나/),
      new File([new Uint8Array(10)], 'feb.xlsx'))
    await user.click(within(dialog).getByRole('button', { name: '업로드' }))
    expect(await within(dialog).findByRole('status')).toHaveTextContent('신규90건')
    await user.click(within(dialog).getByRole('button', { name: '닫기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('등록됨 · 90건')).toBeInTheDocument()
  })

  it('summarizes this month and lists recent uploads', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', ({ request }) => {
        expect(new URL(request.url).searchParams.get('month')).toBe('2026-10')
        return HttpResponse.json([
          { id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-01T09:00:00', type: 'INCOME', categoryMajor: '급여', categoryMinor: '', description: '월급', amount: 3000000, currency: 'KRW', paymentMethod: '은행', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
          { id: 2, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-02T12:00:00', type: 'EXPENSE', categoryMajor: '식비', categoryMinor: '', description: '점심', amount: -12000, currency: 'KRW', paymentMethod: '카드', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
        ])
      }),
      http.get('*/api/imports', () => HttpResponse.json([
        { batchId: 3, fileName: '2026-10.xlsx', totalRows: 2, createdRows: 2, updatedRows: 0, unchangedRows: 0, importedAt: '2026-10-19T09:00:00+09:00' },
      ])),
    )

    renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '이번 달 내 요약 (2026년 10월)' })
    expect(await within(summary).findByText('₩ 3,000,000')).toBeInTheDocument()
    expect(within(summary).getByText('₩ 12,000')).toBeInTheDocument()
    const recent = screen.getByRole('region', { name: '최근 업로드' })
    expect(await within(recent).findByText('2026-10.xlsx')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npm test -- src/home src/common/Modal src/transactions`
Expected: 모듈이 없어 FAIL

- [ ] **Step 3: `src/transactions/transactionsApi.ts`, `src/transactions/summary.ts`**

```ts
import { apiFetch } from '../api/client'

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

/** 화면용 거래. categoryMajor·categoryMinor·memo는 override가 있으면 override 값이다. amount는 부호가 있다. */
export type TransactionView = {
  id: number
  ownerId: number
  ownerNickname: string
  occurredAt: string
  type: TransactionType
  categoryMajor: string
  categoryMinor: string
  description: string
  amount: number
  currency: string
  paymentMethod: string
  memo: string | null
  hidden: boolean
  source: 'IMPORT' | 'MANUAL'
  edited: boolean
  editable: boolean
}

export const transactionsApi = {
  mine: (month: string) => apiFetch<TransactionView[]>(`/me/transactions?month=${encodeURIComponent(month)}`),
}
```

```ts
import type { TransactionView } from './transactionsApi'

/** 서버의 그룹 요약과 같은 규칙: KRW만, 이체 제외, 지출은 양수 합(환불은 차감). */
export function summarize(txs: TransactionView[]): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const tx of txs) {
    if (tx.currency !== 'KRW' || tx.type === 'TRANSFER') continue
    if (tx.type === 'INCOME') income += tx.amount
    else expense -= tx.amount
  }
  return { income, expense }
}
```

- [ ] **Step 4: `src/common/Modal.tsx`, `Modal.module.css`**

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react'
import ui from './ui.module.css'
import styles from './Modal.module.css'

type Props = { title: string; onClose: () => void; children: ReactNode }

export default function Modal({ title, onClose, children }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className={styles.overlay}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={styles.dialog}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={ui.button} onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

```css
.overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: var(--space-6) max(16px, env(safe-area-inset-left, 0px)); background: rgb(20 24 21 / 0.45); z-index: 10; }
.dialog { width: 100%; max-width: 560px; max-height: 100%; overflow: auto; background: var(--surface-000); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
.dialog:focus { outline: none; }
.header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
```

- [ ] **Step 5: `src/home/coverageApi.ts`**

```ts
import { apiFetch } from '../api/client'

export type CoverageMonth = { month: string; importedCount: number }

export const coverageApi = {
  get: (year: number) => apiFetch<CoverageMonth[]>(`/me/coverage?year=${year}`),
}
```

- [ ] **Step 6: `src/home/CoverageCalendar.tsx`, `CoverageCalendar.module.css`**

```tsx
import styles from './CoverageCalendar.module.css'
import type { CoverageMonth } from './coverageApi'

type Props = {
  year: number
  today: Date
  coverage: CoverageMonth[]
  onPickMissing: (month: string) => void
}

export default function CoverageCalendar({ year, today, coverage, onPickMissing }: Props) {
  const counts = new Map(coverage.map((c) => [c.month, c.importedCount]))
  const thisYear = today.getFullYear()
  const thisMonth = today.getMonth() + 1

  return (
    <ul className={styles.grid}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const month = `${year}-${String(m).padStart(2, '0')}`
        const label = `${m}월`
        const future = year > thisYear || (year === thisYear && m > thisMonth)
        const count = counts.get(month)
        return (
          <li key={month}>
            {count !== undefined ? (
              <div className={`${styles.cell} ${styles.registered}`}>
                <span className={styles.month}>{label}</span>
                <span className={styles.state}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  등록됨 · {count}건
                </span>
              </div>
            ) : future ? (
              <div className={`${styles.cell} ${styles.future}`}>
                <span className={styles.month}>{label}</span>
                <span className={styles.state}>예정</span>
              </div>
            ) : (
              <button type="button" className={`${styles.cell} ${styles.missing}`}
                aria-label={`${year}년 ${label} 미등록, 업로드하기`}
                onClick={() => onPickMissing(month)}>
                <span className={styles.month}>{label}</span>
                <span className={styles.state}>미등록 · 업로드하기</span>
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
```

```css
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--space-3); }
.cell { width: 100%; min-height: 96px; padding: 14px; border-radius: var(--radius-md); display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; text-align: left; }
.month { font-weight: 700; }
.state { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
.registered { border: 1px solid var(--brand); background: var(--brand-tint); color: var(--ink); }
.registered .state { color: var(--brand); }
.missing { border: 1px dashed var(--pending); background: var(--pending-tint); color: var(--ink); cursor: pointer; }
.missing .state { color: var(--pending); }
.future { border: 1px solid var(--line); background: var(--surface-100); color: var(--ink-muted); }
@media (max-width: 820px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
```

- [ ] **Step 7: `src/home/HomePage.tsx`, `HomePage.module.css`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import Modal from '../common/Modal'
import ui from '../common/ui.module.css'
import { currentYearMonth, formatDateTime, formatMonthLabel, formatWon } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { importsApi } from '../imports/importsApi'
import UploadForm from '../imports/UploadForm'
import { summarize } from '../transactions/summary'
import { transactionsApi } from '../transactions/transactionsApi'
import CoverageCalendar from './CoverageCalendar'
import { coverageApi } from './coverageApi'
import styles from './HomePage.module.css'

type Props = { today?: Date }

export default function HomePage({ today = new Date() }: Props) {
  usePageTitle('내 가계부')
  const [year, setYear] = useState(today.getFullYear())
  const [uploadMonth, setUploadMonth] = useState<string | null>(null)
  const month = currentYearMonth(today)

  const coverage = useQuery({ queryKey: ['coverage', year], queryFn: () => coverageApi.get(year) })
  const mine = useQuery({ queryKey: ['transactions', 'mine', month], queryFn: () => transactionsApi.mine(month) })
  const imports = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })
  const totals = mine.data ? summarize(mine.data) : null

  return (
    <>
      <div className={ui.pageHeader}>
        <h1>내 가계부</h1>
        <div className={ui.row}>
          <button type="button" className={ui.button} aria-label="이전 연도" onClick={() => setYear(year - 1)}>‹</button>
          <span className={styles.year}>{year}년</span>
          <button type="button" className={ui.button} aria-label="다음 연도" onClick={() => setYear(year + 1)}>›</button>
        </div>
      </div>

      <section aria-labelledby="coverage-title" className={ui.card}>
        <div className={ui.pageHeader}>
          <h2 id="coverage-title">월별 등록 현황</h2>
          <span className={ui.muted}>거래 일자 기준 · 미등록 월을 누르면 업로드합니다</span>
        </div>
        {coverage.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
        {coverage.isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>등록 현황을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void coverage.refetch()}>다시 시도</button>
          </div>
        )}
        {coverage.data && (
          <CoverageCalendar year={year} today={today} coverage={coverage.data} onPickMissing={setUploadMonth} />
        )}
      </section>

      <div className={styles.twoColumns}>
        <section aria-labelledby="summary-title" className={ui.card}>
          <h2 id="summary-title">이번 달 내 요약 ({formatMonthLabel(month)})</h2>
          {mine.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {mine.isError && <p role="alert" className={ui.alert}>이번 달 거래를 불러오지 못했습니다.</p>}
          {totals && (
            <dl className={styles.totals}>
              <div><dt>수입</dt><dd>{formatWon(totals.income)}</dd></div>
              <div><dt>지출</dt><dd>{formatWon(totals.expense)}</dd></div>
            </dl>
          )}
          <Link to="/transactions">내 거래 보기</Link>
        </section>

        <section aria-labelledby="recent-title" className={ui.card}>
          <h2 id="recent-title">최근 업로드</h2>
          {imports.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {imports.data && imports.data.length === 0 && <p className={ui.status}>아직 올린 파일이 없습니다.</p>}
          {imports.data && imports.data.length > 0 && (
            <ul className={ui.stack}>
              {imports.data.slice(0, 3).map((batch) => (
                <li key={batch.batchId} className={ui.row}>
                  <span>{batch.fileName}</span>
                  <span className={ui.muted}>{formatDateTime(batch.importedAt)} · 신규 {batch.createdRows}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/upload">업로드 이력 전체</Link>
        </section>
      </div>

      {uploadMonth && (
        <Modal title={`${formatMonthLabel(uploadMonth)} 데이터 업로드`} onClose={() => setUploadMonth(null)}>
          <p className={ui.status}>뱅크샐러드에서 내려받은 엑셀(.xlsx)을 올려주세요. 여러 달이 들어 있어도 거래 일자에 맞게 반영됩니다.</p>
          <UploadForm />
        </Modal>
      )}
    </>
  )
}
```

```css
.year { min-width: 72px; text-align: center; font-size: 18px; font-weight: 700; }
.twoColumns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); }
.totals { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.totals > div { padding: var(--space-4); border-radius: var(--radius-sm); background: var(--surface-100); }
.totals dt { font-size: 13px; color: var(--ink-muted); }
.totals dd { margin: 0; font-size: 24px; line-height: 32px; font-weight: 700; font-variant-numeric: tabular-nums; }
@media (max-width: 820px) { .twoColumns { grid-template-columns: minmax(0, 1fr); } }
```

- [ ] **Step 8: 라우트 연결과 기존 테스트 정리**

`AppRoutes.tsx`의 index 라우트를 `<Route index element={<HomePage />} />`로 바꾼다(import: `import HomePage from '../home/HomePage'`).

`AppRoutes.test.tsx`는 홈을 렌더하는 테스트가 여럿이다. `signedIn` 헬퍼에 홈이 쓰는 핸들러 세 개를 더한다. 홈 h1은 여전히 "내 가계부"라 다른 기대는 그대로 둔다.

```ts
    http.get('*/api/me/coverage', () => HttpResponse.json([])),
    http.get('*/api/me/transactions', () => HttpResponse.json([])),
    http.get('*/api/imports', () => HttpResponse.json([])),
```

- [ ] **Step 9: 테스트 통과와 전체 확인 후 Commit**

Run: `cd apps/web && npm test && npm run typecheck && npm run lint && npm run build`
Expected: 모두 PASS(summary 1, Modal 1, HomePage 4 추가)

```bash
git add apps/web/src
git commit -m "feat(web): home with monthly coverage calendar, upload dialog and monthly summary"
```

---

### Task 5: 거래 목록 (내 거래·그룹 거래, 월·멤버·검색 필터)

**Files:**
- Modify: `apps/web/src/transactions/transactionsApi.ts`
- Modify: `apps/web/src/groups/groupsApi.ts`
- Create: `apps/web/src/transactions/TransactionsPage.tsx`, `apps/web/src/transactions/TransactionsPage.module.css`
- Create: `apps/web/src/transactions/TransactionList.tsx`
- Modify: `apps/web/src/app/AppRoutes.tsx` (`/transactions` → `TransactionsPage`)
- Test: `apps/web/src/transactions/TransactionsPage.test.tsx`

**Interfaces:**
- Consumes: `TransactionView`, `transactionsApi.mine`(Task 4), `useGroups`(04a), `formatDateTime`, `formatSignedWon`, `currentYearMonth`, `usePageTitle`, `ui.module.css`, `renderPage`
- Produces:
  - `transactionsApi.group(groupId: number, month: string, memberId: number | null): Promise<TransactionView[]>`
  - `type GroupMember = { userId: number; nickname: string; role: 'ADMIN' | 'MEMBER'; shareEnabled: boolean; joinedAt: string }`, `type GroupDetail = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; members: GroupMember[] }`, `groupsApi.detail(groupId: number): Promise<GroupDetail>`
  - `<TransactionList items: TransactionView[]; showOwner: boolean; selectedId: number | null; onSelect(id: number): void />`: 행마다 `<button aria-pressed>`
  - `TransactionsPage`(`/transactions`) 상태: `scope: 'mine' | 'group'`, `month`, `memberId`, `search`, `selectedId`. Task 6이 여기에 상세 패널과 추가 폼을 붙인다(`selectedId`, `adding` 상태와 오른쪽 `<aside>` 자리).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/transactions/TransactionsPage.test.tsx`:

```tsx
import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import TransactionsPage from './TransactionsPage'
import type { TransactionView } from './transactionsApi'

const today = new Date(2026, 9, 19) // 2026-10-19: 기본 월은 2026-10

const base: TransactionView = {
  id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-05T12:30:00', type: 'EXPENSE',
  categoryMajor: '식비', categoryMinor: '점심', description: '김밥', amount: -4000, currency: 'KRW',
  paymentMethod: '현금', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
}
const groups = [{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }]

function mineHandler(items: TransactionView[]) {
  server.use(http.get('*/api/me/transactions', () => HttpResponse.json(items)))
}

describe('TransactionsPage', () => {
  it('lists my transactions for the current month with signed amounts and badges', async () => {
    mineHandler([
      { ...base, id: 2, description: '국밥', amount: -9000, edited: true },
      { ...base, id: 1, hidden: true },
      { ...base, id: 3, type: 'INCOME', categoryMajor: '급여', description: '월급', amount: 3000000 },
    ])

    renderPage(<TransactionsPage today={today} />, { groups })

    const list = await screen.findByRole('region', { name: '거래 목록' })
    const rows = await within(list).findAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('10-05 12:30')
    expect(rows[0]).toHaveTextContent('-₩ 9,000')
    expect(rows[0]).toHaveTextContent('수정됨')
    expect(rows[1]).toHaveTextContent('숨김')
    expect(rows[2]).toHaveTextContent('+₩ 3,000,000')
    expect(document.title).toBe('거래 목록 · Salad Bowl')
  })

  it('switches to group transactions with owner names and filters by member', async () => {
    mineHandler([])
    const calls: string[] = []
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json({
        groupId: 10, name: '우리집', myRole: 'ADMIN',
        members: [
          { userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-01T00:00:00+09:00' },
          { userId: 2, nickname: '멤버', role: 'MEMBER', shareEnabled: true, joinedAt: '2026-09-02T00:00:00+09:00' },
        ],
      })),
      http.get('*/api/groups/10/transactions', ({ request }) => {
        const url = new URL(request.url)
        calls.push(url.search)
        const memberId = url.searchParams.get('memberId')
        const all = [
          { ...base, id: 5, ownerId: 2, ownerNickname: '멤버', description: '택시', editable: true },
          { ...base, id: 6, ownerId: 1, ownerNickname: '나', description: '커피' },
        ]
        return HttpResponse.json(memberId ? all.filter((t) => String(t.ownerId) === memberId) : all)
      }),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('button', { name: '그룹 거래' }))
    const list = screen.getByRole('region', { name: '거래 목록' })
    expect(await within(list).findByText('택시')).toBeInTheDocument()
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('멤버')

    await user.selectOptions(await screen.findByRole('combobox', { name: '멤버' }), '2')

    expect(await within(list).findByText('택시')).toBeInTheDocument()
    expect(within(list).queryByText('커피')).not.toBeInTheDocument()
    expect(calls.at(-1)).toContain('memberId=2')
  })

  it('changes month and filters by search text', async () => {
    const months: string[] = []
    server.use(http.get('*/api/me/transactions', ({ request }) => {
      const month = new URL(request.url).searchParams.get('month')!
      months.push(month)
      return HttpResponse.json(month === '2026-09'
        ? [{ ...base, id: 7, description: '스타벅스', categoryMajor: '카페' }, { ...base, id: 8, description: '버스', categoryMajor: '교통' }]
        : [])
    }))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    expect(await screen.findByText('이 달에 거래가 없습니다.')).toBeInTheDocument()
    // jsdom은 type="month"에 한 글자씩 입력하는 것을 지원하지 않아 change 이벤트로 바꾼다.
    fireEvent.change(screen.getByLabelText('월'), { target: { value: '2026-09' } })
    expect(await screen.findByText('스타벅스')).toBeInTheDocument()

    await user.type(screen.getByLabelText('검색'), '교통')

    expect(screen.queryByText('스타벅스')).not.toBeInTheDocument()
    expect(screen.getByText('버스')).toBeInTheDocument()
    expect(months).toContain('2026-09')
  })

  it('disables group scope when I have no group', async () => {
    mineHandler([])

    renderPage(<TransactionsPage today={today} />, { groups: [] })

    expect(await screen.findByRole('button', { name: '그룹 거래' })).toBeDisabled()
  })

  it('offers retry when loading fails', async () => {
    let fail = true
    server.use(http.get('*/api/me/transactions', () => fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json([{ ...base }])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    expect(await screen.findByRole('alert')).toHaveTextContent('거래를 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('김밥')).toBeInTheDocument()
  })
})
```

`TransactionsPage`는 `today?: Date` prop(기본 `new Date()`)을 받는다. 테스트는 실행 날짜와 상관없이 기본 월이 `2026-10`이 되도록 `today`를 넘긴다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npm test -- src/transactions/TransactionsPage`
Expected: 모듈이 없어 FAIL

- [ ] **Step 3: API 함수 추가**

`transactionsApi`에 추가한다.

```ts
  group: (groupId: number, month: string, memberId: number | null) => {
    const params = new URLSearchParams({ month })
    if (memberId !== null) params.set('memberId', String(memberId))
    return apiFetch<TransactionView[]>(`/groups/${groupId}/transactions?${params}`)
  },
```

`src/groups/groupsApi.ts`에 타입과 함수를 추가한다.

```ts
export type GroupMember = { userId: number; nickname: string; role: 'ADMIN' | 'MEMBER'; shareEnabled: boolean; joinedAt: string }
export type GroupDetail = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; members: GroupMember[] }
```

```ts
  detail: (groupId: number) => apiFetch<GroupDetail>(`/groups/${groupId}`),
```

- [ ] **Step 4: `src/transactions/TransactionList.tsx`**

```tsx
import ui from '../common/ui.module.css'
import { formatDateTime, formatSignedWon } from '../common/format'
import styles from './TransactionsPage.module.css'
import type { TransactionView } from './transactionsApi'

type Props = {
  items: TransactionView[]
  showOwner: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}

export default function TransactionList({ items, showOwner, selectedId, onSelect }: Props) {
  const cols = showOwner ? styles.withOwner : styles.withoutOwner
  return (
    <div className={styles.table}>
      <div className={`${styles.head} ${cols}`} aria-hidden="true">
        <span>일시</span>
        {showOwner && <span>멤버</span>}
        <span>카테고리</span>
        <span>내용</span>
        <span>결제수단</span>
        <span className={styles.amount}>금액</span>
      </div>
      {items.map((tx) => (
        <button key={tx.id} type="button" aria-pressed={tx.id === selectedId}
          className={`${styles.rowButton} ${cols}`} onClick={() => onSelect(tx.id)}>
          <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span>
          {showOwner && <span>{tx.ownerNickname}</span>}
          <span>
            {tx.categoryMajor}{tx.categoryMinor ? ` · ${tx.categoryMinor}` : ''}
            {tx.edited && <span className={`${ui.badge} ${ui.badgePending}`}>수정됨</span>}
          </span>
          <span>
            {tx.description}
            {tx.hidden && <span className={ui.badge}>숨김</span>}
          </span>
          <span>{tx.paymentMethod}</span>
          <span className={styles.amount}>{formatSignedWon(tx.amount)}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: `src/transactions/TransactionsPage.tsx`, `TransactionsPage.module.css`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import ui from '../common/ui.module.css'
import { currentYearMonth } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import { groupsApi } from '../groups/groupsApi'
import TransactionList from './TransactionList'
import styles from './TransactionsPage.module.css'
import { transactionsApi } from './transactionsApi'

type Scope = 'mine' | 'group'
type Props = { today?: Date }

export default function TransactionsPage({ today = new Date() }: Props) {
  usePageTitle('거래 목록')
  const { selectedGroupId } = useGroups()
  const [scope, setScope] = useState<Scope>('mine')
  const [month, setMonth] = useState(() => currentYearMonth(today))
  const [memberId, setMemberId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const groupId = scope === 'group' ? selectedGroupId : null
  const list = useQuery({
    queryKey: groupId === null
      ? ['transactions', 'mine', month]
      : ['transactions', 'group', groupId, month, memberId],
    queryFn: () => (groupId === null
      ? transactionsApi.mine(month)
      : transactionsApi.group(groupId, month, memberId)),
    enabled: /^\d{4}-\d{2}$/.test(month),
  })
  const detail = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.detail(groupId!),
    enabled: groupId !== null,
  })

  const items = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const all = list.data ?? []
    if (!keyword) return all
    return all.filter((tx) => [tx.description, tx.categoryMajor, tx.categoryMinor]
      .some((text) => text.toLowerCase().includes(keyword)))
  }, [list.data, search])

  function changeScope(next: Scope) {
    setScope(next)
    setMemberId(null)
    setSelectedId(null)
  }

  return (
    <>
      <div className={ui.pageHeader}>
        <h1>거래 목록</h1>
      </div>
      <div className={ui.row}>
        <div role="group" aria-label="범위" className={styles.scope}>
          <button type="button" aria-pressed={scope === 'mine'} className={styles.scopeButton}
            onClick={() => changeScope('mine')}>내 거래</button>
          <button type="button" aria-pressed={scope === 'group'} className={styles.scopeButton}
            disabled={selectedGroupId === null} onClick={() => changeScope('group')}>그룹 거래</button>
        </div>
        <label className={styles.inlineField}>
          <span>월</span>
          <input type="month" className={ui.input} value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        {scope === 'group' && detail.data && (
          <label className={styles.inlineField}>
            <span>멤버</span>
            <select className={ui.input} value={memberId ?? ''}
              onChange={(e) => setMemberId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">전체</option>
              {detail.data.members.map((m) => <option key={m.userId} value={m.userId}>{m.nickname}</option>)}
            </select>
          </label>
        )}
        <label className={`${styles.inlineField} ${styles.search}`}>
          <span>검색</span>
          <input type="search" className={ui.input} placeholder="내용·카테고리" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {selectedGroupId === null && <p className={ui.muted}>그룹에 속하면 그룹 거래를 볼 수 있습니다.</p>}

      <div className={styles.layout}>
        <section aria-labelledby="list-title" className={`${ui.card} ${styles.listCard}`}>
          <h2 id="list-title" className={styles.visuallyHidden}>거래 목록</h2>
          {list.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {list.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>거래를 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} onClick={() => void list.refetch()}>다시 시도</button>
            </div>
          )}
          {list.data && items.length === 0 && <p className={ui.status}>이 달에 거래가 없습니다.</p>}
          {items.length > 0 && (
            <TransactionList items={items} showOwner={scope === 'group'} selectedId={selectedId}
              onSelect={setSelectedId} />
          )}
        </section>
      </div>
    </>
  )
}
```

`list.isPending`은 `enabled: false`(잘못된 월)일 때도 true다. 월 입력이 비어 있는 동안 "불러오는 중"이 보여도 된다. 다시 입력하면 바로 조회한다.

```css
.scope { display: flex; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
.scopeButton { min-height: 40px; padding: 0 var(--space-4); border: 0; background: var(--surface-000); color: var(--ink); cursor: pointer; }
.scopeButton[aria-pressed="true"] { background: var(--brand); color: var(--on-brand); font-weight: 700; }
.scopeButton:disabled { opacity: 0.6; cursor: default; }
.inlineField { display: flex; align-items: center; gap: var(--space-2); }
.inlineField > span { font-size: 13px; color: var(--ink-muted); }
.search { flex: 1 1 200px; }
.search > input { flex: 1; }
.layout { display: flex; flex-wrap: wrap; gap: var(--space-6); align-items: flex-start; }
.listCard { flex: 999 1 560px; padding: 0; overflow-x: auto; gap: 0; }
.listCard > :is(p, div[class]) { margin: var(--space-4); }
.table { min-width: 720px; }
.head, .rowButton { display: grid; gap: var(--space-3); padding: var(--space-3) var(--space-4); align-items: center; }
.withOwner { grid-template-columns: 110px 100px minmax(0, 1fr) minmax(0, 1.4fr) 110px 120px; }
.withoutOwner { grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1.4fr) 110px 120px; }
.head { font-size: 13px; color: var(--ink-muted); border-bottom: 1px solid var(--line); }
.rowButton { width: 100%; border: 0; border-bottom: 1px solid var(--line); background: var(--surface-000); color: var(--ink); text-align: left; cursor: pointer; min-height: 48px; }
.rowButton:hover { background: var(--surface-100); }
.rowButton[aria-pressed="true"] { background: var(--brand-tint); }
.when, .amount { font-variant-numeric: tabular-nums; white-space: nowrap; }
.amount { text-align: right; }
.visuallyHidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
```

- [ ] **Step 6: 라우트 연결**

`AppRoutes.tsx`의 `transactions` 라우트를 `<Route path="transactions" element={<TransactionsPage />} />`로 바꾼다(import 추가). 기존 `AppRoutes.test.tsx`의 `signedIn` 헬퍼는 Task 4에서 `/me/transactions` 핸들러를 더해 두어서 추가 수정이 필요 없다. 실패하면 그 원인을 리포트에 남긴다.

- [ ] **Step 7: 테스트 통과와 전체 확인 후 Commit**

Run: `cd apps/web && npm test && npm run typecheck && npm run lint && npm run build`
Expected: 모두 PASS(TransactionsPage 5 추가)

```bash
git add apps/web/src
git commit -m "feat(web): transactions list with scope, month, member and search filters"
```

---

### Task 6: 거래 상세 패널(수정·숨김·삭제·수정 이력)과 수동 거래 추가

**Files:**
- Modify: `apps/web/src/transactions/transactionsApi.ts`
- Create: `apps/web/src/transactions/useTransactionMutations.ts`
- Create: `apps/web/src/transactions/TransactionPanel.tsx`
- Create: `apps/web/src/transactions/ManualTransactionForm.tsx`
- Create: `apps/web/src/transactions/TransactionPanel.module.css`
- Modify: `apps/web/src/transactions/TransactionsPage.tsx`, `TransactionsPage.module.css`
- Test: `apps/web/src/transactions/TransactionPanel.test.tsx`, `apps/web/src/transactions/ManualTransactionForm.test.tsx`

**Interfaces:**
- Consumes: `TransactionView`, `TransactionType`, `transactionsApi`(Task 4, 5), `useAuth().me`, `errorMessage`, `formatDateTime`, `formatSignedWon`, `ui.module.css`, `renderPage`/`testMe`
- Produces:
  - `type TransactionPatch = { categoryMajor?: string; categoryMinor?: string; memo?: string; hidden?: boolean }`
  - `type ManualTransactionInput = { occurredAt: string; type: TransactionType; categoryMajor: string; categoryMinor?: string; description: string; amount: number; paymentMethod?: string; memo?: string }`
  - `type AuditView = { actorId: number; actorNickname: string; field: string; before: string | null; after: string | null; changedAt: string }`
  - `transactionsApi.update(id, patch)`, `transactionsApi.remove(id)`, `transactionsApi.audits(id)`, `transactionsApi.addManual(input)`
  - `useTransactionMutations()` → `{ update, remove, addManual }`(useMutation). 성공하면 `['transactions']`를 무효화하고, update는 `['audits', id]`도 무효화한다.
  - `toSignedAmount(type: TransactionType, positiveAmount: number): number`: 수입은 +, 지출·이체는 -
  - `<TransactionPanel tx: TransactionView; onClose(): void />`
  - `<ManualTransactionForm onDone(created: TransactionView): void; onCancel(): void />`
  - `TransactionsPage`: [+ 거래 추가] 버튼. 오른쪽 `<aside aria-label="거래 상세">`에 패널이나 추가 폼을 보여준다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/transactions/TransactionPanel.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderPage, testMe } from '../test/renderPage'
import TransactionPanel from './TransactionPanel'
import type { TransactionView } from './transactionsApi'

const mine: TransactionView = {
  id: 7, ownerId: testMe.userId, ownerNickname: '나', occurredAt: '2026-10-05T12:30:00', type: 'EXPENSE',
  categoryMajor: '식비', categoryMinor: '점심', description: '김밥', amount: -4000, currency: 'KRW',
  paymentMethod: '현금', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
}

function auditsHandler(rows: unknown[] = []) {
  server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json(rows)))
}

describe('TransactionPanel', () => {
  it('sends only the fields that changed', async () => {
    auditsHandler()
    let body: unknown
    server.use(http.patch('*/api/transactions/7', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...mine, categoryMajor: '외식', edited: true })
    }))
    const { user } = renderPage(<TransactionPanel tx={mine} onClose={vi.fn()} />)

    const major = await screen.findByLabelText('대분류')
    await user.clear(major)
    await user.type(major, '외식')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다.')
    expect(body).toEqual({ categoryMajor: '외식' })
  })

  it('clears an override by saving an empty field', async () => {
    auditsHandler()
    let body: unknown
    server.use(http.patch('*/api/transactions/7', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(mine)
    }))
    const { user } = renderPage(<TransactionPanel tx={{ ...mine, memo: '내 메모', edited: true }} onClose={vi.fn()} />)

    await user.clear(await screen.findByLabelText('메모'))
    await user.click(screen.getByRole('button', { name: '저장' }))

    await screen.findByRole('status')
    expect(body).toEqual({ memo: '' })
  })

  it('lets only the owner hide, and only a manual one be deleted after confirming', async () => {
    auditsHandler()
    let deleted = false
    server.use(http.delete('*/api/transactions/7', () => {
      deleted = true
      return new HttpResponse(null, { status: 204 })
    }))
    const onClose = vi.fn()
    const { user } = renderPage(<TransactionPanel tx={{ ...mine, source: 'MANUAL' }} onClose={onClose} />)

    expect(await screen.findByLabelText('그룹 화면에서 숨기기 (본인만)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(deleted).toBe(false)
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(deleted).toBe(true)
  })

  it('hides owner-only controls for another member and shows read-only when not editable', async () => {
    auditsHandler()
    renderPage(<TransactionPanel tx={{ ...mine, ownerId: 2, ownerNickname: '멤버', editable: false }} onClose={vi.fn()} />)

    expect(await screen.findByText('다른 멤버의 거래는 볼 수만 있습니다. 관리자만 수정할 수 있습니다.')).toBeInTheDocument()
    expect(screen.queryByLabelText('그룹 화면에서 숨기기 (본인만)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('lists the audit trail', async () => {
    auditsHandler([
      { actorId: 2, actorNickname: '관리자', field: 'categoryMajor', before: null, after: '외식', changedAt: '2026-10-06T09:00:00+09:00' },
      { actorId: 1, actorNickname: '나', field: 'hidden', before: 'false', after: 'true', changedAt: '2026-10-07T10:00:00+09:00' },
    ])

    renderPage(<TransactionPanel tx={mine} onClose={vi.fn()} />)

    const history = await screen.findByRole('region', { name: '수정 이력' })
    const items = await within(history).findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('관리자 · 대분류: (원본) → 외식')
    expect(items[1]).toHaveTextContent('나 · 숨김: 아니오 → 예')
  })

  it('shows a readable error when delete is refused', async () => {
    auditsHandler()
    server.use(http.delete('*/api/transactions/7', () =>
      HttpResponse.json({ code: 'CANNOT_DELETE_IMPORTED', message: 'x' }, { status: 409 })))
    const { user } = renderPage(<TransactionPanel tx={{ ...mine, source: 'MANUAL' }} onClose={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('엑셀로 가져온 거래는 삭제할 수 없습니다.')
  })
})
```

`src/transactions/ManualTransactionForm.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import ManualTransactionForm, { toSignedAmount } from './ManualTransactionForm'

describe('toSignedAmount', () => {
  it('makes expenses and transfers negative and income positive', () => {
    expect(toSignedAmount('EXPENSE', 6500)).toBe(-6500)
    expect(toSignedAmount('TRANSFER', 1000)).toBe(-1000)
    expect(toSignedAmount('INCOME', 3000)).toBe(3000)
  })
})

describe('ManualTransactionForm', () => {
  it('posts a manual expense with a negative amount', async () => {
    let body: Record<string, unknown> | undefined
    server.use(http.post('*/api/me/transactions', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 99, ...body, ownerId: 1, ownerNickname: '나', currency: 'KRW', hidden: false, source: 'MANUAL', edited: false, editable: true, categoryMinor: '', paymentMethod: '현금', memo: null }, { status: 201 })
    }))
    const onDone = vi.fn()
    const { user } = renderPage(<ManualTransactionForm onDone={onDone} onCancel={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText('일시'), { target: { value: '2026-10-05T13:30' } })
    await user.type(screen.getByLabelText('대분류'), '식비')
    await user.type(screen.getByLabelText('내용'), '현금 점심')
    await user.type(screen.getByLabelText('금액 (원)'), '6500')
    await user.type(screen.getByLabelText('결제수단'), '현금')
    await user.click(screen.getByRole('button', { name: '추가' }))

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 99 })))
    expect(body).toMatchObject({
      occurredAt: '2026-10-05T13:30', type: 'EXPENSE', categoryMajor: '식비',
      description: '현금 점심', amount: -6500, paymentMethod: '현금',
    })
  })

  it('shows server validation errors', async () => {
    server.use(http.post('*/api/me/transactions', () =>
      HttpResponse.json({ code: 'VALIDATION_FAILED', message: 'x' }, { status: 400 })))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText('일시'), { target: { value: '2026-10-05T13:30' } })
    await user.type(screen.getByLabelText('대분류'), '식비')
    await user.type(screen.getByLabelText('내용'), 'x')
    await user.type(screen.getByLabelText('금액 (원)'), '1')
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('입력한 값을 다시 확인해 주세요.')
  })
})
```

`TransactionsPage.test.tsx`에 패널 연결 테스트를 하나 추가한다.

```tsx
  it('opens the detail panel for a row and the add form from the button', async () => {
    mineHandler([{ ...base }])
    server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('button', { name: /김밥/ }))
    const detail = screen.getByRole('complementary', { name: '거래 상세' })
    expect(within(detail).getByRole('heading', { name: '김밥' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ 거래 추가' }))
    expect(within(detail).getByRole('heading', { name: '거래 추가 (수동)' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npm test -- src/transactions`
Expected: 모듈과 함수가 없어 FAIL

- [ ] **Step 3: `transactionsApi`에 타입과 함수 추가**

```ts
export type TransactionPatch = { categoryMajor?: string; categoryMinor?: string; memo?: string; hidden?: boolean }

export type ManualTransactionInput = {
  occurredAt: string
  type: TransactionType
  categoryMajor: string
  categoryMinor?: string
  description: string
  amount: number
  paymentMethod?: string
  memo?: string
}

export type AuditView = {
  actorId: number
  actorNickname: string
  field: string
  before: string | null
  after: string | null
  changedAt: string
}
```

`transactionsApi` 객체에 추가한다.

```ts
  update: (id: number, patch: TransactionPatch) =>
    apiFetch<TransactionView>(`/transactions/${id}`, { method: 'PATCH', json: patch }),
  remove: (id: number) => apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),
  audits: (id: number) => apiFetch<AuditView[]>(`/transactions/${id}/audits`),
  addManual: (input: ManualTransactionInput) =>
    apiFetch<TransactionView>('/me/transactions', { method: 'POST', json: input }),
```

- [ ] **Step 4: `src/transactions/useTransactionMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, type ManualTransactionInput, type TransactionPatch } from './transactionsApi'

export function useTransactionMutations() {
  const client = useQueryClient()
  const refreshLists = () => client.invalidateQueries({ queryKey: ['transactions'] })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TransactionPatch }) => transactionsApi.update(id, patch),
    onSuccess: (_data, { id }) => {
      void refreshLists()
      void client.invalidateQueries({ queryKey: ['audits', id] })
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => transactionsApi.remove(id),
    onSuccess: () => void refreshLists(),
  })
  const addManual = useMutation({
    mutationFn: (input: ManualTransactionInput) => transactionsApi.addManual(input),
    onSuccess: () => void refreshLists(),
  })
  return { update, remove, addManual }
}
```

- [ ] **Step 5: `src/transactions/TransactionPanel.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { errorMessage } from '../common/errorMessage'
import { formatDateTime, formatSignedWon } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './TransactionPanel.module.css'
import { transactionsApi, type AuditView, type TransactionPatch, type TransactionView } from './transactionsApi'
import { useTransactionMutations } from './useTransactionMutations'

const FIELD_LABELS: Record<string, string> = {
  categoryMajor: '대분류',
  categoryMinor: '소분류',
  memo: '메모',
  hidden: '숨김',
}

function auditValue(field: string, value: string | null): string {
  if (field === 'hidden') return value === 'true' ? '예' : '아니오'
  return value ?? '(원본)'
}

function auditLine(a: AuditView): string {
  const label = FIELD_LABELS[a.field] ?? a.field
  return `${formatDateTime(a.changedAt)} · ${a.actorNickname} · ${label}: ${auditValue(a.field, a.before)} → ${auditValue(a.field, a.after)}`
}

type Props = { tx: TransactionView; onClose: () => void }

export default function TransactionPanel({ tx, onClose }: Props) {
  const { me } = useAuth()
  const { update, remove } = useTransactionMutations()
  const audits = useQuery({ queryKey: ['audits', tx.id], queryFn: () => transactionsApi.audits(tx.id) })
  const [major, setMajor] = useState(tx.categoryMajor)
  const [minor, setMinor] = useState(tx.categoryMinor)
  const [memo, setMemo] = useState(tx.memo ?? '')
  const [hidden, setHidden] = useState(tx.hidden)
  const [confirming, setConfirming] = useState(false)

  const isOwner = me?.userId === tx.ownerId
  const canDelete = isOwner && tx.source === 'MANUAL'

  function onSave(event: FormEvent) {
    event.preventDefault()
    const patch: TransactionPatch = {}
    if (major !== tx.categoryMajor) patch.categoryMajor = major
    if (minor !== tx.categoryMinor) patch.categoryMinor = minor
    if (memo !== (tx.memo ?? '')) patch.memo = memo
    if (isOwner && hidden !== tx.hidden) patch.hidden = hidden
    if (Object.keys(patch).length === 0) return
    update.mutate({ id: tx.id, patch })
  }

  function onDelete() {
    remove.mutate(tx.id, { onSuccess: onClose })
  }

  const error = update.isError ? errorMessage(update.error) : remove.isError ? errorMessage(remove.error) : null

  return (
    <div className={ui.stack}>
      <div className={styles.header}>
        <h2>{tx.description}</h2>
        <button type="button" className={ui.button} onClick={onClose}>닫기</button>
      </div>
      <p className={styles.amount}>{formatSignedWon(tx.amount)}</p>
      <p className={ui.muted}>
        {formatDateTime(tx.occurredAt)} · {tx.paymentMethod} · {tx.ownerNickname} · {tx.source === 'MANUAL' ? '수동' : '엑셀'}
      </p>

      {tx.editable ? (
        <form className={ui.stack} onSubmit={onSave}>
          <label className={ui.field}>
            <span>대분류</span>
            <input className={ui.input} maxLength={100} value={major} onChange={(e) => setMajor(e.target.value)} />
          </label>
          <label className={ui.field}>
            <span>소분류</span>
            <input className={ui.input} maxLength={100} value={minor} onChange={(e) => setMinor(e.target.value)} />
          </label>
          <label className={ui.field}>
            <span>메모</span>
            <textarea className={ui.input} rows={2} maxLength={1000} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          <p className={ui.muted}>비워 두고 저장하면 엑셀의 원래 값으로 돌아갑니다.</p>
          {isOwner && (
            <label className={styles.check}>
              <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
              <span>그룹 화면에서 숨기기 (본인만)</span>
            </label>
          )}
          <div className={styles.actions}>
            {canDelete && !confirming && (
              <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setConfirming(true)}>삭제</button>
            )}
            {canDelete && confirming && (
              <span className={ui.row}>
                <span>이 거래를 삭제할까요?</span>
                <button type="button" className={`${ui.button} ${ui.danger}`} disabled={remove.isPending} onClick={onDelete}>삭제 확인</button>
                <button type="button" className={ui.button} onClick={() => setConfirming(false)}>취소</button>
              </span>
            )}
            <button type="submit" className={`${ui.button} ${ui.primary} ${styles.save}`} disabled={update.isPending}>저장</button>
          </div>
          {update.isSuccess && <p role="status" className={ui.status}>저장했습니다.</p>}
        </form>
      ) : (
        <p className={styles.readOnly}>다른 멤버의 거래는 볼 수만 있습니다. 관리자만 수정할 수 있습니다.</p>
      )}
      {error && <p role="alert" className={ui.alert}>{error}</p>}

      <section aria-labelledby={`audit-${tx.id}`} className={styles.audits}>
        <h3 id={`audit-${tx.id}`}>수정 이력</h3>
        {audits.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
        {audits.data && audits.data.length === 0 && <p className={ui.muted}>수정한 적이 없습니다.</p>}
        {audits.data && audits.data.length > 0 && (
          <ul className={ui.stack}>
            {audits.data.map((a, i) => <li key={i} className={ui.muted}>{auditLine(a)}</li>)}
          </ul>
        )}
      </section>
    </div>
  )
}
```

패널은 `key={tx.id}`로 렌더한다(Step 8). 다른 거래를 고르면 입력 상태가 초기화된다.

- [ ] **Step 6: `src/transactions/ManualTransactionForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import styles from './TransactionPanel.module.css'
import type { TransactionType, TransactionView } from './transactionsApi'
import { useTransactionMutations } from './useTransactionMutations'

/** 사용자는 양수로 입력한다. 저장할 때 뱅크샐러드 부호 규칙에 맞춘다(수입 +, 지출·이체 -). */
// oxlint-disable-next-line react/only-export-components
export function toSignedAmount(type: TransactionType, positiveAmount: number): number {
  const value = Math.abs(positiveAmount)
  return type === 'INCOME' ? value : -value
}

type Props = { onDone: (created: TransactionView) => void; onCancel: () => void }

export default function ManualTransactionForm({ onDone, onCancel }: Props) {
  const { addManual } = useTransactionMutations()
  const [occurredAt, setOccurredAt] = useState('')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [major, setMajor] = useState('')
  const [minor, setMinor] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState('')
  const [memo, setMemo] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    addManual.mutate({
      occurredAt,
      type,
      categoryMajor: major.trim(),
      categoryMinor: minor.trim() || undefined,
      description: description.trim(),
      amount: toSignedAmount(type, Number(amount)),
      paymentMethod: payment.trim() || undefined,
      memo: memo.trim() || undefined,
    }, { onSuccess: (created) => onDone(created) })
  }

  return (
    <form className={ui.stack} onSubmit={onSubmit}>
      <div className={styles.header}>
        <h2>거래 추가 (수동)</h2>
        <button type="button" className={ui.button} onClick={onCancel}>닫기</button>
      </div>
      <label className={ui.field}>
        <span>일시</span>
        <input type="datetime-local" required className={ui.input} value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>타입</span>
        <select className={ui.input} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          <option value="EXPENSE">지출</option>
          <option value="INCOME">수입</option>
          <option value="TRANSFER">이체(출금)</option>
        </select>
      </label>
      <label className={ui.field}>
        <span>대분류</span>
        <input required maxLength={100} className={ui.input} value={major} onChange={(e) => setMajor(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>소분류</span>
        <input maxLength={100} className={ui.input} value={minor} onChange={(e) => setMinor(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>내용</span>
        <input required maxLength={500} className={ui.input} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>금액 (원)</span>
        <input type="number" required min="1" step="1" inputMode="numeric" className={ui.input} value={amount}
          onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>결제수단</span>
        <input maxLength={100} className={ui.input} value={payment} onChange={(e) => setPayment(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>메모</span>
        <textarea rows={2} maxLength={1000} className={ui.input} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <div className={styles.actions}>
        <button type="button" className={ui.button} onClick={onCancel}>취소</button>
        <button type="submit" className={`${ui.button} ${ui.primary} ${styles.save}`} disabled={addManual.isPending}>추가</button>
      </div>
      {addManual.isError && <p role="alert" className={ui.alert}>{errorMessage(addManual.error)}</p>}
    </form>
  )
}
```

- [ ] **Step 7: `src/transactions/TransactionPanel.module.css`**

```css
.header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.amount { margin: 0; font-size: 22px; line-height: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
.check { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; }
.check > input { width: 20px; height: 20px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.save { margin-left: auto; }
.readOnly { margin: 0; padding: var(--space-3); border-radius: var(--radius-sm); background: var(--surface-100); }
.audits { display: flex; flex-direction: column; gap: var(--space-2); border-top: 1px solid var(--line); padding-top: var(--space-3); }
.audits > h3 { margin: 0; font-size: 15px; }
```

- [ ] **Step 8: `TransactionsPage`에 패널 연결**

`adding` 상태를 추가한다. 헤더에 [+ 거래 추가] 버튼을, 목록 옆에 `<aside>`를 둔다.

```tsx
  const [adding, setAdding] = useState(false)
  const selected = items.find((tx) => tx.id === selectedId) ?? null
```

헤더(`<div className={ui.pageHeader}>`)의 h1 다음에 버튼을 둔다.

```tsx
        <button type="button" className={`${ui.button} ${ui.primary}`}
          onClick={() => { setAdding(true); setSelectedId(null) }}>+ 거래 추가</button>
```

`TransactionList`의 `onSelect`를 `(id) => { setSelectedId(id); setAdding(false) }`로 바꾼다. `.layout` 안 목록 섹션 다음에 `<aside>`를 추가한다.

```tsx
        {(adding || selected) && (
          <aside aria-label="거래 상세" className={`${ui.card} ${styles.panel}`}>
            {adding ? (
              <ManualTransactionForm
                onCancel={() => setAdding(false)}
                onDone={(created) => { setAdding(false); setScope('mine'); setSelectedId(created.id) }} />
            ) : selected && (
              <TransactionPanel key={selected.id} tx={selected} onClose={() => setSelectedId(null)} />
            )}
          </aside>
        )}
```

`TransactionsPage.module.css`에 추가한다.

```css
.panel { flex: 1 1 320px; max-width: 400px; }
```

(import: `ManualTransactionForm`, `TransactionPanel`)

수동 추가가 끝나면 목록 쿼리가 무효화된다. 추가한 거래가 다른 달이면 목록에 보이지 않을 수 있다. 그 경우 패널은 닫힌 상태가 된다(`selected`가 `null`).

- [ ] **Step 9: 테스트 통과와 전체 확인 후 Commit**

Run: `cd apps/web && npm test && npm run typecheck && npm run lint && npm run build`
Expected: 모두 PASS(TransactionPanel 6, ManualTransactionForm 3, TransactionsPage 1 추가)

```bash
git add apps/web/src
git commit -m "feat(web): transaction detail panel with edit, hide, delete, audits and manual add"
```
