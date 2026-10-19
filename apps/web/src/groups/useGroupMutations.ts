import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGroups } from './GroupProvider'
import { groupsApi } from './groupsApi'

/** 그룹 관리 화면의 변경 요청. 성공하면 쿼리 키 규칙에 따라 관련 데이터를 다시 불러온다. */
export function useGroupMutations() {
  const queryClient = useQueryClient()
  const { selectGroup } = useGroups()
  const refreshList = () => queryClient.invalidateQueries({ queryKey: ['groups'], exact: true })

  const create = useMutation({
    mutationFn: (name: string) => groupsApi.create(name),
    onSuccess: async (group) => {
      selectGroup(group.groupId)
      await refreshList()
    },
  })
  const rename = useMutation({
    mutationFn: ({ groupId, name }: { groupId: number; name: string }) => groupsApi.rename(groupId, name),
    onSuccess: (_detail, { groupId }) => Promise.all([
      refreshList(),
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] }),
    ]),
  })
  const setShare = useMutation({
    mutationFn: ({ groupId, enabled }: { groupId: number; enabled: boolean }) => groupsApi.setShare(groupId, enabled),
    onSuccess: (_result, { groupId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] }),
      queryClient.invalidateQueries({ queryKey: ['summary', groupId] }),
      queryClient.invalidateQueries({ queryKey: ['transactions', 'group', groupId] }),
    ]),
  })
  const leave = useMutation({
    mutationFn: (groupId: number) => groupsApi.leave(groupId),
    onSuccess: async (_result, groupId) => {
      queryClient.removeQueries({ queryKey: ['groups', groupId] })
      await refreshList()
    },
  })
  return { create, rename, setShare, leave }
}
