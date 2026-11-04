import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { echarts, type ChartInstance, type ChartOption } from './echarts'
import { useMediaQuery } from './useMediaQuery'
import styles from './EChart.module.css'

type Handler = (params: { name?: string; dataIndex?: number }) => void
type Props = { option: ChartOption; onEvents?: Record<string, Handler>; height: number; className?: string; skipInitialAnimation?: boolean }

export const EChart = forwardRef<ChartInstance | null, Props>(function EChart({ option, onEvents, height, className, skipInitialAnimation }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartInstance | null>(null)
  const initialOptionRef = useRef(true)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useLayoutEffect(() => {
    const container = containerRef.current!
    const chart = echarts.init(container, null, { renderer: 'svg' })
    chartRef.current = chart
    initialOptionRef.current = true
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
    const disableAnimation = reducedMotion || (skipInitialAnimation && initialOptionRef.current)
    chartRef.current?.setOption(disableAnimation ? { ...option, animation: false } : option, { notMerge: true })
    initialOptionRef.current = false
  }, [option, reducedMotion, skipInitialAnimation])

  useEffect(() => {
    const chart = chartRef.current!
    const events = Object.entries(onEvents ?? {}).map(([name, handler]) => {
      const listener = (params: unknown) => handler(params as Parameters<Handler>[0])
      return [name, listener] as const
    })
    events.forEach(([name, handler]) => chart.on(name, handler))
    return () => {
      // 레이아웃 효과가 먼저 인스턴스를 폐기한 경우 off도 폐기된 인스턴스를 호출하지 않는다.
      if (!chart.isDisposed()) events.forEach(([name, handler]) => chart.off(name, handler))
    }
  }, [onEvents])

  return <div ref={containerRef} aria-hidden="true" style={{ height }} className={[styles.chart, className].filter(Boolean).join(' ')} />
})
