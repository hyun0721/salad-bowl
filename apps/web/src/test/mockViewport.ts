import { vi } from 'vitest'

/**
 * jsdom에는 matchMedia가 없어 useMediaQuery가 늘 넓은 폭으로 본다.
 * 모바일 폭을 시험할 때 부르고, set으로 폭이 바뀐 것처럼 알린다. 정리는 setup.ts가 한다.
 */
export function mockViewport(narrow: boolean) {
  let current = narrow
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query === '(max-width: 820px)' && current },
    media: query,
    addEventListener: (_type: string, listener: () => void) => { listeners.add(listener) },
    removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener) },
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })))
  return {
    set(next: boolean) {
      current = next
      listeners.forEach((listener) => listener())
    },
  }
}
