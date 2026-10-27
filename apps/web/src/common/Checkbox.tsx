import type { ReactNode } from 'react'
import { CheckboxButton, CheckboxField } from 'react-aria-components'
import Icon from './Icon'
import styles from './Field.module.css'

type Props = { children: ReactNode; isSelected: boolean; onChange: (value: boolean) => void; isDisabled?: boolean }

/** 저장 버튼을 눌러야 반영되는 선택에 쓴다. 누르는 즉시 반영되면 Switch를 쓴다. */
export default function Checkbox({ children, ...rest }: Props) {
  return (
    <CheckboxField {...rest}>
      <CheckboxButton className={styles.check}>
        {({ isSelected }) => (
          <>
            <span className={styles.box} aria-hidden="true">{isSelected && <Icon name="check" size={16} />}</span>
            {children}
          </>
        )}
      </CheckboxButton>
    </CheckboxField>
  )
}
