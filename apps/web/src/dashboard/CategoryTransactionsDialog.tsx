import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import CardList from '../common/CardList'
import DataTable from '../common/DataTable'
import { DialogFrame } from '../common/Dialog'
import { useAmountFormatter } from '../common/AmountMask'
import Icon from '../common/Icon'
import SortButton from '../common/SortButton'
import ui from '../common/ui.module.css'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import { TransactionCard, transactionColumns } from '../transactions/transactionRows'
import TransactionPanel from '../transactions/TransactionPanel'
import { TransactionListSkeleton } from '../transactions/TransactionList'
import { DEFAULT_SORT, SORT_OPTIONS, type TransactionSort } from '../transactions/transactionQuery'
import { dashboardApi } from './dashboardApi'
import styles from './CategoryBreakdown.module.css'

type Props = { groupId: number; month: string; category: string | null; minor?: string | null; onClose: () => void }

export default function CategoryTransactionsDialog({ groupId, month, category, minor, onClose }: Props) {
  const formatWon = useAmountFormatter('EXPENSE')
  const navigate = useNavigate()
  const narrow = useMediaQuery(NARROW)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sort, setSort] = useState<TransactionSort>(DEFAULT_SORT)
  const listRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const focusId = useRef<number | null>(null)
  const [lastSelection, setLastSelection] = useState({ category, minor, month })
  if (category === null && selectedId !== null) setSelectedId(null)
  if (category !== null && (lastSelection.category !== category || lastSelection.minor !== minor || lastSelection.month !== month)) {
    setLastSelection({ category, minor, month })
    setSelectedId(null)
    setSort(DEFAULT_SORT)
  }
  const displayedCategory = category ?? lastSelection.category
  const displayedMinor = category !== null ? minor : lastSelection.minor
  const title = displayedMinor == null ? displayedCategory ?? '' : `${displayedCategory} · ${displayedMinor || '미분류'}`
  const transactions = useQuery({
    queryKey: ['summary', groupId, month, 'transactions', displayedCategory, displayedMinor ?? null, sort],
    queryFn: () => dashboardApi.categoryTransactions(groupId, month, displayedCategory!, displayedMinor ?? undefined, sort),
    enabled: category !== null,
  })
  const items = transactions.data ?? []
  const selected = items.find((tx) => tx.id === selectedId)
  const total = -items.reduce((sum, tx) => sum + tx.amount, 0)
  useEffect(() => {
    if (selectedId !== null || focusId.current === null || transactions.isFetching) return
    const id = focusId.current
    requestAnimationFrame(() => {
      if (category === null || focusId.current !== id) return
      focusId.current = null
      ;(listRef.current?.querySelector<HTMLElement>(`[data-key="${id}"]`) ?? summaryRef.current)?.focus()
    })
  }, [selectedId, category, transactions.data, transactions.isFetching])
  const backToList = () => {
    focusId.current = selectedId
    setSelectedId(null)
  }
  const close = () => {
    setSelectedId(null)
    focusId.current = null
    onClose()
  }
  const showTransaction = (id: number) => {
    focusId.current = null
    setSelectedId(id)
  }
  // 대분류에서 한 단계 들어가는 이동이라 push한다. 뒤로가기로 대분류 화면에 돌아온다.
  const showMinors = () => {
    close()
    navigate(`/dashboard/minor?${new URLSearchParams({ month, major: displayedCategory ?? '' })}`, { state: { focusSubcategories: true } })
  }

  return (
    <DialogFrame isOpen={category !== null} title={selected?.description ?? title} onOpenChange={(open) => { if (!open) close() }}
      closeOnOutsideClick wide pinnedHeader headerAction={
        <div className={ui.row}>
          {selected && <button type="button" className={`${ui.button} ${ui.iconButton}`}
            aria-label="거래 목록으로 돌아가기" onClick={backToList}><Icon name="chevron-left" /></button>}
          {!selected && displayedMinor == null && <button type="button" className={`${ui.button} ${ui.iconButton}`}
            aria-label={`${displayedCategory} 소분류 보기`} title="소분류 보기" onClick={showMinors}>
            <Icon name="list-tree" />
          </button>}
          {!selected && <SortButton options={SORT_OPTIONS} value={sort} defaultValue={DEFAULT_SORT} onApply={setSort} />}
          <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label="닫기" onClick={close}>
            <Icon name="x" />
          </button>
        </div>
      }>
      {() => (
        <div className={styles.dialogBody}>
          {selected ? <div className={styles.dialogList}>
            <TransactionPanel key={selected.id} tx={selected} onSaved={backToList} onDeleted={backToList} />
          </div> : <>
          {transactions.isPending && <div className={styles.dialogList}>
            <TransactionListSkeleton showOwner />
          </div>}
          {transactions.isError && <div className={ui.row}>
            <p role="alert" className={ui.alert}>거래를 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void transactions.refetch()}>다시 시도</button>
          </div>}
          {transactions.isSuccess && <>
            <p ref={summaryRef} tabIndex={-1} className={styles.summary}>{items.length}건 · 합계 {formatWon(total)}</p>
            {items.length === 0 ? <p className={ui.status}>거래가 없습니다.</p> : (
              <div ref={listRef} className={styles.dialogList} data-dialog-list="">
                {narrow ? (
                  <CardList label="거래 목록" items={items} textValue={(tx) => tx.description} onAction={(id) => showTransaction(Number(id))}>
                    {(tx) => <TransactionCard tx={tx} showOwner showMajor={false} />}
                  </CardList>
                ) : <DataTable label="거래 목록" columns={transactionColumns(true, false)} items={items} rowText={(tx) => tx.description} onRowAction={(id) => showTransaction(Number(id))} />}
              </div>
            )}
          </>}
          </>}
        </div>
      )}
    </DialogFrame>
  )
}
