import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import CardList from '../common/CardList'
import DataTable, { type DataColumn } from '../common/DataTable'
import { DialogFrame } from '../common/Dialog'
import { formatDateTime, formatSignedWon, formatWon } from '../common/format'
import ui from '../common/ui.module.css'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import type { TransactionView } from '../transactions/transactionsApi'
import { dashboardApi } from './dashboardApi'
import styles from './CategoryBreakdown.module.css'

type Props = { groupId: number; month: string; category: string | null; onClose: () => void }

const columns: DataColumn<TransactionView>[] = [
  { id: 'occurredAt', label: '일시', width: '110px', render: (tx) => formatDateTime(tx.occurredAt) },
  { id: 'owner', label: '멤버', width: '100px', render: (tx) => tx.ownerNickname },
  { id: 'categoryMinor', label: '소분류', render: (tx) => tx.categoryMinor },
  { id: 'description', label: '내용', isRowHeader: true, render: (tx) => tx.description },
  { id: 'paymentMethod', label: '결제수단', width: '110px', render: (tx) => tx.paymentMethod },
  { id: 'amount', label: '금액', width: '120px', align: 'end', render: (tx) => <span className={styles.txAmount}>{formatSignedWon(tx.amount)}</span> },
]

export default function CategoryTransactionsDialog({ groupId, month, category, onClose }: Props) {
  const narrow = useMediaQuery(NARROW)
  const [lastCategory, setLastCategory] = useState(category)
  if (category !== null && lastCategory !== category) setLastCategory(category)
  const displayedCategory = category ?? lastCategory
  const transactions = useQuery({
    queryKey: ['summary', groupId, month, 'transactions', displayedCategory],
    queryFn: () => dashboardApi.categoryTransactions(groupId, month, displayedCategory!),
    enabled: category !== null,
  })
  const items = transactions.data ?? []
  const total = -items.reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <DialogFrame isOpen={category !== null} title={displayedCategory ?? ''} onOpenChange={(open) => { if (!open) onClose() }}
      closeOnOutsideClick wide headerAction={<button type="button" className={ui.button} onClick={onClose}>닫기</button>}>
      {() => (
        <div className={styles.dialogBody}>
          {transactions.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {transactions.isError && <div className={ui.row}>
            <p role="alert" className={ui.alert}>거래를 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void transactions.refetch()}>다시 시도</button>
          </div>}
          {transactions.isSuccess && <>
            <p className={styles.summary}>{items.length}건 · 합계 {formatWon(total)}</p>
            {items.length === 0 ? <p className={ui.status}>거래가 없습니다.</p> : narrow ? (
              <CardList label="거래 목록" items={items} textValue={(tx) => tx.description} onAction={() => {}}>
                {(tx) => <>
                  <div className={styles.cardTop}><span>{tx.description}</span><span>{formatSignedWon(tx.amount)}</span></div>
                  <div className={styles.cardMeta}>{[formatDateTime(tx.occurredAt), tx.categoryMinor, tx.ownerNickname].filter(Boolean).join(' · ')}</div>
                </>}
              </CardList>
            ) : <DataTable label="거래 목록" columns={columns} items={items} rowText={(tx) => tx.description} onRowAction={() => {}} />}
          </>}
        </div>
      )}
    </DialogFrame>
  )
}
