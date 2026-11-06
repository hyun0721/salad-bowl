import { act } from '@testing-library/react'
import { vi } from 'vitest'

/**
 * jsdom에는 ResizeObserver가 없다. 부르면 크기 변화를 notify로 직접 알릴 수 있다. 정리는 setup.ts가 한다.
 */
export function mockResizeObserver() {
  const callbacks = new Set<() => void>()
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class {
    observe = observe
    disconnect: () => void
    constructor(callback: () => void) {
      callbacks.add(callback)
      this.disconnect = () => {
        callbacks.delete(callback)
        disconnect()
      }
    }
  })
  return { observe, disconnect, notify: () => act(() => callbacks.forEach((callback) => callback())) }
}
