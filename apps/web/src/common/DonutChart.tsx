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
  const base = compact ? 220 : 260
  return Math.min(base + Math.max(0, count - 6) * 12, 380)
}

function richText(text: string): string {
  return text.replace(/[{}|]/g, '')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * 작은 조각(5% 미만)이 4개 이상 몰리면 그 묶음의 가운데가 9시 방향에 오도록 돌린다.
 * 12시에 몰리면 라벨이 위쪽 좁은 곳에 쌓여 지시선이 한데 모이기 때문이다.
 */
// oxlint-disable-next-line react/only-export-components
export function donutStartAngle(slices: DonutSlice[]): number {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const first = slices.findIndex((s) => s.value / total < 0.05)
  if (total <= 0 || first < 0 || slices.length - first < 4) return 90
  const before = slices.slice(0, first).reduce((sum, s) => sum + s.value, 0)
  const mid = ((before + total) / 2 / total) * 360
  return (180 + mid) % 360
}

// oxlint-disable-next-line react/only-export-components
export function buildDonutOption(slices: DonutSlice[], { centerLabel, centerValue, compact, theme }: {
  centerLabel: string; centerValue: string; compact: boolean; theme: ChartTheme
}) {
  return {
    textStyle: { fontFamily: theme.font },
    tooltip: {
      trigger: 'item',
      formatter: (params: { name?: string; dataIndex?: number }) => {
        const slice = slices.find((item) => item.id === params.name)
        return slice ? `${escapeHtml(slice.label)}<br/>${formatWon(slice.value)}${slice.detail ? ` · ${escapeHtml(slice.detail)}` : ''}` : ''
      },
    },
    // 그룹만 중앙에 배치하고 자식 좌표를 고정해야 두 줄이 다시 같은 위치로 정렬되지 않는다.
    graphic: [{
      type: 'group', silent: true, left: 'center', top: 'middle',
      children: [
        { type: 'text', y: -10,
          style: { text: centerLabel, align: 'center', verticalAlign: 'middle', fill: theme.inkMuted, fontFamily: theme.font, fontSize: compact ? 10 : 13 } },
        { type: 'text', y: 12,
          style: { text: centerValue, align: 'center', verticalAlign: 'middle', fill: theme.ink, fontFamily: theme.font, fontSize: compact ? 12 : 18, fontWeight: 'bold' } },
      ],
    }],
    series: [{
      type: 'pie', radius: compact ? ['30%', '46%'] : ['34%', '52%'], center: ['50%', '50%'], avoidLabelOverlap: true,
      startAngle: donutStartAngle(slices),
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
        alignTo: 'none', bleedMargin: 4,
        rich: {
          name: { fontSize: compact ? 12 : 13, color: theme.ink, width: compact ? 56 : 84, overflow: 'truncate' },
          pct: { fontSize: 11, color: theme.inkMuted },
        },
      },
      labelLine: { length: 10, length2: 8, maxSurfaceAngle: 80, lineStyle: { color: theme.inkMuted } },
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

  const onEvents = useMemo(() => ({
    click: ({ name }: { name?: string }) => { if (name !== undefined) onSelect(name) },
    mouseover: ({ name }: { name?: string }) => { if (name !== undefined) onActiveChange(name) },
    mouseout: () => onActiveChange(null),
  }), [onSelect, onActiveChange])

  return <EChart ref={chartRef} option={option} height={donutHeight(slices.length, compact)}
    className={[styles.chart, className].filter(Boolean).join(' ')} onEvents={onEvents} />
}
