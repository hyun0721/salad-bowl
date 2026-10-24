import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import styles from './SegmentedControl.module.css'

type Props = {
  label: string
  items: { id: string; label: string; isDisabled?: boolean }[]
  selectedKey: string
  onSelectionChange: (id: string) => void
}

/** 둘 이상 중 하나만 고르는 버튼 묶음. 늘 하나는 선택되어 있다. */
export default function SegmentedControl({ label, items, selectedKey, onSelectionChange }: Props) {
  return (
    <ToggleButtonGroup aria-label={label} selectionMode="single" disallowEmptySelection
      selectedKeys={[selectedKey]} onSelectionChange={(keys) => {
        const [key] = [...keys]
        // 이미 선택된 것을 다시 눌러도 RAC가 같은 키로 알려 오므로 걸러낸다.
        if (key != null && String(key) !== selectedKey) onSelectionChange(String(key))
      }} className={styles.group}>
      {items.map((item) => (
        <ToggleButton key={item.id} id={item.id} isDisabled={item.isDisabled} className={styles.button}>{item.label}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
