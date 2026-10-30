import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    const region = await screen.findByRole('region', { name: '대분류 분포' })
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
    const { user } = renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={summary} />)
    const row = await screen.findByRole('button', { name: '식비 80% ₩ 200,000' })
    // 첫 setOption 효과는 버튼이 보인 뒤에 실행될 수 있다(느린 CI). 끝난 뒤에 기록을 지운다.
    await waitFor(() => expect(chart.setOption).toHaveBeenCalled())
    chart.setOption.mockClear()
    chart.on.mockClear()
    chart.off.mockClear()
    fireEvent.pointerOver(row, { pointerType: 'mouse' })
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'highlight', seriesIndex: 0, name: '식비' })
    fireEvent.pointerOut(row, { pointerType: 'mouse' })
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'downplay', seriesIndex: 0, name: '식비' })
    await user.tab()
    await user.tab()
    expect(row).toHaveFocus()
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'highlight', seriesIndex: 0, name: '식비' })
    expect(chart.setOption).not.toHaveBeenCalled()
    expect(chart.on).not.toHaveBeenCalled()
    expect(chart.off).not.toHaveBeenCalled()
    fireEvent.blur(row)
    expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'downplay', seriesIndex: 0, name: '식비' })
  })

  it('does not highlight on touch or on focus that is not keyboard focus', async () => {
    renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={summary} />)
    const row = await screen.findByRole('button', { name: '식비 80% ₩ 200,000' })
    await waitFor(() => expect(chart.setOption).toHaveBeenCalled())
    chart.dispatchAction.mockClear()
    fireEvent.pointerOver(row, { pointerType: 'touch' })
    // 대화상자가 닫히며 터치로 연 행에 포커스를 돌려주는 경우처럼 :focus-visible이 아닌 포커스.
    vi.spyOn(row, 'matches').mockReturnValue(false)
    fireEvent.focus(row)
    expect(chart.dispatchAction).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'highlight' }))
  })
})


it('uses compact chart height and keeps the full accessible name on narrow screens', async () => {
  mockViewport(true)
  renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={{ ...summary, byCategory: [{ category: '아주긴카테고리', expense: 1 }] }} />)
  const region = await screen.findByRole('region', { name: '대분류 분포' })
  expect(region.querySelector('div[aria-hidden="true"]')).toHaveStyle({ height: '200px' })
  expect(within(region).getByRole('button', { name: '아주긴카테고리 100% ₩ 1' })).toBeInTheDocument()
})

it('keeps all twelve category controls accessible on narrow screens', async () => {
  mockViewport(true)
  const byCategory = [60, 10, 5, 4, 3, 3, 2, 2, 2, 2, 1, 1].map((expense, index) => ({
    category: `긴 카테고리 이름 ${index + 1}`, expense: expense * 10000,
  }))
  renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={{ ...summary, byCategory }} />)
  const region = await screen.findByRole('region', { name: '대분류 분포' })
  expect(within(region).getAllByRole('button')).toHaveLength(12)
  expect(within(region).getByRole('button', { name: /긴 카테고리 이름 12.*₩ 10,000/ })).toBeInTheDocument()
  expect(region.querySelector('div[aria-hidden="true"]')).toHaveStyle({ height: '272px' })
})

it('switches to member bars, sums minors, and opens category transactions', async () => {
  server.use(
    http.get('*/api/groups/10/summary/members', ({ request }) => {
      expect(new URL(request.url).searchParams.get('month')).toBe('2026-10')
      return HttpResponse.json([{ major: '식비', minor: '외식', userId: 1, expense: 120000 }, { major: '식비', minor: '간식', userId: 1, expense: 80000 }])
    }),
    http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([])),
  )
  const { user, client } = renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={{ ...summary, byMember: [{ userId: 1, nickname: '하나', income: 0, expense: 200000 }] }} />)
  const listToggle = await screen.findByRole('radio', { name: '목록으로 보기' })
  expect(client.getQueryState(['summary', 10, '2026-10', 'members'])?.fetchStatus).toBe('idle')
  expect(client.getQueryData(['summary', 10, '2026-10', 'members'])).toBeUndefined()
  await user.click(listToggle)
  expect(await screen.findByTitle('하나 ₩ 200,000')).toBeVisible()
  const row = screen.getByRole('button', { name: '식비 80.0% ₩ 200,000, 하나 ₩ 200,000' })
  expect(row).toHaveAccessibleName(/하나 ₩ 200,000/)
  await user.click(row)
  expect(await screen.findByRole('dialog', { name: '식비' })).toBeVisible()
})

it('keeps list bars usable while member data loads and after it fails', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  server.use(http.get('*/api/groups/10/summary/members', async () => {
    await pending
    return HttpResponse.json({}, { status: 503 })
  }))
  const { user, client: queryClient } = renderPage(<CategoryBreakdown groupId={10} month="2026-10" summary={{ ...summary, byMember: [{ userId: 1, nickname: '하나', income: 0, expense: 200000 }] }} />)
  await user.click(await screen.findByRole('radio', { name: '목록으로 보기' }))
  try {
    expect(screen.getByRole('img', { name: '식비 80.0%' }).firstElementChild).toHaveStyle({ background: 'var(--brand)' })
    expect(screen.queryByText('하나')).not.toBeInTheDocument()
  } finally { release() }
  await waitFor(() => expect(queryClient.getQueryState(['summary', 10, '2026-10', 'members'])?.status).toBe('error'))
  expect(screen.getByRole('img', { name: '식비 80.0%' }).firstElementChild).toHaveStyle({ background: 'var(--brand)' })
  expect(screen.getByText('-₩ 1 · 환불 초과')).toBeVisible()
  expect(screen.queryByText('하나')).not.toBeInTheDocument()
})
