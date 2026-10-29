import { useId, useState } from 'react'
import { isYearMonth, shiftMonth } from './format'
import Icon from './Icon'
import styles from './MonthPicker.module.css'
import ui from './ui.module.css'

type Props = { month: string; onChange: (month: string) => void; label?: string }

/**
 * 이전·다음 달 버튼과 월 입력. 완전한 `YYYY-MM`일 때만 onChange를 부른다.
 * type="month"를 글자 칸으로 보여주는 브라우저에서 덜 입력된 값으로 조회하지 않기 위해서다.
 */
export default function MonthPicker({ month, onChange, label = '월' }: Props) {
  const prefix = label === '월' ? '' : `${label} `
  const hintId = useId()
  const [draft, setDraft] = useState(month)
  const [shown, setShown] = useState(month)
  if (shown !== month) {
    // 부모가 월을 바꾸면(버튼, 수동 추가 후 이동 등) 입력도 따라간다.
    setShown(month)
    setDraft(month)
  }
  const valid = isYearMonth(draft)

  return (
    <div className={styles.picker}>
      <button type="button" className={`${ui.button} ${styles.step}`} aria-label={`${prefix}이전 달`}
        onClick={() => onChange(shiftMonth(month, -1))}><Icon name="chevron-left" size={18} /></button>
      <label className={styles.field}>
        <span>{label}</span>
        <input type="month" className={ui.input} value={draft} aria-invalid={!valid}
          aria-describedby={valid ? undefined : hintId}
          onChange={(e) => {
            setDraft(e.target.value)
            if (isYearMonth(e.target.value)) onChange(e.target.value)
          }} />
      </label>
      <button type="button" className={`${ui.button} ${styles.step}`} aria-label={`${prefix}다음 달`}
        onClick={() => onChange(shiftMonth(month, 1))}><Icon name="chevron-right" size={18} /></button>
      {!valid && <p id={hintId} className={`${ui.muted} ${styles.hint}`}>2026-10처럼 연도와 월을 입력해 주세요.</p>}
    </div>
  )
}
