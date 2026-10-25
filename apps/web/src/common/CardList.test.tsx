import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CardList from './CardList'

const items = [{ id: 1, name: '김밥' }, { id: 2, name: '월급' }]

describe('CardList', () => {
  it('updates the current card when currentId changes with the same items', () => {
    const props = {
      label: '거래 목록', items, textValue: (i: typeof items[number]) => i.name, onAction: vi.fn(),
      children: (i: typeof items[number]) => <span>{i.name}</span>,
    }
    const { rerender } = render(<CardList {...props} currentId={1} />)
    expect(screen.getByRole('row', { name: '김밥' })).toHaveClass('current')
    expect(screen.getByRole('row', { name: '월급' })).not.toHaveClass('current')

    rerender(<CardList {...props} currentId={2} />)
    expect(screen.getByRole('row', { name: '월급' })).toHaveClass('current')
    expect(screen.getByRole('row', { name: '김밥' })).not.toHaveClass('current')
  })

  it('lists cards and opens one by tap and by Enter', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(<CardList label="거래 목록" items={items} textValue={(i) => i.name} currentId={2} onAction={onAction}>{(i) => <span>{i.name}</span>}</CardList>)

    const list = screen.getByRole('grid', { name: '거래 목록' })
    expect(within(list).getAllByRole('row')).toHaveLength(2)
    expect(within(list).getByRole('row', { name: '월급' })).toHaveClass('current')

    await user.click(within(list).getByRole('row', { name: '김밥' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onAction.mock.calls).toEqual([[1], [2]])
  })
})
