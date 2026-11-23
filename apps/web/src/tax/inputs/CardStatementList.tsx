import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import ConfirmDialog from '../../common/ConfirmDialog'
import HelpButton from '../../common/HelpButton'
import Icon from '../../common/Icon'
import ui from '../../common/ui.module.css'
import { actionError, isStale, taxApi, taxKeys, useTaxSave, type CardView, type TaxYearView } from '../taxApi'
import { fillBlanks, sumAmounts } from './amounts'
import CardStatementDialog from './CardStatementDialog'
import styles from './inputs.module.css'

/** 서버의 연도 기록당 카드 자료 상한(PR 3). 넘으면 서버가 400을 준다. */
const MAX_CARDS = 50

type Props = { view: TaxYearView; defaultAsOfDate: string }

/** 신용·체크 자료 목록. 카드사마다 한 건이다. */
export default function CardStatementList({ view, defaultAsOfDate }: Props) {
  const [editing, setEditing] = useState<CardView | 'new' | null>(null)
  const full = view.cards.length >= MAX_CARDS
  return (
    <section aria-labelledby="tax-cards-title" className={ui.card}>
      <div className={styles.split}>
        <div className={styles.titleWithHelp}>
          <h2 id="tax-cards-title">신용·체크 자료</h2>
          <HelpButton title="신용·체크 자료">카드사마다 1월 1일부터 기준일까지의 누계를 한 건씩 등록합니다. 같은 카드사명을 다시 등록해도 됩니다.</HelpButton>
        </div>
        <button type="button" className={ui.button} disabled={full} onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />신용·체크 자료 추가
        </button>
      </div>
      {full && <p className={ui.muted}>신용·체크 자료는 연도마다 {MAX_CARDS}건까지 등록할 수 있습니다.</p>}
      {view.cards.length === 0 ? (
        <p className={ui.status}>등록한 신용·체크 자료가 없습니다.</p>
      ) : (
        <ul className={styles.list}>
          {view.cards.map((card) => <CardRow key={card.id} year={view.taxYear} card={card} onEdit={() => setEditing(card)} />)}
        </ul>
      )}
      {editing && (
        <CardStatementDialog year={view.taxYear} card={editing === 'new' ? null : editing} defaultAsOfDate={defaultAsOfDate}
          onClose={() => setEditing(null)} />
      )}
    </section>
  )
}

function CardRow({ year, card, onEdit }: { year: number; card: CardView; onEdit: () => void }) {
  const expense = useAmountFormatter('expense')
  const client = useQueryClient()
  const reload = () => client.invalidateQueries({ queryKey: taxKeys.year(year) })
  const fill = useTaxSave(() => taxApi.saveCard(year, card.id, {
    issuerName: card.issuerName, asOfDate: card.asOfDate, memo: card.memo, amounts: fillBlanks(card.amounts), rowVersion: card.rowVersion,
  }))
  // 삭제는 204라 연도를 다시 읽는다. 다른 곳에서 바뀌었어도 새로 불러와 최신 목록을 보인다.
  const remove = useMutation({
    mutationFn: () => taxApi.deleteCard(year, card.id, card.rowVersion),
    onSuccess: () => reload(),
    onError: (error) => { if (isStale(error)) void reload() },
  })
  return (
    <li className={styles.split}>
      <div className={styles.rowInfo}>
        <p className={styles.name}>{card.issuerName}</p>
        <p className={card.blankCount > 0 ? styles.note : ui.muted}>{card.blankCount > 0 ? `미완료 · 빈 칸 ${card.blankCount}개` : '완료'}</p>
        <p className={ui.muted}>기준일 {card.asOfDate} · 합계 {expense(sumAmounts(card.amounts))}{card.memo && ` · ${card.memo}`}</p>
        {fill.error && <p role="alert" className={ui.alert}>{actionError(fill.error)}</p>}
      </div>
      <div className={styles.actions}>
        {card.blankCount > 0 && (
          <button type="button" className={ui.button} disabled={fill.isPending}
            onClick={() => fill.mutate(undefined, { onError: (error) => { if (isStale(error)) void reload() } })}>빈 칸 0원으로 채우기</button>
        )}
        <button type="button" className={ui.button} aria-label={`${card.issuerName} 자료 편집`} onClick={onEdit}>편집</button>
        <ConfirmDialog centered triggerLabel="삭제" triggerAriaLabel={`${card.issuerName} 자료 삭제`}
          title={`${card.issuerName} 자료를 삭제할까요?`} description="이 자료의 금액 8칸이 지워지고 연도 합계표에서 빠집니다. 복구할 수 없습니다."
          confirmLabel="삭제" isPending={remove.isPending} error={remove.error ? actionError(remove.error) : null}
          onOpen={() => remove.reset()} onConfirm={(close) => remove.mutate(undefined, { onSuccess: close })} />
      </div>
    </li>
  )
}
