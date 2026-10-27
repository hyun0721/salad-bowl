import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SaladBowlLoader from './SaladBowlLoader'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

const pieces = (container: HTMLElement) => container.querySelectorAll('[data-piece]').length

it('advances the message and fills the bowl over time', () => {
  const { container } = render(<SaladBowlLoader />)
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('신선한 재료 찾는 중이에요')
  expect(pieces(container)).toBe(1)
  act(() => { vi.advanceTimersByTime(8_000) })
  expect(status).toHaveTextContent('맛있게 섞는 중이에요')
  expect(pieces(container)).toBe(2)
  act(() => { vi.advanceTimersByTime(22_000) })
  expect(status).toHaveTextContent('드레싱 넣는 중이에요')
  expect(pieces(container)).toBe(3)
  act(() => { vi.advanceTimersByTime(60_000) })
  expect(status).toHaveTextContent('거의 다 됐어요, 조금만요')
  expect(pieces(container)).toBe(4)
})

it('repeats each stage motion while it lasts and stops while finishing', () => {
  const { container, rerender } = render(<SaladBowlLoader />)
  const scene = () => container.querySelector('[data-motion]')?.getAttribute('data-motion')
  expect(scene()).toBe('seek')
  act(() => { vi.advanceTimersByTime(8_000) })
  expect(scene()).toBe('stir')
  act(() => { vi.advanceTimersByTime(22_000) })
  expect(scene()).toBe('dress')
  act(() => { vi.advanceTimersByTime(60_000) })
  expect(scene()).toBe('wait')
  rerender(<SaladBowlLoader done />)
  expect(scene()).toBeUndefined()
})

it('hides the drawing and shows the wake-up hint only when slow', () => {
  const { container, rerender } = render(<SaladBowlLoader />)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByText('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요')).not.toBeInTheDocument()
  rerender(<SaladBowlLoader slow />)
  expect(screen.getByRole('status')).toHaveTextContent('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요')
})

it('fills the rest, keeps the message, then calls onFinished when done', () => {
  const onFinished = vi.fn()
  const { container, rerender } = render(<SaladBowlLoader onFinished={onFinished} />)
  rerender(<SaladBowlLoader done onFinished={onFinished} />)
  for (let step = 0; step < 3; step++) act(() => { vi.advanceTimersByTime(120) })
  expect(pieces(container)).toBe(4)
  expect(screen.getByRole('status')).toHaveTextContent('신선한 재료 찾는 중이에요')
  expect(onFinished).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(350) })
  expect(onFinished).toHaveBeenCalledOnce()
  // 완료 중에는 시간 단계가 더 오르지 않는다.
  act(() => { vi.advanceTimersByTime(8_000) })
  expect(screen.getByRole('status')).toHaveTextContent('신선한 재료 찾는 중이에요')
})

it('lines the message up with the bowl when reactivated while finishing', () => {
  const onFinished = vi.fn()
  const { container, rerender } = render(<SaladBowlLoader onFinished={onFinished} />)
  rerender(<SaladBowlLoader done onFinished={onFinished} />)
  for (let step = 0; step < 2; step++) act(() => { vi.advanceTimersByTime(120) })
  expect(pieces(container)).toBe(3)
  rerender(<SaladBowlLoader onFinished={onFinished} />)
  expect(pieces(container)).toBe(3)
  expect(screen.getByRole('status')).toHaveTextContent('드레싱 넣는 중이에요')
  act(() => { vi.advanceTimersByTime(1_000) })
  expect(onFinished).not.toHaveBeenCalled()
})

it('uses the given id for the status region', () => {
  render(<SaladBowlLoader statusId="loader-status" />)
  expect(screen.getByRole('status')).toHaveAttribute('id', 'loader-status')
})

it('finishes at once with reduced motion', () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)', media: query,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
  })))
  const onFinished = vi.fn()
  render(<SaladBowlLoader done onFinished={onFinished} />)
  act(() => { vi.advanceTimersByTime(0) })
  expect(onFinished).toHaveBeenCalledOnce()
})
