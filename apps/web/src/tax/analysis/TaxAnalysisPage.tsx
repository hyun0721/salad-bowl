import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAmountFormatter } from '../../common/AmountMask'
import Icon from '../../common/Icon'
import Skeleton, { SkeletonRegion } from '../../common/Skeleton'
import ui from '../../common/ui.module.css'
import { usePageTitle } from '../../common/usePageTitle'
import inputs from '../inputs/inputs.module.css'
import TaxHeader from '../TaxHeader'
import TaxTabs from '../TaxTabs'
import { useTaxYear } from '../TaxYearProvider'
import { actionError, isStale, taxApi, taxKeys, useTaxAnalysis, useTaxSave, useTaxYearView, type TaxAnalysisView, type TaxYearView } from '../taxApi'
import { asOfText, seoulDate } from './format'
import PlanStep, { usePlanEditor } from './PlanStep'
import RecommendStep from './RecommendStep'
import StatusStep from './StatusStep'
import StepTabs, { type Step } from './StepTabs'
import styles from './analysis.module.css'

/**
 * 소득공제 › 분석·지출계획. 서버가 계산한 분석(GET …/analysis)을 그리고, ②에서 지출계획을 저장한다.
 * 지출계획 값과 rowVersion은 연도 기록(TaxYearView)에서 읽는다. 그룹과 무관하다(useGroups를 쓰지 않는다).
 */
export default function TaxAnalysisPage() {
  usePageTitle('분석·지출계획 · 소득공제')
  const { year } = useTaxYear()
  const analysis = useTaxAnalysis(year)
  const record = useTaxYearView(year)
  const [step, setStep] = useState<Step>('status')
  const result = analysis.data
  const view = record.data
  const plan = usePlanEditor(year, view, () => setStep('recommend'))

  return (
    <div className={`${inputs.page} ${styles.page}`}>
      <TaxHeader />
      <TaxTabs />
      {analysis.isError || record.isError ? (
        <div className={inputs.split}>
          <p role="alert" className={ui.alert}>분석을 불러오지 못했습니다.</p>
          <div className={inputs.actions}>
            <button type="button" className={ui.button} onClick={() => { void analysis.refetch(); void record.refetch() }}>
              <Icon name="refresh-cw" size={18} />다시 시도
            </button>
          </div>
        </div>
      ) : result === undefined || view === undefined ? (
        <SkeletonRegion label="분석 불러오는 중"><Skeleton height={160} radius="var(--radius-md)" /></SkeletonRegion>
      ) : result === null || view === null ? (
        <NoRecord year={year} />
      ) : (
        <>
          <Notices analysis={result} view={view} />
          <StepTabs step={step} onStepChange={setStep}>
            {(id) => (id === 'status' ? <StatusStep analysis={result} />
              : id === 'plan' ? <PlanStep editor={plan} ready={result.status === 'READY'} />
                : <RecommendStep analysis={result} onPlan={() => setStep('plan')} />)}
          </StepTabs>
        </>
      )}
    </div>
  )
}

/** 단계 위 공통: 적용 세법·자료 기준일·예상 총급여 한 줄(TAX-36)과 상태 알림(새 세법 버전, 추정, 근로기간). */
function Notices({ analysis: a, view }: { analysis: TaxAnalysisView; view: TaxYearView }) {
  const income = useAmountFormatter('income')
  const law = a.law ? `${a.taxYear}년 귀속 v${a.law.versionNo} · 적용일 ${seoulDate(a.law.appliedAt)}` : `${a.taxYear}년 귀속 세법 준비 중`
  const asOf = asOfText(a.asOfDateMin, a.asOfDateMax)
  return (
    <>
      <p className={styles.facts}>{`적용 세법 ${law} · 자료 기준일 ${asOf} · 예상 총급여 ${income(a.totalSalary)}`}</p>
      {a.newerLawVersion && <NewerLaw year={a.taxYear} versionNo={a.law?.versionNo} />}
      {a.estimated && (
        <p className={styles.notice}>
          <span className={styles.badge}>추정</span> 자료의 기준일이 서로 다릅니다({asOf}). 서로 다른 시점의 누계를 더한 추정입니다.
        </p>
      )}
      {a.partialYear && (
        <p className={styles.notice}>
          <span className={styles.badge}>근로기간 확인 필요</span> 근로기간이 {view.workStartMonth}월~{view.workEndMonth}월입니다.
          근로기간에 쓴 금액만 입력했는지 확인하세요. 계산은 입력한 금액 그대로 합니다.
        </p>
      )}
    </>
  )
}

/** 새 세법 버전 알림(TAX-66). 누르기 전에는 연도 기록이 기억한 버전의 결과를 그대로 보인다(AC-19). */
function NewerLaw({ year, versionNo }: { year: number; versionNo: number | undefined }) {
  const client = useQueryClient()
  const refresh = useTaxSave(() => taxApi.refreshLawVersion(year))
  return (
    <>
      <div className={inputs.split}>
        <p className={styles.notice}>
          새 세법 버전이 적용됐습니다.{versionNo !== undefined && ` 지금 결과는 v${versionNo} 기준이며, 누르기 전에는 그대로입니다.`}
        </p>
        <div className={inputs.actions}>
          <button type="button" className={ui.button} disabled={refresh.isPending} onClick={() => refresh.mutate(undefined, {
            // 성공하면 다시 읽은 분석에 이 알림이 없어 사라진다. 연도 기록이 다른 곳에서 지워졌으면 새로 읽어 "기록 없음"을 보인다.
            onError: (error) => {
              if (!isStale(error)) return
              void client.invalidateQueries({ queryKey: taxKeys.year(year) })
              void client.invalidateQueries({ queryKey: taxKeys.analysis(year) })
            },
          })}>새 버전으로 다시 계산</button>
        </div>
      </div>
      {refresh.error && <p role="alert" className={ui.alert}>{actionError(refresh.error)}</p>}
    </>
  )
}

function NoRecord({ year }: { year: number }) {
  return (
    <section aria-labelledby="tax-analysis-empty-title" className={`${ui.card} ${inputs.empty}`}>
      <h2 id="tax-analysis-empty-title">{year}년 귀속 기록이 없습니다</h2>
      <p>분석과 지출계획은 연도 기록이 있어야 볼 수 있습니다. 입력자료에서 기본정보부터 입력하세요.</p>
      <Link to="/tax/inputs" className={`${ui.button} ${ui.primary} ${ui.linkButton}`}>입력자료로 가기</Link>
    </section>
  )
}
