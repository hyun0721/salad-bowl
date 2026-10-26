import { useEffect, useMemo, useRef } from 'react'
import { EChart } from './EChart'
import { useChartTheme, type ChartTheme } from './chartTheme'
import type { ChartInstance, ChartOption } from './echarts'
import { formatWon } from './format'
import styles from './DonutChart.module.css'

export type DonutSlice = { id: string; label: string; value: number; detail?: string }
type Props = {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: string
  activeId: string | null
  onActiveChange: (id: string | null) => void
  onSelect: (id: string) => void
  compact?: boolean
  className?: string
}

// 8색을 반복하되 빗금으로 구분하고, 25번째부터는 마지막 패턴을 유지한다.
// oxlint-disable-next-line react/only-export-components
export function sliceStyle(index: number): { slot: number; pattern: 'solid' | 'diag45' | 'diag135' } {
  const tier = Math.min(Math.floor(index / 8), 2)
  return { slot: (index % 8) + 1, pattern: (['solid', 'diag45', 'diag135'] as const)[tier] }
}

// oxlint-disable-next-line react/only-export-components
export function donutHeight(count: number, compact: boolean): number {
  const base = compact ? 240 : 280
  return Math.min(base + Math.max(0, count - 6) * 22, 460)
}

function richText(text: string): string {
  return text.replace(/[{}|]/g, '')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// oxlint-disable-next-line react/only-export-components
export function buildDonutOption(slices: DonutSlice[], { centerLabel, centerValue, compact, theme }: {
  centerLabel: string; centerValue: string; compact: boolean; theme: ChartTheme
}) {
  return {
    textStyle: { fontFamily: theme.font },
    tooltip: {
      trigger: 'item',
      formatter: (params: { dataIndex?: number }) => {
        const slice = params.dataIndex === undefined ? undefined : slices[params.dataIndex]
        return slice ? `${escapeHtml(slice.label)}<br/>${formatWon(slice.value)}${slice.detail ? ` · ${escapeHtml(slice.detail)}` : ''}` : ''
      },
    },
    // middle 배치가 y 이동을 덮어쓰므로 패딩으로 두 줄 사이의 간격을 확보한다.
    graphic: [
      { type: 'text', silent: true, left: 'center', top: 'middle',
        style: { text: centerLabel, padding: [0, 0, compact ? 20 : 28, 0], fill: theme.inkMuted, fontFamily: theme.font, fontSize: compact ? 10 : 13 } },
      { type: 'text', silent: true, left: 'center', top: 'middle',
        style: { text: centerValue, padding: [compact ? 16 : 24, 0, 0, 0], fill: theme.ink, fontFamily: theme.font, fontSize: compact ? 12 : 18, fontWeight: 'bold' } },
    ],
    series: [{
      type: 'pie', radius: compact ? ['30%', '46%'] : ['34%', '52%'], center: ['50%', '50%'], avoidLabelOverlap: true,
      data: slices.map((slice, index) => {
        const { slot, pattern } = sliceStyle(index)
        return {
          name: slice.id, value: slice.value,
          label: { formatter: `{name|${richText(slice.label)}}\n{pct|${richText(slice.detail ?? '')}}` },
          itemStyle: {
            color: theme.chart[slot - 1],
            ...(pattern === 'solid' ? {} : { decal: {
              symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 4],
              rotation: pattern === 'diag45' ? Math.PI / 4 : -Math.PI / 4, color: theme.surface,
            } }),
          },
        }
      }),
      label: {
        alignTo: 'labelLine', bleedMargin: 4,
        rich: {
          name: { fontSize: compact ? 12 : 13, color: theme.ink, width: compact ? 56 : 84, overflow: 'truncate' },
          pct: { fontSize: 11, color: theme.inkMuted },
        },
      },
      labelLine: { length: 8, length2: 6, maxSurfaceAngle: 80, lineStyle: { color: theme.inkMuted } },
      itemStyle: { borderColor: theme.surface, borderWidth: 2 },
      emphasis: { scale: true, scaleSize: 6, focus: 'self', label: { rich: { name: { fontWeight: 'bold' } } } },
    }],
  } satisfies ChartOption
}

export default function DonutChart({ slices, centerLabel, centerValue, activeId, onActiveChange, onSelect, compact = false, className }: Props) {
  const theme = useChartTheme()
  const chartRef = useRef<ChartInstance | null>(null)
  const previousId = useRef<string | null>(null)
  const option = useMemo(() => buildDonutOption(slices, { centerLabel, centerValue, compact, theme }),
    [slices, centerLabel, centerValue, compact, theme])

  useEffect(() => {
    if (previousId.current !== null) chartRef.current?.dispatchAction({ type: 'downplay', seriesIndex: 0, name: previousId.current })
    if (activeId !== null) chartRef.current?.dispatchAction({ type: 'highlight', seriesIndex: 0, name: activeId })
    previousId.current = activeId
    // 옵션 교체로 강조 상태가 초기화되므로 현재 선택을 다시 적용한다.
  }, [activeId, option])

  return <EChart ref={chartRef} option={option} height={donutHeight(slices.length, compact)}
    className={[styles.chart, className].filter(Boolean).join(' ')} onEvents={{
      click: ({ name }) => { if (name !== undefined) onSelect(name) },
      mouseover: ({ name }) => { if (name !== undefined) onActiveChange(name) },
      mouseout: () => onActiveChange(null),
    }} />
}
