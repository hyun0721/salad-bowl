import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountMaskProvider, useAmountMask, useAmountFormatter } from './AmountMask'
import TotalsCards from './TotalsCards'
import DistributionBars from '../dashboard/DistributionBars'
import MemberTotalsDialog from '../dashboard/MemberTotalsDialog'
import { TransactionCard, transactionColumns } from '../transactions/transactionRows'
import type { TransactionView } from '../transactions/transactionsApi'

const key = 'saladbowl.amountMask'
beforeEach(() => localStorage.clear())
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
function Probe() {
  const { hidden, setHidden } = useAmountMask()
  const expense = useAmountFormatter('EXPENSE', true)
  const income = useAmountFormatter('INCOME', true)
  const transfer = useAmountFormatter('TRANSFER', true)
  return <><button onClick={() => setHidden('EXPENSE', !hidden.EXPENSE)}>toggle</button>
    <p>{expense(-12345)} / {income(67890)} / {transfer(0)}</p></>
}
it('defaults to visible without a provider', () => {
  render(<Probe />)
  expect(screen.getByText('-₩ 12,345 / +₩ 67,890 / ₩ 0')).toBeInTheDocument()
})
it('restores synchronously, masks independently and saves toggles', async () => {
  localStorage.setItem(key, JSON.stringify({ EXPENSE: true, INCOME: 'true', TRANSFER: true }))
  render(<AmountMaskProvider><Probe /></AmountMaskProvider>)
  expect(screen.getByText('-₩ ••••• / +₩ 67,890 / ₩ •••••')).toBeInTheDocument()
  await userEvent.click(screen.getByText('toggle'))
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ INCOME: false, EXPENSE: false, TRANSFER: true })
  expect(screen.getByText('-₩ 12,345 / +₩ 67,890 / ₩ •••••')).toBeInTheDocument()
})
it.each(['{broken', 'null', '42', '[]'])('uses defaults for invalid storage: %s', (raw) => {
  localStorage.setItem(key, raw)
  render(<AmountMaskProvider><Probe /></AmountMaskProvider>)
  expect(screen.getByText('-₩ 12,345 / +₩ 67,890 / ₩ 0')).toBeInTheDocument()
})
it('works in memory when reads and writes throw', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
  render(<AmountMaskProvider><Probe /></AmountMaskProvider>)
  await userEvent.click(screen.getByText('toggle'))
  expect(screen.getByText('-₩ ••••• / +₩ 67,890 / ₩ 0')).toBeInTheDocument()
})
it('masks totals and distribution text, titles and accessible names', () => {
  localStorage.setItem(key, JSON.stringify({ EXPENSE: true }))
  const { container } = render(<AmountMaskProvider>
    <TotalsCards income={67890} expense={12345} onSelect={() => {}} />
    <DistributionBars rows={[{ id: 'a', label: '식비', value: -12345, memberExpenses: [{ userId: 1, expense: -12345 }] }]}
      positiveTotal={100000} members={[{ userId: 1, nickname: '가상' }]} onSelect={() => {}} />
  </AmountMaskProvider>)
  expect(screen.getByRole('button', { name: '수입 ₩ 67,890' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '지출 ₩ •••••' })).toBeInTheDocument()
  expect(container.innerHTML).not.toContain('12,345')
  expect(screen.getByTitle('가상 -₩ ••••• · 환불 초과')).toBeInTheDocument()
  expect(screen.getByRole('img')).toHaveAttribute('aria-label', '식비 0.0%, 가상 -₩ ••••• · 환불 초과')
})
it.each(['income', 'expense'] as const)('masks member dialog by shown kind: %s', (kind) => {
  localStorage.setItem(key, JSON.stringify({ EXPENSE: true }))
  render(<AmountMaskProvider><MemberTotalsDialog kind={kind} onClose={() => {}} summary={{
    month: '2026-01', income: 67890, expense: 12345, byCategory: [],
    byMember: [{ userId: 1, nickname: '가상', income: 67890, expense: 12345 }],
  }} /></AmountMaskProvider>)
  expect(screen.getByRole('dialog')).toHaveTextContent(kind === 'expense' ? '₩ •••••' : '₩ 67,890')
  expect(screen.getByRole('dialog').innerHTML).not.toContain('12,345')
})
it('uses saved transaction type for both table cells and cards, retaining signs', () => {
  localStorage.setItem(key, JSON.stringify({ EXPENSE: true, TRANSFER: true }))
  const base: TransactionView = { id: 1, ownerId: 1, ownerNickname: '가상', occurredAt: '2026-01-01T12:00:00', type: 'EXPENSE', categoryMajor: '식비', categoryMinor: '', description: '테스트', amount: 12345, currency: 'KRW', paymentMethod: '', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: false }
  render(<AmountMaskProvider>{(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((type) => {
    const tx = { ...base, type }
    return <section key={type} aria-label={type}><TransactionCard tx={tx} showOwner={false} />{transactionColumns(false).find((c) => c.id === 'amount')!.render(tx)}</section>
  })}</AmountMaskProvider>)
  for (const type of ['EXPENSE', 'TRANSFER']) {
    expect(screen.getByRole('region', { name: type }).textContent).toContain('+₩ •••••')
    expect(screen.getByRole('region', { name: type }).innerHTML).not.toContain('12,345')
  }
  expect(screen.getByRole('region', { name: 'INCOME' })).toHaveTextContent('+₩ 12,345')
})
