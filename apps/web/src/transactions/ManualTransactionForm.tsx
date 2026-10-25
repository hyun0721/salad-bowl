import ComboBox from '../common/ComboBox'
import DateTimePicker from '../common/DateTimePicker'
import MoneyField from '../common/MoneyField'
import Select from '../common/Select'
import TextField, { TextAreaField } from '../common/TextField'
import { majorOptions, minorOptions, useCategories } from './categoriesApi'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import styles from './TransactionPanel.module.css'
import type { TransactionType, TransactionView } from './transactionsApi'
import { useTransactionMutations } from './useTransactionMutations'

/** 사용자는 양수로 입력한다. 저장할 때 뱅크샐러드 부호 규칙에 맞춘다(수입 +, 지출·이체 -). */
// oxlint-disable-next-line react/only-export-components
export function toSignedAmount(type: TransactionType, positiveAmount: number): number {
  const value = Math.abs(positiveAmount)
  return type === 'INCOME' ? value : -value
}

type Props = { onDone: (created: TransactionView) => void; onCancel: () => void }

export default function ManualTransactionForm({ onDone, onCancel }: Props) {
  const { addManual } = useTransactionMutations()
  const categories = useCategories()
  const list = categories.data ?? []
  const [occurredAt, setOccurredAt] = useState('')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [major, setMajor] = useState('')
  const [minor, setMinor] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [payment, setPayment] = useState('')
  const [memo, setMemo] = useState('')
  function onSubmit(event: FormEvent) {
    event.preventDefault()
    addManual.mutate({
      occurredAt,
      type,
      categoryMajor: major.trim(),
      categoryMinor: minor.trim() || undefined,
      description: description.trim(),
      amount: toSignedAmount(type, amount ?? 0),
      paymentMethod: payment.trim() || undefined,
      memo: memo.trim() || undefined,
    }, { onSuccess: (created) => onDone(created) })
  }

  return (
    <form className={ui.stack} onSubmit={onSubmit}>
      <DateTimePicker label="일시" value={occurredAt} onChange={setOccurredAt} isRequired />
      <Select variant="field" label="타입"
        items={[{ id: 'EXPENSE', label: '지출' }, { id: 'INCOME', label: '수입' }, { id: 'TRANSFER', label: '이체(출금)' }]}
        selectedKey={type} onSelectionChange={(key) => { if (key != null) setType(key as TransactionType) }} />
      <ComboBox label="대분류" value={major} onChange={setMajor} options={majorOptions(list)} isRequired maxLength={100} />
      <ComboBox label="소분류" value={minor} onChange={setMinor} options={minorOptions(list, major.trim())} maxLength={100} />
      <TextField label="내용" value={description} onChange={setDescription} isRequired maxLength={500} />
      <MoneyField label="금액 (원)" value={amount} onChange={setAmount} isRequired minValue={1} />
      <TextField label="결제수단" value={payment} onChange={setPayment} maxLength={100} />
      <TextAreaField label="메모" value={memo} onChange={setMemo} maxLength={1000} rows={2} />
      <div className={styles.actions}>
        <button type="button" className={ui.button} onClick={onCancel}>취소</button>
        <button type="submit" className={`${ui.button} ${ui.primary} ${styles.save}`} disabled={addManual.isPending}>추가</button>
      </div>
      {addManual.isError && <p role="alert" className={ui.alert}>{errorMessage(addManual.error)}</p>}
    </form>
  )
}
