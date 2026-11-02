import type { FilterGroup, FilterValue } from '../common/FilterButton'
import type { SortOption } from '../common/SortButton'
import type { CategoryOption } from './categoriesApi'

export type TransactionSort = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'
export const DEFAULT_SORT: TransactionSort = 'DATE_DESC'
export const SORT_OPTIONS: SortOption<TransactionSort>[] = [
  { value: 'DATE_DESC', label: '최신순', direction: 'desc' },
  { value: 'DATE_ASC', label: '오래된순', direction: 'asc' },
  { value: 'AMOUNT_DESC', label: '금액 큰 순', direction: 'desc' },
  { value: 'AMOUNT_ASC', label: '금액 작은 순', direction: 'asc' },
]

export function queryParams(params: URLSearchParams, filter: FilterValue, sort: TransactionSort): URLSearchParams {
  for (const [key, values] of Object.entries(filter)) values.forEach((value) => params.append(key, value))
  if (sort !== DEFAULT_SORT) params.set('sort', sort)
  return params
}

export function transactionFilterGroups(categories: CategoryOption[], draft: FilterValue): FilterGroup[] {
  const majors = draft.major ?? []
  const scoped = majors.length ? categories.filter((category) => majors.includes(category.major)) : categories
  const minors = [...new Set(scoped.flatMap((category) => category.minors.map((minor) => minor.minor)))]
  const owner = (minor: string) => scoped.find((category) => category.minors.some((item) => item.minor === minor))!.major
  return [
    { key: 'type', label: '타입', options: [
      { value: 'EXPENSE', label: '지출' }, { value: 'INCOME', label: '수입' }, { value: 'TRANSFER', label: '이체' },
    ] },
    { key: 'major', label: '대분류', options: categories.map((category) => ({ value: category.major, label: category.major })) },
    { key: 'minor', label: '소분류', options: [
      ...minors.map((minor) => ({ value: minor, label: majors.length ? `${owner(minor)} · ${minor}` : minor })),
      { value: '', label: '미분류' },
    ] },
  ]
}
