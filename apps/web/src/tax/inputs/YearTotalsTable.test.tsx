import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { cardView, renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

// 카드 자료의 합과 일부러 다르게 둔 서버 합계. 화면이 자료를 다시 더하지 않고 이 값을 그대로 보이는지 본다.
const totals = {
  creditGeneral: 14_000_000, creditMarket: 300_000, creditTransit: 200_000, creditCulture: 100_000,
  debitGeneral: 2_000_000, debitMarket: 200_000, debitTransit: 300_000, debitCulture: 100_000,
  cashGeneral: 500_000, cashMarket: 100_000, cashTransit: 0, cashCulture: 0,
}
const cash = { rowVersion: 9, asOfDate: '2026-10-31', memo: null, amounts: { general: 500_000, market: 100_000, transit: 0, culture: 0 }, blankCount: 0 }

function rowCells(table: HTMLElement, name: string) {
  const header = within(table).getByRole('rowheader', { name: new RegExp(`^${name}`) })
  return within(header.closest('tr')!).getAllByRole('cell').map((cell) => cell.textContent)
}

describe('연도 합계표', () => {
  it('shows the 12 server totals as given, with category and method totals', async () => {
    serveTax(yearView({ cards: [cardView()], cashReceipt: cash, totals, blankCount: 0, hasInputs: true }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    const table = within(section).getByRole('table', { name: '2026년 귀속 자료의 합 · 단위 원' })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['소비구분', '신용카드', '체크카드', '현금영수증', '합계'])
    expect(rowCells(table, '일반')).toEqual(['14,000,000', '2,000,000', '500,000', '16,500,000'])
    expect(rowCells(table, '전통시장')).toEqual(['300,000', '200,000', '100,000', '600,000'])
    expect(rowCells(table, '합계')).toEqual(['14,600,000', '2,600,000', '600,000', '17,800,000'])
    expect(within(table).getByRole('rowheader', { name: /^일반/ })).toHaveTextContent('일반 계 16,500,000')
    expect(section).not.toHaveTextContent('미입력 칸이 있습니다')
    expect(section).not.toHaveTextContent('기준일이 서로 다릅니다')
  })

  it('shows a dash in every cell while the year has no inputs and lists the blank cells', async () => {
    serveTax(yearView())
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    expect(rowCells(within(section).getByRole('table'), '일반')).toEqual(['—', '—', '—', '—'])
    expect(within(section).getByRole('status')).toHaveTextContent('미입력 칸이 있습니다(현금영수증 4칸).')
  })

  it('warns about blank cells and different as-of dates', async () => {
    serveTax(yearView({
      cards: [cardView(), cardView({ id: 8, issuerName: 'B카드', asOfDate: '2026-09-30', blankCount: 3 })],
      cashReceipt: cash, totals, blankCount: 3, hasInputs: true, asOfDateMismatch: true,
    }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    const [blanks, dates] = within(section).getAllByRole('status')
    expect(blanks).toHaveTextContent('미입력 칸이 있습니다(B카드 3칸). 아래 합계는 입력한 칸만 더한 값이며 분석은 확정값으로 보여 주지 않습니다.')
    expect(dates).toHaveTextContent('자료의 기준일이 서로 다릅니다(A카드 2026-10-31, B카드 2026-09-30, 현금영수증 2026-10-31).')
  })

  it('masks the deductible amounts with the expense setting and leaves the salary alone', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: true }))
    serveTax(yearView({ cards: [cardView()], cashReceipt: cash, totals, blankCount: 0, hasInputs: true }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    expect(rowCells(within(section).getByRole('table'), '일반')).toEqual(['•••••', '•••••', '•••••', '•••••'])
    expect(screen.getByRole('region', { name: '신용·체크 자료' })).toHaveTextContent('합계 ₩ •••••')
    expect(screen.getByRole('region', { name: '기본정보' })).toHaveTextContent('₩ 50,000,000')
  })

  it('shows the deductible amounts when only the income setting is masked', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ INCOME: true }))
    serveTax(yearView({ cards: [cardView()], cashReceipt: cash, totals, blankCount: 0, hasInputs: true }))
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 합계표' })
    expect(rowCells(within(section).getByRole('table'), '일반')).toEqual(['14,000,000', '2,000,000', '500,000', '16,500,000'])
  })
})
