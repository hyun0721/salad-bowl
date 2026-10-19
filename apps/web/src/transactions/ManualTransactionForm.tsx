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
  const [occurredAt, setOccurredAt] = useState('')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [major, setMajor] = useState('')
  const [minor, setMinor] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
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
      amount: toSignedAmount(type, Number(amount)),
      paymentMethod: payment.trim() || undefined,
      memo: memo.trim() || undefined,
    }, { onSuccess: (created) => onDone(created) })
  }

  return (
    <form className={ui.stack} onSubmit={onSubmit}>
      <div className={styles.header}>
        <h2>거래 추가 (수동)</h2>
        <button type="button" className={ui.button} onClick={onCancel}>닫기</button>
      </div>
      <label className={ui.field}>
        <span>일시</span>
        <input type="datetime-local" required className={ui.input} value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>타입</span>
        <select className={ui.input} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          <option value="EXPENSE">지출</option>
          <option value="INCOME">수입</option>
          <option value="TRANSFER">이체(출금)</option>
        </select>
      </label>
      <label className={ui.field}>
        <span>대분류</span>
        <input required maxLength={100} className={ui.input} value={major} onChange={(e) => setMajor(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>소분류</span>
        <input maxLength={100} className={ui.input} value={minor} onChange={(e) => setMinor(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>내용</span>
        <input required maxLength={500} className={ui.input} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>금액 (원)</span>
        <input type="number" required min="1" step="1" inputMode="numeric" className={ui.input} value={amount}
          onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>결제수단</span>
        <input maxLength={100} className={ui.input} value={payment} onChange={(e) => setPayment(e.target.value)} />
      </label>
      <label className={ui.field}>
        <span>메모</span>
        <textarea rows={2} maxLength={1000} className={ui.input} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <div className={styles.actions}>
        <button type="button" className={ui.button} onClick={onCancel}>취소</button>
        <button type="submit" className={`${ui.button} ${ui.primary} ${styles.save}`} disabled={addManual.isPending}>추가</button>
      </div>
      {addManual.isError && <p role="alert" className={ui.alert}>{errorMessage(addManual.error)}</p>}
    </form>
  )
}
