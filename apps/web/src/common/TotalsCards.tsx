import { formatWon } from './format'
import ui from './ui.module.css'
import styles from './TotalsCards.module.css'

export type TotalKind = 'income' | 'expense'

const KINDS: [TotalKind, string][] = [['income', '수입'], ['expense', '지출']]

type Props = { income: number; expense: number; onSelect: (kind: TotalKind) => void; opensDialog?: boolean }

export default function TotalsCards({ income, expense, onSelect, opensDialog }: Props) {
  const amounts: Record<TotalKind, number> = { income, expense }
  return (
    <div className={styles.totals}>
      {KINDS.map(([kind, label]) => (
        <button key={kind} type="button" aria-haspopup={opensDialog ? 'dialog' : undefined}
          aria-label={`${label} ${formatWon(amounts[kind])}`}
          className={`${ui.card} ${styles.total}`} onClick={() => onSelect(kind)}>
          <span className={styles.label}>{label}</span>
          <span className={`${styles.value} ${styles[kind]}`}>{formatWon(amounts[kind])}</span>
        </button>
      ))}
    </div>
  )
}
