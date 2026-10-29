import { useId, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import LineChart, { lineStyleFor } from '../common/LineChart'
import MonthPicker from '../common/MonthPicker'
import SegmentedControl from '../common/SegmentedControl'
import { formatMonthLabel, formatWon } from '../common/format'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import ui from '../common/ui.module.css'
import { dashboardApi } from './dashboardApi'
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

type Props = { groupId: number; month: string }

export default function CategoryTrend({ groupId, month }: Props) {
  const titleId = useId()
  const compact = useMediaQuery(NARROW)
  const [preset, setPreset] = useState<RangePreset>('6')
  const [customRange, setCustomRange] = useState<MonthRange>(() => presetRange('6', month))
  const [selected, setSelected] = useState<string[] | null>(null)
  const range = preset === 'custom' ? customRange : presetRange(preset, month)
  const error = preset === 'custom' ? rangeError(range.from, range.to) : null
  const trend = useQuery({
    queryKey: ['summary', groupId, 'trend', range.from, range.to],
    queryFn: () => dashboardApi.trend(groupId, range.from, range.to),
    enabled: error === null,
    placeholderData: keepPreviousData,
  })
  const { categories, topFive, active, visible, series } = useMemo(() => {
    const categories = trend.data?.categories.filter((item) => item.total > 0) ?? []
    const topFive = categories.slice(0, 5).map((item) => item.category)
    const active = selected ?? topFive
    const visible = categories.flatMap((item, index) => active.includes(item.category) ? [{ item, index }] : [])
    const series = visible.map(({ item, index }) => ({
      id: item.category, label: item.category, values: item.expenses, styleIndex: index,
    }))
    return { categories, topFive, active, visible, series }
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
    setSelected(current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category])
  }

  return (
    <section aria-labelledby={titleId} className={`${ui.card} ${styles.card}`}>
      <h2 id={titleId}>대분류별 추이</h2>
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
        categories.length === 0 ? <p className={ui.status}>이 기간에 지출이 없습니다.</p> : <>
          <div className={styles.chips} role="group" aria-label="대분류 선택">
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
            ? <p className={ui.status}>대분류를 하나 이상 고르세요.</p>
            : <div aria-busy={trend.isPlaceholderData || undefined} className={trend.isPlaceholderData ? styles.stale : undefined}>{/* 새 기간을 받는 동안 보이는 이전 차트임을 알린다 */}<LineChart series={series} months={trend.data.months} compact={compact} className={styles.chart} /></div>}
          <details className={styles.details}>
            <summary>표로 보기</summary>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption>대분류별 월 지출</caption>
                <thead><tr><th scope="col">월</th>{visible.map(({ item }) => <th scope="col" key={item.category}>{item.category}</th>)}</tr></thead>
                <tbody>{trend.data.months.map((rowMonth, monthIndex) => ({ rowMonth, monthIndex })).reverse().map(({ rowMonth, monthIndex }) => (
                  <tr key={rowMonth}>
                    <th scope="row">{formatMonthLabel(rowMonth)}</th>
                    {visible.map(({ item }) => {
                      const value = item.expenses[monthIndex] ?? 0
                      const change = monthIndex === 0 ? 0 : value - (item.expenses[monthIndex - 1] ?? 0)
                      const comparison = monthIndex === 0 ? '전월 비교 없음' : change > 0 ? '전월 대비 증가' : change < 0 ? '전월 대비 감소' : '전월과 동일'
                      return <td key={item.category} title={comparison}
                        className={change > 0 ? styles.expenseIncrease : change < 0 ? styles.expenseDecrease : undefined}>
                        {value < 0 ? '-' : ''}{formatWon(value)}
                        {change !== 0 && <span aria-label={comparison}> {change > 0 ? '↑' : '↓'}</span>}
                      </td>
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
