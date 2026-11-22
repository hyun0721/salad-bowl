import { http, HttpResponse } from 'msw'
import { AmountMaskProvider } from '../common/AmountMask'
import TaxAnalysisPage from '../tax/analysis/TaxAnalysisPage'
import TaxInputsPage from '../tax/inputs/TaxInputsPage'
import type { CardView, CurrentLaw, PlanView, TaxAnalysisView, TaxYearView } from '../tax/taxApi'
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

// 분석 화면용. 와이어프레임 설명서 D절의 합성 입력(총급여 50,000,000, 합 17,800,000)과 그 손계산 결과다.
export const sampleTotals = {
  creditGeneral: 14_000_000, creditMarket: 300_000, creditTransit: 200_000, creditCulture: 100_000,
  debitGeneral: 2_000_000, debitMarket: 200_000, debitTransit: 300_000, debitCulture: 100_000,
  cashGeneral: 500_000, cashMarket: 100_000, cashTransit: 0, cashCulture: 0,
}

export const samplePlan: PlanView = {
  rowVersion: 55,
  general: { creditFixed: 500_000, debitFixed: 300_000, flexible: 1_200_000 },
  market: { creditFixed: 0, debitFixed: 100_000, flexible: 100_000 },
  transit: { creditFixed: 100_000, debitFixed: 0, flexible: 0 },
  culture: { creditFixed: 0, debitFixed: 0, flexible: 100_000 },
}

/** 자료가 완료되고 지출계획이 저장된 연도 기록(분석 화면의 ②가 읽는다). */
export function readyYearView(overrides: Partial<TaxYearView> = {}): TaxYearView {
  return yearView({ totals: sampleTotals, plan: samplePlan, blankCount: 0, hasInputs: true, ...overrides })
}

/** READY 분석. 현황 1,475,000원, 현재 계획 1,997,272원, 추천 2,150,000원, 차이 152,728원. */
export function analysisView(overrides: Partial<TaxAnalysisView> = {}): TaxAnalysisView {
  return {
    taxYear: 2026, status: 'READY', blankCount: 0, totals: sampleTotals, totalSalary: 50_000_000,
    estimated: false, asOfDateMin: '2026-06-30', asOfDateMax: '2026-06-30', partialYear: false,
    law: { id: 1, versionNo: 1, appliedAt: '2026-01-15T01:00:00Z', childTiersApply: true },
    lawRates: { minSpendRatePct: 25, bracketBoundary: 70_000_000, rateCreditPct: 15, rateDebitCashPct: 30, rateCulturePct: 30, rateMarketPct: 40, rateTransitPct: 40 },
    newerLawVersion: false, planSaved: true,
    deduction: {
      highBracket: false, credit: 14_000_000, debitCash: 2_500_000, culture: 200_000, market: 600_000, transit: 500_000,
      total: 17_800_000, threshold: 12_500_000, thresholdReached: true, remainingToThreshold: 0,
      beforeThresholdCut: 3_350_000, thresholdCut: 1_875_000, deductible: 1_475_000,
      basicLimit: 3_000_000, basicUsed: 1_475_000, extraCap: 3_000_000, extraEligible: 500_000, extraUsed: 0, amount: 1_475_000,
    },
    recommendation: {
      methodShare: { creditPct: 82.0, debitPct: 14.6, cashPct: 3.4 },
      current: {
        allocation: {
          general: { credit: 1_018_183, debit: 145_454, cash: 36_363 }, market: { credit: 50_001, debit: 33_333, cash: 16_666 },
          transit: { credit: 0, debit: 0, cash: 0 }, culture: { credit: 50_000, debit: 50_000, cash: 0 },
        },
        yearEndDeduction: 1_997_272,
      },
      recommended: {
        allocation: {
          general: { credit: 0, debitCash: 1_200_000 }, market: { credit: 50_001, debitCash: 49_999 },
          transit: { credit: 0, debitCash: 0 }, culture: { credit: 50_000, debitCash: 50_000 },
        },
        yearEndDeduction: 2_150_000,
      },
      difference: 152_728,
      reasons: [{ code: 'CREDIT_OVER_THRESHOLD', category: 'GENERAL', amount: 1_018_183 }],
    },
    ...overrides,
  }
}

/** GET 분석과 GET 연도 기록. null이면 404(연도 기록 없음)다. 요청 횟수를 센다. */
export function serveAnalysis(analysis: TaxAnalysisView | null, view: TaxYearView | null = analysis && readyYearView()) {
  const calls = { analysis: 0, year: 0 }
  server.use(
    http.get('*/api/tax/years/:year/analysis', () => {
      calls.analysis++
      return analysis ? HttpResponse.json(analysis) : notFound()
    }),
    http.get('*/api/tax/years/:year', () => {
      calls.year++
      return view ? HttpResponse.json(view) : notFound()
    }),
  )
  return calls
}

export function renderTaxAnalysis(options: { groups?: unknown[] } = {}) {
  return renderPage(
    <AmountMaskProvider><TaxYearProvider today={taxToday}><TaxAnalysisPage /></TaxYearProvider></AmountMaskProvider>,
    { ...options, path: '/tax/analysis' },
  )
}
