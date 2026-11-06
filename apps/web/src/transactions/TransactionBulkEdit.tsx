import { useState, type FormEvent } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import Dialog from '../common/Dialog'
import Select from '../common/Select'
import ComboBox from '../common/ComboBox'
import { errorMessage } from '../common/errorMessage'
import { toast } from '../common/Toast'
import ui from '../common/ui.module.css'
import { majorOptions, minorOptions, type CategoryOption } from './categoriesApi'
import { TYPE_LABELS } from './TransactionPanel'
import type { BulkTransactionPatch, TransactionType, TransactionView } from './transactionsApi'
import { useTransactionMutations } from './useTransactionMutations'

type Props = { items: TransactionView[]; categories: CategoryOption[]; onClose: () => void; onDone: () => void }

export default function TransactionBulkEdit({ items, categories, onClose, onDone }: Props) {
  const { me } = useAuth()
  const { bulkUpdate } = useTransactionMutations()
  const saving = useIsMutating() > 0
  const [type, setType] = useState<TransactionType | ''>('')
  const [major, setMajor] = useState('')
  const [minor, setMinor] = useState('')
  const [hidden, setHidden] = useState('unchanged')
  const allMine = items.every((tx) => tx.ownerId === me?.userId)
  const allowIncome = items.every((tx) => tx.amount > 0 || tx.type === 'INCOME')
  const tooMany = items.length > 1000
  const patch: BulkTransactionPatch = {}
  if (type && (type !== 'INCOME' || allowIncome)) patch.type = type
  if (major.trim()) patch.categoryMajor = major
  if (minor.trim()) patch.categoryMinor = minor
  if (allMine && hidden !== 'unchanged') patch.hidden = hidden === 'hide'
  const disabled = saving || tooMany || items.length === 0 || Object.keys(patch).length === 0

  function apply(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    bulkUpdate.mutate({ ids: items.map((tx) => tx.id), patch }, {
      onSuccess: ({ updated }) => { toast(`${updated}건을 수정했습니다.`); onDone() },
    })
  }

  return (
    <Dialog title="거래 일괄 편집" onClose={onClose} closeDisabled={saving}>
      <form className={ui.stack} onSubmit={apply}>
        <p>선택한 {items.length}건에 적용합니다. 비워 둔 항목은 바뀌지 않습니다.</p>
        {tooMany && <p role="alert" className={ui.alert}>한 번에 최대 1,000건까지 수정할 수 있습니다.</p>}
        <Select variant="field" label="타입" selectedKey={type || 'unchanged'}
          items={[{ id: 'unchanged', label: '변경 안 함' }, ...Object.entries(TYPE_LABELS)
            .filter(([id]) => id !== 'INCOME' || allowIncome).map(([id, label]) => ({ id, label }))]}
          onSelectionChange={(key) => setType(key === 'unchanged' || key == null ? '' : key as TransactionType)} />
        <ComboBox label="대분류" value={major} onChange={setMajor} options={majorOptions(categories)} maxLength={100} />
        <ComboBox label="소분류" value={minor} onChange={setMinor} options={minorOptions(categories, major.trim())} maxLength={100} />
        {major.trim() && !minor.trim() && <p className={ui.muted}>소분류는 지금 값 그대로입니다. 함께 바꾸려면 소분류도 입력하세요.</p>}
        {allMine && <Select variant="field" label="그룹에서 숨기기" selectedKey={hidden}
          items={[{ id: 'unchanged', label: '변경 안 함' }, { id: 'hide', label: '숨기기' }, { id: 'show', label: '숨기기 해제' }]}
          onSelectionChange={(key) => setHidden(String(key ?? 'unchanged'))} />}
        {bulkUpdate.isError && <p role="alert" className={ui.alert}>{errorMessage(bulkUpdate.error)}</p>}
        <button type="submit" className={`${ui.button} ${ui.primary} ${ui.cta}`} disabled={disabled}>{saving ? '저장 중' : '적용'}</button>
      </form>
    </Dialog>
  )
}
