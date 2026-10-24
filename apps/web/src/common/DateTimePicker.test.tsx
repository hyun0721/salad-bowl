import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nProvider } from 'react-aria-components'
import { describe, expect, it, vi } from 'vitest'
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
})
