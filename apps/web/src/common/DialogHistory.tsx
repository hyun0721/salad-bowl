import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

type Entry = { open: boolean; disabled: boolean; close: () => void; owned: boolean; mounted: boolean }
type Registry = { entries: Map<string, Entry>; schedule: () => void }
const HistoryContext = createContext<Registry | null>(null)
const stateKey = 'dialogStack'
function stackOf(state: unknown): string[] {
  const stack = (state as Record<string, unknown> | null)?.[stateKey]
  return Array.isArray(stack) ? stack.filter((id): id is string => typeof id === 'string') : []
}

// 라우트 밖에서 살아 있어야 조건부 언마운트와 다른 화면으로의 이동을 구별할 수 있다.
export function DialogHistoryProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const reconcile = useRef(() => {})
  const pendingLocation = useRef<typeof location | null>(null)
  const [registry] = useState<Registry>(() => {
    let queued = false
    return {
      entries: new Map(),
      schedule: () => {
        if (queued) return
        queued = true
        // StrictMode cleanup/setup과 같은 커밋의 화면 이동이 끝난 뒤 현재 위치로 판단한다.
        queueMicrotask(() => { queued = false; reconcile.current() })
      },
    }
  })
  useLayoutEffect(() => {
    reconcile.current = () => {
      // BrowserRouter의 push는 history부터 바꾼다. transition 커밋 전에는 이전 위치로 닫힘을 판단하지 않는다.
      const browserKey: unknown = window.history.state?.key
      if (typeof browserKey === 'string' && browserKey !== location.key) return
      // navigate의 transition이 커밋되기 전 재렌더를 뒤로가기로 오인하지 않는다.
      if (pendingLocation.current === location) return
      pendingLocation.current = null
      const stack = stackOf(location.state)
      const entries = registry.entries
      let remove = 0
      for (const id of [...stack].reverse()) {
        const entry = entries.get(id)
        if (!entry?.owned || (entry.mounted && entry.open)) break
        entry.owned = false
        remove += 1
      }
      if (remove) {
        pendingLocation.current = location
        void navigate(-remove)
        return
      }
      for (const [id, entry] of entries) {
        if (!entry.mounted || !entry.open) {
          entry.owned = false
          if (!entry.mounted) entries.delete(id)
          continue
        }
        if (stack.includes(id)) continue
        if (entry.owned && !entry.disabled) {
          entry.owned = false
          entry.close()
        } else {
          entry.owned = true
          pendingLocation.current = location
          void navigate(location, { state: { ...location.state, [stateKey]: [...stack, id] } })
          return
        }
      }
      const liveStack = stack.filter((id) => entries.get(id)?.owned)
      if (liveStack.length !== stack.length) {
        pendingLocation.current = location
        void navigate(location, { replace: true, state: { ...location.state, [stateKey]: liveStack } })
      }
    }
    registry.schedule()
  }, [location, navigate, registry])
  useEffect(() => () => { reconcile.current = () => {} }, [])
  return <HistoryContext.Provider value={registry}>{children}</HistoryContext.Provider>
}

// 훅은 Provider와 같은 파일에 둔다(컨텍스트를 밖으로 내보내지 않기 위해).
// oxlint-disable-next-line react/only-export-components
export function useDialogHistory(isOpen: boolean, closeDisabled: boolean, onOpenChange: (open: boolean) => void) {
  const registry = useContext(HistoryContext)
  const id = useId()
  useLayoutEffect(() => {
    if (!registry) return
    const entry = registry.entries.get(id) ?? { open: false, disabled: false, close: () => {}, owned: false, mounted: false }
    Object.assign(entry, { open: isOpen, disabled: closeDisabled, close: () => onOpenChange(false), mounted: true })
    registry.entries.set(id, entry)
    registry.schedule()
    return () => {
      entry.mounted = false
      registry.schedule()
    }
  }, [registry, id, isOpen, closeDisabled, onOpenChange])
}
