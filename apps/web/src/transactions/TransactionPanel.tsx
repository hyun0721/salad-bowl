import Checkbox from '../common/Checkbox'
import ComboBox from '../common/ComboBox'
import Select from '../common/Select'
import { TextAreaField } from '../common/TextField'
import { majorOptions, minorOptions, useCategories } from './categoriesApi'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { errorMessage } from '../common/errorMessage'
import ConfirmDialog from '../common/ConfirmDialog'
import { toast } from '../common/Toast'
import { formatDateTime, formatInstant, formatSignedWon } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './TransactionPanel.module.css'
import { transactionsApi, type AuditView, type TransactionPatch, type TransactionType, type TransactionView } from './transactionsApi'
import { useTransactionMutations } from './useTransactionMutations'

const TYPE_LABELS: Record<TransactionType, string> = { EXPENSE: '지출', INCOME: '수입', TRANSFER: '이체' }
const TYPE_ITEMS = Object.entries(TYPE_LABELS).map(([id, label]) => ({ id, label }))

const FIELD_LABELS: Record<string, string> = {
  type: '타입',
  categoryMajor: '대분류',
  categoryMinor: '소분류',
  memo: '메모',
  hidden: '숨김',
}

function auditValue(field: string, value: string | null): string {
  if (field === 'hidden') return value === 'true' ? '예' : '아니오'
  if (field === 'type' && value) return TYPE_LABELS[value as TransactionType] ?? value
  return value ?? '(원본)'
}

function auditLine(a: AuditView): string {
  const label = FIELD_LABELS[a.field] ?? a.field
  return `${formatInstant(a.changedAt)} · ${a.actorNickname} · ${label}: ${auditValue(a.field, a.before)} → ${auditValue(a.field, a.after)}`
}

/** 저장하지 않은 입력. 모달↔사이드바를 바꿔 다시 그려져도 페이지가 보관했다가 돌려준다. */
export type EditDraft = { type: TransactionType; major: string; minor: string; memo: string; hidden: boolean }

type Props = { tx: TransactionView; onDeleted: () => void; loadDraft?: () => EditDraft | undefined; onDraftChange?: (draft: EditDraft) => void }

export default function TransactionPanel({ tx, onDeleted, loadDraft, onDraftChange }: Props) {
  const { me } = useAuth()
  const list = useCategories().data ?? []
  const { update, remove } = useTransactionMutations()
  const audits = useQuery({ queryKey: ['audits', tx.id], queryFn: () => transactionsApi.audits(tx.id) })
  const [values, setValues] = useState<EditDraft>(() => loadDraft?.()
    ?? { type: tx.type, major: tx.categoryMajor, minor: tx.categoryMinor, memo: tx.memo ?? '', hidden: tx.hidden })
  const { type, major, minor, memo, hidden } = values
  const change = (patch: Partial<EditDraft>) => setValues((prev) => ({ ...prev, ...patch }))
  useEffect(() => { onDraftChange?.(values) }, [values, onDraftChange])
  const isOwner = me?.userId === tx.ownerId
  const canDelete = isOwner && tx.source === 'MANUAL'

  function onSave(event: FormEvent) {
    event.preventDefault()
    const patch: TransactionPatch = {}
    if (type !== tx.type) patch.type = type
    if (major !== tx.categoryMajor) patch.categoryMajor = major
    if (minor !== tx.categoryMinor) patch.categoryMinor = minor
    if (memo !== (tx.memo ?? '')) patch.memo = memo
    if (isOwner && hidden !== tx.hidden) patch.hidden = hidden
    if (Object.keys(patch).length === 0) return
    update.mutate({ id: tx.id, patch }, {
      // 비워서 저장하면 서버가 원본 값을 돌려준다. 입력칸도 그 값으로 맞춘다.
      onSuccess: (updated) => {
        change({ type: updated.type, major: updated.categoryMajor, minor: updated.categoryMinor, memo: updated.memo ?? '', hidden: updated.hidden })
        toast('저장했습니다.')
      },
    })
  }

  const error = update.isError ? errorMessage(update.error) : null

  return (
    <div className={ui.stack}>
      <p className={styles.amount}>{formatSignedWon(tx.amount)}</p>
      <p className={ui.muted}>
        {[formatDateTime(tx.occurredAt), tx.paymentMethod, tx.ownerNickname, tx.source === 'MANUAL' ? '수동' : '엑셀']
          .filter(Boolean).join(' · ')}
      </p>

      {tx.editable ? (
        <form className={ui.stack} onSubmit={onSave}>
          <Select variant="field" label="타입" selectedKey={type}
            items={TYPE_ITEMS.filter((item) => item.id !== 'INCOME' || tx.amount > 0 || tx.type === 'INCOME')}
            onSelectionChange={(key) => { if (key != null) change({ type: key as TransactionType }) }} />
          <ComboBox label="대분류" value={major} onChange={(v) => change({ major: v })} options={majorOptions(list)} maxLength={100} />
          <ComboBox label="소분류" value={minor} onChange={(v) => change({ minor: v })} options={minorOptions(list, major.trim())} maxLength={100} />
          <TextAreaField label="메모" value={memo} onChange={(v) => change({ memo: v })} maxLength={1000} rows={2} />
          <p className={ui.muted}>비워 두거나 원래 타입을 고르고 저장하면 엑셀의 원래 값으로 돌아갑니다.</p>
          {isOwner && (
            <Checkbox isSelected={hidden} onChange={(v) => change({ hidden: v })}>그룹 화면에서 숨기기 (본인만)</Checkbox>
          )}
          <div className={styles.actions}>
            {canDelete && (
              <ConfirmDialog triggerLabel="삭제" triggerIcon="trash" title="거래 삭제" description="이 거래를 삭제할까요?"
                confirmLabel="삭제 확인" isPending={remove.isPending} error={remove.isError ? errorMessage(remove.error) : null}
                onOpen={() => remove.reset()} onConfirm={(close) => remove.mutate(tx.id, { onSuccess: () => { close(); onDeleted() } })} />
            )}
            <button type="submit" className={`${ui.button} ${ui.primary} ${styles.save}`} disabled={update.isPending}>저장</button>
          </div>
        </form>
      ) : (
        <p className={styles.readOnly}>다른 멤버의 거래는 볼 수만 있습니다. 관리자만 수정할 수 있습니다.</p>
      )}
      {error && <p role="alert" className={ui.alert}>{error}</p>}

      <section aria-labelledby={`audit-${tx.id}`} className={styles.audits}>
        <h3 id={`audit-${tx.id}`}>수정 이력</h3>
        {audits.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
        {audits.isError && (
          <div className={ui.row}>
            <p role="alert" className={ui.alert}>수정 이력을 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void audits.refetch()}>수정 이력 다시 시도</button>
          </div>
        )}
        {audits.data && audits.data.length === 0 && <p className={ui.muted}>수정한 적이 없습니다.</p>}
        {audits.data && audits.data.length > 0 && (
          <ul className={ui.stack}>
            {audits.data.map((a, i) => <li key={i} className={ui.muted}>{auditLine(a)}</li>)}
          </ul>
        )}
      </section>
    </div>
  )
}
