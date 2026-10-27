import { useMemo } from 'react'
import { EChart } from './EChart'
import { useChartTheme, type ChartTheme } from './chartTheme'
import type { ChartOption } from './echarts'
import { formatMonthLabel, formatWon } from './format'

// styleIndex: 일부만 보여 줄 때도 색이 바뀌지 않도록 전체 목록에서의 순번을 넘긴다. 없으면 배열 순번.
export type LineSeries = { id: string; label: string; values: number[]; styleIndex?: number }
type Props = { series: LineSeries[]; months: string[]; compact?: boolean; className?: string }

// oxlint-disable-next-line react/only-export-components
export function lineStyleFor(index: number): { slot: number; dash: 'solid' | 'dashed' | 'dotted' } {
  return { slot: (index % 8) + 1, dash: (['solid', 'dashed', 'dotted'] as const)[Math.min(Math.floor(index / 8), 2)] }
}

// oxlint-disable-next-line react/only-export-components
export function monthLabels(months: string[]): string[] {
  const crossesYear = months.some((month) => month.slice(0, 4) !== months[0].slice(0, 4))
  return months.map((month, index) => {
    const [year, m] = month.split('-')
    return Number(m) === 1 || (index === 0 && crossesYear) ? `${year}.${Number(m)}` : `${Number(m)}월`
  })
}

// oxlint-disable-next-line react/only-export-components
export function compactWon(value: number): string {
  const amount = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (amount < 10000) return value.toLocaleString('ko-KR')
  if (amount < 100000) return `${sign}${Number((amount / 10000).toFixed(1))}만`
  return `${sign}${Math.round(amount / 10000)}만`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

type TooltipItem = { dataIndex?: number; seriesName?: string; value?: number; marker?: string }

// oxlint-disable-next-line react/only-export-components
export function buildLineOption(series: LineSeries[], months: string[], { theme, compact }: { theme: ChartTheme; compact: boolean }) {
  return {
    textStyle: { fontFamily: theme.font, color: theme.ink },
    grid: compact ? { left: 32, right: 8, top: 12, bottom: 24 } : { left: 48, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category', data: monthLabels(months),
      axisLabel: { color: theme.inkMuted },
      axisLine: { lineStyle: { color: theme.line } },
      axisTick: { lineStyle: { color: theme.line } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.inkMuted, formatter: compactWon },
      splitLine: { lineStyle: { color: theme.line } },
    },
    tooltip: {
      trigger: 'axis', backgroundColor: theme.surface, borderColor: theme.line,
      textStyle: { color: theme.ink, fontFamily: theme.font },
      formatter: (params: TooltipItem[]) => {
        const month = months[params[0]?.dataIndex ?? -1]
        if (!month) return ''
        const rows = [...params].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .map((item) => `${item.marker ?? ''}${escapeHtml(item.seriesName ?? '')} ${formatWon(item.value ?? 0)}`)
        return [escapeHtml(formatMonthLabel(month)), ...rows].join('<br/>')
      },
    },
    series: series.map((item, index) => {
      const { slot, dash } = lineStyleFor(item.styleIndex ?? index)
      const color = theme.chart[slot - 1]
      return {
        id: item.id, name: item.label, type: 'line', data: item.values,
        symbol: 'circle', symbolSize: 6,
        itemStyle: { color }, lineStyle: { width: 2, type: dash, color },
        emphasis: { focus: 'series' },
      }
    }),
  } satisfies ChartOption
}

export default function LineChart({ series, months, compact = false, className }: Props) {
  const theme = useChartTheme()
  const option = useMemo(() => buildLineOption(series, months, { theme, compact }), [series, months, compact, theme])
  return <EChart option={option} height={compact ? 240 : 300} className={className} />
}
