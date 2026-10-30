import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

type Props = { title: string; action?: ReactNode }

/** 주 화면 제목 줄. 동작 버튼이 없어도 높이가 같아 화면마다 제목이 같은 자리에 놓인다. */
export default function PageHeader({ title, action }: Props) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {action}
    </div>
  )
}
