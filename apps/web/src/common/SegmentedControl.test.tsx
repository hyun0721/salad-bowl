import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SegmentedControl from './SegmentedControl'

const items = [{ id: 'mine', label: '내 거래' }, { id: 'group', label: '그룹 거래' }]

describe('SegmentedControl', () => {
  it('selects exactly one option and reports changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl label="범위" items={items} selectedKey="mine" onSelectionChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: '범위' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '내 거래' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: '그룹 거래' }))
    expect(onChange).toHaveBeenCalledWith('group')

    onChange.mockClear()
    await user.click(screen.getByRole('radio', { name: '내 거래' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables an option', () => {
    render(<SegmentedControl label="범위" items={[items[0], { ...items[1], isDisabled: true }]} selectedKey="mine" onSelectionChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: '그룹 거래' })).toBeDisabled()
  })
})
