import { useState } from 'react'
import { Button, DialogTrigger } from 'react-aria-components'
import Checkbox from './Checkbox'
import Icon from './Icon'
import { ResponsiveOverlay } from './ResponsiveOverlay'
import { useNarrowWhileOpen } from './useMediaQuery'
import ui from './ui.module.css'
import styles from './OptionButton.module.css'

export type FilterGroup = { key: string; label: string; options: { value: string; label: string }[] }
export type FilterValue = Record<string, string[]>
type Props = {
  groups: FilterGroup[]
  value: FilterValue
  onApply: (next: FilterValue) => void
  /** 소분류처럼 다른 그룹 선택에 따라 옵션이 바뀌면 호출 쪽이 groups를 다시 계산한다. */
  onDraftChange?: (draft: FilterValue) => void
}

export function countFilters(value: FilterValue): number {
  return Object.values(value).reduce((sum, list) => sum + list.length, 0)
}

export default function FilterButton({ groups, value, onApply, onDraftChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraftState] = useState(value)
  const mobile = useNarrowWhileOpen(open)
  const count = countFilters(value)

  function setDraft(next: FilterValue) {
    setDraftState(next)
    onDraftChange?.(next)
  }
  function toggle(next: boolean) {
    if (next) setDraft(value)
    setOpen(next)
  }
  function check(key: string, option: string, selected: boolean) {
    const list = draft[key] ?? []
    setDraft({ ...draft, [key]: selected ? [...list, option] : list.filter((v) => v !== option) })
  }

  function apply() {
    const next = Object.fromEntries(Object.entries(draft)
      .map(([key, values]) => [key, values.filter((v) => groups.find((g) => g.key === key)?.options.some((o) => o.value === v))])
      .filter(([, values]) => values.length > 0))
    onApply(next)
    setOpen(false)
  }

  return (
    <DialogTrigger isOpen={open} onOpenChange={toggle}>
      <Button type="button" className={`${ui.button} ${ui.iconButton} ${styles.trigger} ${count > 0 ? styles.applied : ''}`}
        data-applied={count > 0 || undefined} aria-label={count > 0 ? `필터, ${count}개 적용됨` : '필터'}>
        <Icon name={count > 0 ? 'funnel-filled' : 'funnel'} />
      </Button>
      <ResponsiveOverlay mobile={mobile} title="필터">
        <div className={styles.panel}>
          {groups.map((g) => (
            <fieldset key={g.key} className={styles.group}>
              <legend className={styles.legend}>{g.label}</legend>
              {g.options.map((o) => (
                <Checkbox key={o.value} isSelected={(draft[g.key] ?? []).includes(o.value)}
                  onChange={(selected) => check(g.key, o.value, selected)}>{o.label}</Checkbox>
              ))}
            </fieldset>
          ))}
          <div className={styles.actions}>
            <button type="button" className={ui.button} onClick={() => setDraft({})}>초기화</button>
            <button type="button" className={`${ui.button} ${ui.primary}`}
              onClick={apply}>적용</button>
          </div>
        </div>
      </ResponsiveOverlay>
    </DialogTrigger>
  )
}
