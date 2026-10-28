import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import DashboardPage from './DashboardPage'
import styles from './SubcategoryTrends.module.css'
vi.mock('../common/echarts', () => ({ echarts: { init: () => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: vi.fn(() => false), dispatchAction: vi.fn() }) } }))
const today = new Date(2026, 10, 19)
const group = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const summary = { month: '2026-10', income: 0, expense: 0, byCategory: [], byMember: [] }
beforeEach(() => {
  window.localStorage.clear()
  server.use(http.get('*/api/groups/10/summary/trend', () => HttpResponse.json({ months: [], categories: [] })))
})
describe('SubcategoryTrends', () => {
  it('requires one major and shows only its minors with missing months filled as zero', async () => {
    const requests: string[] = []
    server.use(
      http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)),
      http.get('*/api/groups/10/summary/subcategories', ({ request }) => {
        requests.push(new URL(request.url).searchParams.get('month')!)
        return HttpResponse.json([
          { month: '2026-05', major: '식비', minor: '외식', expense: 10000 },
          { month: '2026-10', major: '식비', minor: '외식', expense: 30000 },
          { month: '2026-10', major: '식비', minor: '', expense: 10000 },
          { month: '2026-10', major: '식비', minor: '간식', expense: -5000 },
          { month: '2026-10', major: '교통', minor: '택시', expense: 50000 },
        ])
      }),
    )
    const { user } = renderPage(<DashboardPage today={today} />, { groups: [group] })
    const section = await screen.findByRole('region', { name: '소분류 추이·분포' })
    await within(section).findByText('대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.')
    expect(within(section).queryByRole('table')).not.toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: /대분류/ }))
    await user.click(screen.getByRole('option', { name: '식비' }))
    const table = within(section).getByRole('table')
    const dining = within(table).getByRole('row', { name: /외식/ })
    expect(within(dining).getAllByText('₩ 0')).toHaveLength(4)
    expect(dining).toHaveTextContent('₩ 10,000')
    expect(dining).toHaveTextContent('₩ 30,000')
    expect(within(table).getAllByRole('columnheader').slice(2).map((cell) => cell.textContent)).toEqual([
      '2026년 10월', '2026년 9월', '2026년 8월', '2026년 7월', '2026년 6월', '2026년 5월',
    ])
    const cells = within(dining).getAllByRole('cell').slice(1)
    expect(cells[0]).toHaveTextContent('₩ 30,000')
    expect(cells[0]).toHaveClass(styles.expenseIncrease)
    expect(within(cells[0]).getByLabelText('전월 대비 증가')).toHaveTextContent('↑')
    expect(cells[4]).toHaveClass(styles.expenseDecrease)
    expect(within(cells[4]).getByLabelText('전월 대비 감소')).toHaveTextContent('↓')
    expect(cells[1]).toHaveAttribute('title', '전월과 동일')
    expect(cells[5]).toHaveAttribute('title', '전월 비교 없음')
    for (const cell of [cells[1], cells[5]]) {
      expect(cell).not.toHaveClass(styles.expenseIncrease)
      expect(cell).not.toHaveClass(styles.expenseDecrease)
    }
    const refundCells = within(within(table).getByRole('row', { name: /간식/ })).getAllByRole('cell').slice(1)
    expect(refundCells[0]).toHaveTextContent('-₩ 5,000')
    expect(refundCells[0]).toHaveClass(styles.expenseDecrease)
    expect(within(section).getByText('₩ 30,000 · 75.0%')).toBeInTheDocument()
    expect(within(section).getByText('-₩ 5,000 · 환불 초과')).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /미분류/ })).toBeInTheDocument()
    expect(within(section).queryByText('택시')).not.toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: /대분류/ }))
    await user.click(screen.getByRole('option', { name: '교통' }))
    expect(within(section).getByRole('row', { name: /택시/ })).toBeInTheDocument()
    expect(within(section).queryByText('외식')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await waitFor(() => expect(requests).toEqual(['2026-10', '2026-09']))
  })

  it('retries failed subcategories independently', async () => {
    let fail = true
    server.use(
      http.get('*/api/groups/10/summary', () => HttpResponse.json(summary)),
      http.get('*/api/groups/10/summary/subcategories', () => fail
        ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json([])),
    )
    const { user } = renderPage(<DashboardPage today={today} />, { groups: [group] })
    expect(await screen.findByText('소분류를 불러오지 못했습니다.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '소분류 다시 시도' }))
    expect(await screen.findByText('최근 6개월에 공개된 지출이 없습니다.')).toBeInTheDocument()
  })

})
