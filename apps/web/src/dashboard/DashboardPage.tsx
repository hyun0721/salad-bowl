import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router'
import MonthPicker from '../common/MonthPicker'
import ui from '../common/ui.module.css'
import { defaultYearMonth, formatMonthLabel, formatWon, isYearMonth } from '../common/format'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import NoGroupNotice from '../groups/NoGroupNotice'
import styles from './DashboardPage.module.css'
import CategoryBreakdown from './CategoryBreakdown'
import CategoryTrend from './CategoryTrend'
import SubcategoryTrends from './SubcategoryTrends'
import { dashboardApi, type MonthlySummary } from './dashboardApi'
import { dashboardRedirect, dashboardTitle, type Level, type View } from './dashboardRoute'
import DashboardMenu from './DashboardMenu'
import MemberTotalsDialog, { type TotalKind } from './MemberTotalsDialog'

type Props = { today?: Date }

export default function DashboardPage({ today }: Props) {
  const params = useParams()
  const [search, setSearch] = useSearchParams()
  const { search: rawSearch } = useLocation()
  const narrow = useMediaQuery(NARROW)
  const redirect = dashboardRedirect(params.level, params.view, narrow)
  const level = (params.level ?? 'major') as Level
  const view = (params.view ?? 'share') as View
  const requested = search.get('month')
  const [fallbackMonth] = useState(() => defaultYearMonth(today ?? new Date()))
  const month = isYearMonth(requested) ? requested : fallbackMonth
  usePageTitle(dashboardTitle(level, view, narrow))
  const { groups, selectedGroupId, isLoading, isError, retry } = useGroups()
  const summary = useQuery({
    queryKey: ['summary', selectedGroupId, month],
    queryFn: () => dashboardApi.summary(selectedGroupId!, month),
    enabled: selectedGroupId !== null,
  })
  const groupName = groups.find((g) => g.groupId === selectedGroupId)?.name

  if (redirect) return <Navigate to={redirect + rawSearch} replace />

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
        <MonthPicker month={month} onChange={(m) => setSearch((p) => { p.set('month', m); return p }, { replace: true })} />
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
      <SummaryView key={selectedGroupId} groupId={selectedGroupId} month={month} summary={summary.data}
        level={level} view={params.view as View | undefined} narrow={narrow} />
    </>
  )
}

function SummaryView({ groupId, month, summary, level, view, narrow }: {
  groupId: number; month: string; summary?: MonthlySummary; level: Level; view?: View; narrow: boolean
}) {
  const [kind, setKind] = useState<TotalKind | null>(null)
  const empty = summary && summary.income === 0 && summary.expense === 0
  const hasSummary = summary !== undefined
  const shownView = view ?? 'share'
  const scrolledWithSummary = useRef<string | null>(null)
  useEffect(() => {
    if (narrow || !view) return
    const key = `${level}/${view}`
    if (scrolledWithSummary.current === key) return
    document.getElementById(`dashboard-${view}`)?.scrollIntoView?.({ block: 'start' })
    if (hasSummary) scrolledWithSummary.current = key
  }, [narrow, view, level, hasSummary])
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
      <MemberTotalsDialog kind={kind} summary={summary} onClose={() => setKind(null)} />
      </>}
      {narrow && <DashboardMenu level={level} view={view ?? 'share'} />}
      {level === 'minor' ? (
        // shortcut: 16d 전까지 소분류는 main의 카드를 그대로 보여준다. 16d에서 소분류 분포·추이로 바꾼다.
        <SubcategoryTrends groupId={groupId} month={month} />
      ) : (
        <>
          <div id="dashboard-share" hidden={narrow && shownView !== 'share'}>
            {summary && <CategoryBreakdown key={`${groupId}:${month}`} groupId={groupId} month={month} summary={summary} />}
          </div>
          <div id="dashboard-trend" hidden={narrow && shownView !== 'trend'}>
            <CategoryTrend groupId={groupId} month={month} />
          </div>
        </>
      )}
    </>
  )
}
