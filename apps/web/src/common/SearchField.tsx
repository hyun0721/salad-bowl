import { Button, Input, Label, SearchField as AriaSearchField } from 'react-aria-components'
import Icon from './Icon'
import styles from './Field.module.css'

type Props = { label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }

/** 지우기 버튼과 Esc로 비우는 검색칸. 브라우저 기본 지우기 버튼은 모양이 제각각이라 숨긴다. */
export default function SearchField({ label, placeholder, className, ...rest }: Props) {
  return (
    <AriaSearchField {...rest} className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label className={styles.label}>{label}</Label>
      <div className={styles.search}>
        <Input placeholder={placeholder} className={styles.input} />
        <Button aria-label="검색어 지우기" className={styles.clear}><Icon name="x" size={18} /></Button>
      </div>
    </AriaSearchField>
  )
}
