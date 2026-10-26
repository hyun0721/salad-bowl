import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DonutChart, { buildDonutOption, donutHeight, sliceStyle, type DonutSlice } from './DonutChart'
import type { ChartTheme } from './chartTheme'

const chart = vi.hoisted(() => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), dispatchAction: vi.fn() }))
vi.mock('./echarts', () => ({ echarts: { init: vi.fn(() => chart) } }))
beforeEach(() => vi.clearAllMocks())
const theme: ChartTheme = { chart: Array.from({ length: 8 }, (_, i) => `token-${i}`), surface: 'surface', ink: 'ink', inkMuted: 'muted', line: 'line', font: 'font' }
const slices: DonutSlice[] = [
  { id: '식비', label: '음식', value: 120000, detail: '48%' },
  { id: '교통', label: '교통', value: 80000, detail: '32%' },
  { id: '쇼핑', label: '쇼핑', value: 50000, detail: '20%' },
]
const opts = { centerLabel: '총지출', centerValue: '₩ 250,000', compact: false, theme }

describe('buildDonutOption', () => {
  it('maps ids, values and two-line display labels with theme tokens', () => {
    const option = buildDonutOption(slices, opts)
    expect(option.series[0]).toMatchObject({
      type: 'pie', radius: ['34%', '52%'], center: ['50%', '50%'], avoidLabelOverlap: true,
      label: { alignTo: 'labelLine', bleedMargin: 4, rich: { name: { width: 84, fontSize: 13, color: theme.ink, overflow: 'truncate' }, pct: { fontSize: 11, color: theme.inkMuted } } },
      labelLine: { length: 8, length2: 6, maxSurfaceAngle: 80, lineStyle: { color: theme.inkMuted } },
      itemStyle: { borderColor: theme.surface, borderWidth: 2 },
      emphasis: { scale: true, scaleSize: 6, focus: 'self', label: { rich: { name: { fontWeight: 'bold' } } } },
    })
    expect(option.series[0].data).toHaveLength(3)
    slices.forEach((slice, i) => expect(option.series[0].data[i]).toMatchObject({ name: slice.id, value: slice.value, label: { formatter: `{name|${slice.label}}\n{pct|${slice.detail}}` }, itemStyle: { color: theme.chart[i] } }))
    expect(option.graphic).toEqual(expect.arrayContaining([
      expect.objectContaining({ left: 'center', top: 'middle', style: expect.objectContaining({ text: opts.centerLabel, fill: theme.inkMuted, fontSize: 13, padding: [0, 0, 28, 0] }) }),
      expect.objectContaining({ left: 'center', top: 'middle', style: expect.objectContaining({ text: opts.centerValue, fill: theme.ink, fontSize: 18, fontWeight: 'bold', padding: [24, 0, 0, 0] }) }),
    ]))
  })
  it('uses compact dimensions and supports one slice', () => {
    const option = buildDonutOption([slices[0]], { ...opts, compact: true })
    expect(option.series[0].data).toHaveLength(1)
    expect(option.series[0].radius).toEqual(['30%', '46%'])
    expect(option.series[0].label.rich.name).toMatchObject({ width: 56, fontSize: 12 })
    expect(option.graphic[0].style.fontSize).toBe(10)
    expect(option.graphic[1].style.fontSize).toBe(12)
  })
  it('reuses eight colors with diagonal decals', () => {
    const data = buildDonutOption(Array.from({ length: 17 }, (_, i) => ({ ...slices[0], id: `${i}` })), opts).series[0].data
    expect(data[0].itemStyle.decal).toBeUndefined()
    expect(data[8].itemStyle).toMatchObject({ color: theme.chart[0], decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: Math.PI / 4, color: theme.surface } })
    expect(data[16].itemStyle.decal?.rotation).toBe(-Math.PI / 4)
  })
  it('removes rich delimiters and escapes tooltip HTML while formatting won', () => {
    const option = buildDonutOption([{ id: 'id', label: '<b>&"\'{a|b}', value: 120000, detail: '<1%' }], opts)
    expect(option.series[0].data[0].label.formatter).toBe('{name|<b>&"\'ab}\n{pct|<1%}')
    expect(option.tooltip.trigger).toBe('item')
    expect(option.tooltip.formatter({ dataIndex: 0 })).toBe('&lt;b&gt;&amp;&quot;&#39;{a|b}<br/>₩ 120,000 · &lt;1%')
    expect(buildDonutOption([{ ...slices[0], detail: undefined }], opts).series[0].data[0].label.formatter).toBe('{name|음식}\n{pct|}')
  })
})

it('grows donut height with category count up to the cap', () => {
  expect(donutHeight(3, false)).toBe(280)
  expect(donutHeight(3, true)).toBe(240)
  expect(donutHeight(12, false)).toBe(412)
  expect(donutHeight(12, true)).toBe(372)
  expect(donutHeight(40, false)).toBe(460)
})
it('cycles slots and preserves pattern tiers', () => {
  expect(sliceStyle(0)).toEqual({ slot: 1, pattern: 'solid' })
  expect(sliceStyle(7)).toEqual({ slot: 8, pattern: 'solid' })
  expect(sliceStyle(8)).toEqual({ slot: 1, pattern: 'diag45' })
  expect(sliceStyle(15)).toEqual({ slot: 8, pattern: 'diag45' })
  expect(sliceStyle(16)).toEqual({ slot: 1, pattern: 'diag135' })
  expect(sliceStyle(30)).toEqual({ slot: 7, pattern: 'diag135' })
})

const props = { slices, ...opts, activeId: null as string | null, onActiveChange: vi.fn(), onSelect: vi.fn() }
it('hides the container and connects selection and hover handlers', () => {
  const { container } = render(<DonutChart {...props} />)
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  expect(container.firstChild).toHaveStyle({ height: '280px' })
  const handler = (event: string) => chart.on.mock.calls.find(([name]) => name === event)![1]
  handler('click')({ name: '식비' })
  expect(props.onSelect).toHaveBeenCalledWith('식비')
  handler('mouseover')({ name: '식비' })
  expect(props.onActiveChange).toHaveBeenLastCalledWith('식비')
  handler('mouseout')({ name: '식비' })
  expect(props.onActiveChange).toHaveBeenLastCalledWith(null)
})
it('downplays the previous selection before highlighting the next and clears it', () => {
  const { rerender } = render(<DonutChart {...props} activeId="식비" />)
  expect(chart.dispatchAction).toHaveBeenLastCalledWith({ type: 'highlight', seriesIndex: 0, name: '식비' })
  chart.dispatchAction.mockClear()
  rerender(<DonutChart {...props} activeId="쇼핑" />)
  expect(chart.dispatchAction.mock.calls).toEqual([
    [{ type: 'downplay', seriesIndex: 0, name: '식비' }],
    [{ type: 'highlight', seriesIndex: 0, name: '쇼핑' }],
  ])
  chart.dispatchAction.mockClear()
  rerender(<DonutChart {...props} activeId={null} />)
  expect(chart.dispatchAction).toHaveBeenCalledExactlyOnceWith({ type: 'downplay', seriesIndex: 0, name: '쇼핑' })
})
