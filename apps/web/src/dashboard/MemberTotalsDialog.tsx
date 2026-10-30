import { useState } from 'react'
import { DialogFrame } from '../common/Dialog'
import { formatWon } from '../common/format'
import type { TotalKind } from '../common/TotalsCards'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'
import type { MonthlySummary } from './dashboardApi'
import styles from './DashboardPage.module.css'

const LABELS: Record<TotalKind, string> = { income: '수입', expense: '지출' }

type Props = { kind: TotalKind | null; summary: MonthlySummary; onClose: () => void }

export default function MemberTotalsDialog({ kind, summary, onClose }: Props) {
  // 닫히는 동안에도 제목과 목록이 비지 않게 마지막 종류를 붙잡아 둔다.
  const [lastKind, setLastKind] = useState(kind)
  if (kind !== null && lastKind !== kind) setLastKind(kind)
  const shown = kind ?? lastKind ?? 'income'
  const rows = [...summary.byMember].sort((a, b) => b[shown] - a[shown])

  return (
    <DialogFrame isOpen={kind !== null} title={`멤버별 ${LABELS[shown]}`} onOpenChange={(open) => { if (!open) onClose() }}
      closeOnOutsideClick headerAction={
        <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label="닫기" onClick={onClose}>
          <Icon name="x" />
        </button>
      }>
      {() => rows.length === 0 ? <p className={ui.status}>공개한 멤버가 없습니다.</p> : (
        <table className={styles.table}>
          <thead>
            <tr><th scope="col">멤버</th><th scope="col">{LABELS[shown]}</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.userId}><th scope="row">{m.nickname}</th><td>{formatWon(m[shown])}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">합계</th><td>{formatWon(summary[shown])}</td></tr>
          </tfoot>
        </table>
      )}
    </DialogFrame>
  )
}
