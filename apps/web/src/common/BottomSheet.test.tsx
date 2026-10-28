import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import BottomSheet from './BottomSheet'

function renderSheet() {
  const user = userEvent.setup()
  render(
    <BottomSheet title="계정" triggerLabel="계정" triggerIcon="user">
      {({ close }) => (
        <>
          <p>나</p>
          <button type="button" onClick={close}>닫기</button>
        </>
      )}
    </BottomSheet>,
  )
  return user
}

describe('BottomSheet', () => {
  it('opens a titled dialog from an icon button and requests closing from its content', async () => {
    const user = renderSheet()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: '계정' })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: '계정' })
    expect(dialog).toHaveTextContent('나')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('requests closing with Escape', async () => {
    const user = renderSheet()
    const trigger = screen.getByRole('button', { name: '계정' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: '계정' })
    expect(dialog).toHaveTextContent('나')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('closes when the backdrop outside the sheet is pressed', async () => {
    const user = renderSheet()
    const trigger = screen.getByRole('button', { name: '계정' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: '계정' })

    await user.click(dialog.parentElement!.parentElement!)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
