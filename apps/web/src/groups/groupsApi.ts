import { apiFetch } from '../api/client'

export type GroupSummary = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; memberCount: number }
export type GroupMember = { userId: number; nickname: string; role: 'ADMIN' | 'MEMBER'; shareEnabled: boolean; joinedAt: string }
export type GroupDetail = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; members: GroupMember[] }

export const groupsApi = {
  list: () => apiFetch<GroupSummary[]>('/groups'),
  detail: (groupId: number) => apiFetch<GroupDetail>(`/groups/${groupId}`),
}
