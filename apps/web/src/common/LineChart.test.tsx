import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LineChart, { buildLineOption, compactWon, lineStyleFor, monthLabels, type LineSeries } from './LineChart'
import type { ChartTheme } from './chartTheme'

const chart = vi.hoisted(() => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: vi.fn(() => false) }))
vi.mock('./echarts', () => ({ echarts: { init: vi.fn(() => chart) } }))
beforeEach(() => vi.clearAllMocks())
const theme: ChartTheme = { chart: Array.from({ length: 8 }, (_, i) => `token-${i}`), surface: 'surface', ink: 'ink', inkMuted: 'muted', line: 'line', font: 'font' }
const months = ['2026-09', '2026-10']
const series: LineSeries[] = [{ id: 'food', label: '식비', values: [100000, 300000] }]
const opts = { theme, compact: false }

it('labels January and the first month of a cross-year range with the year', () => {
  expect(monthLabels(['2025-11', '2025-12', '2026-01'])).toEqual(['2025.11', '12월', '2026.1'])
  expect(monthLabels(['2026-05', '2026-06'])).toEqual(['5월', '6월'])
  expect(monthLabels(['2026-01'])).toEqual(['2026.1'])
  expect(monthLabels([])).toEqual([])
})
it('shows a decimal below ten man and preserves signs', () => {
  expect(compactWon(300000)).toBe('30만')
  expect(compactWon(9999)).toBe('9,999')
  expect(compactWon(0)).toBe('0')
  expect(compactWon(15000)).toBe('1.5만')
  expect(compactWon(20000)).toBe('2만')
  expect(compactWon(-15000)).toBe('-1.5만')
})
it('cycles eight colors and caps the dash tier at dotted', () => {
  expect(lineStyleFor(0)).toEqual({ slot: 1, dash: 'solid' })
  expect(lineStyleFor(8)).toEqual({ slot: 1, dash: 'dashed' })
  expect(lineStyleFor(16)).toEqual({ slot: 1, dash: 'dotted' })
  expect(lineStyleFor(23)).toEqual({ slot: 8, dash: 'dotted' })
  expect(lineStyleFor(24)).toEqual({ slot: 1, dash: 'dotted' })
})
describe('buildLineOption', () => {
  it('maps series, axes, emphasis and theme tokens', () => {
    const input = Array.from({ length: 9 }, (_, i) => ({ ...series[0], id: `id-${i}`, label: `분류 ${i}` }))
    const option = buildLineOption(input, months, opts)
    expect(option.series).toHaveLength(9)
    expect(option.series[0]).toMatchObject({ id: 'id-0', name: '분류 0', type: 'line', data: [100000, 300000], symbol: 'circle', symbolSize: 6, lineStyle: { width: 2, type: 'solid', color: theme.chart[0] }, emphasis: { focus: 'series' } })
    expect(option.series[8].lineStyle).toMatchObject({ type: 'dashed', color: theme.chart[0] })
    const kept = buildLineOption([{ id: 'x', label: 'x', values: [1], styleIndex: 9 }], ['2026-05'], { theme, compact: false })
    expect(kept.series[0].lineStyle).toMatchObject({ type: 'dashed', color: theme.chart[1] })
    expect(option.xAxis).toMatchObject({ type: 'category', data: ['9월', '10월'], axisLabel: { color: theme.inkMuted } })
    expect(option.yAxis).toMatchObject({ type: 'value', splitLine: { lineStyle: { color: theme.line } } })
    expect(option.yAxis.axisLabel.formatter(300000)).toBe('30만')
    expect(option.textStyle).toMatchObject({ fontFamily: theme.font, color: theme.ink })
    expect(option.grid).toEqual({ left: 48, right: 16, top: 16, bottom: 32 })
    expect(option.tooltip).toMatchObject({ trigger: 'axis', backgroundColor: theme.surface, textStyle: { color: theme.ink } })
    expect(buildLineOption(series, months, { ...opts, compact: true }).grid).toEqual({ left: 32, right: 8, top: 12, bottom: 24 })
  })
  it('sorts tooltip rows without mutating params and escapes names', () => {
    const option = buildLineOption(series, months, opts)
    const params = [
      { dataIndex: 1, seriesName: '작음', value: 9500, marker: '<span>●</span>' },
      { dataIndex: 1, seriesName: '<b>&"\'', value: 300000, marker: '<span>●</span>' },
      { dataIndex: 1, seriesName: '중간', value: 20000, marker: '<span>●</span>' },
    ]
    expect(option.tooltip.formatter(params)).toBe('2026년 10월<br/><span>●</span>&lt;b&gt;&amp;&quot;&#39; ₩ 300,000<br/><span>●</span>중간 ₩ 20,000<br/><span>●</span>작음 ₩ 9,500')
    expect(params[0].seriesName).toBe('작음')
    expect(option.tooltip.formatter([])).toBe('')
  })
})
it('uses the wrapper and memoizes options until inputs change', () => {
  const { container, rerender } = render(<LineChart series={series} months={months} className="custom" />)
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  expect(container.firstChild).toHaveStyle({ height: '300px' })
  expect(container.firstChild).toHaveClass('custom')
  expect(chart.setOption).toHaveBeenCalledOnce()
  rerender(<LineChart series={series} months={months} className="custom" />)
  expect(chart.setOption).toHaveBeenCalledOnce()
  rerender(<LineChart series={series} months={months} compact />)
  expect(container.firstChild).toHaveStyle({ height: '240px' })
  expect(chart.setOption).toHaveBeenCalledTimes(2)
  rerender(<LineChart series={[{ ...series[0], values: [0, 1] }]} months={months} compact />)
  expect(chart.setOption).toHaveBeenCalledTimes(3)
  expect(chart.setOption.mock.calls[2][0].series[0].data).toEqual([0, 1])
})
