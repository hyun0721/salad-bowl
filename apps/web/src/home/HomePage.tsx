import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatInstant, formatMonthLabel, formatWon } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { importsApi } from '../imports/importsApi'
import CoverageSection from '../imports/CoverageSection'
import { summarize } from '../transactions/summary'
import { transactionsApi } from '../transactions/transactionsApi'
import styles from './HomePage.module.css'

type Props = { today?: Date }

export default function HomePage({ today: todayProp }: Props) {
  usePageTitle('내 가계부')
  const [mountedAt] = useState(() => new Date())
  const today = todayProp ?? mountedAt
  const month = defaultYearMonth(today)
  const mine = useQuery({ queryKey: ['transactions', 'mine', month], queryFn: () => transactionsApi.mine(month) })
  const imports = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })
  const totals = mine.data ? summarize(mine.data) : null

  return (
    <>
      <h1>내 가계부</h1>

      <CoverageSection today={today} />

      <div className={styles.twoColumns}>
        <section aria-labelledby="summary-title" className={ui.card}>
          <h2 id="summary-title">지난달 내 요약 ({formatMonthLabel(month)})</h2>
          {mine.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {mine.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>지난달 거래를 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} aria-label="요약 다시 시도" onClick={() => void mine.refetch()}>다시 시도</button>
            </div>
          )}
          {totals && (
            <dl className={styles.totals}>
              <div><dt>수입</dt><dd>{formatWon(totals.income)}</dd></div>
              <div><dt>지출</dt><dd>{formatWon(totals.expense)}</dd></div>
            </dl>
          )}
          <Link to="/transactions">내 거래 보기</Link>
        </section>

        <section aria-labelledby="recent-title" className={ui.card}>
          <h2 id="recent-title">최근 업로드</h2>
          {imports.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {imports.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>업로드 이력을 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} aria-label="업로드 이력 다시 시도" onClick={() => void imports.refetch()}>다시 시도</button>
            </div>
          )}
          {imports.data && imports.data.length === 0 && <p className={ui.status}>아직 올린 파일이 없습니다.</p>}
          {imports.data && imports.data.length > 0 && (
            <ul className={ui.stack}>
              {imports.data.slice(0, 3).map((batch) => (
                <li key={batch.batchId} className={ui.row}>
                  <span>{batch.fileName}</span>
                  <span className={ui.muted}>{formatInstant(batch.importedAt)} · 신규 {batch.createdRows}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/upload">업로드 이력 전체</Link>
        </section>
      </div>
    </>
  )
}
