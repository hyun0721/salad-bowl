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
    expect(within(table).getByRole('cell', { name: '2026년 10월 -₩ 5,000, 전월 비교 없음' })).toHaveTextContent('—')
    expect(within(table).getAllByRole('rowheader').map((row) => row.textContent)).toEqual(['외식', '미분류', '간식'])
    expect(within(table).getAllByRole('columnheader').slice(2).map((x) => x.textContent)).toEqual(['10월', '9월', '8월'])
    await user.click(screen.getByRole('button', { name: /대분류.*필수/ }))
    await user.click(screen.getByRole('option', { name: '대분류를 선택하세요' }))
    await waitFor(() => expect(screen.getByLabelText('주소').textContent).not.toContain('major='))
  })

  it.each(['chart', 'table'])('marks the previous minor %s busy until the new period arrives', async (view) => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    let requested = false
    server.use(http.get('*/api/groups/10/summary/subcategories', async ({ request }) => {
      if (new URL(request.url).searchParams.get('from') === '2026-05') {
        requested = true
        await pending
      }
      return HttpResponse.json([{ month: '2026-10', major: '식비', minor: '외식', expense: 1000 }])
    }))
    const { user } = renderPage(<SubcategoryTrends groupId={10} month="2026-10" />, { path: '/dashboard/minor?major=식비' })
    const trend = await screen.findByRole('region', { name: '소분류 추이' })
    await within(trend).findByRole('button', { name: '외식' })
    if (view === 'table') await user.click(within(trend).getByRole('radio', { name: '표로 보기' }))
    const content = view === 'table' ? within(trend).getByRole('table') : within(trend).getByRole('group', { name: '소분류 선택' })
    try {
      await user.click(within(trend).getByRole('radio', { name: '6개월' }))
      await waitFor(() => expect(requested).toBe(true))
      expect(content.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true')
      expect(content).toBeVisible()
    } finally { release() }
    await waitFor(() => expect(content.closest('[aria-busy]')).toBeNull())
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

  it.each([[false, 'chart'], [true, 'chart'], [false, 'list'], [true, 'list']] as const)('opens minor transactions and restores focus, mobile=%s, view=%s', async (mobile, view) => {
    mockViewport(mobile)
    const requests: string[] = []
    server.use(
      http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([
        { month: '2026-10', major: '식비', minor: '외식', expense: 8000 },
        { month: '2026-10', major: '식비', minor: '미분류', expense: 1000 },
        { month: '2026-10', major: '식비', minor: '간식', expense: -2000 },
      ])),
      http.get('*/api/groups/10/summary/transactions', ({ request }) => {
        const params = new URL(request.url).searchParams
        expect(params.get('month')).toBe('2026-10')
        expect(params.get('category')).toBe('식비')
        const minor = params.get('minor')!
        requests.push(minor)
        return HttpResponse.json([{
          id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-19T12:30:00',
          type: 'EXPENSE', categoryMajor: '식비', categoryMinor: minor, description: `${minor} 테스트 거래`,
          amount: minor === '간식' ? 2000 : -1000, currency: 'KRW', paymentMethod: '카드', memo: null,
          hidden: false, source: 'IMPORT', edited: false, editable: false,
        }])
      }),
    )
    const { user } = renderPage(<SubcategoryTrends groupId={10} month="2026-10" />, { path: "/dashboard/minor?month=2026-10&major=식비" })
    const share = await screen.findByRole('region', { name: '소분류 분포' })
    await within(share).findByRole('button', { name: /^외식 / })
    if (view === 'list') await user.click(within(share).getByRole('radio', { name: '목록으로 보기' }))
    for (const minor of view === 'list' ? ['외식', '미분류', '간식'] : ['외식', '미분류']) {
      const opener = await within(share).findByRole('button', { name: new RegExp(`^${minor} `) })
      if (mobile) await user.click(opener)
      else {
        opener.focus()
        await user.keyboard('{Enter}')
      }
      const dialog = await screen.findByRole('dialog', { name: `식비 · ${minor}` })
      expect(await within(dialog).findByText(`${minor} 테스트 거래`)).toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /소분류 보기/ })).not.toBeInTheDocument()
      expect(within(dialog).getByText(`1건 · 합계 ₩ ${minor === '간식' ? '2,000' : '1,000'}`)).toBeInTheDocument()
      if (mobile) await user.click(within(dialog).getByRole('button', { name: '닫기' }))
      else await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(opener).toHaveFocus())
    }
    expect(requests).toEqual(view === 'list' ? ['외식', '미분류', '간식'] : ['외식', '미분류'])
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
    const { user } = renderPage(<SubcategoryTrends groupId={10} month="2026-10" />, { path: "/dashboard/minor?major=식비" })
    expect(await screen.findByText('대분류 목록을 불러오는 중입니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /대분류/ })).not.toBeInTheDocument()
    expect(screen.queryByText('최근 6개월에 공개된 지출이 없습니다.')).not.toBeInTheDocument()
    try {
      expect(screen.queryByText('대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.')).not.toBeInTheDocument()
      expect(screen.getAllByText('대분류 목록을 불러오는 중입니다.')).toHaveLength(1)
    } finally { release() }
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
    const { user } = renderPage(<SubcategoryTrends groupId={10} month="2026-10" />, { path: "/dashboard/minor?major=식비" })
    expect(await screen.findByRole('alert')).toHaveTextContent('대분류 목록을 불러오지 못했습니다.')
    expect(screen.queryByRole('button', { name: /대분류/ })).not.toBeInTheDocument()
    expect(screen.queryByText('최근 6개월에 공개된 지출이 없습니다.')).not.toBeInTheDocument()
    expect(screen.queryByText('대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.')).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
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

it('shows selected major member amounts in the monthly minor list', async () => {
  server.use(
    http.get('*/api/groups/10/summary/subcategories', () => HttpResponse.json([{ month: '2026-10', major: '식비', minor: '외식', expense: 100 }])),
    http.get('*/api/groups/10/summary/members', () => HttpResponse.json([{ major: '식비', minor: '외식', userId: 1, expense: 100 }, { major: '여가', minor: '외식', userId: 1, expense: 999 }])),
  )
  const { user, client } = renderPage(<SubcategoryTrends groupId={10} month="2026-10" members={[{ userId: 1, nickname: '하나' }]} />, { path: '/dashboard/minor?major=식비' })
  const region = await screen.findByRole('region', { name: '소분류 분포' })
  expect(client.getQueryState(['summary', 10, '2026-10', 'members'])?.fetchStatus).toBe('idle')
  expect(client.getQueryData(['summary', 10, '2026-10', 'members'])).toBeUndefined()
  await user.click(within(region).getByRole('radio', { name: '목록으로 보기' }))
  expect(await within(region).findByText('하나 ₩ 100')).toBeVisible()
  expect(within(region).queryByText(/999/)).not.toBeInTheDocument()
})
