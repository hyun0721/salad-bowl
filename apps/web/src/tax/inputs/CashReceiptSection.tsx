import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import ui from '../../common/ui.module.css'
import type { TaxYearView } from '../taxApi'
import { sumAmounts } from './amounts'
import CashReceiptDialog from './CashReceiptDialog'
import styles from './inputs.module.css'

/** 현금영수증 자료(연도에 1건). 한 번도 입력하지 않았으면 4칸이 빈 미완료다(TAX-24). 삭제는 없다(D19). */
export default function CashReceiptSection({ view, defaultAsOfDate }: { view: TaxYearView; defaultAsOfDate: string }) {
  const [open, setOpen] = useState<'edit' | 'zeros' | null>(null)
  const expense = useAmountFormatter('expense')
  const cash = view.cashReceipt
  const status = !cash ? '미완료 · 4칸 빔' : cash.blankCount > 0 ? `미완료 · 빈 칸 ${cash.blankCount}개` : '완료'
  return (
    <section aria-labelledby="tax-cash-title" className={ui.card}>
      <div className={styles.split}>
        <div className={styles.rowInfo}>
          <h2 id="tax-cash-title">현금영수증 자료</h2>
          <p className={cash && cash.blankCount === 0 ? ui.muted : styles.note}>{status}</p>
          {cash ? (
            <p className={ui.muted}>기준일 {cash.asOfDate} · 합계 {expense(sumAmounts(cash.amounts))}{cash.memo && ` · ${cash.memo}`}</p>
          ) : (
            <p className={ui.muted}>아직 입력하지 않았습니다. 현금영수증을 쓰지 않았다면 0원으로 채웁니다.</p>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={ui.button} aria-label={cash ? '현금영수증 자료 편집' : '현금영수증 자료 입력'}
            onClick={() => setOpen('edit')}>{cash ? '편집' : '입력'}</button>
          {!cash && <button type="button" className={ui.button} onClick={() => setOpen('zeros')}>4칸 0원으로 채우기</button>}
        </div>
      </div>
      {open && (
        <CashReceiptDialog year={view.taxYear} cash={cash} zeros={open === 'zeros'} defaultAsOfDate={defaultAsOfDate}
          onClose={() => setOpen(null)} />
      )}
    </section>
  )
}
