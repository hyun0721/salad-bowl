import { useId, useState } from 'react'
import { currentYearMonth, isYearMonth, shiftMonth } from './format'
import Icon from './Icon'
import { NARROW, useMediaQuery } from './useMediaQuery'
import styles from './MonthPicker.module.css'
import ui from './ui.module.css'

type Props = { month: string; onChange: (month: string) => void; label?: string }

/**
 * 이전·다음 달 버튼과 월 입력. 완전한 `YYYY-MM`일 때만 onChange를 부른다.
 * type="month"를 글자 칸으로 보여주는 브라우저에서 덜 입력된 값으로 조회하지 않기 위해서다.
 */
export default function MonthPicker({ month, onChange, label }: Props) {
  const compact = useMediaQuery(NARROW) && label === undefined
  const prefix = !label || label === '월' ? '' : `${label} `
  const monthLabel = `${month.slice(0, 4) === currentYearMonth().slice(0, 4) ? '' : month.slice(2, 4) + '년 '}${Number(month.slice(5))}월`
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
    <div className={`${styles.picker} ${compact ? styles.compact : ''}`}>
      <button type="button" className={`${ui.button} ${styles.step}`} aria-label={`${prefix}이전 달`}
        onClick={() => onChange(shiftMonth(month, -1))}><Icon name="chevron-left" size={18} /></button>
      <label className={styles.field}>
        {/* 기본 '월'은 입력값이 이미 연·월을 보여 주므로 화면에서는 숨기고 이름으로만 남긴다. */}
        <span className={prefix ? undefined : styles.srOnly}>{label ?? '월'}</span>
        {compact && <span className={styles.monthValue} aria-hidden="true">{monthLabel}</span>}
        <input type="month" aria-label={label ?? '월'} className={ui.input} value={draft} aria-invalid={!valid}
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
