export function expenseChange(value: number, previous: number | undefined, formatWon: (amount: number) => string) {
  if (previous === undefined) return { label: '—', comparison: '전월 비교 없음', direction: 0 }
  if (previous === 0 && value > 0) return { label: '신규', comparison: '전월 대비 신규 지출', direction: 1 }
  const difference = Math.round(value - previous)
  const amount = formatWon(Math.abs(difference))
  return {
    label: difference > 0 ? `+${amount} ↑` : difference < 0 ? `-${amount} ↓` : amount,
    comparison: difference === 0 ? '전월과 동일' : `전월 대비 ${amount} ${difference > 0 ? '증가' : '감소'}`,
    direction: Math.sign(difference),
  }
}
