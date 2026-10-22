// jsdom에서는 Sheet가 닫힘 애니메이션 완료를 알 수 없어 DOM이 남는다. 실제 닫힘·포커스 복귀는 브라우저에서 확인한다(Plan 06a Task 4).
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
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  })

  it('requests closing with Escape', async () => {
    const user = renderSheet()
    const trigger = screen.getByRole('button', { name: '계정' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: '계정' })
    expect(dialog).toHaveTextContent('나')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  })
})
