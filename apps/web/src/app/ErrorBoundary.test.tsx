import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renders children when nothing fails', () => {
    render(<ErrorBoundary><p>정상 화면</p></ErrorBoundary>)

    expect(screen.getByText('정상 화면')).toBeInTheDocument()
  })

  it('shows a fallback with a reload button when a child throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location)

    render(<ErrorBoundary><Boom /></ErrorBoundary>)

    expect(screen.getByRole('heading', { name: '문제가 생겼습니다' })).toBeInTheDocument()
    expect(screen.getByText('화면을 표시하지 못했습니다.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: '다시 불러오기' }))
    expect(reload).toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
  })
})
