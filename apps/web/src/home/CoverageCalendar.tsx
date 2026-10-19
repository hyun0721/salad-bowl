import styles from './CoverageCalendar.module.css'
import type { CoverageMonth } from './coverageApi'

type Props = {
  year: number
  today: Date
  coverage: CoverageMonth[]
  onPickMissing: (month: string) => void
}

export default function CoverageCalendar({ year, today, coverage, onPickMissing }: Props) {
  const counts = new Map(coverage.map((c) => [c.month, c.importedCount]))
  const thisYear = today.getFullYear()
  const thisMonth = today.getMonth() + 1

  return (
    <ul className={styles.grid}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const month = `${year}-${String(m).padStart(2, '0')}`
        const label = `${m}월`
        const future = year > thisYear || (year === thisYear && m > thisMonth)
        const count = counts.get(month)
        return (
          <li key={month}>
            {count !== undefined ? (
              <div className={`${styles.cell} ${styles.registered}`}>
                <span className={styles.month}>{label}</span>
                <span className={styles.state}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  등록됨 · {count}건
                </span>
              </div>
            ) : future ? (
              <div className={`${styles.cell} ${styles.future}`}>
                <span className={styles.month}>{label}</span>
                <span className={styles.state}>예정</span>
              </div>
            ) : (
              <button type="button" className={`${styles.cell} ${styles.missing}`}
                aria-label={`${year}년 ${label} 미등록, 업로드하기`}
                onClick={() => onPickMissing(month)}>
                <span className={styles.month}>{label}</span>
                <span className={styles.state}>미등록 · 업로드하기</span>
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
