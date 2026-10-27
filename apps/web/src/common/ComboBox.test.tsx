import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ComboBox from './ComboBox'

function Controlled({ onValue, options }: { onValue: (v: string) => void; options: string[] }) {
  const [value, setValue] = useState('')
  return <ComboBox label="대분류" value={value} onChange={(v) => { setValue(v); onValue(v) }} options={options} isRequired maxLength={100} />
}

describe('ComboBox', () => {
  it('suggests matching options and picks one', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} options={['식비', '교통', '식료품']} />)

    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식')
    const list = await screen.findByRole('listbox')
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['식비', '식료품'])
    await user.click(within(list).getByRole('option', { name: '식료품' }))

    expect(onValue).toHaveBeenLastCalledWith('식료품')
    expect(screen.getByRole('combobox', { name: '대분류' })).toHaveValue('식료품')
  })

  it('keeps a value that is not in the list', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} options={['식비']} />)

    await user.type(screen.getByRole('combobox', { name: '대분류' }), '새 카테고리')
    await user.tab()

    expect(onValue).toHaveBeenLastCalledWith('새 카테고리')
    expect(screen.getByRole('combobox', { name: '대분류' })).toHaveValue('새 카테고리')
  })

  it('works as a plain input without options', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} options={[]} />)

    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')

    expect(onValue).toHaveBeenLastCalledWith('식비')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
