import { useIsMutating, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import Dialog from '../common/Dialog'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'
import { currentYearMonth, defaultYearMonth, formatMonthLabel } from '../common/format'
import CoverageCalendar from './CoverageCalendar'
import { coverageApi, type CoverageMonth } from './coverageApi'
import MonthDataDialog from './MonthDataDialog'
import UploadForm from './UploadForm'
import styles from './CoverageSection.module.css'

type Props = { today: Date; initialMonth?: string | null; onInitialMonthHandled?: () => void }

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** 한 해의 월별 등록 현황. 미등록 월은 업로드 창, 등록된 월은 데이터 관리 창을 연다. initialMonth가 있으면 그 달 창을 연다. */
export default function CoverageSection({ today, initialMonth, onInitialMonthHandled }: Props) {
  const requested = initialMonth && MONTH.test(initialMonth) && initialMonth <= currentYearMonth(today) ? initialMonth : null
  // 1월에는 지난달이 작년이므로, 달력도 지난달이 있는 연도부터 보여준다.
  const [year, setYear] = useState(() => Number((requested ?? defaultYearMonth(today)).slice(0, 4)))
  const [uploadMonth, setUploadMonth] = useState<string | null>(null)
  const [managed, setManaged] = useState<CoverageMonth | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const uploading = useIsMutating({ mutationKey: ['upload'] }) > 0
  const coverage = useQuery({ queryKey: ['coverage', year], queryFn: () => coverageApi.get(year) })

  useEffect(() => {
    if (!initialMonth) return
    if (!requested) { onInitialMonthHandled?.(); return }
    // 요청한 달의 연도를 아직 받지 못했으면 기다린다(실패하면 다시 시도가 성공할 때까지).
    if (!coverage.data || year !== Number(requested.slice(0, 4))) return
    const entry = coverage.data.find((c) => c.month === requested)
    if (entry) setManaged(entry)
    else setUploadMonth(requested)
    onInitialMonthHandled?.()
  }, [initialMonth, requested, coverage.data, year, onInitialMonthHandled])

  return (
    <section aria-labelledby="coverage-title" className={ui.card}>
      <div className={ui.pageHeader}>
        <h2 id="coverage-title">월별 등록 현황</h2>
        <div className={ui.row}>
          <button type="button" className={ui.button} aria-label="이전 연도" onClick={() => { setNotice(null); setYear(year - 1) }}><Icon name="chevron-left" size={18} /></button>
          <span className={styles.year}>{year}년</span>
          <button type="button" className={ui.button} aria-label="다음 연도" onClick={() => { setNotice(null); setYear(year + 1) }}><Icon name="chevron-right" size={18} /></button>
        </div>
      </div>
      <p className={ui.muted}>거래 일자 기준 · 미등록 월을 누르면 업로드합니다</p>
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
    </section>
  )
}
