import type { SortOption } from '../common/SortButton'
import type { TransactionType } from './transactionsApi'

export type TransactionFilterValue = { types: TransactionType[]; picks: Partial<Record<TransactionType, string[]>> }
export const TRANSACTION_TYPES: TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER']
export const DEFAULT_FILTER: TransactionFilterValue = { types: TRANSACTION_TYPES, picks: {} }
export function isFilterApplied(filter: TransactionFilterValue): boolean {
  return filter.types.length !== TRANSACTION_TYPES.length || filter.types.some((type) => filter.picks[type] !== undefined)
}

const FILTER_STORAGE_KEY = 'saladbowl.transactionFilter'

/** 저장해 둔 필터. 없거나 모양이 틀리면 기본값이다. */
export function readStoredFilter(): TransactionFilterValue {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return DEFAULT_FILTER
    const { types, picks } = raw as Record<string, unknown>
    if (!Array.isArray(types) || !types.every((t) => TRANSACTION_TYPES.includes(t)) || !picks || typeof picks !== 'object') return DEFAULT_FILTER
    const entries = Object.entries(picks)
    const valid = entries.every(([t, list]) => TRANSACTION_TYPES.includes(t as TransactionType)
      && Array.isArray(list) && list.every((p) => typeof p === 'string'))
    return valid ? { types: TRANSACTION_TYPES.filter((t) => types.includes(t)), picks: Object.fromEntries(entries) } : DEFAULT_FILTER
  } catch {
    return DEFAULT_FILTER
  }
}

/** 기본값이면 저장한 값을 지운다. */
export function storeFilter(filter: TransactionFilterValue) {
  try {
    if (isFilterApplied(filter)) window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter))
    else window.localStorage.removeItem(FILTER_STORAGE_KEY)
  } catch {
    // 저장소를 못 쓰면 이번 화면 동안만 기억한다.
  }
}

export type TransactionSort = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'
export const DEFAULT_SORT: TransactionSort = 'DATE_DESC'
export const SORT_OPTIONS: SortOption<TransactionSort>[] = [
  { value: 'DATE_DESC', label: '최신순', direction: 'desc' },
  { value: 'DATE_ASC', label: '오래된순', direction: 'asc' },
  { value: 'AMOUNT_DESC', label: '금액 큰 순', direction: 'desc' },
  { value: 'AMOUNT_ASC', label: '금액 작은 순', direction: 'asc' },
]

export function queryParams(params: URLSearchParams, filter: TransactionFilterValue, sort: TransactionSort): URLSearchParams {
  if (filter.types.length !== TRANSACTION_TYPES.length) filter.types.forEach((type) => params.append('type', type))
  for (const type of filter.types) {
    filter.picks[type]?.forEach((pick) => params.append('pick', `${type}\t${pick}`))
  }
  if (sort !== DEFAULT_SORT) params.set('sort', sort)
  return params
}
