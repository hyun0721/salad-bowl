import { useState } from 'react'
import { parseDate, parseDateTime, type DateValue } from '@internationalized/date'
import {
  Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment,
  FieldError, Group, Heading, Label,
} from 'react-aria-components'
import Icon from './Icon'
import { ResponsiveOverlay } from './ResponsiveOverlay'
import { useNarrowWhileOpen } from './useMediaQuery'
import fields from './Field.module.css'
import styles from './DateTimePicker.module.css'

type Props = {
  label: string; value: string; onChange: (value: string) => void; isRequired?: boolean
  /** 'day'면 연·월·일만 받고 YYYY-MM-DD로 주고받는다. minValue·maxValue(YYYY-MM-DD) 밖이면 필드 오류로 제출을 막는다. */
  granularity?: 'minute' | 'day'; minValue?: string; maxValue?: string
}

function toValue(text: string, day: boolean): DateValue | null {
  if (!text) return null
  try {
    return day ? parseDate(text) : parseDateTime(text)
  } catch {
    return null
  }
}

/** 연·월·일·시·분을 칸별로 입력하거나 달력에서 고른다. API에는 지금처럼 YYYY-MM-DDTHH:mm으로 보낸다. */
export default function DateTimePicker({ label, value, onChange, isRequired, granularity = 'minute', minValue, maxValue }: Props) {
  const [open, setOpen] = useState(false)
  const mobile = useNarrowWhileOpen(open)
  const day = granularity === 'day'
  return (
    <DatePicker value={toValue(value, day)} onChange={(v) => onChange(v ? v.toString().slice(0, day ? 10 : 16) : '')}
      granularity={granularity} hourCycle={24} isRequired={isRequired} validationBehavior="native"
      minValue={minValue ? parseDate(minValue) : undefined} maxValue={maxValue ? parseDate(maxValue) : undefined}
      onOpenChange={setOpen} className={fields.field}>
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
