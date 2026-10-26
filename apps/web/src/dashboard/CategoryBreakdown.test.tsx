import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockViewport } from '../test/mockViewport'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import CategoryBreakdown from './CategoryBreakdown'
import type { MonthlySummary } from './dashboardApi'

const chart = vi.hoisted(() => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: vi.fn(() => false), dispatchAction: vi.fn() }))
vi.mock('../common/echarts', () => ({ echarts: { init: vi.fn(() => chart) } }))
beforeEach(() => vi.clearAllMocks())

const summary: MonthlySummary = {
  month: '2026-10', income: 0, expense: 250001,
  byCategory: [
    { category: '식비', expense: 200000 },
    { category: '교통', expense: 50000 },
    { category: '기타', expense: 1 },
    { category: '환불', expense: 0 },
    { category: '취소', expense: -1 },
  ],
  byMember: [],
}

describe('CategoryBreakdown', () => {
  it('shows positive expenses and their accessible percentages with a hidden chart', async () => {
    renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={summary} />)
    const region = await screen.findByRole('region', { name: '카테고리별 지출' })
    expect(within(region).getByRole('button', { name: '식비 80% ₩ 200,000' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: '기타 1% 미만 ₩ 1' })).toBeInTheDocument()
    expect(within(region).queryByText('환불')).not.toBeInTheDocument()
    expect(within(region).queryByText('취소')).not.toBeInTheDocument()
    expect(region.querySelector('div[aria-hidden="true"]')).toBeInTheDocument()
    expect(within(region).getByRole('list')).toBeInTheDocument()
    expect(region.querySelector('[aria-hidden="true"][style*="--swatch-color"]')).not.toHaveClass('undefined')
  })

  it('shows the empty state when no category has a positive expense', async () => {
    renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={{ ...summary, byCategory: [{ category: '환불', expense: -1 }] }} />)
    expect(await screen.findByText('지출이 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /환불/ })).not.toBeInTheDocument()
  })

  it('opens the selected category and requests its transactions for the month', async () => {
    const requests: string[] = []
    server.use(http.get('*/api/groups/10/summary/transactions', ({ request }) => {
      requests.push(new URL(request.url).search)
      return HttpResponse.json([])
    }))
    const { user } = renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={summary} />)
    await user.click(await screen.findByRole('button', { name: '식비 80% ₩ 200,000' }))
    expect(await screen.findByRole('dialog', { name: '식비' })).toBeInTheDocument()
    expect(new URLSearchParams(requests[0]).get('month')).toBe('2026-10')
    expect(new URLSearchParams(requests[0]).get('category')).toBe('식비')
  })

  it('highlights the matching chart slice on row hover', async () => {
    renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={summary} />)
    const row = await screen.findByRole('button', { name: '식비 80% ₩ 200,000' })
    chart.setOption.mockClear()
    chart.on.mockClear()
    chart.off.mockClear()
    fireEvent.pointerOver(row)
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'highlight', seriesIndex: 0, name: '식비' })
    fireEvent.pointerOut(row)
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'downplay', seriesIndex: 0, name: '식비' })
    fireEvent.focus(row)
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'highlight', seriesIndex: 0, name: '식비' })
    expect(chart.setOption).not.toHaveBeenCalled()
    expect(chart.on).not.toHaveBeenCalled()
    expect(chart.off).not.toHaveBeenCalled()
    fireEvent.blur(row)
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'downplay', seriesIndex: 0, name: '식비' })
  })
})


it('uses compact chart height and keeps the full accessible name on narrow screens', async () => {
  mockViewport(true)
  renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={{ ...summary, byCategory: [{ category: '아주긴카테고리', expense: 1 }] }} />)
  const region = await screen.findByRole('region', { name: '카테고리별 지출' })
  expect(region.querySelector('div[aria-hidden="true"]')).toHaveStyle({ height: '220px' })
  expect(within(region).getByRole('button', { name: '아주긴카테고리 100% ₩ 1' })).toBeInTheDocument()
})

it('keeps all twelve category controls accessible on narrow screens', async () => {
  mockViewport(true)
  const byCategory = [60, 10, 5, 4, 3, 3, 2, 2, 2, 2, 1, 1].map((expense, index) => ({
    category: `긴 카테고리 이름 ${index + 1}`, expense: expense * 10000,
  }))
  renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={{ ...summary, byCategory }} />)
  const region = await screen.findByRole('region', { name: '카테고리별 지출' })
  expect(within(region).getAllByRole('button')).toHaveLength(12)
  expect(within(region).getByRole('button', { name: /긴 카테고리 이름 12.*₩ 10,000/ })).toBeInTheDocument()
  expect(region.querySelector('div[aria-hidden="true"]')).toHaveStyle({ height: '292px' })
})
