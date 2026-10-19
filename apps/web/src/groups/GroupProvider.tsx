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
  isError: boolean
  retry: () => void
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

  const { refetch } = query
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])

  // isLoading은 오프라인·일시정지 상태의 첫 조회에서 false라서 데이터가 없는데도 '그룹 없음'으로
  // 보이게 된다. 데이터가 아직 없는 동안 true인 isPending을 쓴다.
  const isLoading = query.isPending
  const value = useMemo(
    () => ({ groups, selectedGroupId, selectGroup, isLoading, isError: query.isError, retry }),
    [groups, selectedGroupId, selectGroup, isLoading, query.isError, retry],
  )
  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useGroups(): GroupsValue {
  const value = useContext(GroupContext)
  if (!value) throw new Error('useGroups must be used inside GroupProvider')
  return value
}
