import ComboBox from '../common/ComboBox'
import DateTimePicker from '../common/DateTimePicker'
import MoneyField from '../common/MoneyField'
import Select from '../common/Select'
import TextField, { TextAreaField } from '../common/TextField'
import { majorOptions, minorOptions, useCategories } from './categoriesApi'
import { useEffect, useState, type FormEvent } from 'react'
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

/** 저장하지 않은 입력. 모달↔사이드바를 바꿔 다시 그려져도 페이지가 보관했다가 돌려준다. */
export type AddDraft = {
  occurredAt: string
  type: TransactionType
  major: string
  minor: string
  description: string
  amount: number | null
  payment: string
  memo: string
}

const EMPTY: AddDraft = { occurredAt: '', type: 'EXPENSE', major: '', minor: '', description: '', amount: null, payment: '', memo: '' }

type Props = {
  onDone: (created: TransactionView) => void
  onCancel: () => void
  loadDraft?: () => AddDraft | undefined
  onDraftChange?: (draft: AddDraft) => void
}

export default function ManualTransactionForm({ onDone, onCancel, loadDraft, onDraftChange }: Props) {
  const { addManual } = useTransactionMutations()
  const categories = useCategories()
  const list = categories.data ?? []
  const [values, setValues] = useState<AddDraft>(() => loadDraft?.() ?? EMPTY)
  const { occurredAt, type, major, minor, description, amount, payment, memo } = values
  const change = (patch: Partial<AddDraft>) => setValues((prev) => ({ ...prev, ...patch }))
  useEffect(() => { onDraftChange?.(values) }, [values, onDraftChange])
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
      <DateTimePicker label="일시" value={occurredAt} onChange={(v) => change({ occurredAt: v })} isRequired />
      <Select variant="field" label="타입"
        items={[{ id: 'EXPENSE', label: '지출' }, { id: 'INCOME', label: '수입' }, { id: 'TRANSFER', label: '이체(출금)' }]}
        selectedKey={type} onSelectionChange={(key) => { if (key != null) change({ type: key as TransactionType }) }} />
      <ComboBox label="대분류" value={major} onChange={(v) => change({ major: v })} options={majorOptions(list)} isRequired maxLength={100} />
      <ComboBox label="소분류" value={minor} onChange={(v) => change({ minor: v })} options={minorOptions(list, major.trim())} maxLength={100} />
      <TextField label="내용" value={description} onChange={(v) => change({ description: v })} isRequired maxLength={500} />
      <MoneyField label="금액 (원)" value={amount} onChange={(v) => change({ amount: v })} isRequired minValue={1} />
      <TextField label="결제수단" value={payment} onChange={(v) => change({ payment: v })} maxLength={100} />
      <TextAreaField label="메모" value={memo} onChange={(v) => change({ memo: v })} maxLength={1000} rows={2} />
      <div className={styles.actions}>
        <button type="button" className={ui.button} onClick={onCancel}>취소</button>
        <button type="submit" className={`${ui.button} ${ui.primary} ${styles.save}`} disabled={addManual.isPending || addManual.isSuccess}>추가</button>
      </div>
      {addManual.isError && <p role="alert" className={ui.alert}>{errorMessage(addManual.error)}</p>}
    </form>
  )
}
