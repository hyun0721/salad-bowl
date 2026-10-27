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
  const empty = summary && summary.income === 0 && summary.expense === 0
  return (
    <>
      {summary && <>
      <div className={styles.totals}>
        <section aria-labelledby="income-title" className={ui.card}>
          <h2 id="income-title" className={styles.totalLabel}>수입</h2>
          <p className={styles.totalValue}>{formatWon(summary.income)}</p>
        </section>
        <section aria-labelledby="expense-title" className={ui.card}>
          <h2 id="expense-title" className={styles.totalLabel}>지출</h2>
          <p className={styles.totalValue}>{formatWon(summary.expense)}</p>
        </section>
      </div>
      {empty && <p className={ui.status}>이 달에 합칠 거래가 없습니다.</p>}
      <div className={styles.columns}>
        <CategoryBreakdown key={`${groupId}:${month}`} groupId={groupId} month={month} summary={summary} />
        <section aria-labelledby="member-title" className={ui.card}>
          <h2 id="member-title">멤버별</h2>
          {summary.byMember.length === 0 ? <p className={ui.status}>공개한 멤버가 없습니다.</p> : (
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">멤버</th><th scope="col">수입</th><th scope="col">지출</th></tr>
              </thead>
              <tbody>
                {summary.byMember.map((m) => (
                  <tr key={m.userId}>
                    <th scope="row">{m.nickname}</th>
                    <td>{formatWon(m.income)}</td>
                    <td>{formatWon(m.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      </>}
      <CategoryTrend groupId={groupId} month={month} />
    </>
  )
}
