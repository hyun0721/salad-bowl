import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import CardList from '../common/CardList'
import DataTable from '../common/DataTable'
import { DialogFrame } from '../common/Dialog'
import { formatWon } from '../common/format'
import Icon from '../common/Icon'
import ui from '../common/ui.module.css'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
import { TransactionCard, transactionColumns } from '../transactions/transactionRows'
import { dashboardApi } from './dashboardApi'
import styles from './CategoryBreakdown.module.css'

type Props = { groupId: number; month: string; category: string | null; onClose: () => void }

export default function CategoryTransactionsDialog({ groupId, month, category, onClose }: Props) {
  const navigate = useNavigate()
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
  // 대분류에서 한 단계 들어가는 이동이라 push한다. 뒤로가기로 대분류 화면에 돌아온다.
  const showMinors = () => {
    onClose()
    navigate(`/dashboard/minor?${new URLSearchParams({ month, major: displayedCategory ?? '' })}`, { state: { focusSubcategories: true } })
  }

  return (
    <DialogFrame isOpen={category !== null} title={displayedCategory ?? ''} onOpenChange={(open) => { if (!open) onClose() }}
      closeOnOutsideClick wide pinnedHeader headerAction={
        <div className={ui.row}>
          <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label={`${displayedCategory} 소분류 보기`} onClick={showMinors}>
            <Icon name="chart" />
          </button>
          <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label="닫기" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
      }>
      {() => (
        <div className={styles.dialogBody}>
          {transactions.isPending && <p className={ui.status}>불러오는 중입니다.</p>}
          {transactions.isError && <div className={ui.row}>
            <p role="alert" className={ui.alert}>거래를 불러오지 못했습니다.</p>
            <button type="button" className={ui.button} onClick={() => void transactions.refetch()}>다시 시도</button>
          </div>}
          {transactions.isSuccess && <>
            <p className={styles.summary}>{items.length}건 · 합계 {formatWon(total)}</p>
            {items.length === 0 ? <p className={ui.status}>거래가 없습니다.</p> : (
              <div className={styles.dialogList} data-dialog-list="">
                {narrow ? (
                  <CardList label="거래 목록" items={items} textValue={(tx) => tx.description} onAction={() => {}}>
                    {(tx) => <TransactionCard tx={tx} showOwner />}
                  </CardList>
                ) : <DataTable label="거래 목록" columns={transactionColumns(true)} items={items} rowText={(tx) => tx.description} onRowAction={() => {}} />}
              </div>
            )}
          </>}
        </div>
      )}
    </DialogFrame>
  )
}
