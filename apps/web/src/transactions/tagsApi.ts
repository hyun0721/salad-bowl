import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'

export type TagCount = { tag: string; count: number }
export const tagsApi = {
  mine: () => apiFetch<TagCount[]>('/me/tags'),
  group: (groupId: number) => apiFetch<TagCount[]>(`/groups/${groupId}/tags`),
}
export function useTags(groupId: number | null) {
  return useQuery({
    queryKey: groupId === null ? ['tags'] : ['tags', 'group', groupId],
    queryFn: () => groupId === null ? tagsApi.mine() : tagsApi.group(groupId),
    staleTime: 5 * 60 * 1000,
  })
}
