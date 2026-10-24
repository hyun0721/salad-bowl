import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'

export type CategoryOption = { major: string; count: number; minors: { minor: string; count: number }[] }

export const categoriesApi = {
  list: () => apiFetch<CategoryOption[]>('/me/categories'),
}

/** 대분류·소분류 입력칸의 후보. 실패하거나 불러오는 중이면 후보 없이 일반 입력칸처럼 쓴다. */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list, staleTime: 5 * 60 * 1000 })
}

export function majorOptions(list: CategoryOption[]): string[] {
  return list.map((c) => c.major)
}

export function minorOptions(list: CategoryOption[], major: string): string[] {
  return list.find((c) => c.major === major)?.minors.map((m) => m.minor) ?? []
}
