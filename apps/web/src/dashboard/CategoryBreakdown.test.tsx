import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import CategoryBreakdown from './CategoryBreakdown'
import type { MonthlySummary } from './dashboardApi'

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
    expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
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
    const slice = screen.getByRole('region', { name: '카테고리별 지출' }).querySelector('svg path')!
    fireEvent.pointerOver(row)
    expect(slice).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('region', { name: '카테고리별 지출' }).querySelectorAll('svg path[data-active="true"]')).toHaveLength(1)
  })
})
