import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import Icon from '../../common/Icon'
import ui from '../../common/ui.module.css'
import type { TaxYearView } from '../taxApi'
import { sumAmounts } from './amounts'
import CashReceiptDialog from './CashReceiptDialog'
import styles from './inputs.module.css'

/** 현금영수증 자료(연도에 1건). 한 번도 입력하지 않았으면 4칸이 빈 미완료다(TAX-24). 삭제는 없다(D19). */
export default function CashReceiptSection({ view, defaultAsOfDate }: { view: TaxYearView; defaultAsOfDate: string }) {
  const [open, setOpen] = useState(false)
  const expense = useAmountFormatter('expense')
  const cash = view.cashReceipt
  const status = !cash ? '미완료 · 4칸 빔' : cash.blankCount > 0 ? `미완료 · 빈 칸 ${cash.blankCount}개` : null
  return (
    <section aria-labelledby="tax-cash-title" className={ui.card}>
      <div className={styles.split}>
        <div className={styles.rowInfo}>
          <div className={styles.nameWithStatus}>
            <h2 id="tax-cash-title">현금영수증 자료</h2>
            {!status && <span role="img" aria-label="완료" className={styles.completeIcon}><Icon name="circle-check" size={18} /></span>}
          </div>
          {status && <p className={styles.note}>{status}</p>}
          {cash ? (
            <p className={ui.muted}>기준일 {cash.asOfDate} · 합계 {expense(sumAmounts(cash.amounts))}{cash.memo && ` · ${cash.memo}`}</p>
          ) : (
            <p className={ui.muted}>아직 입력하지 않았어요. 현금영수증을 쓰지 않았다면 저장만 하면 0원으로 기록돼요.</p>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={`${ui.button} ${cash ? ui.iconButton : ''}`} aria-label={cash ? '현금영수증 자료 편집' : '현금영수증 자료 입력'}
            onClick={() => setOpen(true)}>{cash ? <Icon name="pencil" size={18} /> : '입력'}</button>
        </div>
      </div>
      {open && (
        <CashReceiptDialog year={view.taxYear} cash={cash} defaultAsOfDate={defaultAsOfDate}
          onClose={() => setOpen(false)} />
      )}
    </section>
  )
}
