import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FilterButton, { countFilters, type FilterGroup } from './FilterButton'

import { mockViewport } from '../test/mockViewport'

afterEach(() => vi.unstubAllGlobals())

const groups: FilterGroup[] = [
  { key: 'type', label: '타입', options: [{ value: 'EXPENSE', label: '지출' }, { value: 'INCOME', label: '수입' }] },
  { key: 'major', label: '대분류', options: [{ value: '식비', label: '식비' }] },
]

describe('FilterButton', () => {
  it('counts selections across groups', () => {
    expect(countFilters({ type: ['EXPENSE', 'INCOME'], major: [] })).toBe(2)
  })

  it('shows the applied state with count in its name', () => {
    const { rerender } = render(<FilterButton groups={groups} value={{}} onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '필터' })).not.toHaveAttribute('data-applied')
    rerender(<FilterButton groups={groups} value={{ type: ['EXPENSE'] }} onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: '필터, 1개 적용됨' })).toHaveAttribute('data-applied')
  })

  it('multi-selects in a draft, applies on 적용, and resets with 초기화', async () => {
    const onApply = vi.fn()
    const onDraftChange = vi.fn()
    render(<FilterButton groups={groups} value={{ major: ['식비'] }} onApply={onApply} onDraftChange={onDraftChange} />)
    await userEvent.click(screen.getByRole('button', { name: /필터/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: '지출' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '수입' }))
    expect(onDraftChange).toHaveBeenLastCalledWith({ major: ['식비'], type: ['EXPENSE', 'INCOME'] })
    expect(onApply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(screen.getByRole('checkbox', { name: '식비' })).not.toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: '지출' }))
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onApply).toHaveBeenCalledWith({ type: ['EXPENSE'] })
  })

  it.each([false, true])('discards the draft when closed without applying with mobile=%s', async (mobile) => {
    mockViewport(mobile)
    render(<FilterButton groups={groups} value={{}} onApply={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '필터' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '지출' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: '필터' }))
    expect(screen.getByRole('checkbox', { name: '지출' })).not.toBeChecked()
  })

  it.each([false, true])('supports keyboard deselection and omits empty groups with mobile=%s', async (mobile) => {
    mockViewport(mobile)
    const onApply = vi.fn()
    const value = { type: ['EXPENSE'], minor: [''] }
    render(<FilterButton groups={[...groups, { key: 'minor', label: '소분류', options: [{ value: '', label: '미분류' }] }]} value={value} onApply={onApply} />)
    await userEvent.click(screen.getByRole('button', { name: '필터, 2개 적용됨' }))
    screen.getByRole('checkbox', { name: '지출' }).focus()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('checkbox', { name: '지출' })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: '적용' }))
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ minor: [''] })
    expect(value).toEqual({ type: ['EXPENSE'], minor: [''] })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

})
