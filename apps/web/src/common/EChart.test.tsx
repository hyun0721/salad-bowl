import { createRef, StrictMode } from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { EChart } from './EChart'
import { echarts, type ChartInstance } from './echarts'

const chart = vi.hoisted(() => ({ setOption: vi.fn(), on: vi.fn(), off: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: vi.fn(() => false) }))
vi.mock('./echarts', () => ({ echarts: { init: vi.fn(() => chart) } }))
beforeEach(() => {
  vi.clearAllMocks()
  chart.isDisposed.mockReturnValue(false)
  chart.dispose.mockImplementation(() => { chart.isDisposed.mockReturnValue(true) })
  vi.mocked(echarts.init).mockImplementation(() => {
    chart.isDisposed.mockReturnValue(false)
    return chart as unknown as ChartInstance
  })
})

it('initializes SVG, replaces options, exposes its instance and disposes on unmount', () => {
  const ref = createRef<ChartInstance | null>()
  const option = { series: [] }
  const { container, rerender, unmount } = render(<EChart ref={ref} option={option} height={240} className="custom" />)
  expect(echarts.init).toHaveBeenCalledWith(container.firstChild, null, { renderer: 'svg' })
  expect(chart.setOption).toHaveBeenLastCalledWith(option, { notMerge: true })
  expect(ref.current).toBe(chart)
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  expect(container.firstChild).toHaveStyle({ height: '240px' })
  expect(container.firstChild).toHaveClass('custom')
  const next = { series: [{ type: 'pie', data: [1] }] }
  rerender(<EChart ref={ref} option={next} height={300} />)
  expect(chart.setOption).toHaveBeenLastCalledWith(next, { notMerge: true })
  expect(chart.setOption).toHaveBeenCalledTimes(2)
  expect(echarts.init).toHaveBeenCalledOnce()
  unmount()
  expect(chart.dispose).toHaveBeenCalledOnce()
  expect(ref.current).toBeNull()
})

it('dispatches events and removes old handlers on replacement, removal and unmount', () => {
  const click = vi.fn()
  const nextClick = vi.fn()
  const option = {}
  const { rerender, unmount } = render(<EChart option={option} height={240} onEvents={{ click }} />)
  expect(chart.on).toHaveBeenCalledWith('click', expect.any(Function))
  const handler = chart.on.mock.calls[0][1]
  handler({ name: '식비', dataIndex: 0 })
  expect(click).toHaveBeenCalledWith({ name: '식비', dataIndex: 0 })
  rerender(<EChart option={option} height={240} onEvents={{ click: nextClick }} />)
  expect(chart.off).toHaveBeenCalledWith('click', handler)
  const nextHandler = chart.on.mock.calls.at(-1)![1]
  nextHandler({ name: '교통', dataIndex: 1 })
  expect(nextClick).toHaveBeenCalledWith({ name: '교통', dataIndex: 1 })
  expect(click).toHaveBeenCalledOnce()
  rerender(<EChart option={option} height={240} />)
  expect(chart.off).toHaveBeenCalledWith('click', nextHandler)
  rerender(<EChart option={option} height={240} onEvents={{ click }} />)
  chart.off.mockClear()
  unmount()
  expect(chart.isDisposed()).toBe(true)
  expect(chart.off).not.toHaveBeenCalled()
})

it('disables animation for reduced motion and updates when the preference changes', () => {
  let reduced = true
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query === '(prefers-reduced-motion: reduce)' && reduced },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  })))
  const option = { animation: true, series: [] }
  const { unmount } = render(<EChart option={option} height={240} />)
  expect(chart.setOption).toHaveBeenLastCalledWith({ ...option, animation: false }, { notMerge: true })
  expect(option.animation).toBe(true)
  act(() => { reduced = false; listeners.forEach((listener) => listener()) })
  expect(chart.setOption).toHaveBeenLastCalledWith(option, { notMerge: true })
  unmount()
  expect(listeners.size).toBe(0)
})

it('resizes when observed and disconnects on unmount', () => {
  let notify!: () => void
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notify = callback }
    observe = observe
    disconnect = disconnect
  })
  const { container, unmount } = render(<EChart option={{}} height={240} />)
  expect(observe).toHaveBeenCalledWith(container.firstChild)
  act(() => notify())
  expect(chart.resize).toHaveBeenCalledOnce()
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})

it('supports StrictMode effect replay without ResizeObserver', () => {
  vi.stubGlobal('ResizeObserver', undefined)
  const ref = createRef<ChartInstance | null>()
  const { unmount } = render(<StrictMode><EChart ref={ref} option={{}} height={240} /></StrictMode>)
  expect(echarts.init).toHaveBeenCalledTimes(2)
  expect(chart.dispose).toHaveBeenCalledTimes(1)
  expect(ref.current).toBe(chart)
  unmount()
  expect(chart.dispose).toHaveBeenCalledTimes(2)
})
