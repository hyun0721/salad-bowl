import { describe, expect, it } from 'vitest'
import { addMonths, presetRange, rangeError } from './trendRange'

describe('trendRange', () => {
  it('counts both ends of preset ranges', () => {
    expect(presetRange('6', '2026-03')).toEqual({ from: '2025-10', to: '2026-03' })
    expect(presetRange('prev', '2026-03')).toEqual({ from: '2026-02', to: '2026-03' })
    expect(presetRange('3', '2026-03')).toEqual({ from: '2026-01', to: '2026-03' })
    expect(presetRange('12', '2026-03')).toEqual({ from: '2025-04', to: '2026-03' })
  })

  it('crosses the year boundary', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('rejects reversed and 13-month ranges but accepts 12 months', () => {
    const message = '기간은 최대 12개월이고, 시작 월이 끝 월보다 늦을 수 없습니다.'
    expect(rangeError('2026-04', '2026-03')).toBe(message)
    expect(rangeError('2025-03', '2026-03')).toBe(message)
    expect(rangeError('2025-04', '2026-03')).toBeNull()
  })
})
