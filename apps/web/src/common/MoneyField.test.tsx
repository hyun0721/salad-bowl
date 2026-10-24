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

  it('does not clamp a typed 0 and shows the min message', async () => {
    const user = userEvent.setup()
    render(<I18nProvider locale="ko-KR"><form><Controlled onValue={vi.fn()} /></form></I18nProvider>)
    const input = screen.getByLabelText('금액 (원)')

    await user.type(input, '0')
    await user.tab()

    expect(input).toHaveValue('0')
    expect(input).toBeInvalid()
    expect(await screen.findByText('1원 이상 입력하세요')).toBeInTheDocument()
  })

  it('rejects an amount over the max', async () => {
    const user = userEvent.setup()
    render(<I18nProvider locale="ko-KR"><form><Controlled onValue={vi.fn()} /></form></I18nProvider>)
    const input = screen.getByLabelText('금액 (원)')

    await user.type(input, '10000000000000')
    await user.tab()

    expect(input).toBeInvalid()
    expect(await screen.findByText('금액이 너무 큽니다')).toBeInTheDocument()
  })
})
