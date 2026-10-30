import type { DataColumn } from '../common/DataTable'
import { formatDateTime, formatSignedWon } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './TransactionsPage.module.css'
import type { TransactionView } from './transactionsApi'

// 대분류 하나만 모아 보는 창은 제목이 대분류라 showMajor=false로 소분류만 보인다.
const category = (tx: TransactionView, showMajor: boolean) =>
  [showMajor ? tx.categoryMajor : null, tx.categoryMinor].filter(Boolean).join(' · ')
const editedBadge = (tx: TransactionView) => tx.edited && <span className={`${ui.badge} ${ui.badgePending}`}>수정됨</span>
const hiddenBadge = (tx: TransactionView) => tx.hidden && <span className={ui.badge}>숨김</span>
const memoOf = (tx: TransactionView) => tx.memo?.trim() || null

/** 거래 목록과 대시보드 거래 창이 같이 쓰는 표 열. */
// oxlint-disable-next-line react/only-export-components
export function transactionColumns(showOwner: boolean, showMajor = true): DataColumn<TransactionView>[] {
  return [
    { id: 'occurredAt', label: '일시', width: '110px', sortValue: (tx) => tx.occurredAt,
      render: (tx) => <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span> },
    ...(showOwner ? [{ id: 'owner', label: '멤버', width: '100px', render: (tx: TransactionView) => tx.ownerNickname }] : []),
    { id: 'category', label: showMajor ? '카테고리' : '소분류', render: (tx) => <>{category(tx, showMajor)}{editedBadge(tx)}</> },
    { id: 'description', label: '내용', isRowHeader: true, render: (tx) => <>{tx.description}{hiddenBadge(tx)}</> },
    { id: 'paymentMethod', label: '결제수단', width: '110px', render: (tx) => tx.paymentMethod },
    { id: 'amount', label: '금액', width: '120px', align: 'end', sortValue: (tx) => tx.amount,
      render: (tx) => <span className={styles.amount}>{formatSignedWon(tx.amount)}</span> },
  ]
}

/** 좁은 화면 카드 한 장의 내용. 2줄은 `분류 | 메모`와 일시다. */
export function TransactionCard({ tx, showOwner, showMajor = true }: { tx: TransactionView; showOwner: boolean; showMajor?: boolean }) {
  const info = [category(tx, showMajor), showOwner ? tx.ownerNickname : null].filter(Boolean).join(' · ')
  const memo = memoOf(tx)
  return (
    <>
      <div className={styles.cardTop}>
        <span>{tx.description}{hiddenBadge(tx)}</span>
        <span className={styles.amount}>{formatSignedWon(tx.amount)}</span>
      </div>
      <div className={styles.cardMeta}>
        <span className={styles.cardInfo}>
          {info}
          {memo && (info ? <>{' '}<span aria-hidden="true">|</span>{' '}{memo}</> : memo)}
        </span>
        {editedBadge(tx)}
        <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span>
      </div>
    </>
  )
}
