import CardList from '../common/CardList'
import DataTable, { type DataColumn } from '../common/DataTable'
import { formatDateTime, formatSignedWon } from '../common/format'
import ui from '../common/ui.module.css'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import styles from './TransactionsPage.module.css'
import type { TransactionView } from './transactionsApi'

type Props = {
  items: TransactionView[]
  showOwner: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}

const category = (tx: TransactionView) => `${tx.categoryMajor}${tx.categoryMinor ? ` · ${tx.categoryMinor}` : ''}`
const editedBadge = (tx: TransactionView) => tx.edited && <span className={`${ui.badge} ${ui.badgePending}`}>수정됨</span>
const hiddenBadge = (tx: TransactionView) => tx.hidden && <span className={ui.badge}>숨김</span>

export default function TransactionList({ items, showOwner, selectedId, onSelect }: Props) {
  const narrow = useMediaQuery(NARROW)
  if (narrow) {
    return (
      <CardList label="거래 목록" items={items} textValue={(tx) => tx.description} currentId={selectedId}
        onAction={(id) => onSelect(Number(id))}>
        {(tx) => (
          <>
            <div className={styles.cardTop}>
              <span>{tx.description}{hiddenBadge(tx)}</span>
              <span className={styles.amount}>{formatSignedWon(tx.amount)}</span>
            </div>
            <div className={styles.cardMeta}>
              {[formatDateTime(tx.occurredAt), category(tx), showOwner ? tx.ownerNickname : null].filter(Boolean).join(' · ')}
              {editedBadge(tx)}
            </div>
          </>
        )}
      </CardList>
    )
  }
  const columns: DataColumn<TransactionView>[] = [
    { id: 'occurredAt', label: '일시', width: '110px', sortValue: (tx) => tx.occurredAt,
      render: (tx) => <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span> },
    ...(showOwner ? [{ id: 'owner', label: '멤버', width: '100px', render: (tx: TransactionView) => tx.ownerNickname }] : []),
    { id: 'category', label: '카테고리', render: (tx) => <>{category(tx)}{editedBadge(tx)}</> },
    { id: 'description', label: '내용', isRowHeader: true, render: (tx) => <>{tx.description}{hiddenBadge(tx)}</> },
    { id: 'paymentMethod', label: '결제수단', width: '110px', render: (tx) => tx.paymentMethod },
    { id: 'amount', label: '금액', width: '120px', align: 'end', sortValue: (tx) => tx.amount,
      render: (tx) => <span className={styles.amount}>{formatSignedWon(tx.amount)}</span> },
  ]
  return (
    <DataTable label="거래 목록" columns={columns} items={items} rowText={(tx) => tx.description}
      currentId={selectedId} onRowAction={(id) => onSelect(Number(id))} />
  )
}
