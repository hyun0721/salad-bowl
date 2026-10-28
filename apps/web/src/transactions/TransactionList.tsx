import { useEffect, useRef, useState } from 'react'
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

const PAGE_SIZE = 500

const category = (tx: TransactionView) => `${tx.categoryMajor}${tx.categoryMinor ? ` · ${tx.categoryMinor}` : ''}`
const editedBadge = (tx: TransactionView) => tx.edited && <span className={`${ui.badge} ${ui.badgePending}`}>수정됨</span>
const hiddenBadge = (tx: TransactionView) => tx.hidden && <span className={ui.badge}>숨김</span>

export default function TransactionList({ items, showOwner, selectedId, onSelect }: Props) {
  const narrow = useMediaQuery(NARROW)
  const [requestedPage, setPage] = useState(0)
  const pageCount = Math.ceil(items.length / PAGE_SIZE)
  const page = Math.min(requestedPage, Math.max(0, pageCount - 1))
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0 }) }, [page])
  const cards = (
    <CardList label="거래 목록" items={items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)} textValue={(tx) => tx.description} currentId={selectedId}
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
    <>
      <div ref={scrollRef} className={styles.listScroll}>
        {narrow ? cards : <DataTable label="거래 목록" columns={columns} items={items} rowText={(tx) => tx.description}
          pagination={{ page, pageSize: PAGE_SIZE, onSort: () => setPage(0) }}
          currentId={selectedId} onRowAction={(id) => onSelect(Number(id))} />}
      </div>
      <nav aria-label="거래 목록 페이지" className={styles.pagination}>
        <span role="status">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} / {items.length}건</span>
        <div className={ui.row}>
          <button type="button" className={ui.button} disabled={page === 0} onClick={() => setPage(page - 1)}>이전 페이지</button>
          <span>{page + 1} / {pageCount}</span>
          <button type="button" className={ui.button} disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>다음 페이지</button>
        </div>
      </nav>
    </>
  )
}
