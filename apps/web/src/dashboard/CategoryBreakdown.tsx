import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import DonutChart, { sliceStyle } from '../common/DonutChart'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import { formatWon } from '../common/format'
import ui from '../common/ui.module.css'
import { percent } from './percent'
import styles from './CategoryBreakdown.module.css'
import CategoryTransactionsDialog from './CategoryTransactionsDialog'
import { dashboardApi, type MonthlySummary } from './dashboardApi'
import DistributionBars from './DistributionBars'
import ChartViewToggle from './ChartViewToggle'
import trendStyles from './CategoryTrend.module.css'

type Props = { groupId: number; month: string; summary: MonthlySummary }

export default function CategoryBreakdown({ groupId, month, summary }: Props) {
  const [view, setView] = useState('chart')
  const memberQuery = useQuery({
    queryKey: ['summary', groupId, month, 'members'],
    queryFn: () => dashboardApi.memberCategories(groupId, month),
    enabled: view === 'list',
  })
  const memberData = memberQuery.isSuccess ? memberQuery.data : undefined
  const compact = useMediaQuery(NARROW)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const items = useMemo(() => summary.byCategory.filter((item) => item.expense > 0), [summary.byCategory])
  const total = useMemo(() => items.reduce((sum, item) => sum + item.expense, 0), [items])
  const slices = useMemo(() => items.map((item) => ({
    id: item.category, label: item.category, value: item.expense, detail: percent(item.expense, total),
  })), [items, total])

  return (
    <section aria-labelledby="category-title" className={`${ui.card} ${styles.card}`}>
      <div className={trendStyles.header}>
        <h2 id="category-title">대분류 분포</h2>
        <ChartViewToggle title="대분류 분포" value={view} onChange={setView} />
      </div>
      {view === 'list' && summary.byCategory.length > 0 ? <DistributionBars positiveTotal={total} members={summary.byMember} onSelect={setCategory}
        rows={summary.byCategory.map((item) => ({ id: item.category, label: item.category, value: item.expense,
          memberExpenses: memberData && summary.byMember.map((member) => ({ userId: member.userId,
            expense: memberData.filter((row) => row.major === item.category && row.userId === member.userId)
              .reduce((sum, row) => sum + row.expense, 0),
          })),
        }))} /> : items.length === 0 ? <p className={ui.status}>지출이 없습니다.</p> : (
        <div className={styles.content}>
          <DonutChart compact={compact} slices={slices}
            centerLabel="총지출" centerValue={formatWon(summary.expense)} activeId={activeId}
            onActiveChange={setActiveId} onSelect={setCategory} className={styles.chart} />
          <ul className={styles.list}>
            {items.map((item, index) => {
              const swatch = sliceStyle(index)
              return (
                <li key={item.category}>
                  <button type="button" className={styles.row}
                    aria-label={`${item.category} ${percent(item.expense, total)} ${formatWon(item.expense)}`}
                    // 대화상자가 닫히며 터치로 연 행에 포커스가 돌아와도 강조가 남지 않게, 마우스 호버와 키보드 포커스만 강조한다.
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveId(item.category) }} onPointerLeave={() => setActiveId(null)}
                    onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setActiveId(item.category) }} onBlur={() => setActiveId(null)}
                    onClick={() => setCategory(item.category)}>
                    <span aria-hidden="true" className={swatch.pattern === 'solid' ? styles.swatch : `${styles.swatch} ${styles[swatch.pattern]}`}
                      style={{ '--swatch-color': `var(--chart-${swatch.slot})` } as React.CSSProperties} />
                    <span className={styles.name}>{item.category}</span>
                    <span className={styles.amount}>{formatWon(item.expense)}</span>
                    <span className={styles.percent}>{percent(item.expense, total)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <CategoryTransactionsDialog groupId={groupId} month={month} category={category} onClose={() => setCategory(null)} />
    </section>
  )
}
