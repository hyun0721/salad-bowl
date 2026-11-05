import { createRef } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EChart } from './EChart'
import { echarts, type ChartInstance } from './echarts'
import { buildDonutOption } from './DonutChart'
import { buildLineOption } from './LineChart'

const theme = { chart: ['#000'], surface: '#fff', ink: '#000', inkMuted: '#333', line: '#ddd', font: 'sans-serif' }
afterEach(() => vi.restoreAllMocks())
it.each(['donut', 'line'])('removes old %s tooltip amounts from real chart DOM on masking', async (kind) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
  echarts.setPlatformAPI({ measureText: (text) => ({ width: text.length * 7 }) })
  const ref = createRef<ChartInstance>()
  const option = (masked: boolean) => ({ animation: false, ...(kind === 'donut'
    ? buildDonutOption([{ id: 'a', label: '식비', value: 12345 }], { theme, compact: false, centerLabel: '합계', centerValue: masked ? '₩ •••••' : '₩ 12,345', formatValue: masked ? () => '₩ •••••' : undefined })
    : buildLineOption([{ id: 'a', label: '식비', values: [12345] }], ['2026-01'], { theme, compact: false, formatValue: masked ? () => '₩ •••••' : undefined, hideValueLabels: masked })) })
  const { container, rerender } = render(<EChart ref={ref} option={option(false)} height={300} />)
  act(() => { ref.current!.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: 0 }) })
  await vi.waitFor(() => expect(container.textContent).toContain('12,345'))
  rerender(<EChart ref={ref} option={option(true)} height={300} />)
  expect(container.innerHTML).not.toContain('12,345')
  act(() => { ref.current!.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: 0 }) })
  await vi.waitFor(() => expect(container.textContent).toContain('₩ •••••'))
  expect(container.innerHTML).not.toContain('12,345')
})
