# Plan 16a: 홈 업로드 현황을 업로드 메뉴로 옮기기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈에는 지난달 업로드 여부와 지난달 요약만 남기고, 월별 등록 현황·월 데이터 관리는 업로드 화면으로 옮긴다. 홈의 "업로드하기"는 업로드 화면에서 그 달 업로드 창을 바로 연다.

**Architecture:**
- 홈의 등록 현황 카드와 두 창(업로드, 월 데이터 관리)을 `imports/CoverageSection.tsx` 하나로 떼어 낸다. 업로드 화면이 그것을 쓴다.
- 관련 파일(`CoverageCalendar`, `MonthDataDialog`, `useDeleteMonth`, `coverageApi`)은 `home/`에서 `imports/`로 옮긴다.
- 홈은 같은 `coverage` 쿼리로 지난달 항목만 찾아 카드 하나로 보여준다.
- `/upload?month=YYYY-MM`이면 `CoverageSection`이 그 달 창을 열고, 업로드 화면이 주소에서 `month`를 지운다(replace).

**Tech Stack:** React 19, react-router 8(`useSearchParams`), TanStack Query 5, CSS Modules, Vitest + Testing Library + MSW.

**스펙:** [2026-10-29-menu-restructure-design.md](../specs/2026-10-29-menu-restructure-design.md) 4·5장

## Global Constraints

- **바꾸는 곳:** `apps/web`만. API는 바꾸지 않는다(`GET /me/coverage?year=`를 그대로 쓴다). 새 패키지를 설치하지 않는다.
- `react-aria-components`는 `src/common/`·테스트·`main.tsx`에서만 쓴다.
- 쿼리 키는 바꾸지 않는다: `['coverage', year]`, `['transactions', 'mine', month]`, `['imports']`.
- 색·간격은 `src/styles/tokens.css` 변수만 쓴다.
- **문구(그대로 쓴다)**
  - 홈 카드 제목: "지난달 업로드"
  - 등록됨: "`<YYYY년 M월>` 데이터 등록됨 · `<importedCount>`건"
  - 미등록: "`<YYYY년 M월>` 데이터가 아직 없습니다." + 링크 "업로드하기"
  - 실패: "업로드 현황을 불러오지 못했습니다." + 버튼 "다시 시도"(접근 이름 "업로드 현황 다시 시도")
- 업로드 화면 순서: "월별 등록 현황" → "파일 올리기" → "업로드 이력".
- 주석은 한국어로, "왜"만 짧게 쓴다.
- **검증:** 각 Task 끝에 `apps/web`에서 `npm run typecheck && npm test && npm run lint`. Task 3 끝에는 `npm run build`도 돌린다.
- 검사 명령은 `apps/web`에서, `git add`/`git commit`은 **저장소 루트에서** 실행한다(경로는 루트 기준).

## 담당 (codex-collab 3장 표)

| Task | 구현 | 리뷰 | 순서 |
|---|---|---|---|
| 1 등록 현황을 업로드 화면으로 | Codex `gpt-6-sol` / medium | Claude sonnet | 먼저 |
| 2 홈 지난달 업로드 카드 | Codex `gpt-6-sol` / medium | Claude sonnet | Task 1 뒤 |
| 3 `?month=`로 창 열기 | Codex `gpt-6-sol` / medium | Claude sonnet | Task 2 뒤 |
| 4 실제 앱 검증·기능 지도·후속 문서 | 컨트롤러(검증) + Codex `gpt-6-luna` / low(문서) | — | 마지막 |

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/web/src/imports/coverageApi.ts` (← `home/`) | `/me/coverage` 호출과 `CoverageMonth` 타입 |
| `apps/web/src/imports/useDeleteMonth.ts` (← `home/`) | 한 달 삭제 뮤테이션 |
| `apps/web/src/imports/CoverageCalendar.tsx` + `.module.css` (← `home/`) | 12칸 달력 |
| `apps/web/src/imports/MonthDataDialog.tsx` (← `home/`) + `MonthDataDialog.module.css` (새로) | 등록된 달의 건수·다시 업로드·삭제 창 |
| `apps/web/src/imports/CoverageSection.tsx` + `.module.css` (새로) | 연도 선택 + 달력 + 두 창 + 삭제 알림. `initialMonth`로 창을 연다(Task 3) |
| `apps/web/src/imports/CoverageSection.test.tsx` (새로) | 옮겨 온 달력·창 테스트 |
| `apps/web/src/imports/UploadPage.tsx` (+ test) | 등록 현황 → 파일 올리기 → 이력. `?month=` 처리 |
| `apps/web/src/home/HomePage.tsx` (+ test, css) | 지난달 업로드 카드 + 지난달 요약 |

---

### Task 1: 등록 현황을 업로드 화면으로 옮기기

홈에서 하던 달력·창 동작을 그대로 `CoverageSection`으로 옮기고, 업로드 화면 맨 위에 둔다. 이 Task에서는 홈도 잠시 `CoverageSection`을 쓴다(Task 2에서 뺀다). 동작은 바뀌지 않고, 연도 화살표만 페이지 제목 줄에서 카드 제목 줄로 옮겨진다.

**Files:**
- Move: `apps/web/src/home/{coverageApi.ts,useDeleteMonth.ts,CoverageCalendar.tsx,CoverageCalendar.module.css,MonthDataDialog.tsx}` → `apps/web/src/imports/`
- Create: `apps/web/src/imports/MonthDataDialog.module.css`, `apps/web/src/imports/CoverageSection.tsx`, `apps/web/src/imports/CoverageSection.module.css`, `apps/web/src/imports/CoverageSection.test.tsx`
- Modify: `apps/web/src/imports/UploadPage.tsx`, `apps/web/src/imports/UploadPage.test.tsx`, `apps/web/src/home/HomePage.tsx`, `apps/web/src/home/HomePage.module.css`, `apps/web/src/home/HomePage.test.tsx`

**Interfaces:**
- Produces:
  - `imports/coverageApi.ts`: `type CoverageMonth = { month: string; importedCount: number; manualCount: number }`, `coverageApi.get(year: number): Promise<CoverageMonth[]>` (내용 그대로)
  - `imports/CoverageSection.tsx`: `export default function CoverageSection(props: { today: Date }): JSX.Element`. 쿼리 키 `['coverage', year]`.
  - `imports/UploadPage.tsx`: `export default function UploadPage(props: { today?: Date })`

- [ ] **Step 1: 파일 옮기기 (git mv)**

```bash
git mv apps/web/src/home/coverageApi.ts apps/web/src/imports/coverageApi.ts
git mv apps/web/src/home/useDeleteMonth.ts apps/web/src/imports/useDeleteMonth.ts
git mv apps/web/src/home/CoverageCalendar.tsx apps/web/src/imports/CoverageCalendar.tsx
git mv apps/web/src/home/CoverageCalendar.module.css apps/web/src/imports/CoverageCalendar.module.css
git mv apps/web/src/home/MonthDataDialog.tsx apps/web/src/imports/MonthDataDialog.tsx
```

`imports/MonthDataDialog.tsx`의 import 세 줄을 고친다(같은 폴더가 되었으므로):

```tsx
import UploadForm from './UploadForm'
import type { CoverageMonth } from './coverageApi'
import styles from './MonthDataDialog.module.css'
```

`apps/web/src/imports/MonthDataDialog.module.css`를 새로 만든다. 홈 CSS의 `.totals` 규칙을 그대로 복사한다(홈 요약 카드도 계속 쓰므로 홈 CSS에서는 지우지 않는다):

```css
.totals { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.totals > div { padding: var(--space-4); border-radius: var(--radius-sm); background: var(--surface-100); }
.totals dt { font-size: var(--text-sm); color: var(--ink-muted); }
.totals dd { margin: 0; font-size: var(--text-xl); line-height: 32px; font-weight: 700; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: 달력 테스트를 `CoverageSection.test.tsx`로 옮겨 실패시키기**

`apps/web/src/home/HomePage.test.tsx`에서 아래 테스트 15개를 **그대로 잘라** `apps/web/src/imports/CoverageSection.test.tsx`로 옮긴다. 나머지 두 테스트('summarizes last month and lists recent uploads', 'shows an alert with its own retry button when the summary or recent uploads fail')는 홈에 남긴다.

- 'draws the year buttons as icons'
- 'shows registered, missing and upcoming months for the year'
- 'splits the missing-month text so the upload hint can hide in narrow cells'
- 'starts in January on last year, where last month is'
- 'moves between years'
- 'opens the upload dialog from a missing month and refreshes the calendar after upload'
- 'keeps the upload dialog open while the file is uploading'
- 'opens the month dialog from a registered month'
- 'deletes a month after typing it, optionally with manual transactions'
- 'hides the manual option when there are none and shows delete errors in the dialog'
- 'resets the delete confirmation when it is cancelled'
- 'keeps the month dialog open while re-uploading'
- 'deletes only uploaded transactions when the manual option stays off'
- 'cannot delete while an upload is running'
- 'locks the dialog while a delete is in flight'

옮긴 파일에서 바꾸는 것은 세 가지다.
1. 맨 위 import와 헬퍼를 아래로 바꾼다.
2. 본문의 `renderPage(<HomePage today={today} />)`를 모두 `renderPage(<CoverageSection today={today} />)`로, `renderPage(<HomePage today={new Date(2026, 0, 10)} />)`를 `renderPage(<CoverageSection today={new Date(2026, 0, 10)} />)`로 바꾼다.
3. `describe('HomePage', …)`를 `describe('CoverageSection', …)`로 바꾼다.

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import CoverageSection from './CoverageSection'
import type { CoverageMonth } from './coverageApi'

const today = new Date(2026, 9, 19) // 2026-10-19

function handlers(coverage: CoverageMonth[]) {
  server.use(
    http.get('*/api/me/coverage', ({ request }) => {
      const year = new URL(request.url).searchParams.get('year')
      return HttpResponse.json(year === '2026' ? coverage : [])
    }),
    http.get('*/api/me/transactions', () => HttpResponse.json([])),
    http.get('*/api/imports', () => HttpResponse.json([])),
  )
}
```

옮긴 테스트가 쓰지 않는 import(`act`, `waitFor`, `delay` 중 일부)가 생기면 lint가 알려 주므로 지운다. 홈 테스트 파일에서도 더 이상 쓰지 않는 import와 `handlers`를 지운다.

`apps/web/src/imports/UploadPage.test.tsx`에는 순서를 확인하는 테스트를 더한다(맨 아래 `describe` 안):

```tsx
  it('puts the coverage calendar above the upload form and history', async () => {
    server.use(
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
    )

    renderPage(<UploadPage today={new Date(2026, 9, 19)} />)

    await screen.findByRole('region', { name: '월별 등록 현황' })
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['월별 등록 현황', '파일 올리기', '업로드 이력'])
  })
```

같은 파일의 기존 두 테스트에도 `http.get('*/api/me/coverage', () => HttpResponse.json([]))`를 `server.use`에 더한다(업로드 화면이 이제 등록 현황을 부른다).

- [ ] **Step 3: 실패 확인**

Run: `cd apps/web && npx vitest run src/imports src/home`
Expected: FAIL. `./CoverageSection`을 찾지 못하고, `HomePage.tsx`는 `./CoverageCalendar` 등을 찾지 못한다.

- [ ] **Step 4: `CoverageSection` 만들기**

`apps/web/src/imports/CoverageSection.module.css`:

```css
.year { min-width: 72px; text-align: center; font-size: var(--text-md); font-weight: 700; }
```

`apps/web/src/imports/CoverageSection.tsx` (홈의 달력 카드와 두 창, 상태를 그대로 옮긴 것):

```tsx
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Dialog from '../common/Dialog'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatMonthLabel } from '../common/format'
import CoverageCalendar from './CoverageCalendar'
import { coverageApi, type CoverageMonth } from './coverageApi'
import MonthDataDialog from './MonthDataDialog'
import UploadForm from './UploadForm'
import styles from './CoverageSection.module.css'

type Props = { today: Date }

/** 한 해의 월별 등록 현황. 미등록 월은 업로드 창, 등록된 월은 데이터 관리 창을 연다. */
export default function CoverageSection({ today }: Props) {
  // 1월에는 지난달이 작년이므로, 달력도 지난달이 있는 연도부터 보여준다.
  const [year, setYear] = useState(() => Number(defaultYearMonth(today).slice(0, 4)))
  const [uploadMonth, setUploadMonth] = useState<string | null>(null)
  const [managed, setManaged] = useState<CoverageMonth | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const uploading = useIsMutating({ mutationKey: ['upload'] }) > 0
  const coverage = useQuery({ queryKey: ['coverage', year], queryFn: () => coverageApi.get(year) })

  return (
    <section aria-labelledby="coverage-title" className={ui.card}>
      <div className={ui.pageHeader}>
        <h2 id="coverage-title">월별 등록 현황</h2>
        <div className={ui.row}>
          <button type="button" className={ui.button} aria-label="이전 연도" onClick={() => { setNotice(null); setYear(year - 1) }}><Icon name="chevron-left" size={18} /></button>
          <span className={styles.year}>{year}년</span>
          <button type="button" className={ui.button} aria-label="다음 연도" onClick={() => { setNotice(null); setYear(year + 1) }}><Icon name="chevron-right" size={18} /></button>
        </div>
      </div>
      <p className={ui.muted}>거래 일자 기준 · 미등록 월을 누르면 업로드합니다</p>
      {notice && <p role="status" className={ui.status}>{notice}</p>}
      {coverage.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {coverage.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>등록 현황을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void coverage.refetch()}>다시 시도</button>
        </div>
      )}
      {coverage.data && (
        <CoverageCalendar year={year} today={today} coverage={coverage.data} onPickMissing={(month) => { setNotice(null); setUploadMonth(month) }}
          onPickRegistered={(entry) => { setNotice(null); setManaged(entry) }} />
      )}
      {uploadMonth && (
        <Dialog title={`${formatMonthLabel(uploadMonth)} 데이터 업로드`} onClose={() => setUploadMonth(null)} closeDisabled={uploading}>
          <p className={ui.status}>뱅크샐러드에서 내려받은 엑셀(.xlsx)을 올려주세요. 여러 달이 들어 있어도 거래 일자에 맞게 반영됩니다.</p>
          <UploadForm />
        </Dialog>
      )}
      {managed && (
        <MonthDataDialog coverage={managed} onClose={() => setManaged(null)}
          onDeleted={(message) => { setManaged(null); setNotice(message) }} />
      )}
    </section>
  )
}
```

- [ ] **Step 5: 업로드 화면에 넣기**

`apps/web/src/imports/UploadPage.tsx`를 아래처럼 바꾼다(제목 아래, "파일 올리기" 카드 위에 `CoverageSection`):

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import ui from '../common/ui.module.css'
import { formatInstant } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import CoverageSection from './CoverageSection'
import { importsApi } from './importsApi'
import UploadForm from './UploadForm'

type Props = { today?: Date }

export default function UploadPage({ today: todayProp }: Props) {
  usePageTitle('업로드')
  const [mountedAt] = useState(() => new Date())
  const today = todayProp ?? mountedAt
  const history = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })

  return (
    <>
      <h1>뱅크샐러드 엑셀 업로드</h1>
      <CoverageSection today={today} />
      {/* 이 아래("파일 올리기" 카드와 "업로드 이력" 카드)는 지금 코드 그대로 둔다 */}
```

마지막 줄의 주석은 실제 파일에 넣지 않는다. 기존 `<section aria-labelledby="upload-title">`과 `<section aria-labelledby="history-title">` 두 카드를 그 자리에 그대로 둔다는 뜻이다.

- [ ] **Step 6: 홈이 잠시 `CoverageSection`을 쓰게 하기**

`apps/web/src/home/HomePage.tsx`에서:
- `useIsMutating`, `Dialog`, `Icon`, `UploadForm`, `CoverageCalendar`, `coverageApi`, `CoverageMonth`, `MonthDataDialog` import를 지우고 `import CoverageSection from '../imports/CoverageSection'`을 더한다.
- `year`, `uploadMonth`, `managed`, `notice`, `uploading`, `coverage` 상태와 쿼리를 지운다.
- 페이지 제목 줄을 `<h1>내 가계부</h1>` 한 줄로 바꾼다(연도 화살표는 `CoverageSection` 안으로 갔다).
- `<section aria-labelledby="coverage-title">…</section>` 전체와 맨 아래 두 창(`uploadMonth &&`, `managed &&`)을 `<CoverageSection today={today} />` 한 줄로 바꾼다. 위치는 지금 등록 현황 카드가 있던 자리다.

`apps/web/src/home/HomePage.module.css`에서 `.year` 규칙을 지운다.

- [ ] **Step 7: 통과 확인**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint`
Expected: 모두 PASS. `CoverageSection.test.tsx` 15개, `UploadPage.test.tsx` 3개, `HomePage.test.tsx` 2개.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/imports apps/web/src/home
git commit -m "refactor(web): 월별 등록 현황을 업로드 화면으로 옮기기"
```

---

### Task 2: 홈을 지난달 업로드 카드와 요약만으로

**Files:**
- Modify: `apps/web/src/home/HomePage.tsx`, `apps/web/src/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: `coverageApi.get(year)`, `CoverageMonth` (Task 1, `imports/coverageApi.ts`)
- Produces: 홈 링크 `/upload?month=YYYY-MM` (Task 3이 받는다)

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`apps/web/src/home/HomePage.test.tsx` 전체를 아래로 바꾼다:

```tsx
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import HomePage from './HomePage'

const today = new Date(2026, 9, 19) // 2026-10-19

function handlers({ coverage = {}, transactions = [] }: { coverage?: Record<string, unknown[]>; transactions?: unknown[] } = {}) {
  server.use(
    http.get('*/api/me/coverage', ({ request }) =>
      HttpResponse.json(coverage[new URL(request.url).searchParams.get('year') ?? ''] ?? [])),
    http.get('*/api/me/transactions', () => HttpResponse.json(transactions)),
  )
}

describe('HomePage', () => {
  it('says last month is registered with its upload count', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-09', importedCount: 168, manualCount: 2 }] } })

    renderPage(<HomePage today={today} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByText('2026년 9월 데이터 등록됨 · 168건')).toBeInTheDocument()
    expect(within(card).queryByRole('link', { name: '업로드하기' })).not.toBeInTheDocument()
  })

  it('links to the upload menu with last month when it is missing', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-08', importedCount: 10, manualCount: 0 }] } })

    renderPage(<HomePage today={today} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByText('2026년 9월 데이터가 아직 없습니다.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '업로드하기' })).toHaveAttribute('href', '/upload?month=2026-09')
  })

  it('looks up last year in January', async () => {
    handlers({ coverage: { '2025': [{ month: '2025-12', importedCount: 7, manualCount: 0 }] } })

    renderPage(<HomePage today={new Date(2026, 0, 10)} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByText('2025년 12월 데이터 등록됨 · 7건')).toBeInTheDocument()
  })

  it('shows its own alert and retry when coverage fails', async () => {
    let fail = true
    server.use(
      http.get('*/api/me/coverage', () => fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json([{ month: '2026-09', importedCount: 3, manualCount: 0 }])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<HomePage today={today} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByRole('alert')).toHaveTextContent('업로드 현황을 불러오지 못했습니다.')

    fail = false
    await user.click(within(card).getByRole('button', { name: '업로드 현황 다시 시도' }))
    expect(await within(card).findByText('2026년 9월 데이터 등록됨 · 3건')).toBeInTheDocument()
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('summarizes last month and no longer shows the calendar or recent uploads', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', ({ request }) => {
        expect(new URL(request.url).searchParams.get('month')).toBe('2026-09')
        return HttpResponse.json([
          { id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-01T09:00:00', type: 'INCOME', categoryMajor: '급여', categoryMinor: '', description: '월급', amount: 3000000, currency: 'KRW', paymentMethod: '은행', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
          { id: 2, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-02T12:00:00', type: 'EXPENSE', categoryMajor: '식비', categoryMinor: '', description: '점심', amount: -12000, currency: 'KRW', paymentMethod: '카드', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
        ])
      }),
    )

    renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    expect(await within(summary).findByText('₩ 3,000,000')).toBeInTheDocument()
    expect(within(summary).getByText('₩ 12,000')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '월별 등록 현황' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '최근 업로드' })).not.toBeInTheDocument()
  })

  it('retries the summary on its own', async () => {
    let fail = true
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', () => fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json([])),
    )
    const { user } = renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    expect(await within(summary).findByRole('alert')).toHaveTextContent('지난달 거래를 불러오지 못했습니다.')

    fail = false
    await user.click(within(summary).getByRole('button', { name: '요약 다시 시도' }))
    expect(await within(summary).findByText('수입')).toBeInTheDocument()
    expect(within(summary).queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/home`
Expected: FAIL. "지난달 업로드" 영역이 없다.

- [ ] **Step 3: 홈 구현**

`apps/web/src/home/HomePage.tsx` 전체를 아래로 바꾼다:

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatMonthLabel, formatWon } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { coverageApi } from '../imports/coverageApi'
import { summarize } from '../transactions/summary'
import { transactionsApi } from '../transactions/transactionsApi'
import styles from './HomePage.module.css'

type Props = { today?: Date }

export default function HomePage({ today: todayProp }: Props) {
  usePageTitle('내 가계부')
  const [mountedAt] = useState(() => new Date())
  const today = todayProp ?? mountedAt
  const month = defaultYearMonth(today)
  // 1월에는 지난달이 작년이므로 지난달이 속한 연도의 등록 현황을 본다.
  const year = Number(month.slice(0, 4))

  const coverage = useQuery({ queryKey: ['coverage', year], queryFn: () => coverageApi.get(year) })
  const mine = useQuery({ queryKey: ['transactions', 'mine', month], queryFn: () => transactionsApi.mine(month) })
  const totals = mine.data ? summarize(mine.data) : null
  const entry = coverage.data?.find((c) => c.month === month)

  return (
    <>
      <h1>내 가계부</h1>

      <div className={styles.twoColumns}>
        <section aria-labelledby="upload-status-title" className={ui.card}>
          <h2 id="upload-status-title">지난달 업로드</h2>
          {coverage.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {coverage.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>업로드 현황을 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} aria-label="업로드 현황 다시 시도" onClick={() => void coverage.refetch()}>다시 시도</button>
            </div>
          )}
          {coverage.data && (entry
            ? <p>{formatMonthLabel(month)} 데이터 등록됨 · {entry.importedCount}건</p>
            : <>
              <p>{formatMonthLabel(month)} 데이터가 아직 없습니다.</p>
              <Link to={`/upload?month=${month}`}>업로드하기</Link>
            </>)}
        </section>

        <section aria-labelledby="summary-title" className={ui.card}>
          <h2 id="summary-title">지난달 내 요약 ({formatMonthLabel(month)})</h2>
          {mine.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {mine.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>지난달 거래를 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} aria-label="요약 다시 시도" onClick={() => void mine.refetch()}>다시 시도</button>
            </div>
          )}
          {totals && (
            <dl className={styles.totals}>
              <div><dt>수입</dt><dd>{formatWon(totals.income)}</dd></div>
              <div><dt>지출</dt><dd>{formatWon(totals.expense)}</dd></div>
            </dl>
          )}
          <Link to="/transactions">내 거래 보기</Link>
        </section>
      </div>
    </>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint`
Expected: 모두 PASS. `HomePage.test.tsx` 6개.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/home
git commit -m "feat(web): 홈은 지난달 업로드 여부와 요약만 보여주기"
```

---

### Task 3: `/upload?month=`로 그 달 창 열기

**Files:**
- Modify: `apps/web/src/imports/CoverageSection.tsx`, `apps/web/src/imports/UploadPage.tsx`, `apps/web/src/imports/UploadPage.test.tsx`

**Interfaces:**
- Consumes: 홈 링크 `/upload?month=YYYY-MM` (Task 2)
- Produces: `CoverageSection` props가 `{ today: Date; initialMonth?: string | null; onInitialMonthHandled?: () => void }`로 늘어난다.

동작:
- `month`가 `YYYY-MM` 형식이고 이번 달 이하이면, 그 달의 연도를 달력 첫 연도로 쓴다. 등록 현황을 받으면, 미등록 달은 업로드 창을, 등록된 달은 데이터 관리 창을 연다. 그다음 `onInitialMonthHandled()`를 부른다.
- 형식이 틀리거나 미래 달이면 창을 열지 않고 바로 `onInitialMonthHandled()`를 부른다.
- `UploadPage`는 `onInitialMonthHandled`에서 주소의 `month`를 지운다(`replace`). 새로 고쳐도 창이 다시 열리지 않게 하기 위해서다.
- 등록 현황 조회가 실패하면 `month`를 지우지 않는다. "다시 시도"가 성공하면 그때 창이 열린다.

- [ ] **Step 1: 실패하는 테스트 쓰기**

`apps/web/src/imports/UploadPage.test.tsx` 맨 위 import를 아래로 바꾸고, `describe` 안에 테스트 넷을 더한다:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import UploadPage from './UploadPage'

const today = new Date(2026, 9, 19) // 2026-10-19

function Search() {
  return <output aria-label="주소 검색어">{useLocation().search}</output>
}

function coverageByYear(coverage: Record<string, unknown[]>) {
  server.use(
    http.get('*/api/imports', () => HttpResponse.json([])),
    http.get('*/api/me/coverage', ({ request }) =>
      HttpResponse.json(coverage[new URL(request.url).searchParams.get('year') ?? ''] ?? [])),
  )
}
```

```tsx
  it('opens the upload dialog for a missing month from the address and clears it', async () => {
    coverageByYear({})

    renderPage(<><UploadPage today={today} /><Search /></>, { path: '/upload?month=2026-09' })

    expect(await screen.findByRole('dialog', { name: '2026년 9월 데이터 업로드' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어' })).toBeEmptyDOMElement())
  })

  it('opens the month dialog for a registered month', async () => {
    coverageByYear({ '2026': [{ month: '2026-09', importedCount: 168, manualCount: 0 }] })

    renderPage(<UploadPage today={today} />, { path: '/upload?month=2026-09' })

    const dialog = await screen.findByRole('dialog', { name: '2026년 9월 데이터' })
    expect(within(dialog).getByRole('button', { name: '다시 업로드' })).toBeInTheDocument()
  })

  it('starts the calendar on the requested year', async () => {
    coverageByYear({})

    renderPage(<UploadPage today={today} />, { path: '/upload?month=2025-11' })

    expect(await screen.findByRole('dialog', { name: '2025년 11월 데이터 업로드' })).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
  })

  it('ignores a malformed or future month and clears it', async () => {
    coverageByYear({})

    renderPage(<><UploadPage today={today} /><Search /></>, { path: '/upload?month=2026-12' })

    await screen.findByText('12월')
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어' })).toBeEmptyDOMElement())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
```

`<output>`의 역할은 `status`다. 그래서 위 테스트에서 `getByRole('status', { name: '주소 검색어' })`로 찾는다.

- [ ] **Step 2: 실패 확인**

Run: `cd apps/web && npx vitest run src/imports/UploadPage.test.tsx`
Expected: 새 테스트 4개가 FAIL한다(창이 열리지 않는다).

- [ ] **Step 3: `CoverageSection`에 `initialMonth` 더하기**

`apps/web/src/imports/CoverageSection.tsx`에서 import, Props, 연도 초기값을 바꾸고 effect를 더한다:

```tsx
import { useEffect, useState } from 'react'
import { currentYearMonth, defaultYearMonth, formatMonthLabel } from '../common/format'
```

```tsx
type Props = { today: Date; initialMonth?: string | null; onInitialMonthHandled?: () => void }

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** 한 해의 월별 등록 현황. 미등록 월은 업로드 창, 등록된 월은 데이터 관리 창을 연다. initialMonth가 있으면 그 달 창을 연다. */
export default function CoverageSection({ today, initialMonth, onInitialMonthHandled }: Props) {
  const requested = initialMonth && MONTH.test(initialMonth) && initialMonth <= currentYearMonth(today) ? initialMonth : null
  // 1월에는 지난달이 작년이므로, 달력도 지난달이 있는 연도부터 보여준다.
  const [year, setYear] = useState(() => Number((requested ?? defaultYearMonth(today)).slice(0, 4)))
```

`coverage` 쿼리 선언 바로 아래에 더한다:

```tsx
  useEffect(() => {
    if (!initialMonth) return
    if (!requested) { onInitialMonthHandled?.(); return }
    // 요청한 달의 연도를 아직 받지 못했으면 기다린다(실패하면 다시 시도가 성공할 때까지).
    if (!coverage.data || year !== Number(requested.slice(0, 4))) return
    const entry = coverage.data.find((c) => c.month === requested)
    if (entry) setManaged(entry)
    else setUploadMonth(requested)
    onInitialMonthHandled?.()
  }, [initialMonth, requested, coverage.data, year, onInitialMonthHandled])
```

- [ ] **Step 4: `UploadPage`에서 주소 읽고 지우기**

`apps/web/src/imports/UploadPage.tsx`:

```tsx
import { useSearchParams } from 'react-router'
```

컴포넌트 안(`today` 아래):

```tsx
  const [params, setParams] = useSearchParams()
```

`<CoverageSection today={today} />`를 바꾼다:

```tsx
      <CoverageSection today={today} initialMonth={params.get('month')}
        onInitialMonthHandled={() => setParams((p) => { p.delete('month'); return p }, { replace: true })} />
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/web && npm run typecheck && npm test && npm run lint && npm run build`
Expected: 모두 PASS. `UploadPage.test.tsx` 7개.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/imports
git commit -m "feat(web): 업로드 화면이 주소의 달로 업로드 창을 열기"
```

---

### Task 4: 실제 앱 검증, 기능 지도, 후속 문서

**Files:**
- Modify: `.claude/skills/verify/features/home.md`, `.claude/skills/verify/features/upload.md`
- Create: `docs/superpowers/plans/2026-10-29-plan-16a-followups.md`

- [ ] **Step 1: 실제 앱에서 확인 (컨트롤러)**

`/verify` 스킬을 따른다. 저장소 루트에서:

```bash
.claude/skills/verify/bin/up.sh && .claude/skills/verify/bin/seed.sh && .claude/skills/verify/bin/doctor.sh
```

내장 브라우저에서 `mobile`과 `desktop` 두 폭 각각:
1. 로그인 후 홈의 "지난달 업로드"가 "`<지난달>` 데이터 등록됨 · 6건"이다(seed는 지난 3개월을 올린다).
2. "월별 등록 현황"과 "최근 업로드"가 홈에 없다.
3. 메뉴 "업로드"를 누르면 순서가 "월별 등록 현황" → "파일 올리기" → "업로드 이력"이다.
4. 주소창에 `http://localhost:15173/upload?month=<4개월 전 YYYY-MM>`(seed에 없는 달)을 넣으면 "`<그 달>` 데이터 업로드" 창이 열리고, 주소에서 `?month=`가 사라진다. 새로 고쳐도 창이 다시 열리지 않는다.
5. 미등록 상태의 홈 링크는 seed로 만들 수 없다. 달력에서 지난달 "이 달 데이터 삭제"(월 입력 확인)를 한 뒤 홈으로 가서 "업로드하기"가 보이는지, 누르면 업로드 화면에서 지난달 업로드 창이 열리는지 확인한다.

증거는 `.verify-artifacts/home-upload-16a-<yyyymmdd-hhmm>/`에 둔다. 끝나면 `.claude/skills/verify/bin/down.sh`.

- [ ] **Step 2: 기능 지도 고치기 (Codex luna)**

- `home.md`:
  - `home-coverage`, `home-upload-missing`, `home-month-manage`, `home-recent`를 지운다.
  - `home-upload-status`(지난달 업로드 카드: 등록됨, 또는 미등록 + "업로드하기" → `/upload?month=`)를 더한다.
  - 운전 단계와 Gotchas를 1단계에서 확인한 대로 고친다.
- `upload.md`:
  - `upload-coverage`(달력, 연도 화살표), `upload-month-dialog`(미등록 → 업로드 창, 등록 → 관리 창), `upload-deeplink`(`?month=`가 창을 열고 주소에서 지워짐)를 더한다.
  - 진입점 "홈의 업로드하기"를 더하고 "홈의 업로드 이력 전체"를 지운다.
- `README.md` 기능 목록의 홈·업로드 한 줄 설명도 맞춘다.

- [ ] **Step 3: 후속 문서**

`docs/superpowers/plans/2026-10-29-plan-16a-followups.md`에 적는다: 바뀐 결정(있으면), 1단계에서 확인한 것과 못 한 것, 업로드 하위 메뉴(스펙 범위 밖, 추후 구체화), 다음 계획(16b 소분류 API 보강, 16c 대시보드 주소·하위 메뉴).

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/verify/features docs/superpowers/plans/2026-10-29-plan-16a-followups.md
git commit -m "docs: 홈·업로드 이관 검증 기록과 기능 지도 갱신"
```
