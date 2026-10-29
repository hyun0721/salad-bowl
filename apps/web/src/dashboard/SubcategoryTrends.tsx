import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { formatMonthLabel, formatWon, shiftMonth } from '../common/format'
import Select from '../common/Select'
import ui from '../common/ui.module.css'
import { dashboardApi } from './dashboardApi'
import styles from './SubcategoryTrends.module.css'

export default function SubcategoryTrends({ groupId, month, initialMajor }: { groupId: number; month: string; initialMajor?: string }) {
  const focusSubcategories = useLocation().state?.focusSubcategories === true
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusSubcategories) titleRef.current?.focus()
  }, [focusSubcategories])
  const [selected, setSelected] = useState(initialMajor ?? '')
  const query = useQuery({
    queryKey: ['summary', groupId, month, 'subcategories'],
    queryFn: () => dashboardApi.subcategories(groupId, month),
  })
  const data = query.data ?? []
  const majors = [...new Set(data.map((row) => row.major))].sort()
  const major = majors.includes(selected) ? selected : ''
  const rows = data.filter((row) => row.major === major)
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5))
  const monthIndexes = [5, 4, 3, 2, 1, 0]
  const minors = [...new Set(rows.map((row) => row.minor))].map((minor) => ({
    minor,
    values: months.map((m) => rows.find((row) => row.month === m && row.minor === minor)?.expense ?? 0),
  })).sort((a, b) => b.values[5] - a.values[5] || a.minor.localeCompare(b.minor))
  const positiveTotal = minors.reduce((sum, row) => sum + Math.max(0, row.values[5]), 0)
  const min = Math.min(0, ...minors.flatMap((row) => row.values))
  const max = Math.max(0, ...minors.flatMap((row) => row.values))
  const y = (value: number) => 36 - (value - min) / (max - min || 1) * 32

  return (
    <section aria-labelledby="subcategory-title" className={ui.card}>
      <div className={`${ui.pageHeader} ${styles.header}`}>
        <h2 id="subcategory-title" ref={titleRef} tabIndex={-1}>소분류 추이·분포</h2>
        {query.isSuccess && majors.length > 0 && <div className={styles.categorySelect}>
          <Select label="대분류 (필수)" selectedKey={major} variant="field"
            items={[{ id: '', label: '대분류를 선택하세요' }, ...majors.map((name) => ({ id: name, label: name }))]}
            onSelectionChange={(key) => setSelected(String(key ?? ''))} />
        </div>}
      </div>
      <p className={ui.muted}>{formatMonthLabel(month)}까지 최근 6개월 · 지출에서 환불을 차감합니다.</p>
      {query.isPending && <p role="status" className={ui.status}>대분류 목록을 불러오는 중입니다.</p>}
      {query.isError && <div className={ui.row}>
        <p role="alert" className={ui.alert}>대분류 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        <button type="button" className={ui.button} onClick={() => void query.refetch()}>소분류 다시 시도</button>
      </div>}
      {query.isSuccess && (majors.length === 0
        ? <p className={ui.status}>최근 6개월에 공개된 지출이 없습니다.</p>
        : !major ? <p className={ui.status}>대분류 하나를 선택하면 하위 소분류를 볼 수 있습니다.</p>
        : <>
          <h3>{major} 소분류 월별 추이</h3>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.trendTable}`}>
              <caption className={ui.muted}>거래가 없는 달은 0원입니다. 전월 대비 증가: 빨강 ↑ · 감소: 파랑 ↓</caption>
              <thead><tr><th scope="col">소분류</th><th scope="col">추이</th>
                {monthIndexes.map((index) => <th scope="col" key={months[index]}>{formatMonthLabel(months[index])}</th>)}
              </tr></thead>
              <tbody>{minors.map(({ minor, values }) => <tr key={minor}>
                <th scope="row">{minor || '미분류'}</th>
                <td><svg width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
                  <line x1="4" x2="116" y1={y(0)} y2={y(0)} stroke="var(--line)" />
                  <polyline fill="none" stroke="var(--brand)" strokeWidth="2"
                    points={values.map((v, i) => `${4 + i * 22.4},${y(v)}`).join(' ')} />
                </svg></td>
                {monthIndexes.map((index) => {
                  const value = values[index]
                  const change = index === 0 ? 0 : value - values[index - 1]
                  const comparison = index === 0 ? '전월 비교 없음' : change > 0 ? '전월 대비 증가' : change < 0 ? '전월 대비 감소' : '전월과 동일'
                  return <td key={months[index]} title={comparison}
                    className={change > 0 ? styles.expenseIncrease : change < 0 ? styles.expenseDecrease : undefined}>
                    {value < 0 ? '-' : ''}{formatWon(value)}
                    {change !== 0 && <span aria-label={comparison}> {change > 0 ? '↑' : '↓'}</span>}
                  </td>
                })}
              </tr>)}</tbody>
            </table>
          </div>
          <h3>{formatMonthLabel(month)} 소분류 분포</h3>
          <p className={ui.muted}>비율은 환불 차감 후 양수인 소분류 지출의 합계 기준입니다.</p>
          {positiveTotal === 0 && <p className={ui.status}>이 달에 비율로 표시할 지출이 없습니다.</p>}
          <ul className={styles.bars}>{minors.map(({ minor, values }) => {
            const value = values[5]
            const percent = positiveTotal > 0 && value > 0 ? value / positiveTotal * 100 : 0
            return <li key={minor} className={styles.distributionBar}>
              <span className={styles.barLabel} title={minor || '미분류'}>{minor || '미분류'}</span>
              <meter className={styles.meter} min={0} max={100} value={percent}
                aria-label={`${minor || '미분류'} 지출 비율`} />
              <span className={styles.amount}>{value < 0 ? '-' : ''}{formatWon(value)} · {value < 0 ? '환불 초과' : `${percent.toFixed(1)}%`}</span>
            </li>
          })}</ul>
        </>)}
    </section>
  )
}
