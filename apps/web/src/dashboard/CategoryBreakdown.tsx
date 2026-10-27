import { useMemo, useState } from 'react'
import DonutChart, { sliceStyle } from '../common/DonutChart'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import { formatWon } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './CategoryBreakdown.module.css'
import CategoryTransactionsDialog from './CategoryTransactionsDialog'
import type { MonthlySummary } from './dashboardApi'

function percent(expense: number, total: number) {
  const rounded = Math.round((expense / total) * 100)
  return rounded === 0 ? '1% 미만' : `${rounded}%`
}

type Props = { groupId: number; month: string; summary: MonthlySummary }

export default function CategoryBreakdown({ groupId, month, summary }: Props) {
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
      <h2 id="category-title">카테고리별 지출</h2>
      {items.length === 0 ? <p className={ui.status}>지출이 없습니다.</p> : (
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
                    onPointerEnter={() => setActiveId(item.category)} onPointerLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(item.category)} onBlur={() => setActiveId(null)}
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
