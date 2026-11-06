import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'

import type { TransactionType } from './transactionsApi'

export type CategoryOption = { type: TransactionType; major: string; count: number; minors: { minor: string; count: number }[] }

export const categoriesApi = {
  group: (groupId: number) => apiFetch<CategoryOption[]>(`/groups/${groupId}/categories`),
  list: () => apiFetch<CategoryOption[]>('/me/categories'),
}

/** 대분류·소분류 Select에서 고르는 기존 분류 목록. 로딩·오류 상태는 호출 화면에서 처리한다. */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list, staleTime: 5 * 60 * 1000 })
}

export function majorOptions(list: CategoryOption[]): string[] {
  return [...new Set(list.map((c) => c.major))]
}

export function minorOptions(list: CategoryOption[], major: string): string[] {
  return [...new Set(list.filter((c) => c.major === major).flatMap((c) => c.minors.map((m) => m.minor)).filter(Boolean))]
}
