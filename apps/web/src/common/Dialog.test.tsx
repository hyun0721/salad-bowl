import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Dialog from './Dialog'

describe('Dialog', () => {
  it('is a labelled modal dialog that closes with Escape or the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Dialog title="9월 데이터 업로드" onClose={onClose}><p>내용</p></Dialog>)

    const dialog = screen.getByRole('dialog', { name: '9월 데이터 업로드' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

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
    expect(onClose).not.toHaveBeenCalled()
  })
})
