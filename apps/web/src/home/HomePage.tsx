import { useIsMutating, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import Dialog from '../common/Dialog'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatInstant, formatMonthLabel, formatWon } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { importsApi } from '../imports/importsApi'
import UploadForm from '../imports/UploadForm'
import { summarize } from '../transactions/summary'
import { transactionsApi } from '../transactions/transactionsApi'
import CoverageCalendar from './CoverageCalendar'
import { coverageApi, type CoverageMonth } from './coverageApi'
import MonthDataDialog from './MonthDataDialog'
import styles from './HomePage.module.css'

type Props = { today?: Date }

export default function HomePage({ today: todayProp }: Props) {
  usePageTitle('내 가계부')
  const [mountedAt] = useState(() => new Date())
  const today = todayProp ?? mountedAt
  const month = defaultYearMonth(today)
  // 1월에는 지난달이 작년이므로, 달력도 지난달이 있는 연도부터 보여준다.
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))
  const [uploadMonth, setUploadMonth] = useState<string | null>(null)
  const [managed, setManaged] = useState<CoverageMonth | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const uploading = useIsMutating({ mutationKey: ['upload'] }) > 0

  const coverage = useQuery({ queryKey: ['coverage', year], queryFn: () => coverageApi.get(year) })
  const mine = useQuery({ queryKey: ['transactions', 'mine', month], queryFn: () => transactionsApi.mine(month) })
  const imports = useQuery({ queryKey: ['imports'], queryFn: importsApi.history })
  const totals = mine.data ? summarize(mine.data) : null

  return (
    <>
      <div className={ui.pageHeader}>
        <h1>내 가계부</h1>
        <div className={ui.row}>
          <button type="button" className={ui.button} aria-label="이전 연도" onClick={() => { setNotice(null); setYear(year - 1) }}><Icon name="chevron-left" size={18} /></button>
          <span className={styles.year}>{year}년</span>
          <button type="button" className={ui.button} aria-label="다음 연도" onClick={() => { setNotice(null); setYear(year + 1) }}><Icon name="chevron-right" size={18} /></button>
        </div>
      </div>

      <section aria-labelledby="coverage-title" className={ui.card}>
        <div className={ui.pageHeader}>
          <h2 id="coverage-title">월별 등록 현황</h2>
          <span className={ui.muted}>거래 일자 기준 · 미등록 월을 누르면 업로드합니다</span>
        </div>
        {notice && <p role="status" className={ui.status}>{notice}</p>}
        {coverage.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
        {coverage.isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>등록 현황을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void coverage.refetch()}>다시 시도</button>
          </div>
        )}
        {coverage.data && (
          <CoverageCalendar year={year} today={today} coverage={coverage.data} onPickMissing={(month) => { setNotice(null); setUploadMonth(month) }}
            onPickRegistered={(entry) => { setNotice(null); setManaged(entry) }} />
        )}
      </section>

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

      {uploadMonth && (
        <Dialog title={`${formatMonthLabel(uploadMonth)} 데이터 업로드`} onClose={() => setUploadMonth(null)} closeDisabled={uploading}>
          <p className={ui.status}>뱅크샐러드에서 내려받은 엑셀(.xlsx)을 올려주세요. 여러 달이 들어 있어도 거래 일자에 맞게 반영됩니다.</p>
          <UploadForm />
        </Dialog>
      )}
      {managed && (
        <MonthDataDialog coverage={managed} onClose={() => setManaged(null)}
          onDeleted={(message) => { setManaged(null); setNotice(message) }} />
      )}
    </>
  )
}
