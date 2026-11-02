import { useState } from 'react'
import { Button, DialogTrigger, Radio, RadioGroup, Label } from 'react-aria-components'
import Icon from './Icon'
import { Indicator } from './SelectionIndicator'
import { ResponsiveOverlay } from './ResponsiveOverlay'
import { useNarrowWhileOpen } from './useMediaQuery'
import ui from './ui.module.css'
import styles from './OptionButton.module.css'

export type SortOption<T extends string> = { value: T; label: string; direction: 'asc' | 'desc' }
type Props<T extends string> = { options: SortOption<T>[]; value: T; defaultValue: T; onApply: (next: T) => void }

export default function SortButton<T extends string>({ options, value, defaultValue, onApply }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const mobile = useNarrowWhileOpen(open)
  const current = options.find((o) => o.value === value)
  const applied = value !== defaultValue
  const icon = !applied ? 'arrow-up-down' : current?.direction === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow'

  function toggle(next: boolean) {
    if (next) setDraft(value)
    setOpen(next)
  }

  return (
    <DialogTrigger isOpen={open} onOpenChange={toggle}>
      <Button type="button" className={`${ui.button} ${ui.iconButton} ${styles.trigger} ${applied ? styles.applied : ''}`}
        data-applied={applied || undefined} aria-label={`정렬, ${current?.label ?? ''}`}>
        <Icon name={icon} />
      </Button>
      <ResponsiveOverlay mobile={mobile} title="정렬">
        <div className={styles.panel}>
          <RadioGroup value={draft} onChange={(v) => setDraft(v as T)} className={styles.group}>
            <Label className={styles.legend}>정렬 기준</Label>
            {options.map((o) => (
              <Radio key={o.value} value={o.value} className={styles.radio}>
                {({ isSelected }) => <>
                  <span className={styles.radioMark} aria-hidden="true">
                    <Indicator isSelected={isSelected} className={styles.indicator} />
                  </span>
                  {o.label}
                </>}
              </Radio>
            ))}
          </RadioGroup>
          <div className={styles.actions}>
            <button type="button" className={ui.button} onClick={() => setDraft(defaultValue)}>초기화</button>
            <button type="button" className={`${ui.button} ${ui.primary}`}
              onClick={() => { onApply(draft); setOpen(false) }}>적용</button>
          </div>
        </div>
      </ResponsiveOverlay>
    </DialogTrigger>
  )
}
