import { apiFetch } from '../api/client'

export type CoverageMonth = { month: string; importedCount: number }

export const coverageApi = {
  get: (year: number) => apiFetch<CoverageMonth[]>(`/me/coverage?year=${year}`),
}
