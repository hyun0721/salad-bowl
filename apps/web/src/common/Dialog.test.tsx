import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Dialog, { DialogFrame } from './Dialog'
import TextField from './TextField'
import { mockResizeObserver } from '../test/mockResizeObserver'
import { mockViewport } from '../test/mockViewport'

describe('Dialog', () => {
  it('is a labelled modal dialog that closes with Escape or the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Dialog title="9월 데이터 업로드" onClose={onClose}><p>내용</p></Dialog>)

    const dialog = screen.getByRole('dialog', { name: '9월 데이터 업로드' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    expect(screen.getByRole('button', { name: '닫기' }).textContent).toBe('')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('returns focus to the opener when closed', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>열기</button>
          {open && <Dialog title="제목" onClose={() => setOpen(false)}><button type="button">안쪽</button></Dialog>}
        </>
      )
    }
    render(<Harness />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '열기' }))
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // RAC FocusScope는 닫힌 뒤 다음 프레임에 포커스를 돌려준다.
    await waitFor(() => expect(screen.getByRole('button', { name: '열기' })).toHaveFocus())
  })

  it('does not close on an outside click (like the old Modal)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<><button type="button">밖</button><Dialog title="제목" onClose={onClose}><p>내용</p></Dialog></>)

    await user.click(document.body)

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps focus inside while tabbing', async () => {
    const user = userEvent.setup()
    render(<><button type="button">밖</button><Dialog title="제목" onClose={vi.fn()}><button type="button">안쪽</button></Dialog></>)
    const dialog = screen.getByRole('dialog')

    for (let i = 0; i < 4; i += 1) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('blocks every way of closing while closeDisabled', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Dialog title="제목" onClose={onClose} closeDisabled><p>내용</p></Dialog>)

    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).not.toHaveBeenCalled()
  })
  it('pins the header only when asked', async () => {
    const { rerender } = render(<DialogFrame isOpen onOpenChange={() => {}} title="창">{() => <p>본문</p>}</DialogFrame>)
    expect(screen.getByRole('dialog', { name: '창' }).parentElement).not.toHaveClass('pinned')
    rerender(<DialogFrame isOpen onOpenChange={() => {}} title="창" pinnedHeader>{() => <p>본문</p>}</DialogFrame>)
    expect(screen.getByRole('dialog', { name: '창' }).parentElement).toHaveClass('pinned')
  })

})

describe('DialogFrame sheet outside press', () => {
  it('keeps a narrow-screen sheet open on outside press unless closeOnOutsideClick', async () => {
    mockViewport(true)
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <>
        <button type="button">바깥</button>
        <DialogFrame isOpen onOpenChange={onOpenChange} title="그룹 만들기">{() => <p>내용</p>}</DialogFrame>
      </>,
    )
    expect(screen.getByRole('dialog', { name: '그룹 만들기' })).toBeInTheDocument()

    await user.click(document.body)

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes a narrow-screen sheet on outside press when closeOnOutsideClick', async () => {
    mockViewport(true)
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<DialogFrame isOpen onOpenChange={onOpenChange} title="거래 삭제" closeOnOutsideClick>{() => <p>내용</p>}</DialogFrame>)

    await user.click(document.body)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

it('uses a wider modal when requested', () => {
  render(<DialogFrame isOpen onOpenChange={() => {}} title="거래 목록" wide>{() => <p>내용</p>}</DialogFrame>)
  expect(screen.getByRole('dialog', { name: '거래 목록' }).parentElement).toHaveClass('wide')
})

it('keeps the same modal and its input when the width changes while open', async () => {
  const viewport = mockViewport(false)
  const user = userEvent.setup()
  function Harness() {
    const [name, setName] = useState('')
    return (
      <DialogFrame isOpen onOpenChange={() => {}} title="그룹 만들기">
        {() => <TextField label="이름" value={name} onChange={setName} />}
      </DialogFrame>
    )
  }
  render(<Harness />)
  await user.type(screen.getByLabelText('이름'), '우리집')
  const dialog = screen.getByRole('dialog', { name: '그룹 만들기' })

  act(() => viewport.set(true))

  expect(screen.getByRole('dialog', { name: '그룹 만들기' })).toBe(dialog)
  expect(screen.getByLabelText('이름')).toHaveValue('우리집')
})

describe('DialogFrame when the sheet resizes', () => {
  function sheet(title = '그룹 만들기', isOpen = true) {
    return (
      <DialogFrame isOpen={isOpen} onOpenChange={() => {}} title={title}>
        {() => <><label>{`${title} 이름`}<input /></label><button type="button">{`${title} 확인`}</button></>}
      </DialogFrame>
    )
  }
  function spyOnScroll(element: HTMLElement) {
    const scrollIntoView = vi.fn()
    element.scrollIntoView = scrollIntoView
    return scrollIntoView
  }

  it('scrolls the focused input back into view', () => {
    mockViewport(true)
    const { notify } = mockResizeObserver()
    render(sheet())
    const input = screen.getByLabelText('그룹 만들기 이름')
    const scrollIntoView = spyOnScroll(input)
    act(() => input.focus())

    notify()

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })

  it('asks open popovers to reposition when the sheet scrolls under a focused input', () => {
    mockViewport(true)
    mockResizeObserver()
    render(sheet())
    const dialogSheet = screen.getByRole('dialog').parentElement!
    const onResize = vi.fn()
    window.addEventListener('resize', onResize)
    try {
      act(() => screen.getByRole('button', { name: '그룹 만들기 확인' }).focus())
      fireEvent.scroll(dialogSheet)
      expect(onResize).not.toHaveBeenCalled()

      act(() => screen.getByLabelText('그룹 만들기 이름').focus())
      fireEvent.scroll(dialogSheet)
      expect(onResize).toHaveBeenCalledOnce()
    } finally {
      window.removeEventListener('resize', onResize)
    }
  })

  it('leaves the scroll alone when focus is not on an editable element', () => {
    mockViewport(true)
    const { notify } = mockResizeObserver()
    render(sheet())
    const button = screen.getByRole('button', { name: '그룹 만들기 확인' })
    const scrollIntoView = spyOnScroll(button)
    act(() => button.focus())

    notify()

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('reacts only in the sheet that holds the focus', () => {
    mockViewport(true)
    const { notify } = mockResizeObserver()
    render(<>{sheet('아래')}{sheet('위')}</>)
    const input = screen.getByLabelText('위 이름')
    const scrollIntoView = spyOnScroll(input)
    act(() => input.focus())

    notify()

    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('observes while open and disconnects on close', async () => {
    mockViewport(true)
    const { observe, disconnect } = mockResizeObserver()
    const { rerender } = render(sheet())
    expect(observe).toHaveBeenCalledWith(screen.getByRole('dialog').parentElement)
    expect(disconnect).not.toHaveBeenCalled()

    rerender(sheet('그룹 만들기', false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(disconnect).toHaveBeenCalledOnce()

    rerender(sheet())
    expect(observe).toHaveBeenCalledTimes(2)
  })

  it('does not observe a wide-screen modal', () => {
    mockViewport(false)
    const { observe } = mockResizeObserver()
    render(sheet())

    expect(observe).not.toHaveBeenCalled()
  })
})
