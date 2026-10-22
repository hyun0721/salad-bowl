import { useState } from 'react'
import {
  Button, Dialog, Heading, Label, ListBox, ListBoxItem,
  Popover, Select as AriaSelect, SelectValue, type SelectProps,
} from 'react-aria-components'
import Icon from './Icon'
import { useMediaQuery } from './useMediaQuery'
import styles from './Select.module.css'

type Item = { id: string | number; label: string }
type Props = {
  label: string
  items: Item[]
  selectedKey: SelectProps<Item>['selectedKey']
  onSelectionChange: SelectProps<Item>['onSelectionChange']
}

export default function Select({ label, items, selectedKey, onSelectionChange }: Props) {
  const narrow = useMediaQuery('(max-width: 820px)')
  // 열린 동안 폭이 바뀌어도(회전 등) 팝오버와 시트를 바꾸지 않는다. 바꾸면 포커스와 위치가 깨진다.
  const [openedNarrow, setOpenedNarrow] = useState<boolean | null>(null)
  const mobile = openedNarrow ?? narrow
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
    <AriaSelect selectedKey={selectedKey} onSelectionChange={onSelectionChange} className={styles.select}
      onOpenChange={(open) => setOpenedNarrow(open ? narrow : null)}>
      <Label className={styles.label}>{label}</Label>
      <Button className={styles.trigger}>
        <SelectValue className={styles.value} />
        <span className={styles.chevron}><Icon name="chevron-down" size={18} /></span>
      </Button>
      {/* Modal은 닫힌 상태에서 컬렉션을 수집하지 못하므로 모바일도 Popover를 쓴다. */}
      {mobile ? (
        <Popover placement="bottom start" className={styles.sheet}>
          <Dialog className={styles.dialog}>
            <Heading slot="title" className={styles.title}>{label}</Heading>
            {list}
          </Dialog>
        </Popover>
      ) : <Popover placement="bottom start" offset={4} className={styles.popover}>{list}</Popover>}
    </AriaSelect>
  )
}
