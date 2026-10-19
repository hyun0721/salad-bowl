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

export const transactionsApi = {
  mine: (month: string) => apiFetch<TransactionView[]>(`/me/transactions?month=${encodeURIComponent(month)}`),
  group: (groupId: number, month: string, memberId: number | null) => {
    const params = new URLSearchParams({ month })
    if (memberId !== null) params.set('memberId', String(memberId))
    return apiFetch<TransactionView[]>(`/groups/${groupId}/transactions?${params}`)
  },
}
