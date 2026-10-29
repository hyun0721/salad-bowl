import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import { mockViewport } from '../test/mockViewport'
import SubcategoryTrends from './SubcategoryTrends'
import DashboardPage from './DashboardPage'
import styles from './SubcategoryTrends.module.css'
vi.mock('../common/echarts', () => ({ echarts: { init: () => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: vi.fn(() => false), dispatchAction: vi.fn() }) } }))
const today = new Date(2026, 10, 19)
const group = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const summary = { month: '2026-10', income: 0, expense: 0, byCategory: [], byMember: [] }
function renderMinorDashboard() {
  return renderPage(<Routes><Route path="/dashboard/:level?/:view?" element={<DashboardPage today={today} />} /></Routes>,
    { groups: [group], path: '/dashboard/minor' })
}
beforeEach(() => {
  window.localStorage.clear()
  server.use(http.get('*/api/groups/10/summary/trend', () => HttpResponse.json({ months: [], categories: [] })))
})
describe('SubcategoryTrends', () => {
  it('starts from the major given by the address', async () => {
    server.use(http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([
      { month: '2026-10', major: '식비', minor: '외식', expense: 30000 },
      { month: '2026-10', major: '교통', minor: '택시', expense: 50000 },
    ])))
    renderPage(<SubcategoryTrends groupId={10} month="2026-10" initialMajor="식비" />)
    const section = await screen.findByRole('region', { name: '소분류 추이·분포' })
    expect(await within(section).findByRole('heading', { name: '식비 소분류 월별 추이' })).toBeInTheDocument()
    expect(within(section).getByRole('heading', { name: '소분류 추이·분포' })).not.toHaveFocus()
  })

  it('shows the selection hint when the address names an unknown major', async () => {
    server.use(http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([
      { month: '2026-10', major: '식비', minor: '외식', expense: 30000 },
    ])))
    renderPage(<SubcategoryTrends groupId={10} month="2026-10" initialMajor="없는분류" />)
    const section = await screen.findByRole('region', { name: '소분류 추이·분포' })
    expect(await within(section).findByText('대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.')).toBeInTheDocument()
  })

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
    const { user } = renderMinorDashboard()
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
    const { user } = renderMinorDashboard()
    expect(await screen.findByText('대분류 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '소분류 다시 시도' }))
    expect(await screen.findByText('최근 6개월에 공개된 지출이 없습니다.')).toBeInTheDocument()
  })

  it.each([false, true])('waits for the initial list before offering selection, mobile=%s', async (mobile) => {
    mockViewport(mobile)
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    server.use(http.get('*/api/groups/10/summary/subcategories', async () => {
      await pending
      return HttpResponse.json([{ month: '2026-10', major: '식비', minor: '외식', expense: 1000 }])
    }))
    const { user } = renderPage(<SubcategoryTrends groupId={10} month="2026-10" />)
    expect(await screen.findByText('대분류 목록을 불러오는 중입니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /대분류/ })).not.toBeInTheDocument()
    expect(screen.queryByText('최근 6개월에 공개된 지출이 없습니다.')).not.toBeInTheDocument()
    release()
    await user.click(await screen.findByRole('button', { name: /대분류.*필수/ }))
    if (mobile) expect(screen.getByRole('dialog', { name: '대분류 (필수)' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '식비' }))
    expect(await screen.findByRole('row', { name: /외식/ })).toBeInTheDocument()
  })

  it.each([404, 503])('recovers from HTTP %s without showing an empty selector', async (status) => {
    let fail = true
    server.use(http.get('*/api/groups/10/summary/subcategories', () => fail
      ? HttpResponse.json({ code: status === 404 ? 'NOT_FOUND' : 'SERVER_UNAVAILABLE' }, { status })
      : HttpResponse.json([{ month: '2026-10', major: '식비', minor: '외식', expense: 1000 }])))
    const { user } = renderPage(<SubcategoryTrends groupId={10} month="2026-10" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('대분류 목록을 불러오지 못했습니다.')
    expect(screen.queryByRole('button', { name: /대분류/ })).not.toBeInTheDocument()
    expect(screen.queryByText('최근 6개월에 공개된 지출이 없습니다.')).not.toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '소분류 다시 시도' }))
    await user.click(await screen.findByRole('button', { name: /대분류/ }))
    await user.click(screen.getByRole('option', { name: '식비' }))
    expect(await screen.findByRole('row', { name: /외식/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('distinguishes an empty successful response from a failed or pending list', async () => {
    server.use(http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([])))
    renderPage(<SubcategoryTrends groupId={10} month="2026-10" />)
    expect(await screen.findByText('최근 6개월에 공개된 지출이 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /대분류/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('대분류 목록을 불러오는 중입니다.')).not.toBeInTheDocument()
  })

})
