# Plan 08: 접근성 마무리와 운영 작은 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React Aria 적용 뒤 남은 포커스·시트 문제 4건과, Plan 05 후속의 "Plan 06에 더할 것" 중 작은 수정 4건을 고친다.

**Architecture:** 웹은 기존 공용 부품(`DialogFrame`, `ConfirmDialog`)과 화면 코드만 고친다. 업로드 크기 초과는 Pages Function 프록시가 API로 넘기기 전에 413으로 답한다. API는 설정 레코드 하나의 null 검사만 고친다.

**Tech Stack:** React 19, react-aria-components 1.22.1, TanStack Query, Vitest + Testing Library + MSW, Cloudflare Pages Functions, Spring Boot(Java 21) + JUnit

**출처:** [Plan 07c 후속](2026-10-25-plan-07c-followups.md)의 "넘긴 항목"·"나중에", [Plan 07b 후속](2026-10-24-plan-07b-followups.md), [Plan 05 후속](2026-10-20-plan-05-followups.md)의 "Plan 06 (운영·보안 보강)에 더할 것". 이 계획은 Plan 06의 일부다. Plan 06의 나머지(인증·데이터·초대/관리자)는 뒤 계획으로 나눈다.

## Global Constraints

- 시각 디자인은 바꾸지 않는다(`apps/web/src/styles/tokens.css`).
- `react-aria-components`는 `apps/web/src/common/`, 테스트, `main.tsx`에서만 import한다.
- 모바일 폭 기준은 `(max-width: 820px)`이다. 테스트는 `test/mockViewport.ts`의 `mockViewport(true)`로 흉내 낸다.
- 버튼·라벨 문구는 지금 그대로다. 테스트가 이 이름으로 찾는다.
- 오류 문구는 인라인 `role="alert"` 그대로다.
- jsdom 한계: RAC `Sheet`는 jsdom에서 닫힌 뒤 DOM이 남는다. 시트 경로는 `onOpenChange` 호출 여부나 열림까지만 테스트한다.
- 새 npm·Gradle 의존성을 넣지 않는다.
- 주석은 한국어로, "왜"만 짧게 쓴다.
- 웹 Task 끝에 `apps/web`에서 `npm run typecheck && npm test && npm run lint`(lint 경고 0건). API Task는 `apps/api`에서 `./gradlew test`.
- 검사 명령은 각 앱 폴더에서, `git add`/`git commit`은 저장소 루트에서 실행한다. Codex 구현 Task는 컨트롤러가 테스트를 다시 돌린 뒤 `Co-Authored-By: Codex (<모델>) <noreply@openai.com>`로 커밋한다.

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 |
|---|---|---|
| 1 입력 시트 바깥 닫기 | Codex `gpt-6-astra` / medium (공용 부품) | Claude sonnet |
| 2 거래 화면 선택·깜박임 | Codex `gpt-6-sol` / medium | Claude sonnet |
| 3 멤버 내보내기 뒤 포커스 | Codex `gpt-6-sol` / medium | Claude sonnet |
| 4 업로드 안내·프록시 413 | Codex `gpt-6-sol` / medium | Claude sonnet |
| 5 refresh 쿠키 설정 NPE | Claude sonnet (`apps/api`) | Codex `gpt-6-sol` / high |
| 6 후속 문서 정리 | 컨트롤러 | — |
| 최종 브랜치 리뷰 | — | Claude opus 한 번 |

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/web/src/common/Dialog.tsx` + `Dialog.test.tsx` | 좁은 화면 시트도 `closeOnOutsideClick`을 따른다 |
| `apps/web/src/transactions/TransactionsPage.tsx` + `.test.tsx` | 월 바꾸면 선택 해제, 다른 달 추가 뒤 시트 유지 |
| `apps/web/src/groups/MemberList.tsx` + `GroupsAdmin.test.tsx` | 내보낸 뒤 멤버 목록 제목으로 포커스 |
| `apps/web/src/api/client.ts` + `client.test.ts`, `imports/importsApi.ts` | 업로드는 "서버 깨우는 중" 집계에서 뺀다 |
| `apps/web/src/common/errorMessage.ts` + `.test.ts` | `IMPORT_BUSY` 문구에 기다릴 시간 |
| `apps/web/proxy/forward.ts` + `forward.test.ts` | 1MB 넘는 본문은 413 `FILE_TOO_LARGE` |
| `apps/api/.../auth/RefreshCookieProperties.java` + `AuthSettingsTest.java` | `same-site` 누락 시 NPE 대신 설명 있는 오류 |
| `docs/superpowers/plans/2026-10-20-plan-05-followups.md`, `2026-10-25-plan-07c-followups.md`, `2026-10-25-plan-08-followups.md`(새로) | 끝낸 항목 표시, 남은 Plan 06 범위 정리 |

결정:
- **동시 업로드 503**: 서버 대기 시간(20초)을 늘리지 않는다. Cloudflare 프록시는 응답을 100초까지 기다리는데, import 한 건이 CPU 0.1에서 약 81초라 20초를 더하면 이미 한도에 가깝다. 대신 오류 문구에 기다릴 시간을 알린다. 대기열·진행 표시는 사용자가 늘면 다시 본다(후속 문서).
- **1MB 초과 요청**: Tomcat 기본 `max-swallow-size`(2MB)까지는 서버가 이미 413 JSON으로 답한다. 그보다 큰 본문만 연결이 끊긴다. 그래서 서버 설정은 그대로 두고, 프록시가 본문을 넘기기 전에 크기를 보고 413으로 답한다.
- **업로드 중 안내**: 업로드는 자체 진행 표시("업로드 중")가 있으므로 "서버를 깨우는 중" 집계에서 뺀다. 업로드 전용 문구는 만들지 않는다.

---

### Task 1: 입력이 있는 시트는 바깥을 눌러도 닫지 않기

**담당:** Codex `gpt-6-astra` / medium

**Files:**
- Modify: `apps/web/src/common/Dialog.tsx`
- Test: `apps/web/src/common/Dialog.test.tsx`

**Interfaces:**
- Produces: `DialogFrame`의 `closeOnOutsideClick`(기본 `false`)이 넓은 화면 모달뿐 아니라 좁은 화면 시트에도 적용된다. `false`면 시트 바깥을 눌러도 닫히지 않는다(닫기 버튼·Esc·아래로 쓸기는 그대로 닫힌다). `ConfirmDialog`는 이미 `closeOnOutsideClick`을 넘기므로 지금처럼 바깥을 누르면 닫힌다.

배경: 지금 시트는 바깥을 누르면 늘 닫힌다. 그룹 만들기의 이름이나 월 데이터 삭제 확인 문구를 입력하던 중 실수로 바깥을 누르면 입력이 사라진다. 넓은 화면 `Dialog`는 이미 바깥을 눌러도 닫히지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`Dialog.test.tsx`에 더한다(`mockViewport`, `DialogFrame`은 이미 import돼 있으면 그대로 쓴다):

```tsx
describe('DialogFrame sheet outside press', () => {
  it('keeps a narrow-screen sheet open on outside press unless closeOnOutsideClick', async () => {
    mockViewport(true)
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <>
        <button type="button">바깥</button>
        <DialogFrame isOpen onOpenChange={onOpenChange} title="그룹 만들기">{() => <p>내용</p>}</DialogFrame>
      </>,
    )
    expect(screen.getByRole('dialog', { name: '그룹 만들기' })).toBeInTheDocument()

    await user.click(document.body)

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes a narrow-screen sheet on outside press when closeOnOutsideClick', async () => {
    mockViewport(true)
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<DialogFrame isOpen onOpenChange={onOpenChange} title="거래 삭제" closeOnOutsideClick>{() => <p>내용</p>}</DialogFrame>)

    await user.click(document.body)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

`document.body` 클릭이 RAC의 바깥 누르기로 잡히지 않으면(두 번째 테스트가 고치기 전에도 실패하면) 시트 배경(`.sheetBackdrop`, 테스트에서는 클래스 이름이 그대로다: `document.querySelector('.sheetBackdrop')`)을 누르도록 바꾼다. 두 번째 테스트는 지금 코드에서도 통과해야 하고, 첫 번째는 실패해야 한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/common/Dialog.test.tsx`
Expected: 첫 번째 테스트 FAIL(`onOpenChange`가 `false`로 불림), 두 번째 PASS

- [ ] **Step 3: 구현**

`Dialog.tsx`의 `SheetOverlay`에 한 줄을 더한다:

```tsx
<SheetOverlay isOpen={isOpen} onOpenChange={onOpenChange} preventDismissal={closeDisabled}
  // 입력이 있는 대화상자는 바깥을 실수로 눌러 입력을 잃지 않게 한다(넓은 화면 모달과 같은 규칙).
  shouldCloseOnInteractOutside={() => closeOnOutsideClick}
  className={styles.sheetOverlay}>
```

`DialogFrame` 위 설명 주석이나 `closeOnOutsideClick` 설명에 "모바일 시트는 늘 닫힌다"는 말이 있으면 고친다.

- [ ] **Step 4: 통과 확인과 전체 검사**

Run: `npx vitest run src/common/Dialog.test.tsx` → PASS
Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건

- [ ] **Step 5: 커밋** (컨트롤러)

```bash
git add apps/web/src/common
git commit -m "fix(web): sheets with input ignore outside press"
```

---

### Task 2: 거래 화면 — 월을 바꾸면 선택 해제, 다른 달 추가 뒤 시트 유지

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/src/transactions/TransactionsPage.tsx`
- Test: `apps/web/src/transactions/TransactionsPage.test.tsx`

**Interfaces:**
- Consumes: 지금 `TransactionsPage`의 `selectedId`, `adding`, `shown`, `open`(= `adding || selected !== null`), `MonthPicker onChange={setMonth}`, `onDone`(추가 뒤 `setMonth(created.occurredAt.slice(0, 7))`와 `setSelectedId(created.id)`)

두 문제:
- (a) 월을 바꿔도 `selectedId`가 남아, 원래 달로 돌아오면 그 거래 패널(좁은 화면은 시트)이 저절로 다시 열린다.
- (b) 다른 달 거래를 수동으로 추가하면 `onDone`이 월을 바꾸고 새 거래를 고른다. 새 달 목록을 불러오는 동안 `selected`가 `null`이라 `open`이 잠깐 `false`가 되어, 좁은 화면 시트가 닫혔다 다시 열린다.

- [ ] **Step 1: 실패하는 테스트 작성**

`TransactionsPage.test.tsx`에 더한다:

```tsx
it('clears the selection when the month changes', async () => {
  server.use(
    http.get('*/api/me/transactions', ({ request }) => HttpResponse.json(
      new URL(request.url).searchParams.get('month') === '2026-10' ? [{ ...base }] : [])),
    http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
  )
  const { user } = renderPage(<TransactionsPage today={today} />, { groups })

  await user.click(await screen.findByRole('row', { name: /김밥/ }))
  expect(screen.getByRole('complementary', { name: '거래 상세' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '이전 달' }))
  expect(await screen.findByText('이 달에 거래가 없습니다.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '다음 달' }))

  expect(await screen.findByRole('row', { name: /김밥/ })).toBeInTheDocument()
  expect(screen.queryByRole('complementary', { name: '거래 상세' })).not.toBeInTheDocument()
})

it('keeps the sheet open while the month of a newly added transaction loads', async () => {
  mockViewport(true)
  const created: TransactionView = {
    ...base, id: 20, occurredAt: '2026-09-05T13:30:00', description: '9월 간식', source: 'MANUAL', amount: -3000,
  }
  let added = false
  let releaseSeptember: () => void = () => {}
  server.use(
    http.get('*/api/me/transactions', async ({ request }) => {
      if (added && new URL(request.url).searchParams.get('month') === '2026-09') {
        // 새 달 목록을 붙잡아 두고, 그 사이 시트가 닫히지 않는지 본다.
        await new Promise<void>((resolve) => { releaseSeptember = resolve })
        return HttpResponse.json([created])
      }
      return HttpResponse.json([])
    }),
    http.post('*/api/me/transactions', () => {
      added = true
      return HttpResponse.json(created, { status: 201 })
    }),
    http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
  )
  const { user } = renderPage(<TransactionsPage today={today} />, { groups })

  await screen.findByText('이 달에 거래가 없습니다.')
  await user.click(screen.getByRole('button', { name: '거래 추가' }))
  await typeDateTime(user, '202609051330')
  await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')
  await user.type(screen.getByLabelText('내용'), '9월 간식')
  await user.type(screen.getByLabelText('금액 (원)'), '3000')
  const sheet = screen.getByRole('dialog', { name: '거래 추가 (수동)' })
  await user.click(within(sheet).getByRole('button', { name: '추가' }))

  await waitFor(() => expect(screen.getByLabelText('월')).toHaveValue('2026-09'))
  // 새 달을 불러오는 동안에도 같은 시트가 열려 있다(닫혔다 다시 열리지 않는다).
  expect(screen.getByRole('dialog')).toBe(sheet.closest('[role="dialog"]'))
  releaseSeptember()
  expect(await screen.findByRole('dialog', { name: '9월 간식' })).toBeInTheDocument()
})
```

`mockViewport`, `typeDateTime`, `within`, `waitFor`는 파일의 기존 import를 쓴다. 두 번째 테스트에서 "같은 시트"를 dialog 요소 동일성으로 확인하기 어려우면(RAC가 내용 교체 때 요소를 바꾸면) "월이 바뀐 뒤 dialog가 하나 이상 계속 있다"로 확인한다. 단, 고치기 전에는 실패해야 한다. 실패하지 않으면 왜 그런지 보고서에 적는다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/transactions/TransactionsPage.test.tsx`
Expected: 두 새 테스트 FAIL

- [ ] **Step 3: 구현**

`TransactionsPage.tsx`:
- 월 선택: `<MonthPicker month={month} onChange={changeMonth} />`. `changeMonth`는 다음과 같다:
  ```ts
  function changeMonth(next: string) {
    setMonth(next)
    // 다른 달로 가면 열린 패널을 닫는다. 되돌아왔을 때 패널이 저절로 다시 열리지 않게 한다.
    setSelectedId(null)
  }
  ```
  `onDone`은 지금처럼 `setMonth`를 직접 부른다(새 거래를 고른 채로 그 달로 간다).
- 열림 상태:
  ```ts
  // 추가한 거래의 달을 불러오는 동안에는 목록에 아직 없지만 패널을 닫지 않는다(닫혔다 다시 열리는 깜박임).
  const open = adding || selected !== null || (selectedId !== null && list.isPending)
  ```
  이때 시트·패널 본문은 `shown`(마지막으로 연 내용)을 그대로 보여준다. 불러오기가 끝났는데 목록에 없으면(다른 사람이 지운 경우 등) `open`이 `false`가 되어 닫힌다.

- [ ] **Step 4: 통과 확인과 전체 검사**

Run: `npx vitest run src/transactions` → PASS
Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건

- [ ] **Step 5: 커밋** (컨트롤러)

```bash
git add apps/web/src/transactions
git commit -m "fix(web): clear transaction selection on month change, no flicker after add"
```

---

### Task 3: 멤버 내보내기 뒤 멤버 목록 제목으로 포커스

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/src/groups/MemberList.tsx`
- Test: `apps/web/src/groups/GroupsAdmin.test.tsx`

**Interfaces:**
- Consumes: `useGroupMutations().removeMember` — hook의 `onSuccess`가 그룹 상세를 다시 불러올 때까지 기다린다. 그래서 컴포넌트에서 넘긴 `onSuccess: close`가 불리기 전에 내보낸 멤버 행(`MemberRow`)과 그 안의 `ConfirmDialog`가 사라지고, 포커스가 body로 간다.

- [ ] **Step 1: 실패하는 테스트 작성**

`GroupsAdmin.test.tsx`의 기존 내보내기 테스트(`'짝꿍 내보내기 확인'`을 누르는 테스트)를 보고, 같은 준비로 새 테스트를 더하거나 그 테스트 끝에 확인을 더한다:

```tsx
await waitFor(() => expect(screen.queryByText('짝꿍')).not.toBeInTheDocument())
await waitFor(() => expect(screen.getByRole('heading', { name: /멤버 \(/ })).toHaveFocus())
```

(멤버 목록 제목은 `멤버 (n/6)` 형태의 `h3`다.)

Run: `npx vitest run src/groups/GroupsAdmin.test.tsx` → 새 확인 FAIL(포커스가 body)

- [ ] **Step 2: 구현**

`MemberList.tsx`:

```tsx
export default function MemberList({ group, canRemove }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const removingId = useRef<number | null>(null)
  useEffect(() => {
    // 내보낸 멤버 행과 확인 대화상자가 함께 사라져 포커스가 body로 가므로, 목록에서 빠진 뒤 제목으로 옮긴다.
    if (removingId.current === null || group.members.some((m) => m.userId === removingId.current)) return
    removingId.current = null
    headingRef.current?.focus()
  })
  return (
    <section aria-labelledby="members-title" className={ui.stack}>
      <h3 id="members-title" ref={headingRef} tabIndex={-1} className={styles.subTitle}>멤버 ({group.members.length}/6)</h3>
      <ul className={styles.memberList}>
        {group.members.map((m) => (
          <MemberRow key={m.userId} groupId={group.groupId} member={m} canRemove={canRemove && m.role !== 'ADMIN'}
            onRemoving={(userId) => { removingId.current = userId }} />
        ))}
      </ul>
    </section>
  )
}
```

`MemberRow`에 `onRemoving: (userId: number) => void` prop을 더하고, `onConfirm`에서 `mutate` 직전에 `onRemoving(member.userId)`를 부른다. `onOpen`(확인 대화상자를 다시 열 때)에서 `removeMember.reset()`은 그대로 둔다. 내보내기가 실패하면 멤버가 목록에 남아 있으므로 포커스를 옮기지 않는다(확인 대화상자의 오류 문구가 그대로 보인다).

- [ ] **Step 3: 통과 확인과 전체 검사**

Run: `npx vitest run src/groups` → PASS
Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건

- [ ] **Step 4: 커밋** (컨트롤러)

```bash
git add apps/web/src/groups
git commit -m "fix(web): focus the member list heading after removing a member"
```

---

### Task 4: 업로드 안내와 프록시 413

**담당:** Codex `gpt-6-sol` / medium

**Files:**
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/imports/importsApi.ts`, `apps/web/src/common/errorMessage.ts`, `apps/web/proxy/forward.ts`
- Test: `apps/web/src/api/client.test.ts`, `apps/web/src/common/errorMessage.test.ts`, `apps/web/proxy/forward.test.ts`

**Interfaces:**
- Produces:
  - `ApiInit`에 `trackSlow?: boolean`(기본 `true`). `false`면 3초가 지나도 느린 요청으로 세지 않는다.
  - `importsApi.upload`는 `trackSlow: false`로 보낸다.
  - `forward`는 요청 본문이 `MAX_BODY_BYTES`(1 MiB = 1,048,576바이트, API `max-request-size: 1MB`와 같음)를 넘으면 API를 부르지 않고 413 `{ code: 'FILE_TOO_LARGE', message: 'request body must be 1MB or smaller' }`로 답한다.
  - `IMPORT_BUSY` 문구: `'다른 업로드를 처리하고 있습니다. 1~2분 뒤 다시 시도해 주세요.'`

- [ ] **Step 1: 실패하는 테스트 작성**

`client.test.ts` — 기존 `'reports slow requests after 3 seconds'` 테스트와 같은 방식(가짜 타이머·느린 핸들러)으로:

```ts
it('does not report a slow request when trackSlow is false', async () => {
  // (기존 느린 요청 테스트의 준비를 그대로 따른다)
  const states: boolean[] = []
  const off = onSlowRequests((slow) => states.push(slow))
  // 3초 넘게 걸리는 핸들러 …
  await apiFetch('/slow', { auth: false, trackSlow: false })
  off()
  expect(states).toEqual([])
})
```

기존 테스트의 타이머·핸들러 코드를 보고 같은 형태로 채운다(주석의 "…"을 남기지 않는다).

`errorMessage.test.ts`: `IMPORT_BUSY` 기대 문구를 새 문구로 바꾼다.

`forward.test.ts`:

```ts
it('answers 413 FILE_TOO_LARGE without calling the API when the body is over 1MB', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const request = new Request('https://salad.pages.dev/api/imports', { method: 'POST', body: new Uint8Array(1024 * 1024 + 1) })

  const response = await forward(request, 'https://api.example.com')

  expect(response.status).toBe(413)
  expect(await response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' })
  expect(fetchMock).not.toHaveBeenCalled()
})

it('passes a body of exactly 1MB through', async () => {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
  const request = new Request('https://salad.pages.dev/api/imports', { method: 'POST', body: new Uint8Array(1024 * 1024) })

  expect((await forward(request, 'https://api.example.com')).status).toBe(201)
})
```

Run: `npx vitest run src/api/client.test.ts src/common/errorMessage.test.ts proxy/forward.test.ts` → 새 테스트 FAIL

- [ ] **Step 2: 구현**

- `client.ts`: `type ApiInit = RequestInit & { json?: unknown; auth?: boolean; trackSlow?: boolean }`. `apiFetch`에서 `trackSlow = true`를 꺼내 `rawFetch(path, init, trackSlow)`로 넘기고, `rawFetch`는 `trackSlow`가 `false`면 타이머를 걸지 않는다. `rawFetch` 위 주석에 한 줄: 업로드처럼 원래 오래 걸리고 자체 진행 표시가 있는 요청은 "서버 깨우는 중"으로 세지 않는다.
- `importsApi.ts`: `apiFetch<ImportResult>('/imports', { method: 'POST', body: form, trackSlow: false })`
- `errorMessage.ts`: `IMPORT_BUSY` 문구 교체.
- `forward.ts`:
  ```ts
  // API의 max-request-size(1MB)와 같다. 더 큰 본문은 API(Tomcat)가 읽다가 연결을 끊어 502가 되므로 여기서 413으로 답한다.
  const MAX_BODY_BYTES = 1024 * 1024
  // ...
  const body = hasBody ? await request.arrayBuffer() : undefined
  if (body && body.byteLength > MAX_BODY_BYTES) {
    return Response.json({ code: 'FILE_TOO_LARGE', message: 'request body must be 1MB or smaller' }, { status: 413 })
  }
  ```
  `fetch` 호출의 `body:`는 위 `body`를 쓴다.

웹 `FILE_TOO_LARGE` 문구("파일은 512KB 이하만…")가 이 413에도 그대로 쓰이는지 확인한다(`errorMessage`가 `code`로 고른다).

- [ ] **Step 3: 통과 확인과 전체 검사**

Run: `npx vitest run src/api src/common proxy` → PASS
Run: `npm run typecheck && npm test && npm run lint` → 모두 통과, 경고 0건

- [ ] **Step 4: 커밋** (컨트롤러)

```bash
git add apps/web/src apps/web/proxy
git commit -m "fix(web): no wake-up notice for uploads, 413 for oversized bodies at the proxy"
```

---

### Task 5: refresh 쿠키 설정의 same-site 누락 NPE

**담당:** Claude sonnet (`apps/api`), 리뷰 Codex `gpt-6-sol` / high

**Files:**
- Modify: `apps/api/src/main/java/com/saladbowl/api/auth/RefreshCookieProperties.java`
- Test: `apps/api/src/test/java/com/saladbowl/api/auth/AuthSettingsTest.java`

지금 `SAME_SITE_VALUES`는 `Set.of(...)`라 `contains(null)`이 `NullPointerException`을 던진다. `app.auth.refresh-cookie.same-site`를 빠뜨리면 원인을 알 수 없는 NPE로 기동이 실패한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`AuthSettingsTest.java`의 `sameSiteMustBeAKnownValue` 옆에 더한다:

```java
@Test
void sameSiteIsRequired() {
    assertThatThrownBy(() -> new RefreshCookieProperties("/api/auth", null, true))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("same-site");
}
```

Run (in `apps/api`): `./gradlew test --tests '*AuthSettingsTest'` → FAIL(`NullPointerException`)

- [ ] **Step 2: 구현**

```java
if (sameSite == null || !SAME_SITE_VALUES.contains(sameSite)) {
```

- [ ] **Step 3: 통과 확인과 전체 검사**

Run: `./gradlew test --tests '*AuthSettingsTest'` → PASS
Run: `./gradlew test` → 모두 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src
git commit -m "fix(api): explain a missing refresh cookie same-site instead of NPE"
```

---

### Task 6: 후속 문서 정리

**담당:** 컨트롤러

- [ ] **Step 1**: `docs/superpowers/plans/2026-10-20-plan-05-followups.md`의 "Plan 06 (운영·보안 보강)에 더할 것" 네 항목 끝에 "→ Plan 08에서 처리"(동시 업로드는 "문구만, 대기열은 남김")를 붙인다.
- [ ] **Step 2**: `docs/superpowers/plans/2026-10-25-plan-07c-followups.md`의 "넘긴 항목"·"나중에"에서 이번에 끝낸 것(멤버 내보내기 포커스, 입력 시트 바깥 닫기, 월 변경 `selectedId`, 다른 달 추가 깜박임)에 "→ Plan 08"을 붙인다.
- [ ] **Step 3**: `docs/superpowers/plans/2026-10-25-plan-08-followups.md`를 만든다: 실행 중 바뀐 결정, 리뷰에서 넘긴 Minor, 실기기 확인 항목(좁은 화면 시트 바깥 누르기, 다른 달 추가 뒤 시트 유지, 멤버 내보내기 뒤 포커스), **남은 Plan 06 범위**(인증: refresh 토큰 서버 폐기·로그아웃 경합·로그인 횟수 제한 / 데이터: `@Version`·`lock_timeout`·무결성 오류 매핑·import 일괄 삽입·동시 import / 초대 정리·발급 제한·관리자 위임·4xx `detail` 정책 / 동시 업로드 대기열·진행 표시).

```bash
git add docs/superpowers/plans
git commit -m "docs: record plan 08 follow-ups and remaining plan 06 scope"
```
