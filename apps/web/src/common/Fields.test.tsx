import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Checkbox from './Checkbox'
import SearchField from './SearchField'
import Switch from './Switch'
import TextField, { TextAreaField } from './TextField'

function ControlledText() {
  const [value, setValue] = useState('')
  return (
    <form>
      <TextField label="그룹 이름" value={value} onChange={setValue} isRequired maxLength={5} description="최대 5자" />
      <button type="submit">저장</button>
    </form>
  )
}

describe('TextField', () => {
  it('is labelled, described, limited and reports changes', async () => {
    const user = userEvent.setup()
    render(<ControlledText />)
    const input = screen.getByLabelText('그룹 이름')
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription('최대 5자')

    await user.type(input, '우리집가계부')

    expect(input).toHaveValue('우리집가계')
  })

  it('shows the native validation message under the field', async () => {
    const user = userEvent.setup()
    render(<ControlledText />)

    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(screen.getByLabelText('그룹 이름')).toBeInvalid()
    expect(screen.getByText(/./, { selector: '[slot="errorMessage"]' })).toBeInTheDocument()
  })
})

describe('TextAreaField', () => {
  it('renders a labelled textarea', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TextAreaField label="메모" value="" onChange={onChange} maxLength={10} rows={2} />)

    await user.type(screen.getByLabelText('메모'), '가')

    expect(screen.getByLabelText('메모').tagName).toBe('TEXTAREA')
    expect(onChange).toHaveBeenCalledWith('가')
  })
})

describe('SearchField', () => {
  it('clears with the clear button and with Escape', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<SearchField label="검색" value="택시" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(onChange).toHaveBeenLastCalledWith('')

    onChange.mockClear()
    rerender(<SearchField label="검색" value="택시" onChange={onChange} />)
    await user.type(screen.getByRole('searchbox', { name: '검색' }), '{Escape}')
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('keeps its own root class next to a passed class and marks empty', () => {
    const { container } = render(<SearchField label="검색" value="" onChange={vi.fn()} className="extra" />)
    const root = container.firstElementChild!
    expect(root).toHaveClass('extra')
    expect(root.classList.length).toBeGreaterThan(1)
    expect(root).toHaveAttribute('data-empty')
  })
})

describe('Checkbox and Switch', () => {
  it('toggles a checkbox', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox isSelected={false} onChange={onChange}>그룹 화면에서 숨기기 (본인만)</Checkbox>)

    await user.click(screen.getByRole('checkbox', { name: '그룹 화면에서 숨기기 (본인만)' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles a switch and respects disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<Switch isSelected onChange={onChange}>내 거래를 이 그룹에 공개</Switch>)
    const toggle = screen.getByRole('switch', { name: '내 거래를 이 그룹에 공개' })
    expect(toggle).toBeChecked()

    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith(false)

    rerender(<Switch isSelected onChange={onChange} isDisabled>내 거래를 이 그룹에 공개</Switch>)
    expect(screen.getByRole('switch', { name: '내 거래를 이 그룹에 공개' })).toBeDisabled()
  })
})
