import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import Icon from '../../common/Icon'
import Skeleton, { SkeletonRegion } from '../../common/Skeleton'
import ui from '../../common/ui.module.css'
import { usePageTitle } from '../../common/usePageTitle'
import TaxHeader from '../TaxHeader'
import { useTaxYear } from '../TaxYearProvider'
import { taxApi, taxKeys, useTaxYearView, type TaxYearView } from '../taxApi'
import BasicInfoDialog from './BasicInfoDialog'
import DeleteYearDialog from './DeleteYearDialog'
import styles from './inputs.module.css'

/** 소득공제 › 입력자료. 선택 연도의 기록 하나를 보여 주고 고친다. 그룹과 무관하다(useGroups를 쓰지 않는다). */
export default function TaxInputsPage() {
  usePageTitle('입력자료 · 소득공제')
  const { year } = useTaxYear()
  const record = useTaxYearView(year)
  const view = record.data
  // 기록이 없을 때만 만들 때 기억될 현재 적용 세법을 읽는다. 기록이 있으면 기록이 기억한 버전을 쓴다(TAX-66).
  const law = useQuery({ queryKey: taxKeys.currentLaw(year), queryFn: () => taxApi.currentLaw(year), enabled: view === null })
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const lawPending = view ? view.lawVersion === null : view === null && law.data === null
  const childTiersApply = (view ? view.lawVersion?.childTiersApply : law.data?.childTiersApply) ?? false

  return (
    <div className={styles.page}>
      <TaxHeader />
      {record.isPending && (
        <SkeletonRegion label="입력자료 불러오는 중"><Skeleton height={160} radius="var(--radius-md)" /></SkeletonRegion>
      )}
      {record.isError && (
        <div className={styles.split}>
          <p role="alert" className={ui.alert}>입력자료를 불러오지 못했습니다.</p>
          <button type="button" className={ui.button} onClick={() => void record.refetch()}><Icon name="refresh-cw" size={18} />다시 시도</button>
        </div>
      )}
      {lawPending && <p className={ui.status}>{year}년 귀속 세법은 준비 중입니다. 자료는 저장되며, 분석은 세법이 등록된 뒤 볼 수 있습니다.</p>}
      {view === null && (
        <section aria-labelledby="tax-empty-title" className={`${ui.card} ${styles.empty}`}>
          <h2 id="tax-empty-title">{year}년 귀속 기록이 없습니다</h2>
          <p>기본정보(예상 총급여·근로기간)를 입력하면 이 연도의 기록이 만들어집니다.</p>
          <button type="button" className={`${ui.button} ${ui.primary}`} disabled={law.isPending} onClick={() => setEditing(true)}>기본정보 입력</button>
        </section>
      )}
      {view && (
        <>
          <BasicInfoCard view={view} onEdit={() => setEditing(true)} />
          <section aria-label="연도 기록 삭제" className={`${ui.card} ${styles.split}`}>
            <p>이 연도의 기본정보·입력자료·금액·지출계획을 모두 지웁니다.</p>
            <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setDeleting(true)}>{year}년 기록 삭제</button>
          </section>
        </>
      )}
      {editing && view !== undefined && (
        <BasicInfoDialog year={year} view={view} childTiersApply={childTiersApply} onClose={() => setEditing(false)} />
      )}
      {deleting && view && <DeleteYearDialog view={view} onClose={() => setDeleting(false)} />}
    </div>
  )
}

function BasicInfoCard({ view, onEdit }: { view: TaxYearView; onEdit: () => void }) {
  const income = useAmountFormatter('income')
  const fullYear = view.workStartMonth === 1 && view.workEndMonth === 12
  return (
    <section aria-labelledby="tax-basic-title" className={ui.card}>
      <div className={styles.split}>
        <h2 id="tax-basic-title">기본정보</h2>
        <button type="button" className={ui.button} aria-label="기본정보 수정" onClick={onEdit}>수정</button>
      </div>
      <dl className={styles.facts}>
        <dt>예상 총급여</dt>
        <dd className={styles.amount}>{income(view.totalSalary)}</dd>
        <dt>근로기간</dt>
        <dd>{view.workStartMonth}월 ~ {view.workEndMonth}월{!fullYear && <span className={styles.note}>근로기간 확인 필요</span>}</dd>
        {view.lawVersion?.childTiersApply && <><dt>자녀등 수</dt><dd>{view.childCount}명</dd></>}
      </dl>
    </section>
  )
}
