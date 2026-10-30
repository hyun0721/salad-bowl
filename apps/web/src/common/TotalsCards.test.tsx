import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TotalsCards from './TotalsCards'

describe('TotalsCards', () => {
  it('shows income and expense in won and reports which one was pressed', async () => {
    const onSelect = vi.fn()
    render(<TotalsCards income={3000000} expense={250000} onSelect={onSelect} />)
    const income = screen.getByRole('button', { name: '수입 ₩ 3,000,000' })
    expect(income).toHaveTextContent('₩ 3,000,000')
    expect(income).not.toHaveTextContent('(원)')
    expect(income).not.toHaveAttribute('aria-haspopup')
    await userEvent.click(screen.getByRole('button', { name: '지출 ₩ 250,000' }))
    expect(onSelect).toHaveBeenCalledWith('expense')
  })

  it('marks the cards as dialog openers when asked', () => {
    render(<TotalsCards income={0} expense={0} onSelect={() => {}} opensDialog />)
    expect(screen.getByRole('button', { name: '수입 ₩ 0' })).toHaveAttribute('aria-haspopup', 'dialog')
  })
})
