import type { TransactionView } from './transactionsApi'

/** 서버의 그룹 요약과 같은 규칙: KRW만, 이체 제외, 지출은 양수 합(환불은 차감). */
export function summarize(txs: TransactionView[]): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const tx of txs) {
    if (tx.currency !== 'KRW' || tx.type === 'TRANSFER') continue
    if (tx.type === 'INCOME') income += tx.amount
    else expense -= tx.amount
  }
  return { income, expense }
}
