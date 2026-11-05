import type { ReactNode } from 'react'
import { CheckboxButton, CheckboxField } from 'react-aria-components'
import Icon from './Icon'
import styles from './Field.module.css'

type Props = { isDisabled?: boolean; isIndeterminate?: boolean } & (
  | { children: ReactNode; isSelected: boolean; onChange: (value: boolean) => void; slot?: never }
  /** 표·목록 행의 선택 칸. 상태와 이름은 react-aria가 행에서 채운다. */
  | { children?: never; slot: 'selection'; isSelected?: never; onChange?: never }
)

/** 저장 버튼을 눌러야 반영되는 선택에 쓴다. 누르는 즉시 반영되면 Switch를 쓴다. */
export default function Checkbox({ children, ...rest }: Props) {
  return (
    <CheckboxField {...rest}>
      <CheckboxButton className={styles.check}>
        {({ isSelected, isIndeterminate }) => (
          <>
            <span className={styles.box} aria-hidden="true">{isIndeterminate ? '−' : isSelected && <Icon name="check" size={16} />}</span>
            {children}
          </>
        )}
      </CheckboxButton>
    </CheckboxField>
  )
}
