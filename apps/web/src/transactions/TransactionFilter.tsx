import { useState } from 'react'
import { Button, DialogTrigger } from 'react-aria-components'
import Checkbox from '../common/Checkbox'
import Icon from '../common/Icon'
import { ResponsiveOverlay } from '../common/ResponsiveOverlay'
import { useNarrowWhileOpen } from '../common/useMediaQuery'
import ui from '../common/ui.module.css'
import optionStyles from '../common/OptionButton.module.css'
import styles from './TransactionFilter.module.css'
import type { CategoryOption } from './categoriesApi'
import { TYPE_LABELS } from './TransactionPanel'
import { DEFAULT_FILTER, TRANSACTION_TYPES, isFilterApplied, type TransactionFilterValue } from './transactionQuery'
import type { TransactionType } from './transactionsApi'

type Props = { categories: CategoryOption[]; value: TransactionFilterValue; onApply: (next: TransactionFilterValue) => void }
type Picks = string[] | undefined

const key = (major: string, minor: string) => `${major}\t${minor}`
// picks가 없으면 전체, 'major'는 그 대분류 전체, 'major\tminor'는 소분류 하나다.
const isPicked = (picks: Picks, major: string, minor: string) => !picks || picks.includes(major) || picks.includes(key(major, minor))

/** 고른 (대분류, 소분류) 집합을 압축한다: 다 고른 대분류는 'major' 하나로, 다 고른 타입은 undefined로. */
function compact(majors: CategoryOption[], selected: Set<string>): Picks {
  const picks = majors.flatMap((c) => {
    const keys = c.minors.map((m) => key(c.major, m.minor)).filter((k) => selected.has(k))
    return keys.length === c.minors.length ? [c.major] : keys
  })
  return picks.length === majors.length && picks.every((p, i) => p === majors[i].major) ? undefined : picks
}

function summary(picks: Picks): string {
  if (!picks) return '전체'
  const majors = [...new Set(picks.map((p) => p.split('\t')[0]))]
  return majors.length === 0 ? '선택 안 함' : majors.length === 1 ? majors[0] : `${majors[0]} 외 ${majors.length - 1}`
}

export default function TransactionFilter({ categories, value, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [step, setStep] = useState<TransactionType | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const [error, setError] = useState('')
  const mobile = useNarrowWhileOpen(open)
  const applied = isFilterApplied(value)

  function toggle(next: boolean) {
    if (next) { setDraft(value); setStep(null); setError('') }
    setOpen(next)
  }
  function setPicks(type: TransactionType, picks: Picks) {
    setDraft({ ...draft, picks: { ...draft.picks, [type]: picks } })
  }
  function toggleType(type: TransactionType) {
    const types = draft.types.includes(type) ? draft.types.filter((t) => t !== type) : TRANSACTION_TYPES.filter((t) => t === type || draft.types.includes(t))
    setDraft({ ...draft, types })
  }
  function apply() {
    if (draft.types.length === 0) return setError('거래 종류를 하나 이상 선택하세요.')
    if (draft.types.some((t) => draft.picks[t]?.length === 0)) return setError('카테고리를 하나 이상 선택하세요.')
    const picks = Object.fromEntries(draft.types.filter((t) => draft.picks[t]).map((t) => [t, draft.picks[t]]))
    onApply({ types: draft.types, picks })
    setOpen(false)
  }

  function categoryStep(type: TransactionType) {
    const majors = categories.filter((c) => c.type === type)
    const picks = draft.picks[type]
    const selected = new Set(majors.flatMap((c) => c.minors.filter((m) => isPicked(picks, c.major, m.minor)).map((m) => key(c.major, m.minor))))
    const total = majors.reduce((sum, c) => sum + c.minors.length, 0)
    function set(keys: string[], on: boolean) {
      keys.forEach((k) => (on ? selected.add(k) : selected.delete(k)))
      setPicks(type, compact(majors, selected))
    }
    return (
      <>
        <button type="button" className={`${ui.button} ${styles.back}`} onClick={() => setStep(null)}>
          <Icon name="chevron-left" />{TYPE_LABELS[type]} 카테고리
        </button>
        <Checkbox isSelected={selected.size === total} isIndeterminate={selected.size > 0 && selected.size < total}
          onChange={(on) => setPicks(type, on ? undefined : [])}>모든 카테고리</Checkbox>
        <div className={styles.list}>
          {majors.map((c) => {
            const keys = c.minors.map((m) => key(c.major, m.minor))
            const count = keys.filter((k) => selected.has(k)).length
            const isOpen = expanded.includes(c.major)
            return (
              <div key={c.major}>
                <div className={styles.major}>
                  <Checkbox isSelected={count === keys.length} isIndeterminate={count > 0 && count < keys.length}
                    onChange={(on) => set(keys, on)}>{c.major}</Checkbox>
                  <span className={styles.summary}>{count}/{keys.length}</span>
                  <button type="button" className={`${ui.button} ${ui.iconButton}`} aria-label={`${c.major} 펼치기`} aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? expanded.filter((m) => m !== c.major) : [...expanded, c.major])}>
                    <Icon name="chevron-down" />
                  </button>
                </div>
                {isOpen && (
                  <div className={styles.minors}>
                    {c.minors.map((m) => (
                      <Checkbox key={m.minor} isSelected={selected.has(key(c.major, m.minor))}
                        onChange={(on) => set([key(c.major, m.minor)], on)}>{m.minor || '미분류'}</Checkbox>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className={optionStyles.actions}>
          <button type="button" className={`${ui.button} ${ui.primary}`} onClick={() => setStep(null)}>확인</button>
        </div>
      </>
    )
  }

  return (
    <DialogTrigger isOpen={open} onOpenChange={toggle}>
      <Button type="button" className={`${ui.button} ${ui.iconButton} ${optionStyles.trigger} ${applied ? optionStyles.applied : ''}`}
        data-applied={applied || undefined} aria-label={applied ? '필터, 적용됨' : '필터'}>
        <Icon name={applied ? 'funnel-filled' : 'funnel'} />
      </Button>
      <ResponsiveOverlay mobile={mobile} title="내역 필터">
        <div className={optionStyles.panel}>
          {step ? categoryStep(step) : (
            <>
              <div className={optionStyles.group}>
                <span className={optionStyles.legend}>거래 종류</span>
                <div className={styles.types}>
                  {TRANSACTION_TYPES.map((t) => (
                    <button key={t} type="button" className={ui.button} aria-pressed={draft.types.includes(t)}
                      onClick={() => toggleType(t)}>{TYPE_LABELS[t]}</button>
                  ))}
                </div>
              </div>
              {draft.types.map((t) => {
                const label = `${TYPE_LABELS[t]} 카테고리`
                const text = summary(draft.picks[t])
                return (
                  <button key={t} type="button" className={styles.row} aria-label={`${label} ${text}`}
                    onClick={() => { setStep(t); setExpanded([]) }}>
                    <span>{label}</span><span className={styles.summary}>{text}</span><Icon name="chevron-right" />
                  </button>
                )
              })}
              {error && <p role="alert" className={ui.alert}>{error}</p>}
              <div className={optionStyles.actions}>
                <button type="button" className={ui.button} onClick={() => { setDraft(DEFAULT_FILTER); setError('') }}>초기화</button>
                <button type="button" className={`${ui.button} ${ui.primary}`} onClick={apply}>적용</button>
              </div>
            </>
          )}
        </div>
      </ResponsiveOverlay>
    </DialogTrigger>
  )
}
