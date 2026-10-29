import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stubRegister } from '../test/pwaRegisterStub'
import { useAppUpdate } from './useAppUpdate'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); stubRegister.updateServiceWorker.mockClear() })

function stubReload() {
  const reload = vi.fn()
  vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location)
  return reload
}

function register(registration: Partial<ServiceWorkerRegistration>) {
  const hook = renderHook(() => useAppUpdate())
  stubRegister.lastOptions?.onRegisteredSW?.('/sw.js', { update: vi.fn(async () => {}), ...registration } as unknown as ServiceWorkerRegistration)
  return hook
}

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

it('reloads right away when the new version took over without waiting', () => {
  const reload = stubReload()
  const { result } = register({ waiting: null })
  act(() => result.current.update())
  expect(reload).toHaveBeenCalledTimes(1)
})

it('reloads once the waiting version activates', () => {
  const reload = stubReload()
  const waiting = Object.assign(new EventTarget(), { state: 'installed' }) as unknown as ServiceWorker
  const { result } = register({ waiting })
  act(() => result.current.update())
  expect(stubRegister.updateServiceWorker).toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
  Object.assign(waiting, { state: 'activated' })
  waiting.dispatchEvent(new Event('statechange'))
  expect(reload).toHaveBeenCalledTimes(1)
})
