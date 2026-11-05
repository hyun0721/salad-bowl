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
  server.use(http.get('*/api/me/categories', () => HttpResponse.json([])),
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
  await user.click(screen.getByRole('checkbox', { name: '김밥 선택' }))
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
  expect(screen.getByRole('checkbox', { name: '읽기 전용 선택' })).toBeDisabled()
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
  await user.type(screen.getByRole('combobox', { name: '대분류' }), '생활')
  await user.click(screen.getByRole('button', { name: '적용' }))
  expect(await screen.findByText('1건을 수정했습니다.')).toBeInTheDocument()
  expect(body).toEqual({ ids: [1], categoryMajor: '생활' })
  expect(screen.queryByText(/1건 선택/)).not.toBeInTheDocument()
})
it('keeps selection and shows an alert on failure', async () => {
  server.use(http.patch('*/api/transactions/bulk', () => HttpResponse.json({ message: '수정 실패' }, { status: 400 })))
  const { user } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '편집' }))
  await user.type(screen.getByRole('combobox', { name: '소분류' }), '간식')
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
  const { user } = await start()
  await user.click(screen.getByRole('button', { name: '전체 선택' }))
  await user.click(screen.getByRole('button', { name: '편집' }))
  expect(screen.getByRole('alert')).toHaveTextContent('한 번에 최대 1,000건까지 수정할 수 있습니다.')
  await user.type(screen.getByRole('combobox', { name: '대분류' }), '생활')
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
it('sends type, minor and hidden=false while omitting blank categories and prevents closing during save', async () => {
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
  await user.type(screen.getByRole('combobox', { name: '대분류' }), '  ')
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
  await user.type(screen.getByRole('combobox', { name: '소분류' }), '간식')
  await user.click(screen.getByRole('button', { name: /타입/ }))
  await user.click(screen.getByRole('option', { name: '이체' }))
  await user.click(screen.getByRole('button', { name: /그룹에서 숨기기/ }))
  await user.click(screen.getByRole('option', { name: '숨기기 해제' }))
  await user.click(screen.getByRole('button', { name: '적용' }))
  try {
    await waitFor(() => expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled())
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(body).toEqual({ ids: [1], type: 'TRANSFER', categoryMinor: '간식', hidden: false })
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
