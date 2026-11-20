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
}

/** 소득공제 쿼리 키. 머리말 `tax`는 isGroupScopedKey가 보지 않고, 로그아웃 때 queryClient.clear()로 지워진다. */
export const taxKeys = {
  year: (year: number) => ['tax', 'year', year] as const,
  currentLaw: (year: number) => ['tax', 'law', 'current', year] as const,
}

export function useTaxYearView(year: number) {
  return useQuery({ queryKey: taxKeys.year(year), queryFn: () => taxApi.year(year) })
}

/** TaxYearView를 돌려주는 저장. 응답으로 캐시를 바꾼다(합계를 다시 계산하지 않는다). */
export function useTaxSave<T>(year: number, save: (input: T) => Promise<TaxYearView>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: save, onSuccess: (view) => client.setQueryData(taxKeys.year(year), view) })
}

/** 다른 곳에서 먼저 고쳤거나(409) 지운(404) 자료에 대한 저장. 새로 불러와야 다시 저장할 수 있다. */
export function isStale(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404)
}

/** 확인·채우기처럼 입력이 없는 동작의 실패 문구. 다른 곳에서 바뀌었으면 호출한 쪽이 새로 불러온다. */
export function actionError(error: unknown): string {
  return isStale(error) ? '다른 곳에서 수정되거나 삭제됐습니다. 새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.' : errorMessage(error)
}
