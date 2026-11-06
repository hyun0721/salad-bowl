import { describe, expect, it, vi } from 'vitest'
import { expenseChange } from './expenseChange'

describe('expenseChange', () => {
  it.each([
    [120, undefined, '—', '전월 비교 없음', 0],
    [1500, 1000, '+₩ 500 ↑', '전월 대비 ₩ 500 증가', 1],
    [500, 1000, '-₩ 500 ↓', '전월 대비 ₩ 500 감소', -1],
    [100, 100, '₩ 0', '전월과 동일', 0],
    [1, 0, '신규', '전월 대비 신규 지출', 1],
    [0, 0, '₩ 0', '전월과 동일', 0],
    [-1, 0, '-₩ 1 ↓', '전월 대비 ₩ 1 감소', -1],
    [100, -1, '+₩ 101 ↑', '전월 대비 ₩ 101 증가', 1],
    [-20, 100, '-₩ 120 ↓', '전월 대비 ₩ 120 감소', -1],
    [100.4, 100, '₩ 0', '전월과 동일', 0],
  ] as const)('%s vs %s yields %s', (value, previous, label, comparison, direction) => {
    const formatWon = vi.fn((amount: number) => `₩ ${amount}`)
    expect(expenseChange(value, previous, formatWon)).toEqual({ label, comparison, direction })
    for (const [amount] of formatWon.mock.calls) expect(amount).toBeGreaterThanOrEqual(0)
  })
})
