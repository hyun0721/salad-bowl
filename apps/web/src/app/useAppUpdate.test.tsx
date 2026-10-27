import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stubRegister } from '../test/pwaRegisterStub'
import { useAppUpdate } from './useAppUpdate'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it('checks for a new version every hour and when the app becomes visible', () => {
  const { unmount } = renderHook(() => useAppUpdate())
  const update = vi.fn(async () => {})
  stubRegister.lastOptions?.onRegisteredSW?.('/sw.js', { update } as unknown as ServiceWorkerRegistration)
  vi.advanceTimersByTime(3_600_000)
  expect(update).toHaveBeenCalledTimes(1)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(update).toHaveBeenCalledTimes(2)
  unmount()
})
