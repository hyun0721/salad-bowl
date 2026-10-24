import { FieldError, Group, Input, Label, NumberField } from 'react-aria-components'
import styles from './Field.module.css'
import money from './MoneyField.module.css'

type Props = { label: string; value: number | null; onChange: (value: number | null) => void; isRequired?: boolean; minValue?: number }

const WON: Intl.NumberFormatOptions = { maximumFractionDigits: 0, useGrouping: true }

/** 원 단위 정수. 비우면 RAC가 NaN을 주므로 null로 바꿔 넘긴다. 휴대폰에서는 숫자 키패드가 뜬다. */
export default function MoneyField({ label, value, onChange, isRequired, minValue = 1 }: Props) {
  return (
    <NumberField value={value ?? Number.NaN} onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      isRequired={isRequired} minValue={minValue} formatOptions={WON} validationBehavior="native"
      isWheelDisabled className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <Group className={money.money}>
        <Input className={`${styles.input} ${money.input}`} />
        <span className={money.unit} aria-hidden="true">원</span>
      </Group>
      <FieldError className={styles.error} />
    </NumberField>
  )
}
