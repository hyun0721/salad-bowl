import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { typeDateTime } from '../test/typeDateTime'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import { mockViewport } from '../test/mockViewport'
import TransactionsPage from './TransactionsPage'
import type { TransactionView } from './transactionsApi'

const today = new Date(2026, 10, 19) // 2026-11-19: 기본 월은 지난달 2026-10

const base: TransactionView = {
  id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-05T12:30:00', type: 'EXPENSE',
  categoryMajor: '식비', categoryMinor: '점심', description: '김밥', amount: -4000, currency: 'KRW',
  paymentMethod: '현금', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
}
const groups = [{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }]

// 넓은 화면의 오른쪽 패널을 쓰는 흐름(패널을 연 채 목록·필터를 조작)을 확인할 때 쓴다.
function preferSidebar() {
  window.localStorage.setItem('saladbowl.transactionDetailView', 'sidebar')
}

function mineHandler(items: TransactionView[]) {
  server.use(http.get('*/api/me/transactions', () => HttpResponse.json(items)))
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
    server.use(http.get('*/api/me/categories', () => HttpResponse.json([])))
  })

  it('lists my transactions for the current month with signed amounts and badges', async () => {
    mineHandler([
      { ...base, id: 2, description: '국밥', amount: -9000, edited: true },
      { ...base, id: 1, hidden: true },
      { ...base, id: 3, type: 'INCOME', categoryMajor: '급여', description: '월급', amount: 3000000 },
    ])

    renderPage(<TransactionsPage today={today} />, { groups })

    const list = await screen.findByRole('region', { name: '거래 목록' })
    const rows = (await within(list).findAllByRole('row')).slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('10-05 12:30')
    expect(rows[0]).toHaveTextContent('-₩ 9,000')
    expect(rows[0]).toHaveTextContent('수정됨')
    expect(rows[1]).toHaveTextContent('숨김')
    expect(rows[2]).toHaveTextContent('+₩ 3,000,000')
    expect(document.title).toBe('거래 목록 · Salad Bowl')
  })

  it('sorts by amount and opens a row with the keyboard', async () => {
    preferSidebar()
    mineHandler([
      { ...base, id: 1, description: '김밥', amount: -4000 },
      { ...base, id: 2, description: '월급', amount: 3000000 },
      { ...base, id: 3, description: '국밥', amount: -9000 },
    ])
    server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })
    const table = await screen.findByRole('grid', { name: '거래 목록' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['일시', '카테고리', '내용', '결제수단', '금액'])

    await user.click(within(table).getByRole('columnheader', { name: /금액/ }))
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['국밥', '김밥', '월급'])

    await user.click(rows[0])
    // 상세 제목으로 옮겨진 포커스를 표로 되돌린 뒤 행 키보드 이동을 확인한다.
    rows[0].focus()
    await user.keyboard('{ArrowDown}{Enter}')
    const detail = screen.getByRole('complementary', { name: '거래 상세' })
    expect(within(detail).getByRole('heading', { name: '김밥' })).toBeInTheDocument()
  })

  it('shows cards with description, amount and details on a narrow screen', async () => {
    mockViewport(true)
    mineHandler([{ ...base, edited: true }])
    renderPage(<TransactionsPage today={today} />, { groups })

    const list = await screen.findByRole('grid', { name: '거래 목록' })
    const card = within(list).getByRole('row', { name: /김밥/ })
    expect(card).toHaveTextContent('-₩ 4,000')
    expect(card).toHaveTextContent('10-05 12:30')
    expect(card).toHaveTextContent('식비 · 점심')
    expect(card).toHaveTextContent('수정됨')
    expect(within(list).queryByRole('columnheader')).not.toBeInTheDocument()
  })

  it.each([false, true])('pages 500 transactions and searches the whole month (narrow: %s)', async (narrow) => {
    mockViewport(narrow)
    mineHandler(Array.from({ length: 501 }, (_, index) => ({
      ...base, id: index + 1, description: `거래 ${index + 1}`, amount: -(index + 1),
    })))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })
    const list = await screen.findByRole('grid', { name: '거래 목록' })
    expect(within(list).getAllByRole('row')).toHaveLength(narrow ? 500 : 501)
    expect(screen.getByRole('status')).toHaveTextContent('1–500 / 501건')
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '다음 페이지' }))
    expect(within(list).getAllByRole('row')).toHaveLength(narrow ? 1 : 2)
    expect(within(list).getByText('거래 501')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()

    if (!narrow) {
      await user.click(within(list).getByRole('columnheader', { name: /금액/ }))
      expect(screen.getByRole('status')).toHaveTextContent('1–500 / 501건')
      expect(within(list).getAllByRole('row')[1]).toHaveTextContent('거래 501')
      await user.click(screen.getByRole('button', { name: '다음 페이지' }))
      expect(within(list).getByText('거래 1')).toBeInTheDocument()
    }
    fireEvent.change(screen.getByRole('searchbox', { name: '검색' }), { target: { value: '거래 501' } })
    expect(screen.getByRole('status')).toHaveTextContent('1–1 / 1건')
    expect(within(screen.getByRole('grid', { name: '거래 목록' })).getByText('거래 501')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  }, 20000)

  it('keeps long unbroken descriptions and categories readable in mobile cards', async () => {
    mockViewport(true)
    const description = 'PAYMENT_REFERENCE_'.repeat(25)
    const categoryMinor = 'CATEGORY_'.repeat(10)
    mineHandler([{ ...base, description, categoryMinor, amount: -123456789012 }])
    renderPage(<TransactionsPage today={today} />, { groups })

    const list = await screen.findByRole('grid', { name: '거래 목록' })
    const card = within(list).getByRole('row', { name: description })
    expect(within(card).getByText(description, { exact: true })).toBeVisible()
    expect(card).toHaveTextContent(categoryMinor)
    expect(card).toHaveTextContent('-₩ 123,456,789,012')
  })

  it('switches to group transactions with owner names and filters by member', async () => {
    mineHandler([])
    const calls: string[] = []
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json({
        groupId: 10, name: '우리집', myRole: 'ADMIN',
        members: [
          { userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-01T00:00:00+09:00' },
          { userId: 2, nickname: '멤버', role: 'MEMBER', shareEnabled: true, joinedAt: '2026-09-02T00:00:00+09:00' },
        ],
      })),
      http.get('*/api/groups/10/transactions', ({ request }) => {
        const url = new URL(request.url)
        calls.push(url.search)
        const memberId = url.searchParams.get('memberId')
        const all = [
          { ...base, id: 5, ownerId: 2, ownerNickname: '멤버', description: '택시', editable: true },
          { ...base, id: 6, ownerId: 1, ownerNickname: '나', description: '커피' },
        ]
        return HttpResponse.json(memberId ? all.filter((t) => String(t.ownerId) === memberId) : all)
      }),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('radio', { name: '그룹 거래' }))
    const list = screen.getByRole('region', { name: '거래 목록' })
    expect(await within(list).findByText('택시')).toBeInTheDocument()
    expect(within(list).getAllByRole('row')[1]).toHaveTextContent('멤버')

    await user.click(await screen.findByRole('button', { name: '전체 멤버' }))
    await user.click(await screen.findByRole('option', { name: '멤버' }))

    expect(await within(list).findByText('택시')).toBeInTheDocument()
    expect(within(list).queryByText('커피')).not.toBeInTheDocument()
    expect(calls.at(-1)).toContain('memberId=2')
  })

  it('changes month and filters by search text', async () => {
    const months: string[] = []
    server.use(http.get('*/api/me/transactions', ({ request }) => {
      const month = new URL(request.url).searchParams.get('month')!
      months.push(month)
      return HttpResponse.json(month === '2026-09'
        ? [{ ...base, id: 7, description: '스타벅스', categoryMajor: '카페' }, { ...base, id: 8, description: '버스', categoryMajor: '교통' }]
        : [])
    }))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    expect(await screen.findByText('이 달에 거래가 없습니다.')).toBeInTheDocument()
    // jsdom은 type="month"에 한 글자씩 입력하는 것을 지원하지 않아 change 이벤트로 바꾼다.
    fireEvent.change(screen.getByLabelText('월'), { target: { value: '2026-09' } })
    expect(await screen.findByText('스타벅스')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: '검색' }), '교통')

    expect(screen.queryByText('스타벅스')).not.toBeInTheDocument()
    expect(screen.getByText('버스')).toBeInTheDocument()
    expect(months).toContain('2026-09')
  })

  it('disables group scope when I have no group', async () => {
    mineHandler([])

    renderPage(<TransactionsPage today={today} />, { groups: [] })

    expect(await screen.findByRole('radio', { name: '그룹 거래' })).toBeDisabled()
  })

  it('falls back to my transactions when the selected group goes away', async () => {
    mineHandler([])
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json({ groupId: 10, name: '우리집', myRole: 'ADMIN', members: [] })),
      http.get('*/api/groups/10/transactions', () => HttpResponse.json([])),
    )
    const { user, client } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('radio', { name: '그룹 거래' }))
    expect(screen.getByRole('radio', { name: '그룹 거래' })).toBeChecked()

    server.use(http.get('*/api/groups', () => HttpResponse.json([])))
    await client.invalidateQueries({ queryKey: ['groups'], exact: true })

    await waitFor(() => expect(screen.getByRole('radio', { name: '그룹 거래' })).toBeDisabled())
    expect(screen.getByRole('radio', { name: '내 거래' })).toBeChecked()

    // 그룹이 다시 생겨도 범위는 '내 거래'에 머문다(예전 '그룹 거래' 선택이 되살아나지 않는다).
    server.use(http.get('*/api/groups', () => HttpResponse.json(groups)))
    await client.invalidateQueries({ queryKey: ['groups'], exact: true })
    await waitFor(() => expect(screen.getByRole('radio', { name: '그룹 거래' })).toBeEnabled())
    expect(screen.getByRole('radio', { name: '내 거래' })).toBeChecked()
  })

  it('offers retry when loading fails', async () => {
    let fail = true
    server.use(http.get('*/api/me/transactions', () => fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json([{ ...base }])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    expect(await screen.findByRole('alert')).toHaveTextContent('거래를 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('김밥')).toBeInTheDocument()
  })

  it('offers a separate retry when the member list fails to load', async () => {
    let fail = true
    mineHandler([])
    server.use(
      http.get('*/api/groups/10', () => fail
        ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
        : HttpResponse.json({
          groupId: 10, name: '우리집', myRole: 'ADMIN',
          members: [{ userId: 2, nickname: '멤버', role: 'MEMBER', shareEnabled: true, joinedAt: '2026-09-02T00:00:00+09:00' }],
        })),
      http.get('*/api/groups/10/transactions', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('radio', { name: '그룹 거래' }))
    expect(await screen.findByText('멤버 목록을 불러오지 못했습니다.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '멤버 목록 다시 시도' }))

    expect(await screen.findByRole('button', { name: '전체 멤버' })).toBeInTheDocument()
  })

  it('opens detail in a modal by default and remembers switching to the side panel', async () => {
    mineHandler([{ ...base }])
    server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    const modal = screen.getByRole('dialog', { name: '김밥' })
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: '오른쪽 패널로 보기' }))
    const detail = screen.getByRole('complementary', { name: '거래 상세' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('saladbowl.transactionDetailView')).toBe('sidebar')
    expect(within(detail).getByRole('heading', { name: '김밥' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '거래 추가' }))
    expect(within(detail).getByRole('heading', { name: '거래 추가 (수동)' })).toBeInTheDocument()
  })

  it('opens detail in a full-height sheet on a narrow screen', async () => {
    mockViewport(true)
    mineHandler([{ ...base }])
    server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    const sheet = screen.getByRole('dialog', { name: '김밥' })
    expect(within(sheet).getByRole('button', { name: '닫기' })).toBeInTheDocument()
    expect(within(sheet).getByLabelText('메모')).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: '오른쪽 패널로 보기' })).not.toBeInTheDocument()
  })

  it('opens the add form in a sheet on a narrow screen', async () => {
    mockViewport(true)
    mineHandler([])
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('button', { name: '거래 추가' }))
    expect(within(screen.getByRole('dialog', { name: '거래 추가 (수동)' })).getByLabelText('내용')).toBeInTheDocument()
  })

  it('moves focus to the list heading after deleting a transaction', async () => {
    let deleted = false
    server.use(
      http.get('*/api/me/transactions', () => HttpResponse.json(deleted ? [] : [{ ...base, source: 'MANUAL' }])),
      http.delete('*/api/transactions/:id', () => { deleted = true; return new HttpResponse(null, { status: 204 }) }),
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '김밥' })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('heading', { name: '거래 목록', level: 2 })).toHaveFocus())
  })

  it('keeps unsaved edits when switching between the modal and the side panel', async () => {
    mineHandler([{ ...base }])
    server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    await user.type(screen.getByLabelText('메모'), '모달에서 쓴 메모')
    await user.click(screen.getByRole('button', { name: '오른쪽 패널로 보기' }))
    const panel = screen.getByRole('complementary', { name: '거래 상세' })
    expect(within(panel).getByLabelText('메모')).toHaveValue('모달에서 쓴 메모')

    await user.type(within(panel).getByLabelText('메모'), ' 추가')
    await user.click(within(panel).getByRole('button', { name: '가운데 창으로 보기' }))
    expect(within(screen.getByRole('dialog', { name: '김밥' })).getByLabelText('메모')).toHaveValue('모달에서 쓴 메모 추가')
  })

  it('keeps the add form input across a switch and starts empty after closing', async () => {
    mineHandler([])
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await screen.findByText('이 달에 거래가 없습니다.')
    await user.click(screen.getByRole('button', { name: '거래 추가' }))
    await user.type(screen.getByLabelText('내용'), '편의점')
    await user.click(screen.getByRole('button', { name: '오른쪽 패널로 보기' }))
    const panel = screen.getByRole('complementary', { name: '거래 추가' })
    expect(within(panel).getByLabelText('내용')).toHaveValue('편의점')

    await user.click(within(panel).getByRole('button', { name: '닫기' }))
    await user.click(screen.getByRole('button', { name: '거래 추가' }))
    expect(within(screen.getByRole('complementary', { name: '거래 추가' })).getByLabelText('내용')).toHaveValue('')
  })

  it('disables the view switch while a save is in flight', async () => {
    let release = () => {}
    mineHandler([{ ...base }])
    server.use(
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
      http.patch('*/api/transactions/:id', async () => {
        await new Promise<void>((resolve) => { release = resolve })
        return HttpResponse.json({ ...base, memo: '메모' })
      }),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    await user.type(screen.getByLabelText('메모'), '메모')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '오른쪽 패널로 보기' })).toBeDisabled())
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: '오른쪽 패널로 보기' })).toBeEnabled())
  })

  it('returns focus to the row after closing a modal opened from the side panel switch', async () => {
    preferSidebar()
    mineHandler([{ ...base }])
    server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    await user.click(screen.getByRole('button', { name: '가운데 창으로 보기' }))
    expect(screen.getByRole('dialog', { name: '김밥' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('row', { name: /김밥/ })).toHaveFocus())
  })

  it('closes a group transaction panel when the scope falls back to my transactions', async () => {
    preferSidebar()
    mineHandler([{ ...base, id: 6, description: '커피' }])
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json({ groupId: 10, name: '우리집', myRole: 'ADMIN', members: [] })),
      http.get('*/api/groups/10/transactions', () => HttpResponse.json([{ ...base, id: 6, description: '커피' }])),
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
    )
    const { user, client } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('radio', { name: '그룹 거래' }))
    await user.click(await screen.findByRole('row', { name: /커피/ }))
    expect(screen.getByRole('complementary', { name: '거래 상세' })).toBeInTheDocument()

    server.use(http.get('*/api/groups', () => HttpResponse.json([])))
    await client.invalidateQueries({ queryKey: ['groups'], exact: true })

    await waitFor(() => expect(screen.getByRole('radio', { name: '내 거래' })).toBeChecked())
    expect(screen.queryByRole('complementary', { name: '거래 상세' })).not.toBeInTheDocument()
  })

  it('closes the panel when the selected transaction is no longer in the visible list', async () => {
    preferSidebar()
    server.use(
      http.get('*/api/me/transactions', ({ request }) => HttpResponse.json(
        new URL(request.url).searchParams.get('month') === '2026-10' ? [{ ...base }] : [])),
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    expect(screen.getByRole('complementary', { name: '거래 상세' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('월'), { target: { value: '2026-09' } })

    expect(await screen.findByText('이 달에 거래가 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: '거래 상세' })).not.toBeInTheDocument()
  })

  it('clears the selection when the month changes', async () => {
    preferSidebar()
    server.use(
      http.get('*/api/me/transactions', ({ request }) => HttpResponse.json(
        new URL(request.url).searchParams.get('month') === '2026-10' ? [{ ...base }] : [])),
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    expect(screen.getByRole('complementary', { name: '거래 상세' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이전 달' }))
    expect(await screen.findByText('이 달에 거래가 없습니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다음 달' }))

    expect(await screen.findByRole('row', { name: /김밥/ })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: '거래 상세' })).not.toBeInTheDocument()
  })

  it('keeps the sheet open while the month of a newly added transaction loads', async () => {
    mockViewport(true)
    const created: TransactionView = {
      ...base, id: 20, occurredAt: '2026-09-05T13:30:00', description: '9월 간식', source: 'MANUAL', amount: -3000,
    }
    let added = false
    let releaseSeptember: () => void = () => {}
    server.use(
      http.get('*/api/me/transactions', async ({ request }) => {
        if (added && new URL(request.url).searchParams.get('month') === '2026-09') {
          // 새 달 목록을 붙잡아 두고, 그 사이 시트가 닫히지 않는지 본다.
          await new Promise<void>((resolve) => { releaseSeptember = resolve })
          return HttpResponse.json([created])
        }
        return HttpResponse.json([])
      }),
      http.post('*/api/me/transactions', () => {
        added = true
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await screen.findByText('이 달에 거래가 없습니다.')
    await user.click(screen.getByRole('button', { name: '거래 추가' }))
    await typeDateTime(user, '202609051330')
    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')
    await user.type(screen.getByLabelText('내용'), '9월 간식')
    await user.type(screen.getByLabelText('금액 (원)'), '3000')
    const sheet = screen.getByRole('dialog', { name: '거래 추가 (수동)' })
    await user.click(within(sheet).getByRole('button', { name: '추가' }))

    try {
      await waitFor(() => expect(screen.getByLabelText('월')).toHaveValue('2026-09'))
      expect(sheet.parentElement).not.toHaveAttribute('data-exiting', 'true')
      expect(screen.getByRole('dialog')).toBe(sheet.closest('[role="dialog"]'))
    } finally {
      releaseSeptember()
    }
    expect(await screen.findByRole('dialog', { name: '9월 간식' })).toBeInTheDocument()
  })

  it('keeps the sheet open when the month of a newly added transaction is cached', async () => {
    mockViewport(true)
    const created: TransactionView = {
      ...base, id: 20, occurredAt: '2026-09-05T13:30:00', description: '9월 간식', source: 'MANUAL', amount: -3000,
    }
    let added = false
    let releaseSeptember: () => void = () => {}
    server.use(
      http.get('*/api/me/transactions', async ({ request }) => {
        if (added && new URL(request.url).searchParams.get('month') === '2026-09') {
          await new Promise<void>((resolve) => { releaseSeptember = resolve })
          return HttpResponse.json([created])
        }
        return HttpResponse.json([])
      }),
      http.post('*/api/me/transactions', () => {
        added = true
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await screen.findByText('이 달에 거래가 없습니다.')
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await waitFor(() => expect(screen.getByLabelText('월')).toHaveValue('2026-09'))
    await screen.findByText('이 달에 거래가 없습니다.')
    await user.click(screen.getByRole('button', { name: '다음 달' }))
    await waitFor(() => expect(screen.getByLabelText('월')).toHaveValue('2026-10'))
    await user.click(screen.getByRole('button', { name: '거래 추가' }))
    await typeDateTime(user, '202609051330')
    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')
    await user.type(screen.getByLabelText('내용'), '9월 간식')
    await user.type(screen.getByLabelText('금액 (원)'), '3000')
    const sheet = screen.getByRole('dialog', { name: '거래 추가 (수동)' })
    await user.click(within(sheet).getByRole('button', { name: '추가' }))

    try {
      await waitFor(() => expect(screen.getByLabelText('월')).toHaveValue('2026-09'))
      expect(sheet.parentElement).not.toHaveAttribute('data-exiting', 'true')
      expect(within(sheet).getByRole('button', { name: '추가' })).toBeDisabled()
    } finally {
      releaseSeptember()
    }
    expect(await screen.findByRole('dialog', { name: '9월 간식' })).toBeInTheDocument()
  })

  it('moves focus to the panel heading and to the add form heading, not on re-render', async () => {
    preferSidebar()
    mineHandler([{ ...base }])
    server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await user.click(await screen.findByRole('row', { name: /김밥/ }))
    const heading = screen.getByRole('heading', { name: '김밥' })
    expect(heading).toHaveFocus()

    // 다른 곳으로 포커스를 옮긴 뒤 저장 없이 다시 렌더돼도 포커스를 빼앗지 않는다.
    await user.type(screen.getByLabelText('메모'), 'x')
    expect(screen.getByLabelText('메모')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: '거래 추가' }))
    expect(screen.getByRole('heading', { name: '거래 추가 (수동)' })).toHaveFocus()
    expect(screen.getByRole('complementary', { name: '거래 추가' })).toBeInTheDocument()
  })

  it('says there are no search results when filtering empties a non-empty month', async () => {
    mineHandler([{ ...base }])
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await screen.findByText('김밥')
    await user.type(screen.getByRole('searchbox', { name: '검색' }), '없는말')

    expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument()
    expect(screen.queryByText('이 달에 거래가 없습니다.')).not.toBeInTheDocument()
  })

  it('jumps to the month of a manually added transaction and opens its panel', async () => {
    preferSidebar()
    const created: TransactionView = {
      ...base, id: 20, occurredAt: '2026-09-05T13:30:00', description: '9월 간식', source: 'MANUAL', amount: -3000,
    }
    let added = false
    server.use(
      http.get('*/api/me/transactions', ({ request }) => HttpResponse.json(
        added && new URL(request.url).searchParams.get('month') === '2026-09' ? [created] : [])),
      http.post('*/api/me/transactions', () => {
        added = true
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await screen.findByText('이 달에 거래가 없습니다.')
    await user.click(screen.getByRole('button', { name: '거래 추가' }))
    await typeDateTime(user, '202609051330')
    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')
    await user.type(screen.getByLabelText('내용'), '9월 간식')
    await user.type(screen.getByLabelText('금액 (원)'), '3000')
    await user.click(screen.getByRole('button', { name: '추가' }))

    const detail = await screen.findByRole('complementary', { name: '거래 상세' })
    expect(within(detail).getByRole('heading', { name: '9월 간식' })).toBeInTheDocument()
    expect(screen.getByLabelText('월')).toHaveValue('2026-09')
  })

  it('moves to the previous month with the month buttons', async () => {
    const months: string[] = []
    server.use(http.get('*/api/me/transactions', ({ request }) => {
      months.push(new URL(request.url).searchParams.get('month')!)
      return HttpResponse.json([])
    }))
    const { user } = renderPage(<TransactionsPage today={today} />, { groups })

    await screen.findByText('이 달에 거래가 없습니다.')
    await user.click(screen.getByRole('button', { name: '이전 달' }))

    await waitFor(() => expect(months).toContain('2026-09'))
    expect(screen.getByLabelText('월')).toHaveValue('2026-09')
  })
})
