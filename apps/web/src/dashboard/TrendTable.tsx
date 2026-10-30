import { formatMonthLabel } from '../common/format'
import type { CategoryTrend } from './dashboardApi'
import { expenseChange } from './expenseChange'
import styles from './CategoryTrend.module.css'

export default function TrendTable({ months, categories, label }: CategoryTrend & { label: string }) {
  const min = Math.min(0, ...categories.flatMap((row) => row.expenses))
  const max = Math.max(0, ...categories.flatMap((row) => row.expenses))
  const y = (value: number) => 36 - (value - min) / (max - min || 1) * 32
  const indexes = months.map((_, index) => index).reverse()
  return <div className={styles.tableScroll}>
    <table className={styles.table}>
      <caption className={styles.srOnly}>{label}별 전월 대비 증감률</caption>
      <thead><tr><th scope="col">{label}</th><th scope="col">추이</th>
        {indexes.map((index) => <th scope="col" key={months[index]}>{formatMonthLabel(months[index])}</th>)}
      </tr></thead>
      <tbody>{categories.map((row) => <tr key={row.category}>
        <th scope="row">{row.category}</th>
        <td><svg width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
          <line x1="4" x2="116" y1={y(0)} y2={y(0)} stroke="var(--line)" />
          <polyline fill="none" stroke="var(--brand)" strokeWidth="2"
            points={months.map((_, i) => `${4 + i * 112 / Math.max(1, months.length - 1)},${y(row.expenses[i] ?? 0)}`).join(' ')} />
        </svg></td>
        {indexes.map((index) => {
          const value = row.expenses[index] ?? 0
          const change = expenseChange(value, index === 0 ? undefined : row.expenses[index - 1] ?? 0)
          const description = `${formatMonthLabel(months[index])} ${value.toLocaleString('ko-KR')}원, ${change.comparison}`
          return <td key={months[index]} title={description} aria-label={description}
            className={change.direction > 0 ? styles.expenseIncrease : change.direction < 0 ? styles.expenseDecrease : undefined}>{change.label}</td>
        })}
      </tr>)}</tbody>
    </table>
  </div>
}
