import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { formatWon, shiftMonth } from '../common/format'
import DonutChart, { sliceStyle } from '../common/DonutChart'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import Select from '../common/Select'
import ui from '../common/ui.module.css'
import { dashboardApi } from './dashboardApi'
import CategoryTrend from './CategoryTrend'
import ChartViewToggle from './ChartViewToggle'
import { percent } from './percent'
import styles from './SubcategoryTrends.module.css'
import breakdown from './CategoryBreakdown.module.css'
import trendStyles from './CategoryTrend.module.css'

const ignoreSelect = () => {}

export default function SubcategoryTrends({ groupId, month }: { groupId: number; month: string }) {
  const { pathname, search, state } = useLocation()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const compact = useMediaQuery(NARROW)
  const [view, setView] = useState('chart')
  const [activeId, setActiveId] = useState<string | null>(null)
  const focusSubcategories = state?.focusSubcategories === true
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!focusSubcategories) return
    titleRef.current?.focus()
    // history에 남은 state로 포커스가 다시 옮겨지지 않도록 한 번 쓰고 비운다.
    navigate(pathname + search, { replace: true, state: null })
  }, [focusSubcategories, navigate, pathname, search])
  const query = useQuery({
    queryKey: ['summary', groupId, month, 'subcategories'],
    queryFn: () => dashboardApi.subcategories(groupId, month),
  })
  const data = query.data ?? []
  const majors = [...new Set(data.map((row) => row.major))].sort()
  const selected = params.get('major') ?? ''
  const major = majors.includes(selected) ? selected : ''
  const minors = [...new Set(data.filter((row) => row.major === major).map((row) => row.minor))].map((minor) => ({
    minor, value: data.find((row) => row.major === major && row.minor === minor && row.month === month)?.expense ?? 0,
  })).sort((a, b) => b.value - a.value || a.minor.localeCompare(b.minor))
  const positiveTotal = minors.reduce((sum, row) => sum + Math.max(0, row.value), 0)
  const slices = data.filter((row) => row.major === major && row.month === month && row.expense > 0)
    .sort((a, b) => b.expense - a.expense || a.minor.localeCompare(b.minor))
    .map((row) => ({ id: row.minor, label: row.minor || '미분류', value: row.expense, detail: percent(row.expense, positiveTotal) }))

  async function loadTrend(from: string, to: string) {
    const rows = (await dashboardApi.subcategories(groupId, to, from)).filter((row) => row.major === major)
    const months: string[] = []
    for (let m = from; m <= to; m = shiftMonth(m, 1)) months.push(m)
    const categories = [...new Set(rows.map((row) => row.minor || '미분류'))].map((category) => {
      const expenses = months.map((m) => rows.filter((row) => row.month === m && (row.minor || '미분류') === category)
        .reduce((sum, row) => sum + row.expense, 0))
      return { category, expenses, total: expenses.reduce((sum, value) => sum + value, 0) }
    }).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
    return { months, categories }
  }

  return <>
    {query.isSuccess && majors.length > 0 && <div className={styles.categorySelect}>
      <Select label="대분류 (필수)" selectedKey={major} variant="field"
        items={[{ id: '', label: '대분류를 선택하세요' }, ...majors.map((name) => ({ id: name, label: name }))]}
        onSelectionChange={(key) => setParams((current) => {
          const next = new URLSearchParams(current)
          if (key) next.set('major', String(key))
          else next.delete('major')
          return next
        }, { replace: true })} />
    </div>}
    <section id="dashboard-share" aria-labelledby="subcategory-title" className={`${ui.card} ${breakdown.card}`}>
      <div className={trendStyles.header}>
        <h2 id="subcategory-title" ref={titleRef} tabIndex={-1}>소분류 분포</h2>
        <ChartViewToggle title="소분류 분포" value={view} onChange={setView} />
      </div>
      {query.isPending && <p role="status" className={ui.status}>대분류 목록을 불러오는 중입니다.</p>}
      {query.isError && <div className={ui.row}>
        <p role="alert" className={ui.alert}>대분류 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        <button type="button" className={ui.button} onClick={() => void query.refetch()}>소분류 다시 시도</button>
      </div>}
      {query.isSuccess && (majors.length === 0
        ? <p className={ui.status}>최근 6개월에 공개된 지출이 없습니다.</p>
        : !major ? <p className={ui.status}>대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.</p>
        : <>
          {positiveTotal === 0 && <p className={ui.status}>이 달에 비율로 표시할 지출이 없습니다.</p>}
          {view === 'chart' ? positiveTotal > 0 && <div className={breakdown.content}>
            <DonutChart compact={compact} slices={slices} centerLabel="총지출" centerValue={formatWon(positiveTotal)}
              activeId={activeId} onActiveChange={setActiveId} onSelect={ignoreSelect} className={breakdown.chart} />
            <ul className={breakdown.list}>{slices.map((slice, index) => {
              const swatch = sliceStyle(index)
              return <li key={slice.id} tabIndex={0} className={`${breakdown.row} ${styles.legendRow}`}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveId(slice.id) }} onPointerLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(slice.id)} onBlur={() => setActiveId(null)}>
                <span aria-hidden="true" className={swatch.pattern === 'solid' ? breakdown.swatch : `${breakdown.swatch} ${breakdown[swatch.pattern]}`}
                  style={{ '--swatch-color': `var(--chart-${swatch.slot})` } as React.CSSProperties} />
                <span className={breakdown.name}>{slice.label}</span>
                <span className={breakdown.amount}>{formatWon(slice.value)}</span>
                <span className={breakdown.percent}>{slice.detail}</span>
              </li>
            })}</ul>
          </div> : view === 'list' && <ul className={styles.bars}>{minors.map(({ minor, value }) => {
            const ratio = positiveTotal > 0 && value > 0 ? value / positiveTotal * 100 : 0
            return <li key={minor} className={styles.distributionBar}>
              <span className={styles.barLabel} title={minor || '미분류'}>{minor || '미분류'}</span>
              <meter className={styles.meter} min={0} max={100} value={ratio} aria-label={`${minor || '미분류'} 지출 비율`} />
              <span className={styles.amount}>{value < 0 ? '-' : ''}{formatWon(value)} · {value < 0 ? '환불 초과' : `${ratio.toFixed(1)}%`}</span>
            </li>
          })}</ul>}
        </>)}
    </section>
    <CategoryTrend groupId={groupId} month={month} title="소분류 추이" label="소분류"
      queryKey={['summary', groupId, 'subcategory-trend', major]} load={loadTrend} enabled={!!major} ready={query.isSuccess} />
  </>
}
