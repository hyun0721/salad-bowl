import { useId, useState, type FormEvent } from 'react'
import DateTimePicker from '../../common/DateTimePicker'
import Dialog from '../../common/Dialog'
import TextField from '../../common/TextField'
import ui from '../../common/ui.module.css'
import { taxApi, useTaxSave, type CashAmounts, type CashInput, type CashView } from '../taxApi'
import AmountGrid from './AmountGrid'
import { CASH_GROUPS, EMPTY_CASH, fillBlanks } from './amounts'
import SaveError from './SaveError'

type Props = { year: number; cash: CashView | null; defaultAsOfDate: string; onClose: () => void }

/** 현금영수증 자료(연도에 1건) 입력·편집. 삭제는 없다(D19). */
export default function CashReceiptDialog({ year, cash, defaultAsOfDate, onClose }: Props) {
  const formId = useId()
  const [asOfDate, setAsOfDate] = useState(cash?.asOfDate ?? defaultAsOfDate)
  const [memo, setMemo] = useState(cash?.memo ?? '')
  const [amounts, setAmounts] = useState<CashAmounts>(cash?.amounts ?? EMPTY_CASH)
  const [rowVersion] = useState(cash?.rowVersion)
  const save = useTaxSave((body: CashInput) => taxApi.saveCashReceipt(year, body))

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const body: CashInput = { asOfDate, memo: memo.trim() || null, amounts: fillBlanks(amounts) }
    save.mutate(rowVersion === undefined ? body : { ...body, rowVersion }, { onSuccess: onClose })
  }

  return (
    <Dialog title={`${year}년 현금영수증 자료`} onClose={onClose} closeDisabled={save.isPending} centered footer={
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={save.isPending} onClick={onClose}>취소</button>
          <button type="submit" form={formId} className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={save.isPending}>저장</button>
        </div>
      }>
      <form id={formId} className={ui.stack} onSubmit={onSubmit}>
        <SaveError error={save.error} year={year} onReload={onClose} />
        <div className={ui.stack}>
          <DateTimePicker label="기준일" granularity="day" minValue={`${year}-01-01`} maxValue={`${year}-12-31`}
            value={asOfDate} onChange={setAsOfDate} isRequired />
          <p className={ui.muted}>1월 1일부터 기준일까지의 누계를 적습니다.</p>
        </div>
        <TextField label="메모 (선택)" value={memo} onChange={setMemo} maxLength={200} />
        <AmountGrid groups={CASH_GROUPS} values={amounts} onChange={setAmounts} />
      </form>
    </Dialog>
  )
}
