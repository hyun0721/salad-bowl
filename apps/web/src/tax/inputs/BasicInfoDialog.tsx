import { useId, useState, type FormEvent } from 'react'
import { FieldError, Input, NumberField } from 'react-aria-components'
import Dialog from '../../common/Dialog'
import fields from '../../common/Field.module.css'
import HelpButton from '../../common/HelpButton'
import MoneyField from '../../common/MoneyField'
import Select from '../../common/Select'
import ui from '../../common/ui.module.css'
import { taxApi, useTaxSave, type BasicInfoInput, type TaxYearView } from '../taxApi'
import SaveError from './SaveError'
import styles from './inputs.module.css'

type Props = { year: number; view: TaxYearView | null; childTiersApply: boolean; onClose: () => void }

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, label: `${i + 1}월` }))

/** 기본정보 만들기·수정. view가 null이면 이 연도 기록을 새로 만든다(rowVersion 없이 PUT). */
export default function BasicInfoDialog({ year, view, childTiersApply, onClose }: Props) {
  const formId = useId()
  // 연 시점의 값과 버전으로 저장한다. 그 사이 다른 곳에서 바뀌면 서버가 409로 막는다.
  const [salary, setSalary] = useState<number | null>(view?.totalSalary ?? null)
  const [start, setStart] = useState(view?.workStartMonth ?? 1)
  const [end, setEnd] = useState(view?.workEndMonth ?? 12)
  const [childCount, setChildCount] = useState(view?.childCount ?? 0)
  const [rowVersion] = useState(view?.rowVersion)
  const save = useTaxSave((body: BasicInfoInput) => taxApi.saveBasicInfo(year, body))
  const childLabel = useId()
  const monthError = start > end

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (salary == null || monthError) return
    const body: BasicInfoInput = { totalSalary: salary, workStartMonth: start, workEndMonth: end, childCount }
    save.mutate(rowVersion === undefined ? body : { ...body, rowVersion }, { onSuccess: onClose })
  }

  return (
    <Dialog title={`${year}년 귀속 기본정보`} onClose={onClose} closeDisabled={save.isPending} centered footer={
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={save.isPending} onClick={onClose}>취소</button>
          <button type="submit" form={formId} className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={save.isPending || monthError}>저장</button>
        </div>
      }>
      <form id={formId} className={ui.stack} onSubmit={onSubmit}>
        <SaveError error={save.error} year={year} onReload={onClose} />
        <div className={ui.stack}>
          <MoneyField label="예상 총급여" value={salary} onChange={setSalary} isRequired minValue={1} />
          <p className={ui.muted}>비과세 소득을 뺀 연간 총급여</p>
        </div>
        <fieldset className={styles.months}>
          <legend>근로기간</legend>
          <Select label="시작월" variant="field" items={MONTHS} selectedKey={start}
            onSelectionChange={(key) => { if (key != null) setStart(Number(key)) }} />
          <Select label="종료월" variant="field" items={MONTHS} selectedKey={end}
            onSelectionChange={(key) => { if (key != null) setEnd(Number(key)) }} />
        </fieldset>
        {monthError && <p role="alert" className={styles.fieldError}>시작월이 종료월보다 늦어요.</p>}
        <p className={ui.muted}>중도 입사·퇴사한 해는 근로기간에 쓴 금액만 입력하세요.</p>
        {childTiersApply && (
          <div className={fields.field}>
            <div className={styles.labelRow}>
              <span id={childLabel} className={fields.label}>자녀등 수</span>
              <HelpButton title="자녀등 수">
                직계비속 가운데 ① 소득금액 100만원 이하(근로소득만 있으면 총급여 500만원 이하) ② 20세 이하(장애인은 나이와 관계없음) ③ 다른 사람의 기본공제를 받지 않는 사람의 수예요.
              </HelpButton>
            </div>
            <NumberField aria-labelledby={childLabel} value={childCount} minValue={0} maxValue={99}
              onChange={(v) => setChildCount(Number.isNaN(v) ? 0 : v)} formatOptions={{ maximumFractionDigits: 0 }}
              validationBehavior="native" isWheelDisabled className={fields.field}>
              <Input className={fields.input} />
              <FieldError className={fields.error} />
            </NumberField>
          </div>
        )}
      </form>
    </Dialog>
  )
}
