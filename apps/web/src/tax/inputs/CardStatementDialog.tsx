import { useId, useState, type FormEvent } from 'react'
import DateTimePicker from '../../common/DateTimePicker'
import Dialog from '../../common/Dialog'
import TextField from '../../common/TextField'
import ui from '../../common/ui.module.css'
import { taxApi, useTaxSave, type CardAmounts, type CardInput, type CardView } from '../taxApi'
import AmountGrid from './AmountGrid'
import { CARD_GROUPS, EMPTY_CARD, fillBlanks } from './amounts'
import SaveError from './SaveError'

type Props = { year: number; card: CardView | null; defaultAsOfDate: string; onClose: () => void }

/** 신용·체크 자료 추가(card가 null)·편집. 같은 카드사명을 다시 써도 막지 않는다(TAX-22). */
export default function CardStatementDialog({ year, card, defaultAsOfDate, onClose }: Props) {
  const formId = useId()
  const [issuerName, setIssuerName] = useState(card?.issuerName ?? '')
  const [asOfDate, setAsOfDate] = useState(card?.asOfDate ?? defaultAsOfDate)
  const [memo, setMemo] = useState(card?.memo ?? '')
  const [amounts, setAmounts] = useState<CardAmounts>(card?.amounts ?? EMPTY_CARD)
  const [rowVersion] = useState(card?.rowVersion)
  const [nameError, setNameError] = useState(false)
  const save = useTaxSave((body: CardInput) => (card ? taxApi.saveCard(year, card.id, { ...body, rowVersion }) : taxApi.addCard(year, body)))

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!issuerName.trim()) { setNameError(true); return }
    save.mutate({ issuerName: issuerName.trim(), asOfDate, memo: memo.trim() || null, amounts: fillBlanks(amounts) }, { onSuccess: onClose })
  }

  return (
    <Dialog title={card ? `${card.issuerName} 자료 편집` : '신용·체크 자료 추가'} onClose={onClose} closeDisabled={save.isPending} centered footer={
        <div className={ui.confirmActions}>
          <button type="button" className={ui.button} disabled={save.isPending} onClick={onClose}>취소</button>
          <button type="submit" form={formId} className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={save.isPending}>저장</button>
        </div>
      }>
      <form id={formId} className={ui.stack} onSubmit={onSubmit}>
        <SaveError error={save.error} year={year} onReload={onClose} />
        <TextField label="카드사명" value={issuerName} onChange={(value) => { setIssuerName(value); setNameError(false) }} isRequired maxLength={50} />
        {nameError && <p role="alert" className={ui.alert}>카드사명을 입력하세요.</p>}
        <div className={ui.stack}>
          <DateTimePicker label="기준일" granularity="day" minValue={`${year}-01-01`} maxValue={`${year}-12-31`}
            value={asOfDate} onChange={setAsOfDate} isRequired />
          <p className={ui.muted}>1월 1일부터 기준일까지의 누계를 적습니다.</p>
        </div>
        <TextField label="메모 (선택)" value={memo} onChange={setMemo} maxLength={200} />
        <AmountGrid groups={CARD_GROUPS} values={amounts} onChange={setAmounts} />
      </form>
    </Dialog>
  )
}
