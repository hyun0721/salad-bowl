import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockViewport } from '../test/mockViewport'
import SortButton, { type SortOption } from './SortButton'

type S = 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC'
const options: SortOption<S>[] = [
  { value: 'DATE_DESC', label: '최신순', direction: 'desc' },
  { value: 'DATE_ASC', label: '오래된순', direction: 'asc' },
  { value: 'AMOUNT_DESC', label: '금액 큰 순', direction: 'desc' },
]
afterEach(() => vi.unstubAllGlobals())

describe('SortButton', () => {
  it('names the current sort and marks non-default as applied', () => {
    const { rerender } = render(<SortButton options={options} value="DATE_DESC" defaultValue="DATE_DESC" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '정렬, 최신순' })).not.toHaveAttribute('data-applied')
    rerender(<SortButton options={options} value="AMOUNT_DESC" defaultValue="DATE_DESC" onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '정렬, 금액 큰 순' })).toHaveAttribute('data-applied')
  })

  it('applies the draft only on 적용, and 초기화 resets the draft to default', async () => {
    mockViewport(true)
    const onApply = vi.fn()
    render(<SortButton options={options} value="AMOUNT_DESC" defaultValue="DATE_DESC" onApply={onApply} />)
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    await userEvent.click(screen.getByRole('radio', { name: '오래된순' }))
    expect(onApply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByRole('radio', { name: '최신순' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onApply).toHaveBeenCalledWith('DATE_DESC')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([false, true])('applies a keyboard-selected draft with mobile=%s', async (mobile) => {
    mockViewport(mobile)
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<SortButton options={options} value="DATE_DESC" defaultValue="DATE_DESC" onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: /정렬/ }))
    await user.click(screen.getByRole('radio', { name: '최신순' }))
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: '오래된순' })).toBeChecked()
    expect(onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '적용' }))
    expect(onApply).toHaveBeenCalledExactlyOnceWith('DATE_ASC')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([false, true])('discards the draft when closed without applying with mobile=%s', async (mobile) => {
    mockViewport(mobile)
    render(<SortButton options={options} value="DATE_DESC" defaultValue="DATE_DESC" onApply={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    await userEvent.click(screen.getByRole('radio', { name: '오래된순' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    expect(screen.getByRole('radio', { name: '최신순' })).toBeChecked()
  })

  it.each([false, true])('closes with the X button without applying with mobile=%s', async (mobile) => {
    mockViewport(mobile)
    const onApply = vi.fn()
    render(<SortButton options={options} value="DATE_DESC" defaultValue="DATE_DESC" onApply={onApply} />)
    await userEvent.click(screen.getByRole('button', { name: /정렬/ }))
    await userEvent.click(screen.getByRole('radio', { name: '오래된순' }))
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
  })
})
