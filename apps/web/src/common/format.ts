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

const seoulParts = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** 시각(오프셋 포함 ISO, 예: `...Z`, `...+09:00`) → 서울 시간 `MM-DD HH:mm`. */
export function formatInstant(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const parts = Object.fromEntries(seoulParts.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** `YYYY-MM` → `YYYY년 M월`. */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${year}년 ${Number(m)}월`
}

export function currentYearMonth(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

/** `YYYY-MM`을 delta개월 옮긴다. */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const index = year * 12 + (m - 1) + delta
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}
