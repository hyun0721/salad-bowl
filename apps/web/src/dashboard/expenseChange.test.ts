import { describe, expect, it } from 'vitest'
import { expenseChange } from './expenseChange'

describe('expenseChange', () => {
  it.each([
    [120, undefined, '—'], [112, 100, '+12% ↑'], [92, 100, '-8% ↓'],
    [100, 100, '0%'], [1, 0, '신규'], [0, 0, '0%'], [-1, 0, '—'],
    [100, -1, '—'], [-20, 100, '-120% ↓'], [100.4, 100, '0%'],
  ])('%s vs %s yields %s', (value, previous, label) => {
    expect(expenseChange(value, previous).label).toBe(label)
  })
})
