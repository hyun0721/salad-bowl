import { useCallback, useEffect, useRef, type UIEvent } from 'react'

/** 목록의 스크롤바만 이동 중에 표시하며 React 목록은 다시 렌더하지 않는다. */
export function useScrollActivity() {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return useCallback((event: UIEvent<HTMLElement>) => {
    const element = event.currentTarget
    element.dataset.scrolling = 'true'
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { delete element.dataset.scrolling }, 600)
  }, [])
}
