import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nProvider } from 'react-aria-components'
import { describe, expect, it, vi } from 'vitest'
import MoneyField from './MoneyField'

function Controlled({ onValue }: { onValue: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null)
  return <MoneyField label="금액 (원)" value={value} onChange={(v) => { setValue(v); onValue(v) }} isRequired minValue={1} />
}

describe('MoneyField', () => {
  it('formats won with separators and reports a whole number', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<I18nProvider locale="ko-KR"><Controlled onValue={onValue} /></I18nProvider>)
    const input = screen.getByLabelText('금액 (원)')

    await user.type(input, '12345')
    await user.tab()

    expect(input).toHaveValue('12,345')
    expect(onValue).toHaveBeenLastCalledWith(12345)
    expect(screen.getByText('원')).toBeInTheDocument()
  })

  it('reports null when cleared', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<I18nProvider locale="ko-KR"><Controlled onValue={onValue} /></I18nProvider>)
    const input = screen.getByLabelText('금액 (원)')
    await user.type(input, '5')
    await user.tab()

    await user.clear(input)
    await user.tab()

    expect(onValue).toHaveBeenLastCalledWith(null)
  })
})
