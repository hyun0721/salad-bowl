import { apiFetch } from '../api/client'

export type GroupSummary = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; memberCount: number }
export type GroupMember = { userId: number; nickname: string; role: 'ADMIN' | 'MEMBER'; shareEnabled: boolean; joinedAt: string }
export type GroupDetail = { groupId: number; name: string; myRole: 'ADMIN' | 'MEMBER'; members: GroupMember[] }
export type BanRow = { userId: number; nickname: string; bannedAt: string }
export type InviteResponse = { token: string; expiresAt: string }

export const groupsApi = {
  list: () => apiFetch<GroupSummary[]>('/groups'),
  detail: (groupId: number) => apiFetch<GroupDetail>(`/groups/${groupId}`),
  create: (name: string) => apiFetch<GroupSummary>('/groups', { method: 'POST', json: { name } }),
  rename: (groupId: number, name: string) =>
    apiFetch<GroupDetail>(`/groups/${groupId}`, { method: 'PATCH', json: { name } }),
  setShare: (groupId: number, enabled: boolean) =>
    apiFetch<{ shareEnabled: boolean }>(`/groups/${groupId}/share`, { method: 'PUT', json: { enabled } }),
  leave: (groupId: number) => apiFetch<void>(`/groups/${groupId}/members/me`, { method: 'DELETE' }),
  removeMember: (groupId: number, userId: number) =>
    apiFetch<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  bans: (groupId: number) => apiFetch<BanRow[]>(`/groups/${groupId}/bans`),
  unban: (groupId: number, userId: number) =>
    apiFetch<void>(`/groups/${groupId}/bans/${userId}`, { method: 'DELETE' }),
  createInvite: (groupId: number) => apiFetch<InviteResponse>(`/groups/${groupId}/invites`, { method: 'POST' }),
}
