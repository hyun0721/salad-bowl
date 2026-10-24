import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

function renderConfirm(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const user = userEvent.setup()
  const view = render(
    <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기" description="우리집에서 나가면 다시 초대받아야 합류할 수 있습니다."
      confirmLabel="나가기 확인" isPending={false} error={null} onConfirm={onConfirm} {...props} />,
  )
  return { onConfirm, user, ...view }
}

describe('ConfirmDialog', () => {
  it('opens on the trigger with focus on cancel and closes back to the trigger', async () => {
    const { user } = renderConfirm()
    const trigger = screen.getByRole('button', { name: '그룹 나가기' })

    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: '그룹 나가기' })
    expect(dialog).toHaveTextContent('다시 초대받아야')
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('closes even when the caller closes in the same tick that pending ends', async () => {
    // mutate의 onSuccess는 리렌더 전에 불린다. 그때 isPending이 아직 true여도 close()는 닫아야 한다.
    const user = userEvent.setup()
    let close: () => void = () => {}
    const { rerender } = render(
      <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기" description="설명" confirmLabel="나가기 확인"
        isPending={false} error={null} onConfirm={(c) => { close = c }} />,
    )
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))
    await user.click(screen.getByRole('button', { name: '나가기 확인' }))
    rerender(
      <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기" description="설명" confirmLabel="나가기 확인"
        isPending error={null} onConfirm={(c) => { close = c }} />,
    )

    act(() => close())

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('calls onOpen every time it opens', async () => {
    const onOpen = vi.fn()
    const { user } = renderConfirm({ onOpen })
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('confirms through the callback and closes when the caller says so', async () => {
    const { user, onConfirm } = renderConfirm()
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))

    await user.click(screen.getByRole('button', { name: '나가기 확인' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const close = onConfirm.mock.calls[0][0] as () => void
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    close()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('blocks closing and both buttons while pending and shows errors inside', async () => {
    const { user, rerender, onConfirm } = renderConfirm()
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))

    rerender(
      <ConfirmDialog triggerLabel="그룹 나가기" title="그룹 나가기" description="설명" confirmLabel="나가기 확인"
        isPending error="관리자는 나갈 수 없습니다." onConfirm={onConfirm} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: '나가기 확인' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '취소' })).toBeDisabled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('관리자는 나갈 수 없습니다.')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('uses accessible names that differ from the visible labels when given', async () => {
    const { user } = renderConfirm({ triggerLabel: '내보내기', triggerAriaLabel: '짝꿍 내보내기', confirmLabel: '내보내기 확인', confirmAriaLabel: '짝꿍 내보내기 확인' })
    await user.click(screen.getByRole('button', { name: '짝꿍 내보내기' }))
    expect(screen.getByRole('button', { name: '짝꿍 내보내기 확인' })).toBeInTheDocument()
  })
})
