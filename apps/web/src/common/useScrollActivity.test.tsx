import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useScrollActivity } from './useScrollActivity'

function ScrollList() {
  return <div role="region" aria-label="목록" onScroll={useScrollActivity()} />
}

afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows during scrolling and hides 600ms after the last movement', () => {
  vi.useFakeTimers()
  render(<ScrollList />)
  const list = screen.getByRole('region', { name: '목록' })
  expect(list).not.toHaveAttribute('data-scrolling')
  fireEvent.scroll(list, { target: { scrollTop: 50 } })
  expect(list).toHaveAttribute('data-scrolling', 'true')
  act(() => vi.advanceTimersByTime(400))
  fireEvent.scroll(list, { target: { scrollTop: 100 } })
  act(() => vi.advanceTimersByTime(599))
  expect(list).toHaveAttribute('data-scrolling', 'true')
  act(() => vi.advanceTimersByTime(1))
  expect(list).not.toHaveAttribute('data-scrolling')
})

it('cleans up the pending hide when the list unmounts', () => {
  vi.useFakeTimers()
  const { unmount } = render(<ScrollList />)
  fireEvent.scroll(screen.getByRole('region'), { target: { scrollTop: 50 } })
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
