import { apiFetch } from '../api/client'

export type GroupSummary = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; memberCount: number }

export const groupsApi = {
  list: () => apiFetch<GroupSummary[]>('/groups'),
}
