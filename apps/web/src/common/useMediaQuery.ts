import { useCallback, useSyncExternalStore } from 'react'

// SSR과 matchMedia가 없는 테스트 환경에서는 데스크톱으로 처리한다.
export function useMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const media = window.matchMedia(query)
    media.addEventListener('change', notify)
    return () => media.removeEventListener('change', notify)
  }, [query])
  const getSnapshot = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
