import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import MonthPicker from '../common/MonthPicker'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatMonthLabel, formatWon } from '../common/format'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import NoGroupNotice from '../groups/NoGroupNotice'
import styles from './DashboardPage.module.css'
import CategoryBreakdown from './CategoryBreakdown'
import CategoryTrend from './CategoryTrend'
import { dashboardApi, type MonthlySummary } from './dashboardApi'
import MemberTotalsDialog, { type TotalKind } from './MemberTotalsDialog'

type Props = { today?: Date }

export default function DashboardPage({ today }: Props) {
  usePageTitle('그룹 대시보드')
  const { groups, selectedGroupId, isLoading, isError, retry } = useGroups()
  const [month, setMonth] = useState(() => defaultYearMonth(today ?? new Date()))
  const summary = useQuery({
    queryKey: ['summary', selectedGroupId, month],
    queryFn: () => dashboardApi.summary(selectedGroupId!, month),
    enabled: selectedGroupId !== null,
  })
  const groupName = groups.find((g) => g.groupId === selectedGroupId)?.name

  if (isLoading || isError || selectedGroupId === null) {
    return (
      <>
        <h1>그룹 대시보드</h1>
        {isLoading && <p className={ui.status}>불러오는 중입니다.</p>}
        {isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>그룹을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={retry}>그룹 목록 다시 시도</button>
          </div>
        )}
        {!isLoading && !isError && <NoGroupNotice />}
      </>
    )
  }

  return (
    <>
      <div className={ui.pageHeader}>
        <h1>그룹 대시보드</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <p className={ui.muted}>
        {groupName} · {formatMonthLabel(month)} · 공개를 켠 멤버의 원화 거래를 합칩니다(이체·숨긴 거래 제외).
      </p>
      {summary.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {summary.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>요약을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void summary.refetch()}>다시 시도</button>
        </div>
      )}
      <SummaryView key={selectedGroupId} groupId={selectedGroupId} month={month} summary={summary.data} />
    </>
  )
}

function SummaryView({ groupId, month, summary }: { groupId: number; month: string; summary?: MonthlySummary }) {
  const [kind, setKind] = useState<TotalKind | null>(null)
  const empty = summary && summary.income === 0 && summary.expense === 0
  return (
    <>
      {summary && <>
      <div className={styles.totals}>
        {([['income', '수입'], ['expense', '지출']] as const).map(([k, label]) => (
          <button key={k} type="button" aria-haspopup="dialog" aria-label={`${label} ${formatWon(summary[k])}`}
            className={`${ui.card} ${styles.total}`} onClick={() => setKind(k)}>
            <span className={styles.totalLabel}>{label}</span>
            <span className={styles.totalValue}>{formatWon(summary[k])}</span>
          </button>
        ))}
      </div>
      {empty && <p className={ui.status}>이 달에 합칠 거래가 없습니다.</p>}
      <CategoryBreakdown key={`${groupId}:${month}`} groupId={groupId} month={month} summary={summary} />
      <MemberTotalsDialog kind={kind} summary={summary} onClose={() => setKind(null)} />
      </>}
      <CategoryTrend groupId={groupId} month={month} />
    </>
  )
}
