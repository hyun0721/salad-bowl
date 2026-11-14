import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Selection } from 'react-aria-components'
import Checkbox from '../common/Checkbox'
import { useScrollActivity } from '../common/useScrollActivity'
import scrollStyles from '../common/ScrollActivity.module.css'
import CardList from '../common/CardList'
import cardStyles from '../common/CardList.module.css'
import DataTable from '../common/DataTable'
import tableStyles from '../common/DataTable.module.css'
import Skeleton, { SkeletonRegion } from '../common/Skeleton'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import styles from './TransactionsPage.module.css'
import { TransactionCard, transactionColumns } from './transactionRows'
import type { TransactionView } from './transactionsApi'

type Props = {
  items: TransactionView[]
  showOwner: boolean
  selectedId: number | null
  onSelect: (id: number) => void
  selectedIds?: Set<number>
  onSelectionChange?: (ids: Set<number>) => void
  onTagClick?: (tag: string) => void
  saving?: boolean
}

const RENDER_BATCH = 300

const selectionCheckbox = () => <Checkbox slot="selection" />

export default function TransactionList({ items, showOwner, selectedId, onSelect, selectedIds, onSelectionChange, saving = false, onTagClick }: Props) {
  const narrow = useMediaQuery(NARROW)
  const onScroll = useScrollActivity()
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasMore = visibleCount < items.length
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => count + RENDER_BATCH)
    }, { root: scrollRef.current, rootMargin: '600px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, visibleCount])
  const selecting = selectedIds !== undefined
  const select = (keys: Selection) => {
    onSelectionChange?.(new Set(items.filter((tx) => tx.editable && (keys === 'all' || keys.has(tx.id))).map((tx) => tx.id)))
  }
  const disabledKeys = useMemo(() => items.filter((tx) => saving || !tx.editable).map((tx) => tx.id), [items, saving])
  const selection = selectedIds ? {
    selectionMode: 'multiple' as const, selectionBehavior: 'toggle' as const,
    selectedKeys: selectedIds, onSelectionChange: select, disabledKeys,
  } : undefined
  // 선택이 바뀔 때마다 목록을 다시 그리지 않도록 열과 카드 내용의 정체성을 유지한다.
  const columns = useMemo(() => selecting
    ? [{ id: 'selection', label: '선택', width: '48px', render: selectionCheckbox }, ...transactionColumns(showOwner, true, onTagClick)]
    : transactionColumns(showOwner, true, onTagClick), [selecting, showOwner, onTagClick])
  const renderCard = useCallback((tx: TransactionView) => (selecting
    ? <div className={styles.cardSelection}>{selectionCheckbox()}<div className={styles.cardContent}><TransactionCard tx={tx} showOwner={showOwner} onTagClick={onTagClick} /></div></div>
    : <TransactionCard tx={tx} showOwner={showOwner} onTagClick={onTagClick} />), [selecting, showOwner, onTagClick])
  const cards = (
    <CardList label="거래 목록" items={items.slice(0, visibleCount)} textValue={(tx) => tx.description} currentId={selectedId}
      selection={selection} onAction={selecting ? undefined : (id) => onSelect(Number(id))}>
      {renderCard}
    </CardList>
  )
  return (
    <>
      <div ref={scrollRef} className={`${styles.listScroll} ${scrollStyles.scroll}`} onScroll={onScroll}>
        {narrow ? cards : <DataTable label="거래 목록" columns={columns} selection={selection} items={items} rowText={(tx) => tx.description}
          visibleRows={{ count: visibleCount, onSort: () => { setVisibleCount(RENDER_BATCH); scrollRef.current?.scrollTo?.({ top: 0 }) } }}
          currentId={selectedId} onRowAction={selecting ? undefined : (id) => onSelect(Number(id))} />}
        {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
      </div>
      <span role="status" className={styles.visuallyHidden}>{Math.min(visibleCount, items.length)} / {items.length}건 표시</span>
    </>
  )
}

const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => i)

/** 넓은 화면은 DataTable, 좁은 화면은 CardList와 같은 클래스로 그려 데이터가 와도 목록 자리가 밀리지 않는다. */
export function TransactionListSkeleton({ showOwner }: { showOwner: boolean }) {
  const narrow = useMediaQuery(NARROW)
  const columns = transactionColumns(showOwner)
  return (
    <SkeletonRegion className={styles.listScroll}>
      {narrow ? (
        <div className={cardStyles.list}>
          {SKELETON_ROWS.map((i) => (
            <div key={i} className={`${cardStyles.card} ${styles.skeletonCard}`}>
              <div className={styles.cardTop}><Skeleton width={`${50 - (i % 3) * 8}%`} height={12} /><Skeleton width={72} height={12} className={styles.skeletonInset} /></div>
              <div className={styles.cardMeta}><Skeleton width="40%" height={12} /><Skeleton width={64} height={12} className={`${styles.when} ${styles.skeletonInset}`} /></div>
            </div>
          ))}
        </div>
      ) : (
        <table className={tableStyles.table}>
          <thead className={tableStyles.head}>
            <tr>{columns.map((c) => (
              <th key={c.id} className={tableStyles.cell} style={{ width: c.width }}><Skeleton width={36} height="1lh" /></th>
            ))}</tr>
          </thead>
          <tbody>
            {SKELETON_ROWS.map((i) => (
              <tr key={i} className={`${tableStyles.row} ${styles.skeletonCard}`}>
                {columns.map((c) => (
                  <td key={c.id} className={tableStyles.cell}>
                    <Skeleton width={c.width ? '70%' : `${60 - (i % 3) * 10}%`} height={12} className={c.align === 'end' ? styles.skeletonEnd : undefined} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SkeletonRegion>
  )
}
