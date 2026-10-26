import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import DashboardPage from './DashboardPage'

vi.mock('../common/echarts', () => ({ echarts: { init: () => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), dispatchAction: vi.fn() }) } }))

const today = new Date(2026, 10, 19) // 기본 월은 지난달 2026-10
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
    expect(within(categories).getByRole('button', { name: '식비 80% ₩ 200,000' })).toBeInTheDocument()
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
