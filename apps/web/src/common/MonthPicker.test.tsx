import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MonthPicker from './MonthPicker'

describe('MonthPicker', () => {
  it('moves one month back and forth', async () => {
    const onChange = vi.fn()
    render(<MonthPicker month="2026-12" onChange={onChange} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await user.click(screen.getByRole('button', { name: '다음 달' }))

    expect(onChange.mock.calls).toEqual([['2026-11'], ['2027-01']])
  })

  it('reports a complete month typed into the input', () => {
    const onChange = vi.fn()
    render(<MonthPicker month="2026-10" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('월'), { target: { value: '2026-03' } })

    expect(onChange).toHaveBeenCalledWith('2026-03')
  })

  it('ignores an incomplete value and shows the expected format', () => {
    const onChange = vi.fn()
    render(<MonthPicker month="2026-10" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('월'), { target: { value: '' } })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('2026-10처럼 연도와 월을 입력해 주세요.')).toBeInTheDocument()
    expect(screen.getByLabelText('월')).toHaveAttribute('aria-invalid', 'true')
  })

  it('follows a month changed by the parent', () => {
    const { rerender } = render(<MonthPicker month="2026-10" onChange={() => {}} />)

    rerender(<MonthPicker month="2025-01" onChange={() => {}} />)

    expect(screen.getByLabelText('월')).toHaveValue('2025-01')
  })
})
