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
it.each([false, true])('edits two steps, partial majors, summaries and compact excludes (mobile=%s)', async (mobile) => {
  mockViewport(mobile)
  const onApply = vi.fn()
  render(<TransactionFilter categories={categories} value={DEFAULT_FILTER} onApply={onApply} />)
  await userEvent.click(screen.getByRole('button', { name: '필터' }))
  await userEvent.click(screen.getByRole('button', { name: '지출 카테고리 전체' }))
  expect(screen.getByRole('button', { name: '지출 카테고리' })).toHaveFocus()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: '식비 펼치기' }))
  await userEvent.click(screen.getByRole('checkbox', { name: '미분류' }))
  expect(screen.getByRole('checkbox', { name: '식비' })).toBePartiallyChecked()
  expect(screen.getByText('1/2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByRole('button', { name: '지출 카테고리 3/3개 · 일부' })).toHaveFocus()
  expect(onApply).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_FILTER, excludes: { EXPENSE: ['식비\t'] } })
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
  expect(screen.getByRole('button', { name: '지출 카테고리 선택 안 함' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(screen.getByRole('alert')).toHaveTextContent('카테고리')
  expect(onApply).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '초기화' }))
  expect(onApply).toHaveBeenCalledWith(DEFAULT_FILTER)
  expect(screen.getByRole('button', { name: '이체' })).toHaveAttribute('aria-pressed', 'true')
})
it.each([false, true])('discards unapplied drafts and indicates applied filters (mobile=%s)', async (mobile) => {
  mockViewport(mobile)
  render(<TransactionFilter categories={categories} value={{ types: ['EXPENSE'], excludes: {} }} onApply={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: '필터, 적용됨' }))
  await userEvent.click(screen.getByRole('button', { name: '지출' }))
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByRole('button', { name: '필터, 적용됨' }))
  expect(screen.getByRole('button', { name: '지출' })).toHaveAttribute('aria-pressed', 'true')
})

it('preserves absent exclusions, compresses majors and clears current selections', async () => {
  const onApply = vi.fn()
  render(<TransactionFilter categories={categories} value={{ ...DEFAULT_FILTER, excludes: { EXPENSE: ['없는대분류', '식비\t없는소분류'] } }} onApply={onApply} />)
  await userEvent.click(screen.getByRole('button', { name: '필터, 적용됨' }))
  await userEvent.click(screen.getByRole('button', { name: '지출 카테고리 전체' }))
  await userEvent.click(screen.getByRole('checkbox', { name: '식비' }))
  await userEvent.click(screen.getByRole('button', { name: '지출 카테고리' }))
  expect(screen.getByRole('button', { name: '지출 카테고리 교통, 문화' })).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(onApply).toHaveBeenLastCalledWith({ ...DEFAULT_FILTER, excludes: { EXPENSE: ['없는대분류', '식비\t없는소분류', '식비'] } })
})
it('allows a type without candidates and ignores absent exclusions in its summary', async () => {
  const value = { types: ['EXPENSE' as const], excludes: { EXPENSE: ['없는대분류'] } }
  const onApply = vi.fn()
  render(<TransactionFilter categories={[]} value={value} onApply={onApply} />)
  await userEvent.click(screen.getByRole('button', { name: '필터, 적용됨' }))
  expect(screen.getByRole('button', { name: '지출 카테고리 전체' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(onApply).toHaveBeenCalledWith(value)
})

it.each([false, true])('clears exclusions on reselection without stealing focus (all=%s)', async (all) => {
  const onApply = vi.fn()
  render(<TransactionFilter categories={categories} value={{ ...DEFAULT_FILTER, excludes: { EXPENSE: ['식비', '없는대분류'] } }} onApply={onApply} />)
  await userEvent.click(screen.getByRole('button', { name: '필터, 적용됨' }))
  await userEvent.click(screen.getByRole('button', { name: '지출 카테고리 교통, 문화' }))
  const checkbox = screen.getByRole('checkbox', { name: all ? '모든 카테고리' : '식비' })
  await userEvent.click(checkbox)
  expect(checkbox).toHaveFocus()
  expect(checkbox).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByRole('button', { name: '지출 카테고리 전체' })).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: '적용' }))
  expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_FILTER, excludes: { EXPENSE: ['없는대분류'] } })
})
