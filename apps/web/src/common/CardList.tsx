import type { ReactNode } from 'react'
import { GridList, GridListItem, type Key } from 'react-aria-components'
import styles from './CardList.module.css'

type Props<T extends { id: Key }> = {
  label: string
  items: T[]
  textValue: (item: T) => string
  currentId?: Key | null
  onAction: (id: Key) => void
  children: (item: T) => ReactNode
}

/** 좁은 화면에서 표 대신 쓰기 위한 카드 목록. */
export default function CardList<T extends { id: Key }>({ label, items, textValue, currentId, onAction, children }: Props<T>) {
  return (
    <GridList aria-label={label} items={items} dependencies={[currentId]} onAction={onAction} className={styles.list}>
      {(item) => (
        <GridListItem id={item.id} textValue={textValue(item)}
          className={item.id === currentId ? `${styles.card} ${styles.current}` : styles.card}>
          {children(item)}
        </GridListItem>
      )}
    </GridList>
  )
}
