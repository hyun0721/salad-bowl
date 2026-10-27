import { shiftMonth } from '../common/format'

export type RangePreset = 'prev' | '3' | '6' | '12' | 'custom'
export type MonthRange = { from: string; to: string }

export function addMonths(month: string, n: number): string {
  return shiftMonth(month, n)
}

export function presetRange(preset: Exclude<RangePreset, 'custom'>, month: string): MonthRange {
  const count = preset === 'prev' ? 2 : Number(preset)
  return { from: addMonths(month, 1 - count), to: month }
}

export function rangeError(from: string, to: string): string | null {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  const months = (toYear - fromYear) * 12 + toMonth - fromMonth + 1
  return months < 1 || months > 12
    ? '기간은 최대 12개월이고, 시작 월이 끝 월보다 늦을 수 없습니다.'
    : null
}
