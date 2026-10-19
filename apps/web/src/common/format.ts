const won = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 합계용: 부호 없이 원화 기호와 천 단위 쉼표. */
export function formatWon(amount: number): string {
  return `₩ ${won.format(Math.abs(amount))}`
}

/** 거래 금액용: 지출 -, 수입 +. */
export function formatSignedWon(amount: number): string {
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : ''
  return `${sign}${formatWon(amount)}`
}

/** API의 시간대 없는 한국 시간 `YYYY-MM-DDTHH:mm[:ss]` → `MM-DD HH:mm`. */
export function formatDateTime(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

/** `YYYY-MM` → `YYYY년 M월`. */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${year}년 ${Number(m)}월`
}

export function currentYearMonth(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}
