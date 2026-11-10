import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MonthPicker from './MonthPicker'
import { mockViewport } from '../test/mockViewport'

describe('MonthPicker', () => {
  it('names the step buttons after a custom label', () => {
    render(<MonthPicker label="시작 월" month="2026-10" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '시작 월 이전 달' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '시작 월 다음 달' })).toBeInTheDocument()
  })

  it('keeps the plain names with the default label', () => {
    render(<MonthPicker month="2026-10" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '이전 달' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 달' })).toBeInTheDocument()
  })

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

it('shows a compact month only for narrow default pickers', async () => {
  mockViewport(true)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 19))
  try {
    const onChange = vi.fn()
    const { rerender } = render(<MonthPicker month="2026-10" onChange={onChange} />)
    expect(screen.getByText('10월')).toBeInTheDocument()
    expect(screen.getByLabelText('월')).toHaveValue('2026-10')
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    fireEvent.change(screen.getByLabelText('월'), { target: { value: '2026-03' } })
    expect(onChange.mock.calls).toEqual([['2026-09'], ['2026-11'], ['2026-03']])
    fireEvent.change(screen.getByLabelText('월'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(screen.getByLabelText('월')).toHaveAttribute('aria-invalid', 'true')
    rerender(<MonthPicker month="2025-12" onChange={onChange} />)
    expect(screen.getByText('25년 12월')).toBeInTheDocument()
    rerender(<MonthPicker label="시작 월" month="2025-12" onChange={onChange} />)
    expect(screen.queryByText('25년 12월')).not.toBeInTheDocument()
    expect(screen.getByLabelText('시작 월')).toHaveValue('2025-12')
  } finally {
    vi.useRealTimers()
  }
})

