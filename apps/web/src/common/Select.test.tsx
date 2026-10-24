import { act, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Select from './Select'

const items = [{ id: 10, label: '우리집' }, { id: 20, label: '커플 가계부' }]
afterEach(() => vi.unstubAllGlobals())

describe('Select', () => {
  it.each([false, true])('keeps the open overlay and focus when resizing from mobile=%s', async (initialMobile) => {
    let mobile = initialMobile
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      get matches() { return query === '(max-width: 820px)' && mobile },
      media: query,
      addEventListener: (_type: string, listener: () => void) => { listeners.add(listener) },
      removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener) },
      addListener: vi.fn(), removeListener: vi.fn(),
    })))
    const user = userEvent.setup()
    render(<Select label="그룹" items={items} selectedKey={10} onSelectionChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /그룹/ })
    await user.click(trigger)
    const listbox = screen.getByRole('listbox')
    const option = within(listbox).getByRole('option', { name: '우리집' })
    act(() => option.focus())
    act(() => {
      mobile = !initialMobile
      listeners.forEach((listener) => listener())
    })
    expect(screen.getByRole('listbox')).toBe(listbox)
    expect(option).toHaveFocus()
    // 데스크톱 팝오버도 role=dialog라서, 시트에만 있는 제목으로 구분한다.
    expect(!!screen.queryByRole('heading', { name: '그룹' })).toBe(initialMobile)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    await user.click(trigger)
    expect(!!screen.queryByRole('heading', { name: '그룹' })).toBe(!initialMobile)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it.each([false, true])('opens and selects with mobile=%s', async (mobile) => {
    if (mobile) vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 820px)', media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(),
    })))
    const onSelectionChange = vi.fn()
    const user = userEvent.setup()
    render(<Select label="그룹" items={items} selectedKey={10} onSelectionChange={onSelectionChange} />)
    const trigger = screen.getByRole('button', { name: /그룹/ })
    expect(trigger).toHaveTextContent('우리집')
    await user.click(trigger)
    const listbox = mobile
      ? within(screen.getByRole('dialog', { name: '그룹' })).getByRole('listbox')
      : screen.getByRole('listbox')
    expect(within(listbox).getByRole('option', { name: '우리집' })).toHaveAttribute('aria-selected', 'true')
    await user.click(within(listbox).getByRole('option', { name: '커플 가계부' }))
    expect(onSelectionChange).toHaveBeenCalledWith(20)
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    await user.click(trigger)
    await user.click(screen.getByTestId('underlay'))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })
  it('puts the label above a full-width trigger in the field variant', () => {
    render(<Select variant="field" label="타입" items={[{ id: 'EXPENSE', label: '지출' }]} selectedKey="EXPENSE" onSelectionChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /타입/ })
    expect(trigger).toHaveTextContent('지출')
    expect(trigger.closest('[data-variant="field"]')).not.toBeNull()
  })

})
