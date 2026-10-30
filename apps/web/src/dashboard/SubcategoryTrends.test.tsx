import { screen, within, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation, useNavigationType } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import { mockViewport } from '../test/mockViewport'
import SubcategoryTrends from './SubcategoryTrends'
import DashboardPage from './DashboardPage'

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
  it('uses the address, separates cards, and requests three months only after selection', async () => {
    const requests: URLSearchParams[] = []
    server.use(http.get('*/api/groups/10/summary/subcategories', ({ request }) => {
      requests.push(new URL(request.url).searchParams)
      return HttpResponse.json([
        { month: '2026-10', major: '식비', minor: '외식', expense: 30000 },
        { month: '2026-10', major: '식비', minor: '', expense: 10000 },
        { month: '2026-10', major: '식비', minor: '간식', expense: -5000 },
      ])
    }))
    function Address() {
      const location = useLocation()
      const type = useNavigationType()
      return <output aria-label="주소">{location.search} {type}</output>
    }
    const { user } = renderPage(<><SubcategoryTrends groupId={10} month="2026-10" /><Address /></>, { path: '/dashboard/minor?month=2026-10&other=keep' })
    const share = await screen.findByRole('region', { name: '소분류 분포' })
    const trend = screen.getByRole('region', { name: '소분류 추이' })
    expect(share).toHaveAttribute('id', 'dashboard-share')
    expect(trend).toHaveAttribute('id', 'dashboard-trend')
    await screen.findByRole('button', { name: /대분류.*필수/ })
    expect(requests).toHaveLength(1)
    expect(requests[0].has('from')).toBe(false)
    await user.click(screen.getByRole('button', { name: /대분류.*필수/ }))
    await user.click(screen.getByRole('option', { name: '식비' }))
    await within(trend).findByRole('button', { name: '외식' })
    expect(requests.some((p) => p.get('from') === '2026-08' && p.get('month') === '2026-10')).toBe(true)
    expect(screen.getByLabelText('주소')).toHaveTextContent('REPLACE')
    expect(screen.getByLabelText('주소').textContent).toContain('major=%EC%8B%9D%EB%B9%84')
    expect(screen.getByLabelText('주소').textContent).toContain('other=keep')
    expect(within(share).getByRole('radiogroup', { name: '소분류 분포 보기 방식' })).toBeInTheDocument()
    expect(within(share).getByRole('radio', { name: '차트로 보기' })).toHaveAttribute('aria-checked', 'true')
    expect(within(share).getByText('미분류')).toBeInTheDocument()
    expect(within(share).queryByText('간식')).not.toBeInTheDocument()
    await user.click(within(share).getByRole('radio', { name: '목록으로 보기' }))
    expect(within(share).getByText('-₩ 5,000 · 환불 초과')).toBeInTheDocument()
    expect(within(trend).queryByRole('table')).not.toBeInTheDocument()
    await user.click(within(trend).getByRole('radio', { name: '표로 보기' }))
    const table = within(trend).getByRole('table', { name: '소분류별 전월 대비 증감률' })
    expect(within(table).getByRole('row', { name: /외식/ })).toHaveTextContent('신규0%—')
    expect(within(table).getByRole('cell', { name: '2026년 10월 -5,000원, 전월 비교 없음' })).toHaveTextContent('—')
    expect(within(table).getAllByRole('rowheader').map((row) => row.textContent)).toEqual(['외식', '미분류', '간식'])
    expect(within(table).getAllByRole('columnheader').slice(2).map((x) => x.textContent)).toEqual(['2026년 10월', '2026년 9월', '2026년 8월'])
    await user.click(screen.getByRole('button', { name: /대분류.*필수/ }))
    await user.click(screen.getByRole('option', { name: '대분류를 선택하세요' }))
    await waitFor(() => expect(screen.getByLabelText('주소').textContent).not.toContain('major='))
  })

  it('shows the selection hint for an unknown major without requesting a trend', async () => {
    const requests: string[] = []
    server.use(http.get('*/api/groups/10/summary/subcategories', ({ request }) => {
      requests.push(request.url)
      return HttpResponse.json([{ month: '2026-10', major: '식비', minor: '외식', expense: 1000 }])
    }))
    renderPage(<SubcategoryTrends groupId={10} month="2026-10" />, { path: '/dashboard/minor?major=unknown' })
    const share = await screen.findByRole('region', { name: '소분류 분포' })
    expect(await within(share).findByText('대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.')).toBeInTheDocument()
    expect(requests).toHaveLength(1)
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
    expect(await screen.findByRole('button', { name: '외식' })).toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: '외식' })).toBeInTheDocument()
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
