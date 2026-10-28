import { apiFetch } from '../api/client'
import type { TransactionView } from '../transactions/transactionsApi'

export type CategoryTotal = { category: string; expense: number }
export type MemberTotal = { userId: number; nickname: string; income: number; expense: number }
/** KRW만, 이체·숨긴 거래·공개를 끈 멤버 제외. 지출은 양수다. */
export type MonthlySummary = {
  month: string
  income: number
  expense: number
  byCategory: CategoryTotal[]
  byMember: MemberTotal[]
}
export type CategoryTrend = {
  months: string[]
  categories: { category: string; expenses: number[]; total: number }[]
}

export type SubcategoryMonth = { month: string; major: string; minor: string; expense: number }

export const dashboardApi = {
  subcategories: (groupId: number, month: string) =>
    apiFetch<SubcategoryMonth[]>(`/groups/${groupId}/summary/subcategories?month=${month}`),
  summary: (groupId: number, month: string) =>
    apiFetch<MonthlySummary>(`/groups/${groupId}/summary?month=${month}`),
  categoryTransactions: (groupId: number, month: string, category: string) =>
    apiFetch<TransactionView[]>(`/groups/${groupId}/summary/transactions?${new URLSearchParams({ month, category })}`),
  trend: (groupId: number, from: string, to: string) =>
    apiFetch<CategoryTrend>(`/groups/${groupId}/summary/trend?${new URLSearchParams({ from, to })}`),
}
