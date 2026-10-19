import ui from '../common/ui.module.css'
import { formatDateTime, formatSignedWon } from '../common/format'
import styles from './TransactionsPage.module.css'
import type { TransactionView } from './transactionsApi'

type Props = {
  items: TransactionView[]
  showOwner: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}

export default function TransactionList({ items, showOwner, selectedId, onSelect }: Props) {
  const cols = showOwner ? styles.withOwner : styles.withoutOwner
  return (
    <div className={styles.table}>
      <div className={`${styles.head} ${cols}`} aria-hidden="true">
        <span>일시</span>
        {showOwner && <span>멤버</span>}
        <span>카테고리</span>
        <span>내용</span>
        <span>결제수단</span>
        <span className={styles.amount}>금액</span>
      </div>
      {items.map((tx) => (
        <button key={tx.id} type="button" aria-pressed={tx.id === selectedId}
          className={`${styles.rowButton} ${cols}`} onClick={() => onSelect(tx.id)}>
          <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span>
          {showOwner && <span>{tx.ownerNickname}</span>}
          <span>
            {tx.categoryMajor}{tx.categoryMinor ? ` · ${tx.categoryMinor}` : ''}
            {tx.edited && <span className={`${ui.badge} ${ui.badgePending}`}>수정됨</span>}
          </span>
          <span>
            {tx.description}
            {tx.hidden && <span className={ui.badge}>숨김</span>}
          </span>
          <span>{tx.paymentMethod}</span>
          <span className={styles.amount}>{formatSignedWon(tx.amount)}</span>
        </button>
      ))}
    </div>
  )
}
