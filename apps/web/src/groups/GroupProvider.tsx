import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { groupsApi, type GroupSummary } from './groupsApi'

const STORAGE_KEY = 'saladbowl.selectedGroupId'

function readStored(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function writeStored(id: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // 저장소를 못 쓰면 이번 세션 동안만 기억한다.
  }
}

type GroupsValue = {
  groups: GroupSummary[]
  selectedGroupId: number | null
  selectGroup: (id: number) => void
  isLoading: boolean
}

const GroupContext = createContext<GroupsValue | null>(null)

export function GroupProvider({ children }: { children: ReactNode }) {
  const query = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const [chosen, setChosen] = useState<number | null>(readStored)
  const groups = useMemo(() => query.data ?? [], [query.data])

  const selectedGroupId = groups.some((g) => g.groupId === chosen) ? chosen : (groups[0]?.groupId ?? null)

  const selectGroup = useCallback((id: number) => {
    setChosen(id)
    writeStored(id)
  }, [])

  const value = useMemo(
    () => ({ groups, selectedGroupId, selectGroup, isLoading: query.isLoading }),
    [groups, selectedGroupId, selectGroup, query.isLoading],
  )
  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useGroups(): GroupsValue {
  const value = useContext(GroupContext)
  if (!value) throw new Error('useGroups must be used inside GroupProvider')
  return value
}
