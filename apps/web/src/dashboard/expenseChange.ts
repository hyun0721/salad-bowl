export function expenseChange(value: number, previous: number | undefined) {
  if (previous === undefined || previous < 0 || (previous === 0 && value < 0)) {
    return { label: '—', comparison: '전월 비교 없음', direction: 0 }
  }
  if (previous === 0 && value > 0) return { label: '신규', comparison: '전월 대비 신규 지출', direction: 1 }
  const rate = previous === 0 ? 0 : Math.round((value - previous) / previous * 100)
  return {
    label: rate > 0 ? `+${rate}% ↑` : rate < 0 ? `${rate}% ↓` : '0%',
    comparison: rate === 0 ? '전월과 동일' : `전월 대비 ${Math.abs(rate)}% ${rate > 0 ? '증가' : '감소'}`,
    direction: Math.sign(rate),
  }
}
