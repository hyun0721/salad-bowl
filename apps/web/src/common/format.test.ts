import { describe, expect, it } from 'vitest'
import { currentYearMonth, formatDateTime, formatInstant, formatMonthLabel, formatSignedWon, formatWon, shiftMonth } from './format'

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

  it('formats an instant in Seoul time regardless of its offset', () => {
    expect(formatInstant('2026-10-18T15:30:00Z')).toBe('10-19 00:30')
    expect(formatInstant('2026-10-19T03:12:45.123456Z')).toBe('10-19 12:12')
    expect(formatInstant('2026-10-19T09:00:00+09:00')).toBe('10-19 09:00')
    expect(formatInstant('2026-12-31T23:59:00+09:00')).toBe('12-31 23:59')
    expect(formatInstant('2026-10-18T15:00:00Z')).toBe('10-19 00:00')
  })

  it('shifts a YYYY-MM month across years', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})
