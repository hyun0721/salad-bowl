import {
  Button, Label, ListBox, ListBoxItem,
  Select as AriaSelect, SelectValue, type SelectProps,
} from 'react-aria-components'
import Icon from './Icon'
import { ResponsiveOverlay, useOverlayMode } from './ResponsiveOverlay'
import styles from './Select.module.css'

type Item = { id: string | number; label: string }
type Props = {
  label: string
  variant?: 'inline' | 'field'
  items: Item[]
  selectedKey: SelectProps<Item>['selectedKey']
  onSelectionChange: SelectProps<Item>['onSelectionChange']
}

export default function Select({ label, items, selectedKey, onSelectionChange, variant = 'inline' }: Props) {
  const { mobile, onOpenChange } = useOverlayMode()
  const list = (
    <ListBox items={items} className={styles.list} aria-label={label}>
      {(item) => (
        <ListBoxItem id={item.id} textValue={item.label} className={styles.item}>
          {({ isSelected }) => <><span>{item.label}</span>{isSelected && <Icon name="check" size={18} />}</>}
        </ListBoxItem>
      )}
    </ListBox>
  )

  return (
    <AriaSelect selectedKey={selectedKey} onSelectionChange={onSelectionChange} data-variant={variant}
      className={variant === 'field' ? `${styles.select} ${styles.field}` : styles.select}
      onOpenChange={onOpenChange}>
      <Label className={styles.label}>{label}</Label>
      <Button className={styles.trigger}>
        <SelectValue className={styles.value} />
        <span className={styles.chevron}><Icon name="chevron-down" size={18} /></span>
      </Button>
      <ResponsiveOverlay mobile={mobile} title={label} dialog={false}>{list}</ResponsiveOverlay>
    </AriaSelect>
  )
}
