import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { menuLabel } from '../app/menu'
import PageHeader from '../common/PageHeader'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatMonthLabel, formatWon } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { coverageApi } from '../imports/coverageApi'
import { summarize } from '../transactions/summary'
import { transactionsApi } from '../transactions/transactionsApi'
import styles from './HomePage.module.css'

type Props = { today?: Date }

export default function HomePage({ today: todayProp }: Props) {
  const title = menuLabel('/')
  usePageTitle(title)
  const [mountedAt] = useState(() => new Date())
  const today = todayProp ?? mountedAt
  const month = defaultYearMonth(today)
  // 1월에는 지난달이 작년이므로 지난달이 속한 연도의 등록 현황을 본다.
  const year = Number(month.slice(0, 4))

  const coverage = useQuery({ queryKey: ['coverage', year], queryFn: () => coverageApi.get(year) })
  const mine = useQuery({ queryKey: ['transactions', 'mine', month], queryFn: () => transactionsApi.mine(month) })
  const totals = mine.data ? summarize(mine.data) : null
  const entry = coverage.data?.find((c) => c.month === month && c.importedCount > 0)

  return (
    <>
      <PageHeader title={title} />

      <div className={styles.twoColumns}>
        <section aria-labelledby="upload-status-title" className={ui.card}>
          <h2 id="upload-status-title">지난달 업로드</h2>
          {coverage.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {coverage.isError && (
            <div className={ui.row}>
              <p role="alert" className={ui.alert}>업로드 현황을 불러오지 못했습니다.</p>
              <button type="button" className={ui.button} aria-label="업로드 현황 다시 시도" onClick={() => void coverage.refetch()}>다시 시도</button>
            </div>
          )}
          {coverage.data && (entry
            ? <p>{formatMonthLabel(month)} 데이터 등록됨 · {entry.importedCount}건</p>
            : <>
              <p>{formatMonthLabel(month)} 데이터가 아직 없습니다.</p>
              <Link to={`/upload?month=${month}`}>업로드하기</Link>
            </>)}
        </section>

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
      </div>
    </>
  )
}
