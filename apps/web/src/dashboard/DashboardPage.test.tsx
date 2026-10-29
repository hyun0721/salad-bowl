import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation, useNavigationType } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockViewport } from '../test/mockViewport'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import DashboardPage from './DashboardPage'

vi.mock('../common/echarts', () => ({ echarts: { init: () => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: vi.fn(() => false), dispatchAction: vi.fn() }) } }))

const today = new Date(2026, 10, 19) // 기본 월은 지난달 2026-10
const group = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const summary = {
  month: '2026-10',
  income: 3000000,
  expense: 250000,
  byCategory: [{ category: '식비', expense: 200000 }, { category: '교통', expense: 50000 }],
  // 금액이 작은 멤버를 먼저 두어 대화상자의 금액순 정렬을 확인한다.
  byMember: [
    { userId: 2, nickname: '짝꿍', income: 0, expense: 100000 },
    { userId: 1, nickname: '나', income: 3000000, expense: 150000 },
  ],
}

function Where() {
  const { pathname, search } = useLocation()
  return <output aria-label="현재 주소">{pathname + search}</output>
}

function NavType() { return <output aria-label="이동 방식">{useNavigationType()}</output> }

function renderDashboard(path = '/dashboard/major') {
  return renderPage(
    <Routes>
      <Route path="/dashboard/:level?/:view?" element={<><DashboardPage today={today} /><Where /><NavType /></>} />
    </Routes>,
    { groups: [group], path },
  )
}

beforeEach(() => {
  server.use(http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([])))
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
  server.use(http.get('*/api/groups/10/summary/trend', () => HttpResponse.json({ months: [], categories: [] })))
})

describe('DashboardPage', () => {
  it('shows the selected group summary for this month', async () => {
    const months: string[] = []
    server.use(http.get('*/api/groups/10/summary', ({ request }) => {
      months.push(new URL(request.url).searchParams.get('month')!)
      return HttpResponse.json(summary)
    }))
    renderDashboard()

    expect(await screen.findByRole('button', { name: '수입 ₩ 3,000,000' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '지출 ₩ 250,000' })).toBeInTheDocument()
    const categories = screen.getByRole('region', { name: '카테고리별 지출' })
    expect(within(categories).getByRole('button', { name: '식비 80% ₩ 200,000' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '멤버별' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '대분류별 추이' })).toBeInTheDocument()
    expect(months).toEqual(['2026-10'])
  })

  it('opens per-member totals from the income and expense cards', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    const { user } = renderDashboard()

    await user.click(await screen.findByRole('button', { name: '지출 ₩ 250,000' }))
    const expense = await screen.findByRole('dialog', { name: '멤버별 지출' })
    expect(within(expense).getAllByRole('row').map((r) => r.textContent)).toEqual(
      ['멤버지출', '나₩ 150,000', '짝꿍₩ 100,000', '합계₩ 250,000'])
    await user.click(within(expense).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '수입 ₩ 3,000,000' }))
    const income = await screen.findByRole('dialog', { name: '멤버별 수입' })
    expect(within(income).getAllByRole('row').map((r) => r.textContent)).toEqual(
      ['멤버수입', '나₩ 3,000,000', '짝꿍₩ 0', '합계₩ 3,000,000'])
  })

  it('loads the previous month', async () => {
    const months: string[] = []
    server.use(http.get('*/api/groups/10/summary', ({ request }) => {
      const month = new URL(request.url).searchParams.get('month')!
      months.push(month)
      return HttpResponse.json({ ...summary, month })
    }))
    const { user } = renderDashboard()

    await screen.findByRole('button', { name: /^수입/ })
    await user.click(screen.getByRole('button', { name: '이전 달' }))

    await waitFor(() => expect(months).toContain('2026-09'))
  })

  it('keeps trend chip choices when the dashboard month changes', async () => {
    const trendMonths: string[] = []
    server.use(
      http.get('*/api/groups/10/summary', ({ request }) => {
        const month = new URL(request.url).searchParams.get('month')!
        return HttpResponse.json({ ...summary, month })
      }),
      http.get('*/api/groups/10/summary/trend', ({ request }) => {
        trendMonths.push(new URL(request.url).searchParams.get('to')!)
        return HttpResponse.json({
          months: ['2026-09', '2026-10'],
          categories: [{ category: '식비', expenses: [1000, 2000], total: 3000 }],
        })
      }),
    )
    const { user } = renderDashboard()
    const trend = await screen.findByRole('region', { name: '대분류별 추이' })
    await within(trend).findByRole('button', { name: '식비' })
    await user.click(within(trend).getByRole('button', { name: '식비' }))
    expect(within(trend).getByRole('button', { name: '식비' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await waitFor(() => expect(trendMonths).toContain('2026-09'))
    await waitFor(() => expect(within(screen.getByRole('region', { name: '대분류별 추이' }))
      .getByRole('button', { name: '식비' })).toHaveAttribute('aria-pressed', 'false'))
  })

  it('says so when nothing was shared this month', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(
      { month: '2026-10', income: 0, expense: 0, byCategory: [], byMember: [] })))
    const { user } = renderDashboard()

    expect(await screen.findByText('이 달에 합칠 거래가 없습니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '수입 ₩ 0' }))
    expect(within(await screen.findByRole('dialog', { name: '멤버별 수입' })).getByText('공개한 멤버가 없습니다.')).toBeInTheDocument()
  })

  it('retries a failed summary', async () => {
    let fail = true
    server.use(http.get('*/api/groups/10/summary', () => (fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json(summary))))
    const { user } = renderDashboard()

    expect(await screen.findByText('요약을 불러오지 못했습니다.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('button', { name: /^수입/ })).toBeInTheDocument()
  })

  it('guides people without a group', async () => {
    renderPage(<Routes><Route path="/dashboard/:level?/:view?" element={<DashboardPage today={today} />} /></Routes>,
      { groups: [], path: '/dashboard/major' })

    expect(await screen.findByRole('heading', { name: '아직 속한 그룹이 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '그룹 만들기' })).toHaveAttribute('href', '/groups')
  })

  it('redirects /dashboard to the major screen and keeps the month', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json({ ...summary, month: '2026-08' })))
    renderDashboard('/dashboard?month=2026-08')
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major?month=2026-08'))
    expect(await screen.findByRole('region', { name: '카테고리별 지출' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '대분류별 추이' })).toBeInTheDocument()
    expect(document.title).toBe('그룹 대시보드 · 대분류 · Salad Bowl')
  })

  it('reads the month from the address and writes it back when the month changes', async () => {
    const months: string[] = []
    server.use(http.get('*/api/groups/10/summary', ({ request }) => {
      const month = new URL(request.url).searchParams.get('month')!
      months.push(month)
      return HttpResponse.json({ ...summary, month })
    }))
    const { user } = renderDashboard('/dashboard/major?month=2026-08')
    await screen.findByRole('button', { name: /^수입/ })
    expect(months).toEqual(['2026-08'])
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major?month=2026-07'))
  })

  it('falls back to last month for a malformed month', async () => {
    const months: string[] = []
    server.use(http.get('*/api/groups/10/summary', ({ request }) => {
      months.push(new URL(request.url).searchParams.get('month')!)
      return HttpResponse.json(summary)
    }))
    renderDashboard('/dashboard/major?month=2026-13')
    await screen.findByRole('button', { name: /^수입/ })
    expect(months).toEqual(['2026-10'])
  })

  it('shows the temporary subcategory card on the minor screen', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    renderDashboard('/dashboard/minor')
    expect(await screen.findByRole('region', { name: '소분류 추이·분포' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '카테고리별 지출' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^수입/ })).toBeInTheDocument()
  })

  it('scrolls to the view card again after the summary arrives', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    server.use(http.get('*/api/groups/10/summary', async () => {
      await pending
      return HttpResponse.json({ ...summary, month: '2026-08' })
    }))
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    const scroll = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    try {
      renderDashboard('/dashboard/major/trend?month=2026-08')
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
      release()
      await screen.findByRole('region', { name: '카테고리별 지출' })
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(2))
      expect(scroll.mock.contexts[1]).toBe(document.getElementById('dashboard-trend'))
    } finally {
      release()
      if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original)
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })
})

describe('DashboardPage on a narrow screen', () => {
  beforeEach(() => { mockViewport(true) })

  it('switches sub-screens in place, keeps the month and leaves focus on the link', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    const { user } = renderDashboard('/dashboard/major/share?month=2026-10')
    const nav = await screen.findByRole('navigation', { name: '대시보드 메뉴' })
    const trend = within(nav).getByRole('link', { name: '추이' })
    await user.click(trend)
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major/trend?month=2026-10'))
    expect(screen.getByRole('status', { name: '이동 방식' })).toHaveTextContent('REPLACE')
    expect(within(screen.getByRole('navigation', { name: '대시보드 메뉴' })).getByRole('link', { name: '추이' })).toHaveFocus()
    expect(await screen.findByRole('region', { name: '대분류별 추이' })).toBeInTheDocument()
  })

  it('redirects a level address to its share screen', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    renderDashboard('/dashboard/major?month=2026-10')
    await waitFor(() => expect(screen.getByRole('status', { name: '현재 주소' })).toHaveTextContent('/dashboard/major/share?month=2026-10'))
    expect(await screen.findByRole('region', { name: '카테고리별 지출' })).toBeVisible()
    expect(screen.queryByRole('region', { name: '대분류별 추이' })).not.toBeInTheDocument()
    expect(document.title).toBe('그룹 대시보드 · 대분류 분포 · Salad Bowl')
  })

  it('shows only the trend card on the trend screen', async () => {
    server.use(http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)))
    renderDashboard('/dashboard/major/trend')
    expect(await screen.findByRole('region', { name: '대분류별 추이' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '카테고리별 지출' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^지출/ })).toBeInTheDocument()
  })
})
