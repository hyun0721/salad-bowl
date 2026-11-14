import { extractTags, removeTags } from './memoTags'
import { TransactionAmount } from '../common/AmountMask'
import type { DataColumn } from '../common/DataTable'
import { formatDateTime } from '../common/format'
import ui from '../common/ui.module.css'
import styles from './TransactionsPage.module.css'
import type { TransactionView } from './transactionsApi'

// 대분류 하나만 모아 보는 창은 제목이 대분류라 showMajor=false로 소분류만 보인다.
const category = (tx: TransactionView, showMajor: boolean) =>
  [showMajor ? tx.categoryMajor : null, tx.categoryMinor].filter(Boolean).join(' · ')
const editedBadge = (tx: TransactionView) => tx.edited && <span className={`${ui.badge} ${ui.badgePending}`}>수정됨</span>
const hiddenBadge = (tx: TransactionView) => tx.hidden && <span className={ui.badge}>숨김</span>
function TagChips({ memo, onTagClick }: { memo: string | null; onTagClick?: (tag: string) => void }) {
  return extractTags(memo).map((tag) => onTagClick
    ? <button key={tag} type="button" className={styles.tagChip}
        onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onTagClick(tag) }}>#{tag}</button>
    : <span key={tag} className={styles.tagChip}>#{tag}</span>)
}

/** 거래 목록과 대시보드 거래 창이 같이 쓰는 표 열. */
// oxlint-disable-next-line react/only-export-components
export function transactionColumns(showOwner: boolean, showMajor = true, onTagClick?: (tag: string) => void): DataColumn<TransactionView>[] {
  return [
    { id: 'occurredAt', label: '일시', width: '110px', sortValue: (tx) => tx.occurredAt,
      render: (tx) => <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span> },
    ...(showOwner ? [{ id: 'owner', label: '멤버', width: '100px', render: (tx: TransactionView) => tx.ownerNickname }] : []),
    { id: 'category', label: showMajor ? '카테고리' : '소분류', render: (tx) => <>{category(tx, showMajor)}{editedBadge(tx)}</> },
    { id: 'description', label: '내용', isRowHeader: true, render: (tx) => <>{tx.description}{hiddenBadge(tx)}<TagChips memo={tx.memo} onTagClick={onTagClick} /></> },
    { id: 'paymentMethod', label: '결제수단', width: '110px', render: (tx) => tx.paymentMethod },
    { id: 'amount', label: '금액', width: '120px', align: 'end', sortValue: (tx) => tx.amount,
      render: (tx) => <span className={styles.amount} data-type={tx.type}><TransactionAmount type={tx.type} amount={tx.amount} /></span> },
  ]
}

/** 좁은 화면은 거래·분류와 일시·태그와 메모·상태를 각각 나눈다. */
export function TransactionCard({ tx, showOwner, showMajor = true, onTagClick }: { tx: TransactionView; showOwner: boolean; showMajor?: boolean; onTagClick?: (tag: string) => void }) {
  const tags = extractTags(tx.memo)
  const memo = removeTags(tx.memo, tags).trim()
  return (
    <>
      <div className={styles.cardTop}>
        <span>{tx.description}</span>
        <span className={styles.amount} data-type={tx.type}><TransactionAmount type={tx.type} amount={tx.amount} /></span>
      </div>
      <div className={styles.cardBody} data-owner={showOwner || undefined}>
        <span className={styles.cardInfo}>{category(tx, showMajor)}</span>
        <div className={styles.cardIdentity}>
          <span className={styles.when}>{formatDateTime(tx.occurredAt)}</span>
          {showOwner && <span className={styles.cardOwner}>{tx.ownerNickname}</span>}
        </div>
        {(tags.length > 0 || memo) && <div className={styles.cardAnnotations}>
          <TagChips memo={tx.memo} onTagClick={onTagClick} />
          {memo && <span className={styles.cardMemo}><span className={styles.memoLabel}>메모</span>{memo}</span>}
        </div>}
      </div>
      {(tx.edited || tx.hidden) && <div className={styles.cardFooter}>
        {editedBadge(tx)}{hiddenBadge(tx)}
      </div>}
    </>
  )
}
