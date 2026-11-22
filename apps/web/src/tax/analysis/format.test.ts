import { describe, expect, it } from 'vitest'
import { asOfText, percent, seoulDate } from './format'

describe('analysis format', () => {
  it('rounds a share half up to one decimal with integer arithmetic', () => {
    expect(percent(14_600_000, 17_800_000)).toBe('82.0%')
    expect(percent(2_600_000, 17_800_000)).toBe('14.6%')
    expect(percent(600_000, 17_800_000)).toBe('3.4%')
    // 0.15%는 부동소수점으로 0.1499…가 되어 toFixed(1)이면 0.1%다. 반올림(HALF_UP)이면 0.2%.
    expect(percent(3, 2_000)).toBe('0.2%')
    expect(percent(9_999_999_999_999, 9_999_999_999_999 * 12)).toBe('8.3%')
    expect(percent(17_800_000, 12_500_000)).toBe('142.4%')
    expect(percent(0, 17_800_000)).toBe('0.0%')
    expect(percent(0, 0)).toBeNull()
  })

  it('writes one data date or the range of different dates', () => {
    expect(asOfText('2026-06-30', '2026-06-30')).toBe('2026-06-30')
    expect(asOfText('2026-05-31', '2026-06-30')).toBe('2026-05-31 ~ 2026-06-30')
    expect(asOfText(null, null)).toBe('자료 없음')
  })

  it('reads the applied day in Korean time', () => {
    expect(seoulDate('2026-01-15T01:00:00Z')).toBe('2026-01-15')
    expect(seoulDate('2026-12-31T15:30:00Z')).toBe('2027-01-01')
  })
})
