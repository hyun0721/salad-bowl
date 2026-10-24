import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DataTable, { type DataColumn } from './DataTable'

type Item = { id: number; name: string; amount: number }
const items: Item[] = [{ id: 1, name: '김밥', amount: -4000 }, { id: 2, name: '월급', amount: 3000 }, { id: 3, name: '국밥', amount: -9000 }]
const columns: DataColumn<Item>[] = [
  { id: 'name', label: '내용', isRowHeader: true, render: (i) => i.name },
  { id: 'amount', label: '금액', align: 'end', sortValue: (i) => i.amount, render: (i) => String(i.amount) },
]
const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getByRole('rowheader').textContent)

describe('DataTable', () => {
  it('is a labelled table with column headers in the given order', () => {
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} onRowAction={vi.fn()} />)
    const table = screen.getByRole('grid', { name: '거래 목록' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['내용', '금액'])
    expect(names()).toEqual(['김밥', '월급', '국밥'])
  })

  it('opens a row by click and by Enter after moving with arrow keys', async () => {
    const onRowAction = vi.fn()
    const user = userEvent.setup()
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} onRowAction={onRowAction} />)

    await user.click(screen.getByRole('row', { name: /김밥/ }))
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onRowAction.mock.calls).toEqual([[1], [2]])
  })

  it('sorts by a sortable column ascending then descending', async () => {
    const user = userEvent.setup()
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} onRowAction={vi.fn()} />)
    const amount = screen.getByRole('columnheader', { name: /금액/ })

    await user.click(amount)
    expect(amount).toHaveAttribute('aria-sort', 'ascending')
    expect(names()).toEqual(['국밥', '김밥', '월급'])

    await user.click(amount)
    expect(amount).toHaveAttribute('aria-sort', 'descending')
    expect(names()).toEqual(['월급', '김밥', '국밥'])
  })

  it('marks the current row', () => {
    render(<DataTable label="거래 목록" columns={columns} items={items} rowText={(i) => i.name} currentId={2} onRowAction={vi.fn()} />)
    expect(screen.getByRole('row', { name: /월급/ })).toHaveClass('current')
    expect(screen.getByRole('row', { name: /김밥/ })).not.toHaveClass('current')
  })
})
