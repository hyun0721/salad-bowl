import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../test/mockViewport'
import { useNarrowWhileOpen } from './useMediaQuery'

describe('useNarrowWhileOpen', () => {
  it('keeps the width from when it opened, through closing, until the next open', () => {
    const viewport = mockViewport(false)
    const { result, rerender } = renderHook(({ open }) => useNarrowWhileOpen(open), { initialProps: { open: true } })
    expect(result.current).toBe(false)

    act(() => viewport.set(true))
    expect(result.current).toBe(false)

    rerender({ open: false })
    expect(result.current).toBe(false)

    rerender({ open: true })
    expect(result.current).toBe(true)
  })

  it('uses the current width when opening after the width changed while closed', () => {
    const viewport = mockViewport(true)
    const { result, rerender } = renderHook(({ open }) => useNarrowWhileOpen(open), { initialProps: { open: false } })
    act(() => viewport.set(false))
    rerender({ open: true })
    expect(result.current).toBe(false)
  })
})
