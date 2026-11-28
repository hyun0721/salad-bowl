import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { FieldError, Group, Input, Label, NumberField } from 'react-aria-components'
import DateTimePicker from '../../common/DateTimePicker'
import Dialog from '../../common/Dialog'
import { errorMessage } from '../../common/errorMessage'
import fields from '../../common/Field.module.css'
import MoneyField from '../../common/MoneyField'
import money from '../../common/MoneyField.module.css'
import TextField, { TextAreaField } from '../../common/TextField'
import { toast } from '../../common/Toast'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import { actionError, isStale, taxKeys } from '../taxApi'
import { LawDetailHeading } from './LawVersionFacts'
import { LAW_LABEL, taxLawApi, taxLawKeys, type LawFieldError, type LawValues, type LawVersion } from './taxLawApi'
import styles from './law.module.css'

type TextKey = 'basisLawName' | 'basisArticle' | 'basisUrl' | 'periodStart' | 'periodEnd' | 'memo'
/** 입력 중인 값. 글 칸은 빈 문자열, 숫자 칸은 null이 "비어 있음"이다. */
type LawForm = Omit<LawValues, TextKey> & Record<TextKey, string>
type Tiers = 'basicLimitLow' | 'basicLimitHigh'

function toForm(v: LawValues): LawForm {
  return {
    minSpendRatePct: v.minSpendRatePct, bracketBoundary: v.bracketBoundary,
    rateCreditPct: v.rateCreditPct, rateDebitCashPct: v.rateDebitCashPct, rateCulturePct: v.rateCulturePct,
    rateMarketPct: v.rateMarketPct, rateTransitPct: v.rateTransitPct,
    basicLimitLow: [...v.basicLimitLow], basicLimitHigh: [...v.basicLimitHigh], extraLimitLow: v.extraLimitLow, extraLimitHigh: v.extraLimitHigh,
    basisLawName: v.basisLawName ?? '', basisArticle: v.basisArticle ?? '', basisUrl: v.basisUrl ?? '',
    periodStart: v.periodStart ?? '', periodEnd: v.periodEnd ?? '', memo: v.memo ?? '',
  }
}

function toBody(f: LawForm): LawValues {
  const text = (value: string) => value.trim() || null
  return {
    ...f, basisLawName: text(f.basisLawName), basisArticle: text(f.basisArticle), basisUrl: text(f.basisUrl),
    periodStart: text(f.periodStart), periodEnd: text(f.periodEnd), memo: text(f.memo),
  }
}

/** 버전 하나를 목록 캐시에서 바꾼다. 다른 버전은 그대로 둔다. */
function putVersion(client: QueryClient, saved: LawVersion) {
  client.setQueryData<LawVersion[]>(taxLawKeys.list(saved.taxYear), (old) => old?.map((v) => (v.id === saved.id ? saved : v)))
}

/** 0~100 정수 퍼센트. 범위는 적용할 때 서버가 검사한다(TAX-64). 비우면 null. */
function PercentField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <NumberField value={value ?? Number.NaN} onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      formatOptions={{ maximumFractionDigits: 0 }} validationBehavior="native" isWheelDisabled className={fields.field}>
      <Label className={fields.label}>{label}</Label>
      <Group className={money.money}>
        {/* RAC가 iPhone에서 전체 키보드를 선택하므로 숫자패드로 덮어쓴다. */}
        <Input inputMode="numeric" className={`${fields.input} ${money.input}`} />
        <span className={money.unit} aria-hidden="true">%</span>
      </Group>
      <FieldError className={fields.error} />
    </NumberField>
  )
}

const RATES = [
  ['minSpendRatePct', '최저사용금액 비율'], ['rateCreditPct', '신용카드 공제율'], ['rateDebitCashPct', '체크카드·현금영수증 공제율'],
  ['rateCulturePct', '문화체육 공제율'], ['rateMarketPct', '전통시장 공제율'], ['rateTransitPct', '대중교통 공제율'],
] as const
const TIERS = ['자녀등 0명', '자녀등 1명', '자녀등 2명 이상']

type Props = { version: LawVersion; onReload: (showNotice?: boolean) => void; onApplied: () => void }

/**
 * 초안 편집(TAX-62~64). 연 시점(또는 마지막 저장)의 값과 rowVersion으로 저장하고, 다른 곳에서 바뀌었으면 서버가 409로 막는다.
 * 검증·적용은 저장된 값으로 하므로 저장하지 않은 변경이 있으면 끈다.
 */
export default function LawVersionForm({ version, onReload, onApplied }: Props) {
  const client = useQueryClient()
  const [base, setBase] = useState(version)
  const [values, setValues] = useState(() => toForm(version))
  const [checked, setChecked] = useState<LawFieldError[] | null>(null)
  const [applying, setApplying] = useState(false)
  const name = `${base.taxYear}년 귀속 v${base.versionNo}`
  const dirty = JSON.stringify(toBody(values)) !== JSON.stringify(toBody(toForm(base)))
  const save = useMutation({
    mutationFn: () => taxLawApi.update(base.id, { ...toBody(values), rowVersion: base.rowVersion }),
    onSuccess: (saved) => {
      putVersion(client, saved)
      setBase(saved)
      setValues(toForm(saved))
      toast(`${name} 초안을 저장했어요.`)
    },
  })
  const validate = useMutation({
    mutationFn: () => taxLawApi.validate(base.id),
    onSuccess: (result) => setChecked(result.errors),
    onError: (error) => { if (isStale(error)) onReload(true) },
  })
  const busy = save.isPending || validate.isPending

  function change(next: Partial<LawForm>) {
    setValues((current) => ({ ...current, ...next }))
    setChecked(null)
  }
  const tier = (key: Tiers, i: number) => (value: number | null) => change({ [key]: values[key].map((v, j) => (j === i ? value : v)) })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <section aria-labelledby="law-detail-title" className={ui.card}>
      <LawDetailHeading version={base} />
      <form className={ui.stack} onSubmit={onSubmit}>
        <fieldset className={styles.fields}>
          <legend>비율 (%)</legend>
          {RATES.map(([key, label]) => <PercentField key={key} label={label} value={values[key]} onChange={(v) => change({ [key]: v })} />)}
        </fieldset>
        <fieldset className={styles.fields}>
          <legend>급여구간 (원)</legend>
          <MoneyField label="급여구간 경계 금액" value={values.bracketBoundary} minValue={0} onChange={(v) => change({ bracketBoundary: v })} />
        </fieldset>
        {(['basicLimitLow', 'basicLimitHigh'] as const).map((key) => (
          <fieldset key={key} className={styles.fields}>
            <legend>기본한도 · 경계 {key === 'basicLimitLow' ? '이하' : '초과'} (원)</legend>
            {TIERS.map((label, i) => <MoneyField key={label} label={label} value={values[key][i]} minValue={0} onChange={tier(key, i)} />)}
          </fieldset>
        ))}
        <fieldset className={styles.fields}>
          <legend>추가한도 상한 (원)</legend>
          <MoneyField label="경계 이하" value={values.extraLimitLow} minValue={0} onChange={(v) => change({ extraLimitLow: v })} />
          <MoneyField label="경계 초과" value={values.extraLimitHigh} minValue={0} onChange={(v) => change({ extraLimitHigh: v })} />
        </fieldset>
        <fieldset className={styles.basis}>
          <legend>근거·적용 대상 기간</legend>
          <TextField label="법령명" value={values.basisLawName} onChange={(v) => change({ basisLawName: v })} maxLength={200} />
          <TextField label="조문" value={values.basisArticle} onChange={(v) => change({ basisArticle: v })} maxLength={200} />
          <TextField label="근거 URL" value={values.basisUrl} onChange={(v) => change({ basisUrl: v })} maxLength={500} />
          <DateTimePicker label="적용 대상 기간 시작" granularity="day" value={values.periodStart} onChange={(v) => change({ periodStart: v })} />
          <DateTimePicker label="적용 대상 기간 끝" granularity="day" value={values.periodEnd} onChange={(v) => change({ periodEnd: v })} />
          <TextAreaField label="메모 (선택)" value={values.memo} onChange={(v) => change({ memo: v })} maxLength={1000} />
        </fieldset>
        {save.error && (isStale(save.error) ? (
          <div className={inputs.split}>
            <p role="alert" className={ui.alert}>다른 곳에서 수정·적용되거나 삭제됐어요. 저장하지 않았어요.</p>
            <div className={inputs.actions}><button type="button" className={ui.button} onClick={() => onReload()}>다시 불러오기</button></div>
          </div>
        ) : <p role="alert" className={ui.alert}>{errorMessage(save.error)} 입력한 값은 그대로 있어요.</p>)}
        {validate.error && <p role="alert" className={ui.alert}>{actionError(validate.error)}</p>}
        {checked && (checked.length === 0
          ? <p role="status" className={ui.status}>검증 통과 — 적용할 수 있어요.</p>
          : (
            <div role="alert" className={ui.alert}>
              <p>검증 실패 — 적용할 수 없어요.</p>
              <ul>{checked.map((e) => <li key={`${e.field}:${e.message}`}>{LAW_LABEL[e.field] ?? e.field}: {e.message}</li>)}</ul>
            </div>
          ))}
        <div className={inputs.split}>
          <p className={ui.muted}>{dirty ? '저장하지 않은 변경이 있어요. 초안을 저장한 뒤 검증·적용할 수 있어요.' : '검증과 적용은 저장한 값으로 해요.'}</p>
          <div className={inputs.actions}>
            <button type="submit" className={ui.button} disabled={busy}>초안 저장</button>
            <button type="button" className={ui.button} disabled={busy || dirty} onClick={() => validate.mutate()}>검증</button>
            <button type="button" className={`${ui.button} ${ui.primary}`} disabled={busy || dirty} onClick={() => setApplying(true)}>적용</button>
          </div>
        </div>
      </form>
      {applying && <ApplyDialog version={base} onClose={() => setApplying(false)} onReload={() => onReload(true)} onApplied={onApplied} />}
    </section>
  )
}

/** 적용 확인(TAX-61·72). 적용하면 상태가 바뀌어 이 화면은 읽기 전용 보기로 바뀐다. */
function ApplyDialog({ version, onClose, onReload, onApplied }: { version: LawVersion; onClose: () => void; onReload: () => void; onApplied: () => void }) {
  const client = useQueryClient()
  const year = version.taxYear
  const apply = useMutation({
    mutationFn: () => taxLawApi.apply(version.id, version.rowVersion),
    onSuccess: (applied) => {
      onClose()
      putVersion(client, applied)
      onApplied()
      // 이 연도의 회원용 현재 적용 세법과, 세법이 없던 내 연도 기록(적용 때 서버가 이 버전을 붙인다)을 다시 읽는다.
      void client.invalidateQueries({ queryKey: taxKeys.currentLaw(year) })
      void client.invalidateQueries({ queryKey: taxKeys.year(year) })
      toast(`${year}년 귀속 v${applied.versionNo} 적용을 마쳤어요.`)
    },
    onError: (error) => { if (isStale(error)) { onClose(); onReload() } },
  })
  const failure = apply.error && (isStale(apply.error)
    ? actionError(apply.error)
    : errorMessage(apply.error, { VALIDATION_FAILED: '검증을 통과하지 못해 적용하지 않았어요. [검증]으로 이유를 확인해 주세요.' }))
  return (
    <Dialog title={`${year}년 귀속 v${version.versionNo} 적용`} onClose={onClose} closeDisabled={apply.isPending} centered footer={
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={apply.isPending} onClick={onClose}>취소</button>
          <button type="button" className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={apply.isPending} onClick={() => apply.mutate()}>적용</button>
        </div>
      }>
      <p>적용하면 이 버전은 고치거나 삭제할 수 없어요. {year}년 귀속 연도 기록에는 "새 세법 버전 있음"이 표시되고, 회원이 직접 눌러야 새 버전으로 다시 계산돼요. 세법이 없던 기록은 바로 이 버전으로 계산돼요.</p>
      <p>다른 초안은 초안으로 남아요.</p>
      {failure && <p role="alert" className={ui.alert}>{failure}</p>}
    </Dialog>
  )
}
