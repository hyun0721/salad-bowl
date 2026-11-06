import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import { mockViewport } from '../test/mockViewport'
import { AmountMaskProvider } from '../common/AmountMask'
import TransactionsPage from './TransactionsPage'
import type { TransactionView } from './transactionsApi'

const base: TransactionView = {
  id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-05T12:30:00', type: 'EXPENSE',
  categoryMajor: '식비', categoryMinor: '점심', description: '김밥', amount: -4000, currency: 'KRW',
  paymentMethod: '현금', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
}
let items: TransactionView[]
beforeEach(() => {
  localStorage.clear()
  items = [base]
  server.use(http.get('*/api/me/tags', () => HttpResponse.json([{ tag: '여행', count: 3 }, { tag: '제주', count: 2 }])),
    http.get('*/api/me/categories', () => HttpResponse.json([{ type: 'EXPENSE', major: '생활', count: 1, minors: [{ minor: '간식', count: 1 }] }, { type: 'EXPENSE', major: '식비', count: 1, minors: [] }])),
    http.get('*/api/me/transactions', () => HttpResponse.json(items)))
})
async function start() {
  const result = renderPage(<TransactionsPage today={new Date(2026, 10, 19)} />)
  await screen.findByText('김밥')
  await result.user.click(screen.getByRole('button', { name: '선택' }))
  return result
}
it.each([false, true])('selects rows without opening details, narrow=%s', async (narrow) => {
  mockViewport(narrow)
  const { user } = await start()
  await user.click(screen.getByText('김밥'))
  expect(screen.getByText(/1건 선택/)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('row', { name: /김밥/ })).toHaveAttribute('aria-selected', 'true')
  await user.click(screen.getByRole('checkbox', { name: '선택 김밥' }))
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
  act(() => screen.getByRole('row', { name: /김밥/ }).focus())
  await user.keyboard(' ')
  expect(screen.getByText(/1건 선택/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '거래 추가' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '취소' }))
  expect(screen.getByRole('button', { name: '선택' })).toHaveFocus()
})
it('selects all search results beyond 500 and clears on month change', async () => {
  items = Array.from({ length: 502 }, (_, i) => ({ ...base, id: i + 1, description: i === 501 ? '커피' : '김밥' }))
  // 500행을 다시 그리는 클릭마다 user-event가 오래 걸려 CI에서 시간을 넘기므로 fireEvent를 쓴다.
  renderPage(<TransactionsPage today={new Date(2026, 10, 19)} />)
  await screen.findAllByText('김밥')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '김밥' } })
  fireEvent.click(screen.getByRole('button', { name: '선택' }))
  fireEvent.click(screen.getByRole('button', { name: '전체 선택' }))
  expect(screen.getByText(/501건 선택/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  expect(screen.getByText(/501건 선택/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
}, 20000)
it.each([false, true])('excludes uneditable rows, narrow=%s', async (narrow) => {
  mockViewport(narrow)
  items = [base, { ...base, id: 2, description: '읽기 전용', editable: false }]
  const { user } = await start()
  expect(screen.getByRole('checkbox', { name: '선택 읽기 전용' })).toBeDisabled()
  await user.click(screen.getByText('읽기 전용'))
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  expect(screen.getByText(/1건 선택/)).toBeInTheDocument()
})
it('sends only changed fields and exits with a toast on success', async () => {
  let body: unknown
  server.use(http.patch('*/api/transactions/bulk', async ({ request }) => {
    body = await request.json(); return HttpResponse.json({ updated: 1 })
  }))
  const { user } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '편집' }))
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  await choose(user, '대분류', '생활')
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  await choose(user, '소분류', '소분류 없음')
  await user.click(screen.getByRole('button', { name: '적용' }))
  expect(await screen.findByText('1건을 수정했습니다.')).toBeInTheDocument()
  expect(body).toEqual({ ids: [1], categoryMajor: '생활', categoryMinor: '' })
  expect(screen.queryByText(/1건 선택/)).not.toBeInTheDocument()
})
it('keeps selection and shows an alert on failure', async () => {
  server.use(http.patch('*/api/transactions/bulk', () => HttpResponse.json({ message: '수정 실패' }, { status: 400 })))
  const { user } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '편집' }))
  await choose(user, '대분류', '생활')
  await choose(user, '소분류', '간식')
  await user.click(screen.getByRole('button', { name: '적용' }))
  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.getByText(/1건 선택/)).toBeInTheDocument())
})
it.each([['EXPENSE', 0, false], ['EXPENSE', -1, false], ['EXPENSE', 1, true], ['INCOME', -1, true]] as const)('filters income for %s %s', async (type, amount, allowed) => {
  items = [{ ...base, type, amount }, { ...base, id: 2, description: '타인', type: 'INCOME', ownerId: 2 }]
  const { user } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '편집' }))
  expect(screen.queryByText('그룹에서 숨기기')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /타입/ }))
  expect(!!screen.queryByRole('option', { name: '수입' })).toBe(allowed)
})

it('blocks more than 1000 selected transactions', async () => {
  mockViewport(true)
  items = Array.from({ length: 1001 }, (_, i) => ({ ...base, id: i + 1, description: i === 0 ? '김밥' : `거래 ${i}` }))
  renderPage(<TransactionsPage today={new Date(2026, 10, 19)} />)
  await screen.findByText('김밥')
  fireEvent.click(screen.getByRole('button', { name: '선택' }))
  fireEvent.click(screen.getByRole('button', { name: '전체 선택' }))
  fireEvent.click(screen.getByRole('button', { name: '편집' }))
  expect(screen.getByRole('alert')).toHaveTextContent('한 번에 최대 1,000건까지 수정할 수 있습니다.')
  fireEvent.change(screen.getByRole('textbox', { name: '태그 추가' }), { target: { value: '#여행' } })
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
}, 20000)
it('preserves selection on sorting and removes missing or no longer editable ids after refresh', async () => {
  items = [base, { ...base, id: 2, description: '커피' }, { ...base, id: 3, description: '간식' }]
  const { user, client } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: /정렬,/ }))
  await user.click(screen.getByRole('radio', { name: '금액 큰 순' }))
  await user.click(screen.getByRole('button', { name: '적용' }))
  expect(screen.getByText(/3건 선택/)).toBeInTheDocument()
  await waitFor(() => expect(client.isFetching({ queryKey: ['transactions'] })).toBe(0))
  items = [base, { ...items[1], editable: false }]
  await act(async () => { await client.invalidateQueries({ queryKey: ['transactions'] }) })
  await waitFor(() => expect(screen.getByText(/1건 선택/)).toBeInTheDocument())
  await user.type(screen.getByRole('searchbox'), '김')
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '필터' }))
  await user.click(screen.getByRole('button', { name: '지출' }))
  await user.click(screen.getByRole('button', { name: '적용' }))
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
})
it('sends type, both categories and hidden=false and prevents closing during save', async () => {
  let body: unknown
  let release = () => {}
  server.use(http.patch('*/api/transactions/bulk', async ({ request }) => {
    body = await request.json()
    await new Promise<void>((resolve) => { release = resolve })
    return HttpResponse.json({ updated: 1 })
  }))
  const { user } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '편집' }))
  expect(screen.getByRole('button', { name: /소분류/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  await choose(user, '대분류', '생활')
  await choose(user, '소분류', '간식')
  await user.click(screen.getByRole('button', { name: /타입/ }))
  await user.click(screen.getByRole('option', { name: '이체' }))
  await user.click(screen.getByRole('button', { name: /그룹에서 숨기기/ }))
  await user.click(screen.getByRole('option', { name: '숨기기 해제' }))
  await user.click(screen.getByRole('button', { name: '적용' }))
  try {
    await waitFor(() => expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled())
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(body).toEqual({ ids: [1], type: 'TRANSFER', categoryMajor: '생활', categoryMinor: '간식', hidden: false })
  } finally { release() }
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: '선택' })).toHaveFocus())
})
it.each([false, true])('shows signed totals and respects amount masking, masked=%s', async (masked) => {
  localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: masked }))
  items = [base, { ...base, id: 2, type: 'INCOME', amount: 1000, description: '환급' }]
  const { user } = renderPage(<AmountMaskProvider><TransactionsPage today={new Date(2026, 10, 19)} /></AmountMaskProvider>)
  await screen.findByText('김밥')
  await user.click(screen.getByRole('button', { name: '선택' }))
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  expect(screen.getByText(/2건 선택/)).toHaveTextContent(masked ? '합계 ₩ •••••' : '합계 -₩ 3,000')
})
it('closes an open sidebar when selection starts', async () => {
  localStorage.setItem('saladbowl.transactionDetailView', 'sidebar')
  server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json([])))
  const { user } = renderPage(<TransactionsPage today={new Date(2026, 10, 19)} />)
  await user.click(await screen.findByText('김밥'))
  expect(screen.getByRole('complementary')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '선택' }))
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '선택' })).toHaveFocus()
})

it('clears selection on scope and member changes even when cached lists share ids', async () => {
  const groups = [{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }]
  server.use(
    http.get('*/api/groups/10', () => HttpResponse.json({ groupId: 10, name: '우리집', myRole: 'ADMIN', members: [{ userId: 1, nickname: '나' }] })),
    http.get('*/api/groups/10/categories', () => HttpResponse.json([])),
    http.get('*/api/groups/10/transactions', () => HttpResponse.json([base, { ...base, id: 2, description: '커피', ownerId: 2 }])),
  )
  const { user } = renderPage(<TransactionsPage today={new Date(2026, 10, 19)} />, { groups })
  await screen.findByText('김밥')
  await user.click(screen.getByRole('button', { name: '선택' }))
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('radio', { name: '그룹 거래' }))
  await screen.findByText('커피')
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: /멤버/ }))
  await user.click(screen.getByRole('option', { name: '나' }))
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
  await screen.findByText('커피')
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  expect(screen.getByText(/2건 선택/)).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: '내 거래' }))
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
})

async function choose(user: ReturnType<typeof renderPage>['user'], label: string, option: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(label) }))
  await user.click(screen.getByRole('option', { name: option }))
}
it.each([false, true])('searches memos and tag prefixes; a tag click clears the selection, narrow=%s', async (narrow) => {
  mockViewport(narrow)
  items = [{ ...base, memo: '예식장 #결혼식' }, { ...base, id: 2, description: '커피', memo: '다른 메모' }]
  const { user } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '#결혼식' }))
  expect(screen.getByRole('searchbox')).toHaveValue('#결혼식')
  expect(screen.getByText(/0건 선택/)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), '#결혼')
  expect(screen.getByText('김밥')).toBeInTheDocument()
  expect(screen.queryByText('커피')).not.toBeInTheDocument()
  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), '예식장')
  expect(screen.getByText('김밥')).toBeInTheDocument()
})
async function openBulk() {
  const result = await start()
  await result.user.click(screen.getByRole('button', { name: '전체 선택' }))
  await result.user.click(screen.getByRole('button', { name: '편집' }))
  return result
}
it('resets minor when major changes and requires a new selection', async () => {
  const { user } = await openBulk()
  expect(screen.getByRole('button', { name: /소분류/ })).toBeDisabled()
  await choose(user, '대분류', '생활')
  await choose(user, '소분류', '간식')
  expect(screen.getByRole('button', { name: '적용' })).toBeEnabled()
  await choose(user, '대분류', '식비')
  expect(screen.getByRole('button', { name: /소분류/ })).toHaveTextContent('선택')
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
})
it('parses tags, blocks invalid tokens, suggests tags and sends a tag-only patch', async () => {
  let body: unknown
  server.use(http.patch('*/api/transactions/bulk', async ({ request }) => {
    body = await request.json(); return HttpResponse.json({ updated: 1 })
  }))
  const { user } = await openBulk()
  const input = screen.getByRole('textbox', { name: '태그 추가' })
  await user.type(input, '#결혼준비 bad-tag')
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  expect(screen.getByText(/태그는 글자/)).toBeInTheDocument()
  await user.clear(input)
  await user.type(input, '#결혼준비 결혼준비')
  await user.click(await screen.findByRole('button', { name: '#여행' }))
  expect(input).toHaveValue('#결혼준비 결혼준비 #여행')
  expect(screen.queryByRole('button', { name: '#여행' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '적용' }))
  expect(await screen.findByText('1건을 수정했습니다.')).toBeInTheDocument()
  expect(body).toEqual({ ids: [1], addTags: ['결혼준비', '여행'] })
})
it('offers only selected memo tags with transaction counts and removes tags', async () => {
  items = [{ ...base, memo: '#여행 #여행 #제주' }, { ...base, id: 2, description: '커피', memo: '#여행' },
    { ...base, id: 3, description: '읽기 전용', memo: '#제외', editable: false }]
  let body: unknown
  server.use(http.patch('*/api/transactions/bulk', async ({ request }) => {
    body = await request.json(); return HttpResponse.json({ updated: 2 })
  }))
  const { user } = await openBulk()
  expect(screen.queryByRole('checkbox', { name: /제외/ })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: '#제주 · 1건' })).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: '#여행 · 2건' }))
  await user.click(screen.getByRole('button', { name: '적용' }))
  expect(await screen.findByText('2건을 수정했습니다.')).toBeInTheDocument()
  expect(body).toEqual({ ids: [1, 2], removeTags: ['여행'] })
})
it('blocks overflowing memos with a count and checks removal before addition', async () => {
  items = [{ ...base, memo: 'a'.repeat(996) + ' #제주' }, { ...base, id: 2, description: '커피', memo: 'a'.repeat(1000) }]
  const { user } = await openBulk()
  await user.type(screen.getByRole('textbox', { name: '태그 추가' }), '#여행')
  expect(screen.getByText('2건은 메모가 1,000자를 넘어 태그를 추가할 수 없습니다.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: '#제주 · 1건' }))
  expect(screen.getByText('1건은 메모가 1,000자를 넘어 태그를 추가할 수 없습니다.')).toBeInTheDocument()
})

it('limits suggestions to eight and blocks more than twenty tags', async () => {
  server.use(http.get('*/api/me/tags', () => HttpResponse.json(Array.from({ length: 10 }, (_, i) => ({ tag: '태그' + i, count: 10 - i })))))
  const { user } = await openBulk()
  expect(within(screen.getByLabelText('추천 태그')).getAllByRole('button')).toHaveLength(8)
  fireEvent.change(screen.getByRole('textbox', { name: '태그 추가' }), {
    target: { value: Array.from({ length: 21 }, (_, i) => '#태그' + i).join(' ') },
  })
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('각각 최대 20개')
  await user.clear(screen.getByRole('textbox', { name: '태그 추가' }))
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
})

it.each([false, true])('tag buttons support keyboard search without opening a transaction, narrow=%s', async (narrow) => {
  mockViewport(narrow)
  items = [{ ...base, memo: '계약금 #결혼식' }]
  const { user } = renderPage(<TransactionsPage today={new Date(2026, 10, 19)} />)
  const chip = await screen.findByRole('button', { name: '#결혼식' })
  act(() => chip.focus())
  await user.keyboard('{Enter}')
  expect(screen.getByRole('searchbox')).toHaveValue('#결혼식')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

