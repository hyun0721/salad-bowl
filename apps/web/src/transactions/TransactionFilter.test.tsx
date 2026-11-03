import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import TransactionFilter from './TransactionFilter'
import { DEFAULT_FILTER } from './transactionQuery'
import type { CategoryOption } from './categoriesApi'
import { mockViewport } from '../test/mockViewport'

afterEach(() => vi.unstubAllGlobals())
const categories: CategoryOption[] = [
  { type: 'EXPENSE', major: '식비', count: 3, minors: [{ minor: '외식', count: 2 }, { minor: '', count: 1 }] },
  { type: 'EXPENSE', major: '교통', count: 1, minors: [{ minor: '버스', count: 1 }] },
  { type: 'EXPENSE', major: '문화', count: 1, minors: [{ minor: '책', count: 1 }] },
  { type: 'INCOME', major: '식비', count: 1, minors: [{ minor: '환급', count: 1 }] },
]
it.each([false, true])('edits two steps, partial majors, summaries and compact picks (mobile=%s)', async (mobile) => {
  mockViewport(mobile)
  const onApply = vi.fn()
  render(<TransactionFilter categories={categories} value={DEFAULT_FILTER} onApply={onApply} />)
  await userEvent.click(screen.getByRole('button', { name: '필터' }))
  await userEvent.click(screen.getByRole('button', { name: '지출 카테고리 전체' }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: '식비 펼치기' }))
  await userEvent.click(screen.getByRole('checkbox', { name: '미분류' }))
  expect(screen.getByRole('checkbox', { name: '식비' })).toBePartiallyChecked()
  expect(screen.getByText('1/2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByRole('button', { name: '지출 카테고리 식비 외 2' })).toBeInTheDocument()
  expect(onApply).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_FILTER, picks: { EXPENSE: ['식비\t외식', '교통', '문화'] } })
})
it('validates empty types and categories, then resets to default', async () => {
  const onApply = vi.fn()
  render(<TransactionFilter categories={categories} value={DEFAULT_FILTER} onApply={onApply} />)
  await userEvent.click(screen.getByRole('button', { name: '필터' }))
  for (const name of ['지출', '수입', '이체']) await userEvent.click(screen.getByRole('button', { name }))
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(screen.getByRole('alert')).toHaveTextContent('거래 종류')
  expect(onApply).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '지출' }))
  expect(screen.getByRole('button', { name: '지출' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: '지출 카테고리 전체' }))
  await userEvent.click(screen.getByRole('checkbox', { name: '모든 카테고리' }))
  await userEvent.click(screen.getByRole('button', { name: '확인' }))
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(screen.getByRole('alert')).toHaveTextContent('카테고리')
  expect(onApply).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '초기화' }))
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(onApply).toHaveBeenCalledWith(DEFAULT_FILTER)
})
it.each([false, true])('discards unapplied drafts and indicates applied filters (mobile=%s)', async (mobile) => {
  mockViewport(mobile)
  render(<TransactionFilter categories={categories} value={{ types: ['EXPENSE'], picks: {} }} onApply={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: '필터, 적용됨' }))
  await userEvent.click(screen.getByRole('button', { name: '지출' }))
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByRole('button', { name: '필터, 적용됨' }))
  expect(screen.getByRole('button', { name: '지출' })).toHaveAttribute('aria-pressed', 'true')
})
