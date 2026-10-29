import { StrictMode, useEffect, useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DialogHistoryProvider } from './DialogHistory'
import Dialog from './Dialog'
import ConfirmDialog from './ConfirmDialog'

function setup(strict = false, disabled = false, initiallyOpen = false) {
  let navigate: NavigateFunction
  let pathname: string
  function Harness() {
    const nav = useNavigate()
    const location = useLocation()
    const [open, setOpen] = useState(initiallyOpen)
    useEffect(() => { navigate = nav; pathname = location.pathname })
    return <>
      <button onClick={() => setOpen(true)}>열기</button>
      {open && <Dialog title="상세" onClose={() => setOpen(false)} closeDisabled={disabled}>
        <ConfirmDialog triggerLabel="삭제" title="삭제 확인" description="확인" confirmLabel="확인" isPending={false} error={null} onConfirm={(close) => { close(); setOpen(false) }} />
      </Dialog>}
    </>
  }
  const content = <MemoryRouter initialEntries={['/previous', '/current']}><DialogHistoryProvider><Harness /></DialogHistoryProvider></MemoryRouter>
  render(strict ? <StrictMode>{content}</StrictMode> : content)
  return { user: userEvent.setup(), back: () => act(async () => { await navigate(-1) }), path: () => pathname }
}

describe('dialog router history', () => {
  it('back closes the dialog and keeps the route', async () => {
    const h = setup()
    await h.user.click(screen.getByText('열기'))
    await h.back()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(h.path()).toBe('/current')
    await h.back()
    expect(h.path()).toBe('/previous')
  })

  it.each([false, true])('conditional unmount removes the entry (StrictMode: %s)', async (strict) => {
    const h = setup(strict)
    await h.user.click(screen.getByText('열기'))
    await h.user.click(screen.getByText('닫기'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(h.path()).toBe('/current')
    await h.back()
    expect(h.path()).toBe('/previous')
  })

  it('back dismisses only the top confirmation', async () => {
    const h = setup()
    await h.user.click(screen.getByText('열기'))
    await h.user.click(screen.getByText('삭제'))
    await h.back()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '삭제 확인' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: '상세' })).toBeInTheDocument()
    expect(h.path()).toBe('/current')
    await h.back()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(h.path()).toBe('/current')
  })

  it('StrictMode initially open mounts add only one entry', async () => {
    const h = setup(true, false, true)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await h.back()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(h.path()).toBe('/current')
    await h.back()
    expect(h.path()).toBe('/previous')
  })

  it('Escape removes the entry before the next back', async () => {
    const h = setup()
    await h.user.click(screen.getByText('열기'))
    await h.user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(h.path()).toBe('/current')
    await h.back()
    expect(h.path()).toBe('/previous')
  })

  it('closing both nested dialogs removes both entries', async () => {
    const h = setup()
    await h.user.click(screen.getByText('열기'))
    await h.user.click(screen.getByText('삭제'))
    await h.user.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(h.path()).toBe('/current')
    await h.back()
    expect(h.path()).toBe('/previous')
  })

  it('restores the entry when closing is disabled', async () => {
    const h = setup(false, true)
    await h.user.click(screen.getByText('열기'))
    await h.back()
    expect(screen.getByRole('dialog', { name: '상세' })).toBeInTheDocument()
    expect(h.path()).toBe('/current')
    await h.back()
    expect(screen.getByRole('dialog', { name: '상세' })).toBeInTheDocument()
    expect(h.path()).toBe('/current')
  })
})
