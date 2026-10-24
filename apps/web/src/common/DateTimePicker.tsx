import { parseDateTime, type CalendarDateTime } from '@internationalized/date'
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment,
  FieldError, Group, Heading, Label,
} from 'react-aria-components'
import Icon from './Icon'
import { ResponsiveOverlay, useOverlayMode } from './ResponsiveOverlay'
import fields from './Field.module.css'
import styles from './DateTimePicker.module.css'

type Props = { label: string; value: string; onChange: (value: string) => void; isRequired?: boolean }

function toValue(text: string): CalendarDateTime | null {
  if (!text) return null
  try {
    return parseDateTime(text)
  } catch {
    return null
  }
}

/** 연·월·일·시·분을 칸별로 입력하거나 달력에서 고른다. API에는 지금처럼 YYYY-MM-DDTHH:mm으로 보낸다. */
export default function DateTimePicker({ label, value, onChange, isRequired }: Props) {
  const { mobile, onOpenChange } = useOverlayMode()
  return (
    <DatePicker value={toValue(value)} onChange={(v) => onChange(v ? v.toString().slice(0, 16) : '')}
      granularity="minute" hourCycle={24} isRequired={isRequired} validationBehavior="native"
      onOpenChange={onOpenChange} className={fields.field}>
      <Label className={fields.label}>{label}</Label>
      <Group className={styles.group}>
        <DateInput className={styles.input}>
          {(segment) => <DateSegment segment={segment} className={styles.segment} />}
        </DateInput>
        <Button aria-label="달력 열기" className={styles.button}><Icon name="calendar" size={18} /></Button>
      </Group>
      <FieldError className={fields.error} />
      <ResponsiveOverlay mobile={mobile} title={label}>
        <Calendar className={styles.calendar}>
          <header className={styles.header}>
            <Button slot="previous" aria-label="이전 달" className={styles.nav}><Icon name="chevron-left" size={18} /></Button>
            <Heading className={styles.month} />
            <Button slot="next" aria-label="다음 달" className={styles.nav}><Icon name="chevron-right" size={18} /></Button>
          </header>
          <CalendarGrid className={styles.grid}>
            {(date) => <CalendarCell date={date} className={styles.cell} />}
          </CalendarGrid>
        </Calendar>
      </ResponsiveOverlay>
    </DatePicker>
  )
}
