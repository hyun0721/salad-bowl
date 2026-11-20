import { http, HttpResponse } from 'msw'
import { AmountMaskProvider } from '../common/AmountMask'
import TaxInputsPage from '../tax/inputs/TaxInputsPage'
import type { CardView, CurrentLaw, TaxYearView } from '../tax/taxApi'
import { TaxYearProvider } from '../tax/TaxYearProvider'
import { renderPage } from './renderPage'
import { server } from './server'

// 소득공제 화면 테스트용 합성값. 실제 급여·카드 금액이 아니다.
export const taxToday = new Date('2026-11-20T09:00:00+09:00')

const zeroTotals = {
  creditGeneral: 0, creditMarket: 0, creditTransit: 0, creditCulture: 0,
  debitGeneral: 0, debitMarket: 0, debitTransit: 0, debitCulture: 0,
  cashGeneral: 0, cashMarket: 0, cashTransit: 0, cashCulture: 0,
}

export function yearView(overrides: Partial<TaxYearView> = {}): TaxYearView {
  return {
    taxYear: 2026, rowVersion: 777, totalSalary: 50_000_000, workStartMonth: 1, workEndMonth: 12, childCount: 0,
    lawVersion: { id: 1, versionNo: 1, appliedAt: '2026-01-02T00:00:00Z', childTiersApply: true }, newerLawVersion: false,
    cards: [], cashReceipt: null, plan: null, totals: zeroTotals, blankCount: 4, hasInputs: false, asOfDateMismatch: false,
    ...overrides,
  }
}

export function cardView(overrides: Partial<CardView> = {}): CardView {
  return {
    id: 7, rowVersion: 3, issuerName: 'A카드', asOfDate: '2026-10-31', memo: '주 사용 카드',
    amounts: {
      creditGeneral: 9_000_000, creditMarket: 300_000, creditTransit: 200_000, creditCulture: 100_000,
      debitGeneral: 0, debitMarket: 0, debitTransit: 0, debitCulture: 0,
    },
    blankCount: 0,
    ...overrides,
  }
}

export const law2026: CurrentLaw = { id: 1, taxYear: 2026, versionNo: 1, appliedAt: '2026-01-02T00:00:00Z', childTiersApply: true }

const notFound = () => HttpResponse.json({ code: 'NOT_FOUND', message: 'not found' }, { status: 404 })

/** GET 연도 기록과 현재 적용 세법. null이면 404(없음)다. 연도 기록 GET 횟수를 센다. */
export function serveTax(view: TaxYearView | null, law: CurrentLaw | null = law2026) {
  const calls = { year: 0 }
  server.use(
    http.get('*/api/tax/years/:year', () => {
      calls.year++
      return view ? HttpResponse.json(view) : notFound()
    }),
    http.get('*/api/tax/law-versions/current', () => (law ? HttpResponse.json(law) : notFound())),
  )
  return calls
}

export function renderTaxInputs(options: { groups?: unknown[] } = {}) {
  return renderPage(
    <AmountMaskProvider><TaxYearProvider today={taxToday}><TaxInputsPage /></TaxYearProvider></AmountMaskProvider>,
    options,
  )
}
