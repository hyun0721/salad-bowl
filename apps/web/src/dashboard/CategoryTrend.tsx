import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import LineChart, { lineStyleFor } from '../common/LineChart'
import MonthPicker from '../common/MonthPicker'
import SegmentedControl from '../common/SegmentedControl'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import ui from '../common/ui.module.css'
import { dashboardApi, type CategoryTrend as TrendData } from './dashboardApi'
import ChartViewToggle from './ChartViewToggle'
import TrendTable from './TrendTable'
import { presetRange, rangeError, type MonthRange, type RangePreset } from './trendRange'
import styles from './CategoryTrend.module.css'

const presets: { id: RangePreset; label: string }[] = [
  { id: 'prev', label: '전월 비교' },
  { id: '3', label: '3개월' },
  { id: '6', label: '6개월' },
  { id: '12', label: '12개월' },
  { id: 'custom', label: '직접 지정' },
]
const compactPresets: { id: RangePreset; label: string }[] = [
  { id: 'prev', label: '전월' },
  { id: '3', label: '3개월' },
  { id: '6', label: '6개월' },
  { id: '12', label: '12개월' },
  { id: 'custom', label: '직접' },
]

type Props = { groupId: number; month: string; title?: string; queryKey?: readonly unknown[]; load?: (from: string, to: string) => Promise<TrendData>; label?: string; enabled?: boolean }

export default function CategoryTrend({ groupId, month, title = '대분류 추이', queryKey, load, label = '대분류', enabled = true }: Props) {
  const [view, setView] = useState('chart')
  const titleId = useId()
  const compact = useMediaQuery(NARROW)
  const [preset, setPreset] = useState<RangePreset>('3')
  const [customRange, setCustomRange] = useState<MonthRange>(() => presetRange('3', month))
  const scope = JSON.stringify(queryKey ?? ['summary', groupId, 'trend'])
  const [selection, setSelection] = useState<{ scope: string; categories: string[] } | null>(null)
  const selected = selection?.scope === scope ? selection.categories : null
  const range = preset === 'custom' ? customRange : presetRange(preset, month)
  const error = preset === 'custom' ? rangeError(range.from, range.to) : null
  const trend = useQuery({
    queryKey: [...(queryKey ?? ['summary', groupId, 'trend']), range.from, range.to],
    queryFn: () => load ? load(range.from, range.to) : dashboardApi.trend(groupId, range.from, range.to),
    enabled: enabled && error === null,
    placeholderData: (previous, previousQuery) => JSON.stringify(previousQuery?.queryKey.slice(0, -2)) === scope ? previous : undefined,
  })
  const { categories, tableCategories, topFive, active, visible, series } = useMemo(() => {
    const tableCategories = trend.data?.categories.filter((item) => item.expenses.some((value) => value !== 0))
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category)) ?? []
    const categories = tableCategories.filter((item) => item.total > 0)
    const topFive = categories.slice(0, 5).map((item) => item.category)
    const active = selected ?? topFive
    const visible = categories.flatMap((item, index) => active.includes(item.category) ? [{ item, index }] : [])
    const series = visible.map(({ item, index }) => ({
      id: item.category, label: item.category, values: item.expenses, styleIndex: index,
    }))
    return { categories, tableCategories, topFive, active, visible, series }
  }, [trend.data, selected])

  function selectPreset(id: string) {
    const next = id as RangePreset
    if (next === 'custom' && preset !== 'custom') {
      setCustomRange(presetRange(preset, month))
    }
    setPreset(next)
  }

  function toggle(category: string) {
    const current = selected ?? topFive
    setSelection({ scope, categories: current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category] })
  }

  return (
    <section id="dashboard-trend" aria-labelledby={titleId} className={`${ui.card} ${styles.card}`}>
      <div className={styles.header}><h2 id={titleId}>{title}</h2><ChartViewToggle title={title} table value={view} onChange={setView} /></div>
      {!enabled ? <p className={ui.status}>대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.</p> : <>
      <div className={styles.presetScroll}>
        <SegmentedControl label="기간" items={compact ? compactPresets : presets} selectedKey={preset} onSelectionChange={selectPreset} />
      </div>
      {preset === 'custom' && (
        <div className={styles.range}>
          <MonthPicker label="시작 월" month={customRange.from}
            onChange={(from) => setCustomRange((current) => ({ ...current, from }))} />
          <MonthPicker label="끝 월" month={customRange.to}
            onChange={(to) => setCustomRange((current) => ({ ...current, to }))} />
        </div>
      )}
      {error && <p role="alert" className={ui.alert}>{error}</p>}
      {!error && trend.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {!error && trend.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>추이를 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void trend.refetch()}>다시 시도</button>
        </div>
      )}
      {!error && trend.data && (
        (view === 'chart' ? categories : tableCategories).length === 0 ? <p className={ui.status}>이 기간에 지출이 없습니다.</p> : <>
          <div aria-busy={trend.isPlaceholderData || undefined} className={trend.isPlaceholderData ? styles.stale : undefined}>
          {view === 'chart' ? <>
          <div className={styles.chips} role="group" aria-label={`${label} 선택`}>
            {categories.map((item, index) => {
              const { slot, dash } = lineStyleFor(index)
              const pressed = active.includes(item.category)
              return (
                <button key={item.category} type="button" className={styles.chip}
                  aria-pressed={pressed} onClick={() => toggle(item.category)}>
                  <span aria-hidden="true" className={styles.marker}
                    style={{ '--marker-color': `var(--chart-${slot})`, '--marker-style': dash } as React.CSSProperties} />
                  {item.category}
                </button>
              )
            })}
          </div>
          {visible.length === 0
            ? <p className={ui.status}>{label}를 하나 이상 고르세요.</p>
            : <LineChart series={series} months={trend.data.months} compact={compact} className={styles.chart} />}
          </> : <TrendTable months={trend.data.months} categories={tableCategories} label={label} />}
          </div>
        </>
      )}
      </>}
    </section>
  )
}
