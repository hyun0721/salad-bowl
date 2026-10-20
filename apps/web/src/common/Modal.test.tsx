import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Modal from './Modal'

describe('Modal', () => {
  it('is a labelled modal dialog that takes focus and closes with Escape or the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal title="9월 데이터 업로드" onClose={onClose}><p>내용</p></Modal>)

    const dialog = screen.getByRole('dialog', { name: '9월 데이터 업로드' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()

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
          {open && <Modal title="제목" onClose={() => setOpen(false)}><button type="button">안쪽</button></Modal>}
        </>
      )
    }
    render(<Harness />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '열기' }))
    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '열기' })).toHaveFocus()
  })

  it('keeps Tab inside the dialog', async () => {
    render(<Modal title="제목" onClose={() => {}}><button type="button">안쪽</button></Modal>)
    const user = userEvent.setup()

    await user.tab()
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '안쪽' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: '안쪽' })).toHaveFocus()
  })

  it('cannot be closed while closing is disabled', async () => {
    const onClose = vi.fn()
    render(<Modal title="제목" onClose={onClose} closeDisabled><p>올리는 중</p></Modal>)
    const user = userEvent.setup()

    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled()
  })
})
