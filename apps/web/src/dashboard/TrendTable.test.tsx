import { screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { AmountMaskProvider } from '../common/AmountMask'
import TrendTable from './TrendTable'

it('hides amounts in labels, titles and accessible comparisons', async () => {
  localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: true }))
  renderPage(<AmountMaskProvider><TrendTable label="대분류" months={['2026-01', '2026-02', '2026-03']}
    categories={[{ category: '식비', expenses: [1000, 2000, 1500], total: 4500 }]} /></AmountMaskProvider>)
  const table = await screen.findByRole('table', { name: '대분류별 전월 대비 증감액' })
  expect(table).toHaveTextContent('-₩ ••••• ↓+₩ ••••• ↑')
  for (const cell of within(table).getAllByRole('cell')) {
    expect(cell.getAttribute('title') ?? '').not.toMatch(/1,500|2,000|500|1,000/)
    expect(cell.getAttribute('aria-label') ?? '').not.toMatch(/1,500|2,000|500|1,000/)
  }
  localStorage.clear()
})
