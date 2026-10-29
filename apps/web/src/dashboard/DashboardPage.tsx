import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router'
import MonthPicker from '../common/MonthPicker'
import ui from '../common/ui.module.css'
import { defaultYearMonth, isYearMonth } from '../common/format'
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
  const redirect = dashboardRedirect(params.level, params.view)
  const level = (params.level ?? 'major') as Level
  const requested = search.get('month')
  const [fallbackMonth] = useState(() => defaultYearMonth(today ?? new Date()))
  const month = level === 'major' && isYearMonth(requested) ? requested : fallbackMonth
  usePageTitle(dashboardTitle(level))
  const { selectedGroupId, isLoading, isError, retry } = useGroups()
  const summary = useQuery({
    queryKey: ['summary', selectedGroupId, month],
    queryFn: () => dashboardApi.summary(selectedGroupId!, month),
    enabled: selectedGroupId !== null,
  })

  if (redirect) return <Navigate to={redirect + rawSearch} replace />

  if (isLoading || isError || selectedGroupId === null) {
    return (
      <>
        <h1 className={styles.visuallyHidden}>그룹 대시보드</h1>
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
      <h1 className={styles.visuallyHidden}>그룹 대시보드</h1>
      {narrow && <DashboardMenu level={level} />}
      {level === 'major' && (
        <MonthPicker month={month} onChange={(m) => setSearch((p) => { p.set('month', m); return p }, { replace: true })} />
      )}
      {summary.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
      {summary.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>요약을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void summary.refetch()}>다시 시도</button>
        </div>
      )}
      <SummaryView key={selectedGroupId} groupId={selectedGroupId} month={month} summary={summary.data}
        level={level} view={params.view as View | undefined} major={search.get('major') ?? undefined} />
    </>
  )
}

function SummaryView({ groupId, month, summary, level, view, major }: {
  groupId: number; month: string; summary?: MonthlySummary; level: Level; view?: View; major?: string
}) {
  const [kind, setKind] = useState<TotalKind | null>(null)
  const empty = summary && summary.income === 0 && summary.expense === 0
  const hasSummary = summary !== undefined
  const scrolledWithSummary = useRef<string | null>(null)
  useEffect(() => {
    if (!view) return
    const key = `${level}/${view}`
    if (scrolledWithSummary.current === key) return
    // shortcut: 소분류 임시 카드는 분포·추이가 한 카드라 대상이 없다. 16d에서 카드를 나눌 때 같은 id를 붙인다.
    const target = document.getElementById(`dashboard-${view}`)
    if (!target) return
    target.scrollIntoView?.({ block: 'start' })
    if (hasSummary) scrolledWithSummary.current = key
  }, [view, level, hasSummary])
  return (
    <>
      {summary && <>
      <div className={styles.totals}>
        {([['income', '수입'], ['expense', '지출']] as const).map(([k, label]) => (
          <button key={k} type="button" aria-haspopup="dialog" aria-label={`${label} ${summary[k].toLocaleString('ko-KR')}원`}
            className={`${ui.card} ${styles.total}`} onClick={() => setKind(k)}>
            <span className={styles.totalLabel}>{label}</span>
            <span className={`${styles.totalValue} ${styles[k]}`}>{summary[k].toLocaleString('ko-KR')} <span className={styles.totalUnit}>(원)</span></span>
          </button>
        ))}
      </div>
      {empty && <p className={ui.status}>이 달에 합칠 거래가 없습니다.</p>}
      <MemberTotalsDialog kind={kind} summary={summary} onClose={() => setKind(null)} />
      </>}
      {level === 'minor' ? (
        // shortcut: 16d 전까지 소분류는 main의 카드를 그대로 보여준다. 16d에서 소분류 분포·추이로 바꾼다.
        <SubcategoryTrends groupId={groupId} month={month} initialMajor={major} />
      ) : (
        <>
          <div id="dashboard-share">
            {summary && <CategoryBreakdown key={`${groupId}:${month}`} groupId={groupId} month={month} summary={summary} />}
          </div>
          <div id="dashboard-trend">
            <CategoryTrend groupId={groupId} month={month} />
          </div>
        </>
      )}
    </>
  )
}
