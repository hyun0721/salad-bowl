import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nProvider } from 'react-aria-components'
import { describe, expect, it, vi } from 'vitest'
import { mockViewport } from '../test/mockViewport'
import DateTimePicker from './DateTimePicker'

function Controlled({ onValue, initial = '' }: { onValue: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial)
  return <DateTimePicker label="일시" value={value} onChange={(v) => { setValue(v); onValue(v) }} isRequired />
}

function renderPicker(onValue = vi.fn(), initial?: string) {
  const user = userEvent.setup()
  render(<I18nProvider locale="ko-KR"><Controlled onValue={onValue} initial={initial} /></I18nProvider>)
  return { user, onValue }
}

describe('DateTimePicker', () => {
  it('reports YYYY-MM-DDTHH:mm after typing every segment', async () => {
    const { user, onValue } = renderPicker()
    const group = screen.getByRole('group', { name: '일시' })
    const segments = within(group).getAllByRole('spinbutton')

    await user.click(segments[0])
    await user.keyboard('202610051330')

    expect(onValue).toHaveBeenLastCalledWith('2026-10-05T13:30')
  })

  it('shows an initial value and opens a calendar', async () => {
    const { user } = renderPicker(vi.fn(), '2026-10-05T13:30')
    const group = screen.getByRole('group', { name: '일시' })
    expect(within(group).getAllByRole('spinbutton').map((s) => s.textContent?.trim())).toEqual(['2026', '10', '5', '13', '30'])

    await user.click(screen.getByRole('button', { name: /달력/ }))

    expect(await screen.findByRole('grid')).toBeInTheDocument()
  })

  it('names the mobile calendar sheet by its visible title without warnings', async () => {
    mockViewport(true)
    const spies = [vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')]
    const { user } = renderPicker()
    await user.click(screen.getByRole('button', { name: /달력/ }))
    const dialog = await screen.findByRole('dialog', { name: '일시' })
    expect(within(dialog).getByRole('heading', { name: '일시' })).toBeInTheDocument()
    expect(spies.flatMap((spy) => spy.mock.calls)).toEqual([])
    spies.forEach((spy) => spy.mockRestore())
  })
})

describe('DateTimePicker with day granularity', () => {
  function DayPicker({ onValue, onSubmit }: { onValue: (v: string) => void; onSubmit: () => void }) {
    const [value, setValue] = useState('')
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
        <DateTimePicker label="기준일" granularity="day" minValue="2026-01-01" maxValue="2026-12-31" isRequired
          value={value} onChange={(v) => { setValue(v); onValue(v) }} />
        <button type="submit">저장</button>
      </form>
    )
  }

  it('reports YYYY-MM-DD and blocks a date outside the allowed range', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    const onSubmit = vi.fn()
    render(<I18nProvider locale="ko-KR"><DayPicker onValue={onValue} onSubmit={onSubmit} /></I18nProvider>)
    const group = screen.getByRole('group', { name: '기준일' })
    expect(within(group).getAllByRole('spinbutton')).toHaveLength(3)

    await user.click(within(group).getAllByRole('spinbutton')[0])
    await user.keyboard('20251231')
    expect(onValue).toHaveBeenLastCalledWith('2025-12-31')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(within(group).getAllByRole('spinbutton')[0])
    await user.keyboard('2026')
    expect(onValue).toHaveBeenLastCalledWith('2026-12-31')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
