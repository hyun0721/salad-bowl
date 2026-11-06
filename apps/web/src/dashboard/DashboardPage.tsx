import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router'
import { menuLabel } from '../app/menu'
import MonthPicker from '../common/MonthPicker'
import PageHeader from '../common/PageHeader'
import { SkeletonRegion } from '../common/Skeleton'
import TotalsCards, { TotalsCardsSkeleton, type TotalKind } from '../common/TotalsCards'
import ui from '../common/ui.module.css'
import { defaultYearMonth, isYearMonth } from '../common/format'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import { usePageTitle } from '../common/usePageTitle'
import { useGroups } from '../groups/GroupProvider'
import NoGroupNotice from '../groups/NoGroupNotice'
import CategoryBreakdown from './CategoryBreakdown'
import { CategoryShareSkeleton } from './ChartSkeletons'
import CategoryTrend from './CategoryTrend'
import SubcategoryTrends from './SubcategoryTrends'
import { dashboardApi, type MonthlySummary } from './dashboardApi'
import { dashboardRedirect, dashboardTitle, type Level, type View } from './dashboardRoute'
import DashboardMenu from './DashboardMenu'
import MemberTotalsDialog from './MemberTotalsDialog'
import Icon from '../common/Icon'

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
  const month = isYearMonth(requested) ? requested : fallbackMonth
  const [kind, setKind] = useState<TotalKind | null>(null)
  usePageTitle(dashboardTitle(level))
  const { selectedGroupId, isLoading, isError, retry } = useGroups()
  const summary = useQuery({
    queryKey: ['summary', selectedGroupId, month],
    queryFn: () => dashboardApi.summary(selectedGroupId!, month),
    enabled: selectedGroupId !== null,
    placeholderData: (prev, prevQuery) => prevQuery?.queryKey[1] === selectedGroupId ? prev : undefined,
  })

  if (redirect) return <Navigate to={redirect + rawSearch} replace />

  if (isLoading || isError || selectedGroupId === null) {
    return (
      <>
        <PageHeader title={menuLabel('/dashboard')} />
        {isLoading && <SkeletonRegion><TotalsCardsSkeleton /></SkeletonRegion>}
        {isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>그룹을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={retry}><Icon name="refresh-cw" size={18} />그룹 목록 다시 시도</button>
          </div>
        )}
        {!isLoading && !isError && <NoGroupNotice />}
      </>
    )
  }

  return (
    <>
      <PageHeader title={menuLabel('/dashboard')} />
      <MonthPicker month={month} onChange={(m) => setSearch((p) => { p.set('month', m); return p }, { replace: true })} />
      {summary.isPending && <SkeletonRegion><TotalsCardsSkeleton /></SkeletonRegion>}
      {summary.isError && (
        <div className={ui.row}>
          <p role="alert" className={ui.alert}>요약을 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void summary.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
        </div>
      )}
      {summary.data && <>
        <TotalsCards income={summary.data.income} expense={summary.data.expense} onSelect={setKind} opensDialog />
        {summary.data.income === 0 && summary.data.expense === 0 && <p className={ui.status}>이 달에 합칠 거래가 없습니다.</p>}
        <MemberTotalsDialog kind={kind} summary={summary.data} onClose={() => setKind(null)} />
      </>}
      {narrow && <DashboardMenu level={level} />}
      <SummaryView key={selectedGroupId} groupId={selectedGroupId} month={month} summary={summary.data}
        summaryPending={summary.isPending} level={level} view={params.view as View | undefined} />
    </>
  )
}

function SummaryView({ groupId, month, summary, summaryPending, level, view }: {
  groupId: number; month: string; summary?: MonthlySummary; summaryPending: boolean; level: Level; view?: View
}) {
  const compact = useMediaQuery(NARROW)
  const hasSummary = summary !== undefined
  const scrolledWithSummary = useRef<string | null>(null)
  useEffect(() => {
    if (!view) return
    const key = `${level}/${view}`
    if (scrolledWithSummary.current === key) return
    const target = document.getElementById(`dashboard-${view}`)
    if (!target) return
    target.scrollIntoView?.({ block: 'start' })
    if (hasSummary) scrolledWithSummary.current = key
  }, [view, level, hasSummary])
  return (
    <>
      {level === 'minor' ? (
        <SubcategoryTrends groupId={groupId} month={month} members={summary?.byMember} />
      ) : (
        <>
          <div id="dashboard-share">
            {summaryPending && <SkeletonRegion label="대분류 분포를 불러오는 중입니다."><CategoryShareSkeleton compact={compact} /></SkeletonRegion>}
            {summary && <CategoryBreakdown key={`${groupId}:${month}`} groupId={groupId} month={month} summary={summary} />}
          </div>
          <CategoryTrend groupId={groupId} month={month} />
        </>
      )}
    </>
  )
}
