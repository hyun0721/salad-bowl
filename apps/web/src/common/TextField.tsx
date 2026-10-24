import { FieldError, Input, Label, Text, TextArea, TextField as AriaTextField } from 'react-aria-components'
import styles from './Field.module.css'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password'
  isRequired?: boolean
  maxLength?: number
  minLength?: number
  autoComplete?: string
  isReadOnly?: boolean
  description?: string
  className?: string
}

/** 보이는 라벨, 설명, 브라우저 검증 오류 자리를 같은 모양으로 둔 한 줄 입력칸. */
export default function TextField({ label, description, className, ...rest }: Props) {
  return (
    <AriaTextField {...rest} validationBehavior="native" className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label className={styles.label}>{label}</Label>
      <Input className={styles.input} />
      {description && <Text slot="description" className={styles.description}>{description}</Text>}
      <FieldError className={styles.error} />
    </AriaTextField>
  )
}

type AreaProps = { label: string; value: string; onChange: (value: string) => void; maxLength?: number; rows?: number }

export function TextAreaField({ label, rows = 2, ...rest }: AreaProps) {
  return (
    <AriaTextField {...rest} validationBehavior="native" className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <TextArea rows={rows} className={styles.input} />
      <FieldError className={styles.error} />
    </AriaTextField>
  )
}
