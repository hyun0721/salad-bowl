import { apiFetch } from '../api/client'

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

/** 화면용 거래. categoryMajor·categoryMinor·memo는 override가 있으면 override 값이다. amount는 부호가 있다. */
export type TransactionView = {
  id: number
  ownerId: number
  ownerNickname: string
  occurredAt: string
  type: TransactionType
  categoryMajor: string
  categoryMinor: string
  description: string
  amount: number
  currency: string
  paymentMethod: string
  memo: string | null
  hidden: boolean
  source: 'IMPORT' | 'MANUAL'
  edited: boolean
  editable: boolean
}

export type TransactionPatch = { categoryMajor?: string; categoryMinor?: string; memo?: string; hidden?: boolean }

export type ManualTransactionInput = {
  occurredAt: string
  type: TransactionType
  categoryMajor: string
  categoryMinor?: string
  description: string
  amount: number
  paymentMethod?: string
  memo?: string
}

export type AuditView = {
  actorId: number
  actorNickname: string
  field: string
  before: string | null
  after: string | null
  changedAt: string
}

export type MonthDeleteResult = { deletedImported: number; deletedManual: number }

export const transactionsApi = {
  deleteMonth: (month: string, includeManual: boolean) =>
    apiFetch<MonthDeleteResult>(
      `/me/transactions?${new URLSearchParams({ month, includeManual: String(includeManual) })}`,
      { method: 'DELETE' }),
  mine: (month: string) => apiFetch<TransactionView[]>(`/me/transactions?month=${encodeURIComponent(month)}`),
  group: (groupId: number, month: string, memberId: number | null) => {
    const params = new URLSearchParams({ month })
    if (memberId !== null) params.set('memberId', String(memberId))
    return apiFetch<TransactionView[]>(`/groups/${groupId}/transactions?${params}`)
  },
  update: (id: number, patch: TransactionPatch) =>
    apiFetch<TransactionView>(`/transactions/${id}`, { method: 'PATCH', json: patch }),
  remove: (id: number) => apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),
  audits: (id: number) => apiFetch<AuditView[]>(`/transactions/${id}/audits`),
  addManual: (input: ManualTransactionInput) =>
    apiFetch<TransactionView>('/me/transactions', { method: 'POST', json: input }),
}
