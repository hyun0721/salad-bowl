import { useRef, useState } from 'react'
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
type Excludes = string[] | undefined

const focusButton = (node: HTMLButtonElement | null) => { node?.focus() }
const key = (major: string, minor: string) => `${major}\t${minor}`
const isPicked = (excludes: Excludes, major: string, minor: string) => !excludes?.includes(major) && !excludes?.includes(key(major, minor))

/** 현재 후보의 제외값만 압축하고 다른 범위의 제외값은 보존한다. */
function compact(majors: CategoryOption[], selected: Set<string>, excludes: Excludes): string[] {
  const absent = (excludes ?? []).filter((item) => !majors.some((c) => item === c.major || c.minors.some((m) => item === key(c.major, m.minor))))
  return [...absent, ...majors.flatMap((c) => {
    const keys = c.minors.map((m) => key(c.major, m.minor)).filter((k) => !selected.has(k))
    return keys.length > 0 && keys.length === c.minors.length ? [c.major] : keys
  })]
}

function summary(excludes: Excludes, candidates: CategoryOption[]): string {
  const remaining = candidates.map((c) => ({ major: c.major, count: c.minors.filter((m) => isPicked(excludes, c.major, m.minor)).length, total: c.minors.length }))
  if (remaining.every((c) => c.count === c.total)) return '전체'
  const majors = remaining.filter((c) => c.count > 0)
  const partial = majors.some((c) => c.count < c.total) ? ' · 일부' : ''
  return majors.length === 0 ? '선택 안 함' : majors.length <= 2 ? majors.map((c) => c.major).join(', ') + partial : `${majors.length}/${candidates.length}개${partial}`
}

export default function TransactionFilter({ categories, value, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [step, setStep] = useState<TransactionType | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const [error, setError] = useState('')
  const returnType = useRef<TransactionType | null>(null)
  const mobile = useNarrowWhileOpen(open)
  const applied = isFilterApplied(value)

  function toggle(next: boolean) {
    if (next) { setDraft(value); setStep(null); setError('') }
    setOpen(next)
  }
  function setExcludes(type: TransactionType, excludes: string[]) {
    setDraft({ ...draft, excludes: { ...draft.excludes, [type]: excludes } })
  }
  function toggleType(type: TransactionType) {
    const types = draft.types.includes(type) ? draft.types.filter((t) => t !== type) : TRANSACTION_TYPES.filter((t) => t === type || draft.types.includes(t))
    setDraft({ ...draft, types })
  }
  function apply() {
    if (draft.types.length === 0) return setError('거래 종류를 하나 이상 선택하세요.')
    if (draft.types.some((t) => {
      const candidates = categories.filter((c) => c.type === t).flatMap((c) => c.minors.map((m) => isPicked(draft.excludes[t], c.major, m.minor)))
      return candidates.length > 0 && !candidates.some(Boolean)
    })) return setError('카테고리를 하나 이상 선택하세요.')
    onApply(draft)
    setOpen(false)
  }

  function categoryStep(type: TransactionType) {
    const majors = categories.filter((c) => c.type === type)
    const excludes = draft.excludes[type]
    const selected = new Set(majors.flatMap((c) => c.minors.filter((m) => isPicked(excludes, c.major, m.minor)).map((m) => key(c.major, m.minor))))
    const total = majors.reduce((sum, c) => sum + c.minors.length, 0)
    function set(keys: string[], on: boolean) {
      keys.forEach((k) => (on ? selected.add(k) : selected.delete(k)))
      setExcludes(type, compact(majors, selected, excludes))
    }
    return (
      <>
        <button type="button" ref={focusButton} className={`${ui.button} ${styles.back}`} onClick={() => setStep(null)}>
          <Icon name="chevron-left" />{TYPE_LABELS[type]} 카테고리
        </button>
        <Checkbox isSelected={selected.size === total} isIndeterminate={selected.size > 0 && selected.size < total}
          onChange={(on) => set(majors.flatMap((c) => c.minors.map((m) => key(c.major, m.minor))), on)}>모든 카테고리</Checkbox>
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
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} />
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
        <div className={`${optionStyles.actions} ${styles.actions}`}>
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
        <button type="button" className={`${ui.button} ${ui.iconButton} ${styles.close}`} aria-label="닫기"
          onClick={() => setOpen(false)}><Icon name="x" /></button>
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
                const text = summary(draft.excludes[t], categories.filter((c) => c.type === t))
                return (
                  <button key={t} type="button" ref={(node) => { if (returnType.current === t && node) { node.focus(); returnType.current = null } }} className={styles.row} aria-label={`${label} ${text}`}
                    onClick={() => { returnType.current = t; setStep(t); setExpanded([]) }}>
                    <span>{label}</span><span className={styles.summary}>{text}</span><Icon name="chevron-right" />
                  </button>
                )
              })}
              {error && <p role="alert" className={ui.alert}>{error}</p>}
              <div className={`${optionStyles.actions} ${styles.actions}`}>
                {/* 초기화는 바로 반영해 저장한 필터도 지운다. */}
                <button type="button" className={ui.button} onClick={() => { setDraft(DEFAULT_FILTER); setError(''); onApply(DEFAULT_FILTER) }}>초기화</button>
                <button type="button" className={`${ui.button} ${ui.primary}`} onClick={apply}>적용</button>
              </div>
            </>
          )}
        </div>
      </ResponsiveOverlay>
    </DialogTrigger>
  )
}
