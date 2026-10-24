import type { ReactNode } from 'react'
import { SwitchButton, SwitchField } from 'react-aria-components'
import styles from './Field.module.css'

type Props = { children: ReactNode; isSelected: boolean; onChange: (value: boolean) => void; isDisabled?: boolean }

/** 누르는 즉시 반영되는 설정에 쓴다. */
export default function Switch({ children, ...rest }: Props) {
  return (
    <SwitchField {...rest}>
      <SwitchButton className={styles.check}>
        <span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span>
        {children}
      </SwitchButton>
    </SwitchField>
  )
}
