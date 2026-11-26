import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import { errorMessage } from '../../common/errorMessage'
import MoneyField from '../../common/MoneyField'
import { toast } from '../../common/Toast'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import { isStale, taxApi, taxKeys, useTaxSave, type PlanInput, type PlanRow, type PlanView, type TaxYearView } from '../taxApi'
import styles from './analysis.module.css'

const ROWS = [['general', '일반'], ['market', '전통시장'], ['transit', '대중교통'], ['culture', '문화체육']] as const
const FIELDS = [['creditFixed', '신용카드 고정'], ['debitFixed', '체크카드·현금영수증 고정'], ['flexible', '바꿀 수 있음']] as const
type Row = (typeof ROWS)[number][0]
type Field = (typeof FIELDS)[number][0]
/** 입력 중인 지출계획. 비운 칸은 null로 두고 저장할 때 0으로 채운다. */
type PlanForm = Record<Row, Record<Field, number | null>>

function toForm(plan: PlanView | null): PlanForm {
  const row = (key: Row) => (plan ? { ...plan[key] } : { creditFixed: 0, debitFixed: 0, flexible: 0 })
  return { general: row('general'), market: row('market'), transit: row('transit'), culture: row('culture') }
}

const sum = (values: (number | null)[]) => values.reduce<number>((n, v) => n + (v ?? 0), 0)

/**
 * ② 지출계획의 입력 상태(TAX-51·70). 화면(TaxAnalysisPage)이 들고 있어 단계를 옮겨도 입력이 남는다.
 * 처음 고친 시점의 rowVersion을 잡아 두고 저장하므로, 그 사이 다른 곳에서 저장했으면 서버가 409로 막는다(TAX-29).
 * [계산하기]를 누를 때만 저장하고, 저장 응답과 다시 읽은 분석을 받은 뒤 onSaved를 부른다.
 */
// oxlint-disable-next-line react/only-export-components
export function usePlanEditor(year: number, view: TaxYearView | null | undefined, onSaved: () => void) {
  const client = useQueryClient()
  const currentYear = useRef(year)
  useEffect(() => { currentYear.current = year }, [year])
  const [edit, setEdit] = useState<{ year: number; values: PlanForm; rowVersion: number | undefined } | null>(null)
  const [failedYear, setFailedYear] = useState<number | null>(null)
  const save = useTaxSave((body: PlanInput) => taxApi.savePlan(year, body))
  const mine = edit?.year === year ? edit : null
  const saved = toForm(view?.plan ?? null)
  const values = mine?.values ?? saved
  const rowVersion = mine ? mine.rowVersion : view?.plan?.rowVersion
  return {
    values,
    dirty: mine !== null && JSON.stringify(mine.values) !== JSON.stringify(saved),
    saving: save.isPending,
    error: failedYear === year ? save.error : null,
    change: (next: PlanForm) => setEdit({ year, values: next, rowVersion }),
    submit: () => {
      const requestYear = year
      setFailedYear(year)
      const row = (key: Row): PlanRow => ({
        creditFixed: values[key].creditFixed ?? 0,
        debitFixed: values[key].debitFixed ?? 0,
        flexible: values[key].flexible ?? 0,
      })
      save.mutate({ general: row('general'), market: row('market'), transit: row('transit'), culture: row('culture'), rowVersion }, {
        onSuccess: () => {
          setEdit((e) => (e?.year === requestYear ? null : e))
          if (currentYear.current !== requestYear) return
          toast('지출계획을 저장했어요.')
          onSaved()
        },
      })
    },
    /** 409·404 뒤: 연도 기록과 분석을 새로 읽은 뒤 입력을 버리고 새 값을 보인다. */
    reload: () => void Promise.all([
      client.invalidateQueries({ queryKey: taxKeys.year(year) }),
      client.invalidateQueries({ queryKey: taxKeys.analysis(year) }),
    ]).then(() => {
      if (client.getQueryState(taxKeys.year(year))?.status === 'error' || client.getQueryState(taxKeys.analysis(year))?.status === 'error') return
      setEdit(null)
      save.reset()
    }),
  }
}

type Props = { editor: ReturnType<typeof usePlanEditor>; ready: boolean }

/** ② 지출계획(TAX-51·70·75). 미완료·세법 준비 중에도 입력은 열려 있고 [계산하기]는 저장만 한다. */
export default function PlanStep({ editor, ready }: Props) {
  const won = useAmountFormatter('expense')
  const { values, error } = editor
  const column = (field: Field) => sum(ROWS.map(([row]) => values[row][field]))
  return (
    <section aria-labelledby="tax-plan-title" className={ui.card}>
      <h2 id="tax-plan-title">남은 기간 지출계획</h2>
      <p className={ui.muted}>
        기준일 다음 날부터 12월 31일까지 쓸 공제대상액을 소비구분별로 적으세요. 결제수단이 정해진 금액과 바꿀 수 있는 금액을 나눠 적고,
        공제 대상이 아닌 지출(보험료·공과금 등)은 적지 마세요.
      </p>
      <p className={ui.muted}>비운 칸은 0원으로 저장돼요.</p>
      <form className={ui.stack} onSubmit={(event) => { event.preventDefault(); editor.submit() }}>
        {ROWS.map(([row, label]) => (
          <fieldset key={row} className={styles.planGroup}>
            <legend>{label}</legend>
            {FIELDS.map(([field, fieldLabel]) => (
              <MoneyField key={field} label={fieldLabel} value={values[row][field]} minValue={0}
                onChange={(value) => editor.change({ ...values, [row]: { ...values[row], [field]: value } })} />
            ))}
            <p className={styles.planSum}>합계 {won(sum(FIELDS.map(([field]) => values[row][field])))}</p>
          </fieldset>
        ))}
        <p className={styles.planTotal}>
          총액 {won(sum(FIELDS.map(([field]) => column(field))))} (신용카드 고정 {won(column('creditFixed'))} · 체크카드·현금영수증 고정 {won(column('debitFixed'))} · 바꿀 수 있음 {won(column('flexible'))})
        </p>
        {editor.dirty && <p className={ui.status}>저장하지 않은 변경이 있어요. ③ 추천은 마지막으로 저장한 계획 기준이에요.</p>}
        {error && (isStale(error) ? (
          <div className={inputs.split}>
            <p role="alert" className={ui.alert}>다른 곳에서 수정되거나 삭제됐어요. 저장하지 않았어요.</p>
            <div className={inputs.actions}><button type="button" className={ui.button} onClick={editor.reload}>다시 불러오기</button></div>
          </div>
        ) : <p role="alert" className={ui.alert}>{errorMessage(error)} 입력한 값은 그대로 있어요.</p>)}
        <div className={inputs.split}>
          <p className={ui.muted}>
            {ready ? '[계산하기]를 누르면 지출계획을 저장하고 추천을 다시 계산해요. 입력하는 동안에는 다시 계산하지 않아요.'
              : '자료가 완료되지 않았거나 세법이 준비 중이라 [계산하기]는 지출계획을 저장만 해요.'}
          </p>
          <div className={inputs.actions}>
            <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={editor.saving}>계산하기</button>
          </div>
        </div>
      </form>
    </section>
  )
}
