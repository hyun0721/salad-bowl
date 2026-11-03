import type { SortOption } from '../common/SortButton'
import type { TransactionType } from './transactionsApi'

export type TransactionFilterValue = { types: TransactionType[]; picks: Partial<Record<TransactionType, string[]>> }
export const TRANSACTION_TYPES: TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER']
export const DEFAULT_FILTER: TransactionFilterValue = { types: TRANSACTION_TYPES, picks: {} }
export function isFilterApplied(filter: TransactionFilterValue): boolean {
  return filter.types.length !== TRANSACTION_TYPES.length || filter.types.some((type) => filter.picks[type] !== undefined)
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
