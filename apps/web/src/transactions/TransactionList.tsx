import { useEffect, useRef, useState } from 'react'
import CardList from '../common/CardList'
import Icon from '../common/Icon'
import DataTable from '../common/DataTable'
import ui from '../common/ui.module.css'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import styles from './TransactionsPage.module.css'
import { TransactionCard, transactionColumns } from './transactionRows'
import type { TransactionView } from './transactionsApi'

type Props = {
  items: TransactionView[]
  showOwner: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}

const PAGE_SIZE = 500

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
      {(tx) => <TransactionCard tx={tx} showOwner={showOwner} />}
    </CardList>
  )
  return (
    <>
      <div ref={scrollRef} className={styles.listScroll}>
        {narrow ? cards : <DataTable label="거래 목록" columns={transactionColumns(showOwner)} items={items} rowText={(tx) => tx.description}
          pagination={{ page, pageSize: PAGE_SIZE, onSort: () => setPage(0) }}
          currentId={selectedId} onRowAction={(id) => onSelect(Number(id))} />}
      </div>
      <nav aria-label="거래 목록 페이지" className={styles.pagination}>
        <span role="status">
          {page + 1} / {pageCount}
          <span className={styles.visuallyHidden}>, {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} / {items.length}건</span>
        </span>
        <button type="button" className={`${ui.button} ${styles.pageStep}`} aria-label="이전 페이지"
          disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="chevron-left" size={18} /></button>
        <button type="button" className={`${ui.button} ${styles.pageStep}`} aria-label="다음 페이지"
          disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}><Icon name="chevron-right" size={18} /></button>
      </nav>
    </>
  )
}
