import { describe, expect, it } from 'vitest'
import { summarize } from './summary'
import type { TransactionView } from './transactionsApi'

const tx = (type: TransactionView['type'], amount: number, currency = 'KRW'): TransactionView => ({
  id: Math.random(), ownerId: 1, ownerNickname: '나', occurredAt: '2026-09-01T12:00:00', type,
  categoryMajor: '식비', categoryMinor: '', description: 'x', amount, currency, paymentMethod: '카드',
  memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
})

describe('summarize', () => {
  it('sums KRW income and expense, ignores transfers, subtracts refunds', () => {
    expect(summarize([
      tx('INCOME', 3000000), tx('EXPENSE', -10000), tx('EXPENSE', -5000), tx('EXPENSE', 2000),
      tx('TRANSFER', -500000), tx('EXPENSE', -120, 'USD'),
    ])).toEqual({ income: 3000000, expense: 13000 })
  })
})
