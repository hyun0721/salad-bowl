import { apiFetch } from '../api/client'

export type InvitePreview = {
  groupName: string
  memberCount: number
  maxMembers: number
  expiresAt: string
  alreadyMember: boolean
}

export const inviteApi = {
  preview: (token: string) => apiFetch<InvitePreview>(`/invites/${encodeURIComponent(token)}`),
  accept: (token: string) =>
    apiFetch<{ groupId: number }>(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
}
