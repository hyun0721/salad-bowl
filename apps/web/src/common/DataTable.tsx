import { useMemo, useState, type ReactNode } from 'react'
import { Cell, Column, Row, Table, TableBody, TableHeader, type Key, type SortDescriptor } from 'react-aria-components'
import Icon from './Icon'
import styles from './DataTable.module.css'

export type DataColumn<T> = {
  id: string
  label: string
  isRowHeader?: boolean
  align?: 'end'
  width?: string
  /** 있으면 이 열 머리글로 정렬한다. 처음에는 서버가 준 순서를 그대로 둔다. */
  sortValue?: (item: T) => string | number
  render: (item: T) => ReactNode
}

type Props<T extends { id: Key }> = {
  label: string
  columns: DataColumn<T>[]
  items: T[]
  rowText: (item: T) => string
  currentId?: Key | null
  onRowAction: (id: Key) => void
}

export default function DataTable<T extends { id: Key }>({ label, columns, items, rowText, currentId, onRowAction }: Props<T>) {
  const [sort, setSort] = useState<SortDescriptor>()
  const sorted = useMemo(() => {
    const value = columns.find((c) => c.id === sort?.column)?.sortValue
    if (!sort || !value) return items
    const dir = sort.direction === 'descending' ? -1 : 1
    return [...items].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      return (x < y ? -1 : x > y ? 1 : 0) * dir
    })
  }, [items, columns, sort])

  const cellClass = (c: DataColumn<T>) => (c.align === 'end' ? `${styles.cell} ${styles.end}` : styles.cell)
  return (
    <Table aria-label={label} sortDescriptor={sort} onSortChange={setSort} onRowAction={onRowAction} className={styles.table}>
      <TableHeader columns={columns} className={styles.head}>
        {(c) => (
          <Column id={c.id} isRowHeader={c.isRowHeader} allowsSorting={!!c.sortValue} style={{ width: c.width }} className={cellClass(c)}>
            {({ sortDirection }) => (
              <>
                {c.label}
                {sortDirection && <span aria-hidden="true" className={sortDirection === 'ascending' ? styles.up : undefined}><Icon name="chevron-down" size={14} /></span>}
              </>
            )}
          </Column>
        )}
      </TableHeader>
      <TableBody items={sorted} dependencies={[currentId, columns]}>
        {(item) => (
          <Row id={item.id} columns={columns} textValue={rowText(item)}
            className={item.id === currentId ? `${styles.row} ${styles.current}` : styles.row}>
            {(c) => <Cell className={cellClass(c)}>{c.render(item)}</Cell>}
          </Row>
        )}
      </TableBody>
    </Table>
  )
}
