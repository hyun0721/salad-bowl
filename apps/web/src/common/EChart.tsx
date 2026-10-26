import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { echarts, type ChartInstance, type ChartOption } from './echarts'
import { useMediaQuery } from './useMediaQuery'
import styles from './EChart.module.css'

type Handler = (params: { name?: string; dataIndex?: number }) => void
type Props = { option: ChartOption; onEvents?: Record<string, Handler>; height: number; className?: string }

export const EChart = forwardRef<ChartInstance | null, Props>(function EChart({ option, onEvents, height, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartInstance | null>(null)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useLayoutEffect(() => {
    const container = containerRef.current!
    const chart = echarts.init(container, null, { renderer: 'svg' })
    chartRef.current = chart
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => chart.resize())
    observer?.observe(container)
    return () => {
      observer?.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => chartRef.current!, [])

  useEffect(() => {
    chartRef.current?.setOption(reducedMotion ? { ...option, animation: false } : option, { notMerge: true })
  }, [option, reducedMotion])

  useEffect(() => {
    const chart = chartRef.current!
    const events = Object.entries(onEvents ?? {}).map(([name, handler]) => {
      const listener = (params: unknown) => handler(params as Parameters<Handler>[0])
      return [name, listener] as const
    })
    events.forEach(([name, handler]) => chart.on(name, handler))
    return () => events.forEach(([name, handler]) => chart.off(name, handler))
  }, [onEvents])

  return <div ref={containerRef} aria-hidden="true" style={{ height }} className={[styles.chart, className].filter(Boolean).join(' ')} />
})
