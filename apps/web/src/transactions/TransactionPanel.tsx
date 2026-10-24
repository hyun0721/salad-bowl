import Checkbox from '../common/Checkbox'
import ComboBox from '../common/ComboBox'
import { TextAreaField } from '../common/TextField'
import { majorOptions, minorOptions, useCategories } from './categoriesApi'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { errorMessage } from '../common/errorMessage'
import Icon from '../common/Icon'
import { formatDateTime, formatInstant, formatSignedWon } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './TransactionPanel.module.css'
import { transactionsApi, type AuditView, type TransactionPatch, type TransactionView } from './transactionsApi'
import { useTransactionMutations } from './useTransactionMutations'

const FIELD_LABELS: Record<string, string> = {
  categoryMajor: '대분류',
  categoryMinor: '소분류',
  memo: '메모',
  hidden: '숨김',
}

function auditValue(field: string, value: string | null): string {
  if (field === 'hidden') return value === 'true' ? '예' : '아니오'
  return value ?? '(원본)'
}

function auditLine(a: AuditView): string {
  const label = FIELD_LABELS[a.field] ?? a.field
  return `${formatInstant(a.changedAt)} · ${a.actorNickname} · ${label}: ${auditValue(a.field, a.before)} → ${auditValue(a.field, a.after)}`
}

type Props = { tx: TransactionView; onClose: () => void }

export default function TransactionPanel({ tx, onClose }: Props) {
  const { me } = useAuth()
  const list = useCategories().data ?? []
  const { update, remove } = useTransactionMutations()
  const audits = useQuery({ queryKey: ['audits', tx.id], queryFn: () => transactionsApi.audits(tx.id) })
  const [major, setMajor] = useState(tx.categoryMajor)
  const [minor, setMinor] = useState(tx.categoryMinor)
  const [memo, setMemo] = useState(tx.memo ?? '')
  const [hidden, setHidden] = useState(tx.hidden)
  const [confirming, setConfirming] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // 패널은 목록 아래로 밀려 화면 밖에 열릴 수 있어, 열릴 때 제목으로 포커스를 옮긴다. 다시 렌더할 때는 옮기지 않는다.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const isOwner = me?.userId === tx.ownerId
  const canDelete = isOwner && tx.source === 'MANUAL'

  function onSave(event: FormEvent) {
    event.preventDefault()
    const patch: TransactionPatch = {}
    if (major !== tx.categoryMajor) patch.categoryMajor = major
    if (minor !== tx.categoryMinor) patch.categoryMinor = minor
    if (memo !== (tx.memo ?? '')) patch.memo = memo
    if (isOwner && hidden !== tx.hidden) patch.hidden = hidden
    if (Object.keys(patch).length === 0) return
    update.mutate({ id: tx.id, patch }, {
      // 비워서 저장하면 서버가 원본 값을 돌려준다. 입력칸도 그 값으로 맞춘다.
      onSuccess: (updated) => {
        setMajor(updated.categoryMajor)
        setMinor(updated.categoryMinor)
        setMemo(updated.memo ?? '')
        setHidden(updated.hidden)
      },
    })
  }

  function onDelete() {
    remove.mutate(tx.id, { onSuccess: onClose })
  }

  const error = update.isError ? errorMessage(update.error) : remove.isError ? errorMessage(remove.error) : null

  return (
    <div className={ui.stack}>
      <div className={styles.header}>
        <h2 ref={headingRef} tabIndex={-1}>{tx.description}</h2>
        <button type="button" className={ui.button} onClick={onClose}><Icon name="x" size={18} />닫기</button>
      </div>
      <p className={styles.amount}>{formatSignedWon(tx.amount)}</p>
      <p className={ui.muted}>
        {[formatDateTime(tx.occurredAt), tx.paymentMethod, tx.ownerNickname, tx.source === 'MANUAL' ? '수동' : '엑셀']
          .filter(Boolean).join(' · ')}
      </p>

      {tx.editable ? (
        <form className={ui.stack} onSubmit={onSave}>
          <ComboBox label="대분류" value={major} onChange={setMajor} options={majorOptions(list)} maxLength={100} />
          <ComboBox label="소분류" value={minor} onChange={setMinor} options={minorOptions(list, major.trim())} maxLength={100} />
          <TextAreaField label="메모" value={memo} onChange={setMemo} maxLength={1000} rows={2} />
          <p className={ui.muted}>비워 두고 저장하면 엑셀의 원래 값으로 돌아갑니다.</p>
          {isOwner && (
            <Checkbox isSelected={hidden} onChange={setHidden}>그룹 화면에서 숨기기 (본인만)</Checkbox>
          )}
          <div className={styles.actions}>
            {canDelete && !confirming && (
              <button type="button" className={`${ui.button} ${ui.danger}`} onClick={() => setConfirming(true)}><Icon name="trash" size={18} />삭제</button>
            )}
            {canDelete && confirming && (
              <span className={ui.row}>
                <span>이 거래를 삭제할까요?</span>
                <button type="button" className={`${ui.button} ${ui.danger}`} disabled={remove.isPending} onClick={onDelete}>삭제 확인</button>
                <button type="button" className={ui.button} onClick={() => setConfirming(false)}>취소</button>
              </span>
            )}
            <button type="submit" className={`${ui.button} ${ui.primary} ${styles.save}`} disabled={update.isPending}>저장</button>
          </div>
          {update.isSuccess && <p role="status" className={ui.status}>저장했습니다.</p>}
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
