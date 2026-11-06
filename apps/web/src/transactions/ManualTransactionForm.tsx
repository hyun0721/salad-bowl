import DateTimePicker from '../common/DateTimePicker'
import MoneyField from '../common/MoneyField'
import Select from '../common/Select'
import TextField, { TextAreaField } from '../common/TextField'
import { majorOptions, minorOptions, useCategories } from './categoriesApi'
import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../common/errorMessage'
import ui from '../common/ui.module.css'
import styles from './TransactionPanel.module.css'
import listStyles from './TransactionsPage.module.css'
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
  loadDraft?: () => AddDraft | undefined
  onDraftChange?: (draft: AddDraft) => void
}

export default function ManualTransactionForm({ onDone, loadDraft, onDraftChange }: Props) {
  const { addManual } = useTransactionMutations()
  const categories = useCategories()
  const list = categories.data ?? []
  const [values, setValues] = useState<AddDraft>(() => loadDraft?.() ?? EMPTY)
  const { occurredAt, type, major, minor, description, amount, payment, memo } = values
  const change = (patch: Partial<AddDraft>) => setValues((prev) => ({ ...prev, ...patch }))
  useEffect(() => { onDraftChange?.(values) }, [values, onDraftChange])
  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!major) return
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
      <div className={listStyles.categoryFields}>
        <Select variant="field" label="대분류" placeholder="선택" selectedKey={major ? 'major:' + major : null}
          isDisabled={categories.isPending || list.length === 0}
          items={[...new Set([major, ...majorOptions(list)])].filter(Boolean).map((value) => ({ id: 'major:' + value, label: value }))}
          onSelectionChange={(key) => {
            if (key != null && String(key).slice(6) !== major) change({ major: String(key).slice(6), minor: '' })
          }} />
        <Select variant="field" label="소분류" selectedKey={minor ? 'minor:' + minor : 'none'} isDisabled={!major}
          items={[{ id: 'none', label: '소분류 없음' }, ...minorOptions(list, major).map((value) => ({ id: 'minor:' + value, label: value }))]}
          onSelectionChange={(key) => { if (key != null) change({ minor: key === 'none' ? '' : String(key).slice(6) }) }} />
      </div>
      {categories.isSuccess && list.length === 0 && <p className={ui.muted}>엑셀을 먼저 업로드하면 분류를 고를 수 있습니다.</p>}
      {categories.isError && <div className={ui.row}>
        <p role="alert" className={ui.alert}>분류를 불러오지 못했습니다.</p>
        <button type="button" className={ui.button} onClick={() => void categories.refetch()}>분류 다시 시도</button>
      </div>}
      <TextField label="내용" value={description} onChange={(v) => change({ description: v })} isRequired maxLength={500} />
      <MoneyField label="금액 (원)" value={amount} onChange={(v) => change({ amount: v })} isRequired minValue={1} />
      <TextField label="결제수단" value={payment} onChange={(v) => change({ payment: v })} maxLength={100} />
      <TextAreaField label="메모" value={memo} onChange={(v) => change({ memo: v })} maxLength={1000} rows={2} />
      <div className={styles.actions}>
        {/* 취소는 두지 않는다. 머리의 닫기(X)가 같은 일을 한다. */}
        <button type="submit" className={`${ui.button} ${ui.primary} ${ui.cta} ${styles.save}`} disabled={!major || addManual.isPending || addManual.isSuccess}>추가</button>
      </div>
      {addManual.isError && <p role="alert" className={ui.alert}>{errorMessage(addManual.error)}</p>}
    </form>
  )
}
