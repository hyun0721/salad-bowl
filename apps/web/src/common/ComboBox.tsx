import { Button, ComboBox as AriaComboBox, FieldError, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components'
import Icon from './Icon'
import fields from './Field.module.css'
import styles from './ComboBox.module.css'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  isRequired?: boolean
  maxLength?: number
}

/**
 * 후보가 있는 입력칸. 목록에 없는 값도 그대로 쓴다(allowsCustomValue).
 * 모바일에서도 입력칸 바로 아래 팝오버를 쓴다. 하단 시트는 화면 키보드에 가려진다.
 */
export default function ComboBox({ label, value, onChange, options, isRequired, maxLength }: Props) {
  const items = options.map((name) => ({ id: name, name }))
  // items를 주면 RAC가 입력값으로 거르지 않는다(useComboBoxState). defaultItems로 기본 필터(포함 검색)를 쓴다.
  return (
    <AriaComboBox allowsCustomValue inputValue={value} onInputChange={onChange} defaultItems={items}
      menuTrigger="focus" isRequired={isRequired} validationBehavior="native" className={fields.field}>
      <Label className={fields.label}>{label}</Label>
      <div className={styles.wrap}>
        <Input maxLength={maxLength} className={`${fields.input} ${styles.input}`} />
        {options.length > 0 && (
          <Button aria-label={`${label} 후보 보기`} className={styles.button}><Icon name="chevron-down" size={18} /></Button>
        )}
      </div>
      <FieldError className={fields.error} />
      <Popover placement="bottom start" offset={4} className={styles.popover}>
        <ListBox className={styles.list}>
          {(item: { id: string; name: string }) => <ListBoxItem id={item.id} className={styles.item}>{item.name}</ListBoxItem>}
        </ListBox>
      </Popover>
    </AriaComboBox>
  )
}
