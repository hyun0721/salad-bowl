import { useCallback, useState, useSyncExternalStore } from 'react'

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

export const NARROW = '(max-width: 820px)'

/**
 * 열린 동안 모양을 바꾸면 폼이 다시 마운트되어 입력을 잃으므로 열릴 때의 폭을 유지한다.
 * 닫힘 애니메이션도 연 모양으로 끝나도록 다음에 열 때까지 값을 유지한다.
 */
export function useNarrowWhileOpen(isOpen: boolean): boolean {
  const narrow = useMediaQuery(NARROW)
  const [opened, setOpened] = useState({ isOpen, narrow })
  if (opened.isOpen !== isOpen) setOpened({ isOpen, narrow: isOpen ? narrow : opened.narrow })
  return opened.narrow
}
