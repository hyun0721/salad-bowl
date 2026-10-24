import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ToastRegion, { toast } from './Toast'

afterEach(() => vi.useRealTimers())

describe('Toast', () => {
  it('announces a message in a labelled region and hides it after 4 seconds', () => {
    vi.useFakeTimers()
    render(<ToastRegion />)

    act(() => toast('저장했습니다.'))

    const region = screen.getByRole('region', { name: '알림' })
    expect(region).toHaveTextContent('저장했습니다.')
    act(() => { vi.advanceTimersByTime(4100) })
    expect(screen.queryByText('저장했습니다.')).not.toBeInTheDocument()
  })

  it('can be dismissed with its close button', async () => {
    const user = userEvent.setup()
    render(<ToastRegion />)
    act(() => toast('링크를 복사했습니다.'))

    await user.click(screen.getByRole('button', { name: '알림 닫기' }))

    expect(screen.queryByText('링크를 복사했습니다.')).not.toBeInTheDocument()
  })
})
