import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import CategoryTrend from './CategoryTrend'

vi.mock('../common/echarts', () => ({ echarts: { init: () => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: vi.fn(() => false), dispatchAction: vi.fn() }) } }))

const categories = ['식비', '교통', '주거', '쇼핑', '의료', '교육', '여행'].map((category, index) => ({
  category, expenses: [7000 - index * 1000, 8000 - index * 1000], total: 15000 - index * 2000,
}))
const trend = { months: ['2026-02', '2026-03'], categories }

function setup(response: { months: string[]; categories: typeof categories } = trend) {
  const requests: { from: string | null; to: string | null }[] = []
  server.use(http.get('*/api/groups/10/summary/trend', ({ request }) => {
    const params = new URL(request.url).searchParams
    requests.push({ from: params.get('from'), to: params.get('to') })
    return HttpResponse.json(response)
  }))
  return requests
}

describe('CategoryTrend', () => {
  it('requests six months and selects the top five positive categories', async () => {
    const requests = setup()
    renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    const region = await screen.findByRole('region', { name: '대분류별 추이' })
    expect(await within(region).findByRole('button', { name: '식비' })).toHaveAttribute('aria-pressed', 'true')
    expect(requests).toEqual([{ from: '2025-10', to: '2026-03' }])
    expect(within(region).getByRole('button', { name: '의료' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(region).getByRole('button', { name: '교육' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(region).getByRole('button', { name: '여행' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles chips and updates the visible table', async () => {
    setup()
    const { user } = renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    await screen.findByRole('button', { name: '식비' })
    await user.click(screen.getByRole('button', { name: '식비' }))
    expect(screen.getByRole('button', { name: '식비' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByText('표로 보기'))
    const table = screen.getByRole('table', { name: '대분류별 월 지출' })
    expect(within(table).queryByRole('columnheader', { name: '식비' })).not.toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: '교통' })).toBeInTheDocument()
  })

  it('requests a new preset range', async () => {
    const requests = setup()
    const { user } = renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    await screen.findByRole('button', { name: '식비' })
    await user.click(screen.getByRole('radio', { name: '12개월' }))
    await waitFor(() => expect(requests).toContainEqual({ from: '2025-04', to: '2026-03' }))
  })

  it('shows a custom range error without sending another request', async () => {
    const requests = setup()
    const { user } = renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    await screen.findByRole('button', { name: '식비' })
    await user.click(screen.getByRole('radio', { name: '직접 지정' }))
    fireEvent.change(screen.getByLabelText('시작 월'), { target: { value: '2026-04' } })
    expect(screen.getByRole('alert')).toHaveTextContent('기간은 최대 12개월이고, 시작 월이 끝 월보다 늦을 수 없습니다.')
    expect(requests).toHaveLength(1)
  })

  it('shows month rows and formatted won amounts in the table', async () => {
    setup()
    const { user } = renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    await screen.findByRole('button', { name: '식비' })
    await user.click(screen.getByText('표로 보기'))
    const table = screen.getByRole('table', { name: '대분류별 월 지출' })
    expect(within(table).getByRole('row', { name: /2026년 2월/ })).toHaveTextContent('₩ 7,000')
    expect(within(table).getByRole('row', { name: /2026년 3월/ })).toHaveTextContent('₩ 8,000')
  })

  it('shows an empty state', async () => {
    setup({ months: ['2026-03'], categories: [] })
    renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    expect(await screen.findByText('이 기간에 지출이 없습니다.')).toBeInTheDocument()
  })

  it('retries a failed request', async () => {
    let fail = true
    server.use(http.get('*/api/groups/10/summary/trend', () => fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json(trend)))
    const { user } = renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('추이를 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('button', { name: '식비' })).toBeInTheDocument()
  })

  it('hides nonpositive categories and guides when every chip is off', async () => {
    setup({ ...trend, categories: [...categories.slice(0, 1), { category: '환불', expenses: [-10, 0], total: -10 }] })
    const { user } = renderPage(<CategoryTrend groupId={10} month="2026-03" />)
    await screen.findByRole('button', { name: '식비' })
    expect(screen.queryByRole('button', { name: '환불' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '식비' }))
    expect(screen.getByText('대분류를 하나 이상 고르세요.')).toBeInTheDocument()
  })
})
