import type { ReactNode } from 'react'
import { useMediaQuery } from './useMediaQuery'
import styles from './PageHeader.module.css'

type Props = { title: string; action?: ReactNode }

/** 좁은 화면의 제목은 앱 헤더에 두고 본문에는 동작 버튼만 남긴다. */
export default function PageHeader({ title, action }: Props) {
  const narrow = useMediaQuery('(max-width: 820px)')
  if (narrow && !action) return null
  return (
    <div className={narrow ? `${styles.header} ${styles.actionsOnly}` : styles.header}>
      {!narrow && <h1 className={styles.title}>{title}</h1>}
      {action}
    </div>
  )
}
