import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import TransactionsPage from './TransactionsPage'
import type { TransactionView } from './transactionsApi'

const today = new Date(2026, 9, 19) // 2026-10-19: 기본 월은 2026-10

const base: TransactionView = {
  id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-05T12:30:00', type: 'EXPENSE',
  categoryMajor: '식비', categoryMinor: '점심', description: '김밥', amount: -4000, currency: 'KRW',
  paymentMethod: '현금', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
}
const groups = [{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }]

function mineHandler(items: TransactionView[]) {
  server.use(http.get('*/api/me/transactions', () => HttpResponse.json(items)))
}

describe('TransactionsPage', () => {
  it('lists my transactions for the current month with signed amounts and badges', async () => {
    mineHandler([
      { ...base, id: 2, description: '국밥', amount: -9000, edited: true },
      { ...base, id: 1, hidden: true },
      { ...base, id: 3, type: 'INCOME', categoryMajor: '급여', description: '월급', amount: 3000000 },
    ])

    renderPage(<TransactionsPage today={today} />, { groups })

    const list = await screen.findByRole('region', { name: '거래 목록' })
    const rows = await within(list).findAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('10-05 12:30')
    expect(rows[0]).toHaveTextContent('-₩ 9,000')
    expect(rows[0]).toHaveTextContent('수정됨')
    expect(rows[1]).toHaveTextContent('숨김')
    expect(rows[2]).toHaveTextContent('+₩ 3,000,000')
    expect(document.title).toBe('거래 목록 · Salad Bowl')
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

    await user.click(await screen.findByRole('button', { name: '그룹 거래' }))
    const list = screen.getByRole('region', { name: '거래 목록' })
    expect(await within(list).findByText('택시')).toBeInTheDocument()
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('멤버')

    await user.selectOptions(await screen.findByRole('combobox', { name: '멤버' }), '2')

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

    await user.type(screen.getByLabelText('검색'), '교통')

    expect(screen.queryByText('스타벅스')).not.toBeInTheDocument()
    expect(screen.getByText('버스')).toBeInTheDocument()
    expect(months).toContain('2026-09')
  })

  it('disables group scope when I have no group', async () => {
    mineHandler([])

    renderPage(<TransactionsPage today={today} />, { groups: [] })

    expect(await screen.findByRole('button', { name: '그룹 거래' })).toBeDisabled()
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

    await user.click(await screen.findByRole('button', { name: '그룹 거래' }))
    expect(await screen.findByText('멤버 목록을 불러오지 못했습니다.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '멤버 목록 다시 시도' }))

    expect(await screen.findByRole('combobox', { name: '멤버' })).toBeInTheDocument()
  })
})
