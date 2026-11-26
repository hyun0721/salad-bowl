import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { analysisView, readyYearView, renderTaxAnalysis, serveAnalysis } from '../../test/taxFixtures'
import type { Deduction, TaxAnalysisView } from '../taxApi'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

const zeroTotals = {
  creditGeneral: 0, creditMarket: 0, creditTransit: 0, creditCulture: 0, debitGeneral: 0, debitMarket: 0, debitTransit: 0, debitCulture: 0,
  cashGeneral: 0, cashMarket: 0, cashTransit: 0, cashCulture: 0,
}

/** 공제가 시작되지 않은 결과(합성값). 과정 값은 PR 4 계산기의 정의를 따른다. */
function belowThreshold(total: number, deduction: Partial<Deduction> = {}): Partial<TaxAnalysisView> {
  const base = analysisView().deduction!
  return {
    totals: { ...zeroTotals, creditGeneral: total },
    deduction: {
      ...base, credit: total, debitCash: 0, culture: 0, market: 0, transit: 0, total, thresholdReached: false,
      remainingToThreshold: 12_500_001 - total, beforeThresholdCut: total * 15 / 100, thresholdCut: total * 15 / 100, deductible: 0,
      basicUsed: 0, extraEligible: 0, extraUsed: 0, amount: 0, ...deduction,
    },
  }
}

async function status() {
  return within(await screen.findByRole('tabpanel', { name: '① 현황' }))
}

describe('StatusStep — ① 현황', () => {
  it('summarizes the deduction, threshold and limits, saying it is not a refund', async () => {
    serveAnalysis(analysisView())
    renderTaxAnalysis()
    const step = await status()

    const summary = step.getByRole('region', { name: '현재 요약' })
    expect(summary).toHaveTextContent(/소득공제액\s*₩ 1,475,000\s*과세표준에서 빼는 금액 · 환급액 아님/)
    expect(summary).toHaveTextContent(/최저사용금액\s*달성 · 142\.4%\s*₩ 17,800,000 \/ ₩ 12,500,000 \(총급여의 25%\)/)
    expect(summary).toHaveTextContent(/기본한도 사용\s*49\.2%\s*₩ 1,475,000 \/ ₩ 3,000,000 \(공제액 기준\)/)
    expect(summary).toHaveTextContent(/추가한도 사용\s*0\.0%\s*₩ 0 \/ ₩ 3,000,000 \(전통시장·대중교통·문화체육\)/)
    expect(step.getByText(/^참고:/)).toHaveTextContent('참고: 기본한도까지 남은 공제 여유 ₩ 1,525,000')
    expect(summary).not.toHaveTextContent('추정')
  })

  it('shows category and payment shares over the whole year total, named as such', async () => {
    serveAnalysis(analysisView())
    renderTaxAnalysis()
    const step = await status()

    expect(step.getByText(/^분모:/)).toHaveTextContent('분모: 2026년 전체 입력 공제대상액 ₩ 17,800,000(연도 합계표 12칸의 합). 공제율·한도 사용률과 다른 숫자예요.')
    const rows = (name: string) => within(step.getByRole('table', { name })).getAllByRole('row').map((row) => row.textContent)
    expect(rows('소비구분별')).toEqual(['일반92.7%', '전통시장3.4%', '대중교통2.8%', '문화체육1.1%'])
    expect(rows('결제수단별')).toEqual(['신용카드82.0%', '체크카드14.6%', '현금영수증3.4%'])
  })

  it('shows an empty chart state when the year total is 0', async () => {
    serveAnalysis(analysisView({ ...belowThreshold(0), recommendation: null }))
    renderTaxAnalysis()
    const step = await status()

    expect(step.getByText('입력 합계가 0원이라 비율을 계산하지 않아요.')).toBeInTheDocument()
    expect(step.queryByRole('table')).not.toBeInTheDocument()
    expect(step.getByRole('region', { name: '현재 요약' })).toHaveTextContent(/최저사용금액\s*미달 · 0\.0%/)
  })

  it('states 0원 and the remaining amount below the threshold without urging more spending', async () => {
    serveAnalysis(analysisView(belowThreshold(9_300_000)))
    renderTaxAnalysis()
    const step = await status()

    const summary = step.getByRole('region', { name: '현재 요약' })
    expect(summary).toHaveTextContent(/소득공제액\s*₩ 0/)
    expect(summary).toHaveTextContent(/최저사용금액\s*미달 · 74\.4%/)
    expect(summary).toHaveTextContent('최저사용금액까지 ₩ 3,200,001 남았어요. 전체 사용액이 최저사용금액을 넘어야 공제가 시작돼요.')
    expect(screen.getByRole('tabpanel').textContent).not.toMatch(/더 쓰|늘리|쓰세요/)
  })

  it('keeps the calculation folded until asked, then shows threshold → rates → limits ending at the deduction', async () => {
    serveAnalysis(analysisView())
    const { user } = renderTaxAnalysis()
    const step = await status()
    const toggle = step.getByRole('button', { name: '계산 과정 보기' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(step.queryByRole('heading', { name: /최저사용금액 차감/ })).not.toBeInTheDocument()
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const calc = within(document.getElementById(toggle.getAttribute('aria-controls')!)!)
    expect(calc.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['1. 최저사용금액 차감', '2. 공제율 적용', '3. 한도'])
    expect(calc.getByText(/^최저사용금액 = 총급여/).parentElement).toHaveTextContent(/최저사용금액 = 총급여 ₩ 50,000,000 × 25%\s*₩ 12,500,000/)
    expect(calc.getByText(/^차감액/).nextElementSibling).toHaveTextContent('− ₩ 1,875,000')
    expect(calc.getAllByRole('listitem').map((li) => li.textContent)).toContain('신용카드 ₩ 14,000,000 × 15%')
    expect(calc.getByText(/^공제 가능 금액/).nextElementSibling).toHaveTextContent('₩ 1,475,000')
    expect(calc.getByText(/^추가 인정액/).nextElementSibling).toHaveTextContent('₩ 0')
    const last = calc.getByText('소득공제액 = 기본한도 안에서 인정 + 추가 인정액').nextElementSibling
    expect(last).toHaveTextContent('₩ 1,475,000')
    expect(step.getByRole('region', { name: '현재 요약' })).toHaveTextContent(/소득공제액\s*₩ 1,475,000/)
  })

  it('stops the calculation at the threshold when it is not passed', async () => {
    serveAnalysis(analysisView(belowThreshold(9_300_000)))
    const { user } = renderTaxAnalysis()
    const step = await status()
    await user.click(step.getByRole('button', { name: '계산 과정 보기' }))

    expect(step.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['1. 최저사용금액 차감'])
    expect(step.getByText('전체 사용액이 최저사용금액 이하라 여기서 끝나요. 소득공제액은 0원이에요.')).toBeInTheDocument()
  })

  it('marks an estimate on the deduction', async () => {
    serveAnalysis(analysisView({ estimated: true, asOfDateMin: '2026-05-31' }))
    renderTaxAnalysis()
    const step = await status()

    expect(step.getByRole('region', { name: '현재 요약' })).toHaveTextContent(/소득공제액\s*추정/)
  })

  it('shows the blank count and a way to the inputs instead of numbers while the data is incomplete', async () => {
    serveAnalysis(analysisView({ status: 'INCOMPLETE', blankCount: 3, lawRates: null, deduction: null, recommendation: null }), readyYearView({ blankCount: 3 }))
    renderTaxAnalysis()
    const step = await status()

    expect(step.getByRole('heading', { name: '자료를 완료하면 계산해요' })).toBeInTheDocument()
    expect(step.getByText(/^빈 칸 3개/)).toBeInTheDocument()
    expect(step.getByRole('link', { name: '입력자료로 가기' })).toHaveAttribute('href', '/tax/inputs')
    expect(step.queryByRole('region', { name: '현재 요약' })).not.toBeInTheDocument()
    expect(step.queryByText(/₩/)).not.toBeInTheDocument()
  })

  it('shows only that the law is not ready when the data is complete', async () => {
    serveAnalysis(analysisView({ status: 'LAW_PENDING', law: null, lawRates: null, deduction: null, recommendation: null }), readyYearView({ lawVersion: null }))
    renderTaxAnalysis()
    const step = await status()

    expect(step.getByRole('heading', { name: '세법 준비 중' })).toBeInTheDocument()
    expect(step.queryByText(/빈 칸/)).not.toBeInTheDocument()
    expect(step.queryByRole('link', { name: '입력자료로 가기' })).not.toBeInTheDocument()
  })

  it('hides the deduction amounts under the 지출 mask and the salary under the 수입 mask', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: true }))
    serveAnalysis(analysisView())
    renderTaxAnalysis()
    const step = await status()

    expect(step.getByRole('region', { name: '현재 요약' })).toHaveTextContent(/소득공제액\s*₩ •••••/)
    expect(step.getByRole('region', { name: '현재 요약' })).not.toHaveTextContent('1,475,000')
    expect(screen.getByText(/^적용 세법/)).toHaveTextContent('예상 총급여 ₩ 50,000,000')
  })
})
