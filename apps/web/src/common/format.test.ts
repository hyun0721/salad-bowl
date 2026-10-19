import { describe, expect, it } from 'vitest'
import { currentYearMonth, formatDateTime, formatMonthLabel, formatSignedWon, formatWon } from './format'

describe('format', () => {
  it('formats won with and without sign', () => {
    expect(formatWon(1234000)).toBe('₩ 1,234,000')
    expect(formatWon(-7000)).toBe('₩ 7,000')
    expect(formatSignedWon(-7000)).toBe('-₩ 7,000')
    expect(formatSignedWon(3000000)).toBe('+₩ 3,000,000')
    expect(formatSignedWon(0)).toBe('₩ 0')
  })

  it('formats date time and month labels', () => {
    expect(formatDateTime('2026-09-10T12:00:00')).toBe('09-10 12:00')
    expect(formatDateTime('2026-09-10T08:05')).toBe('09-10 08:05')
    expect(formatMonthLabel('2026-09')).toBe('2026년 9월')
    expect(currentYearMonth(new Date(2026, 9, 19))).toBe('2026-10')
    expect(currentYearMonth(new Date(2026, 0, 1))).toBe('2026-01')
  })
})
