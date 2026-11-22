import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { ApiError } from '../api/errors'
import { errorMessage } from '../common/errorMessage'

// PR 3 응답(TaxRecordDtos)과 같은 모양. 금액은 원 단위 정수, null은 미입력이다.
// rowVersion은 서버가 주는 불투명한 값(JS 안전 정수 이하)이다. 받은 값을 그대로 돌려보내고 계산하지 않는다.
export type CardAmounts = {
  creditGeneral: number | null; creditMarket: number | null; creditTransit: number | null; creditCulture: number | null
  debitGeneral: number | null; debitMarket: number | null; debitTransit: number | null; debitCulture: number | null
}
export type CashAmounts = { general: number | null; market: number | null; transit: number | null; culture: number | null }
export type CardView = { id: number; rowVersion: number; issuerName: string; asOfDate: string; memo: string | null; amounts: CardAmounts; blankCount: number }
export type CashView = { rowVersion: number; asOfDate: string; memo: string | null; amounts: CashAmounts; blankCount: number }
export type PlanRow = { creditFixed: number; debitFixed: number; flexible: number }
export type PlanView = { rowVersion: number; general: PlanRow; market: PlanRow; transit: PlanRow; culture: PlanRow }
export type LawVersionRef = { id: number; versionNo: number; appliedAt: string; childTiersApply: boolean }
/** 연도 합계표 12칸. 서버가 그 연도 자료를 더한 값이고 웹은 자료에서 다시 더하지 않는다. */
export type SpendingTotals = Record<keyof CardAmounts | 'cashGeneral' | 'cashMarket' | 'cashTransit' | 'cashCulture', number>
export type TaxYearView = {
  taxYear: number; rowVersion: number; totalSalary: number; workStartMonth: number; workEndMonth: number; childCount: number
  lawVersion: LawVersionRef | null; newerLawVersion: boolean; cards: CardView[]; cashReceipt: CashView | null; plan: PlanView | null
  totals: SpendingTotals; blankCount: number; hasInputs: boolean; asOfDateMismatch: boolean
}
/** 회원용 현재 적용 세법(`GET /tax/law-versions/current`) 가운데 화면이 쓰는 칸. */
export type CurrentLaw = { id: number; taxYear: number; versionNo: number; appliedAt: string; childTiersApply: boolean }

export type BasicInfoInput = { totalSalary: number; workStartMonth: number; workEndMonth: number; childCount: number; rowVersion?: number }
export type CardInput = { issuerName: string; asOfDate: string; memo: string | null; amounts: CardAmounts; rowVersion?: number }
export type CashInput = { asOfDate: string; memo: string | null; amounts: CashAmounts; rowVersion?: number }
export type PlanInput = { general: PlanRow; market: PlanRow; transit: PlanRow; culture: PlanRow; rowVersion?: number }

// PR 4 분석 응답(TaxAnalysisView)과 같은 모양. 계산은 서버가 하고 웹은 그리기만 한다(TAX-44·46).
export type Category = 'GENERAL' | 'MARKET' | 'TRANSIT' | 'CULTURE'
export type AnalysisStatus = 'NO_INPUT' | 'INCOMPLETE' | 'LAW_PENDING' | 'READY'
export type ByCategory<T> = { general: T; market: T; transit: T; culture: T }
export type LawRates = {
  minSpendRatePct: number; bracketBoundary: number
  rateCreditPct: number; rateDebitCashPct: number; rateCulturePct: number; rateMarketPct: number; rateTransitPct: number
}
/** 소득공제액(amount)과 그 과정 값. 과정 값은 표시용으로 각각 원 미만을 버린 값이고 amount만 계산 결과다. */
export type Deduction = {
  highBracket: boolean; credit: number; debitCash: number; culture: number; market: number; transit: number; total: number
  threshold: number; thresholdReached: boolean; remainingToThreshold: number; beforeThresholdCut: number; thresholdCut: number
  deductible: number; basicLimit: number; basicUsed: number; extraCap: number; extraEligible: number; extraUsed: number; amount: number
}
export type ReasonCode = 'CREDIT_OVER_THRESHOLD' | 'CREDIT_RATE_HIGHER' | 'NO_FLEXIBLE_AMOUNT' | 'BELOW_THRESHOLD' | 'LIMIT_REACHED'
  | 'METHOD_NEUTRAL' | 'ALREADY_BEST'
export type Reason = { code: ReasonCode; category: Category | null; amount: number | null }
/** allocation은 지출계획의 "바꿀 수 있는 금액"만 결제수단에 둔 금액이다(고정액 없음). */
export type Recommendation = {
  methodShare: { creditPct: number; debitPct: number; cashPct: number } | null
  current: { allocation: ByCategory<{ credit: number; debit: number; cash: number }>; yearEndDeduction: number }
  recommended: { allocation: ByCategory<{ credit: number; debitCash: number }>; yearEndDeduction: number }
  difference: number; reasons: Reason[]
}
export type TaxAnalysisView = {
  taxYear: number; status: AnalysisStatus; blankCount: number; totals: SpendingTotals; totalSalary: number
  estimated: boolean; asOfDateMin: string | null; asOfDateMax: string | null; partialYear: boolean
  law: LawVersionRef | null; lawRates: LawRates | null; newerLawVersion: boolean; planSaved: boolean
  /** READY일 때만 있다. */
  deduction: Deduction | null
  /** READY이고 지출계획이 저장돼 있을 때만 있다. */
  recommendation: Recommendation | null
}

const yearPath = (year: number) => `/tax/years/${year}`

/** 404는 "없음"(연도 기록 없음, 적용 세법 없음)이라 null로 돌려준다. 그룹 쿼리처럼 그룹 목록을 다시 부르지 않는다. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export const taxApi = {
  year: (year: number) => orNull(apiFetch<TaxYearView>(yearPath(year))),
  /** rowVersion이 없으면 연도 기록을 만들고(201), 있으면 기본정보를 고친다(200). */
  saveBasicInfo: (year: number, body: BasicInfoInput) => apiFetch<TaxYearView>(yearPath(year), { method: 'PUT', json: body }),
  deleteYear: (year: number, rowVersion: number) => apiFetch<void>(`${yearPath(year)}?rowVersion=${rowVersion}`, { method: 'DELETE' }),
  addCard: (year: number, body: CardInput) => apiFetch<TaxYearView>(`${yearPath(year)}/cards`, { method: 'POST', json: body }),
  saveCard: (year: number, cardId: number, body: CardInput) =>
    apiFetch<TaxYearView>(`${yearPath(year)}/cards/${cardId}`, { method: 'PUT', json: body }),
  deleteCard: (year: number, cardId: number, rowVersion: number) =>
    apiFetch<void>(`${yearPath(year)}/cards/${cardId}?rowVersion=${rowVersion}`, { method: 'DELETE' }),
  saveCashReceipt: (year: number, body: CashInput) => apiFetch<TaxYearView>(`${yearPath(year)}/cash-receipt`, { method: 'PUT', json: body }),
  currentLaw: (year: number) => orNull(apiFetch<CurrentLaw>(`/tax/law-versions/current?year=${year}`)),
  analysis: (year: number) => orNull(apiFetch<TaxAnalysisView>(`${yearPath(year)}/analysis`)),
  /** rowVersion이 없으면 지출계획을 만들고, 있으면 고친다. 자료가 미완료여도 저장된다(TAX-75). */
  savePlan: (year: number, body: PlanInput) => apiFetch<TaxYearView>(`${yearPath(year)}/plan`, { method: 'PUT', json: body }),
  /** 연도 기록의 세법 버전을 그 연도의 현재 적용 버전으로 바꾼다(TAX-66). */
  refreshLawVersion: (year: number) => apiFetch<TaxYearView>(`${yearPath(year)}/law-version/refresh`, { method: 'POST' }),
}

/** 소득공제 쿼리 키. 머리말 `tax`는 isGroupScopedKey가 보지 않고, 로그아웃 때 queryClient.clear()로 지워진다. */
export const taxKeys = {
  year: (year: number) => ['tax', 'year', year] as const,
  currentLaw: (year: number) => ['tax', 'law', 'current', year] as const,
  analysis: (year: number) => ['tax', 'analysis', year] as const,
}

export function useTaxYearView(year: number) {
  return useQuery({ queryKey: taxKeys.year(year), queryFn: () => taxApi.year(year) })
}

/**
 * 분석 결과. 연도 기록이 바뀌면 달라지므로 화면을 떠나면 캐시에 남기지 않는다(gcTime 0).
 * 입력자료 화면에서 고친 뒤 돌아왔을 때 지난 결과를 잠깐이라도 보이지 않게 하려는 것이다.
 */
export function useTaxAnalysis(year: number) {
  return useQuery({ queryKey: taxKeys.analysis(year), queryFn: () => taxApi.analysis(year), gcTime: 0 })
}

/**
 * TaxYearView를 돌려주는 저장. 응답으로 캐시를 바꾸고(합계를 다시 계산하지 않는다) 분석을 다시 읽는다.
 * 분석을 다 읽은 뒤에 저장이 끝나므로, 저장 뒤 옮겨 간 화면은 새 결과를 그린다.
 */
export function useTaxSave<T>(_year: number, save: (input: T) => Promise<TaxYearView>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: save,
    onSuccess: (view) => {
      client.setQueryData(taxKeys.year(view.taxYear), view)
      return client.invalidateQueries({ queryKey: taxKeys.analysis(view.taxYear) })
    },
  })
}

/** 다른 곳에서 먼저 고쳤거나(409) 지운(404) 자료에 대한 저장. 새로 불러와야 다시 저장할 수 있다. */
export function isStale(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404)
}

/** 확인·채우기처럼 입력이 없는 동작의 실패 문구. 다른 곳에서 바뀌었으면 호출한 쪽이 새로 불러온다. */
export function actionError(error: unknown): string {
  return isStale(error) ? '다른 곳에서 수정되거나 삭제됐습니다. 새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.' : errorMessage(error)
}
