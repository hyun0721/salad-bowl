import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import GroupsPage from './GroupsPage'

const home = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const me = { userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-01T00:00:00Z' }
const partner = { userId: 2, nickname: '짝꿍', role: 'MEMBER', shareEnabled: true, joinedAt: '2026-09-02T00:00:00Z' }
const homeDetail = { groupId: 10, name: '우리집', myRole: 'ADMIN', members: [me, partner] }

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('group admin tools', () => {
  it('removes a member after confirming and lists them as banned', async () => {
    let removed = false
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json(removed ? { ...homeDetail, members: [me] } : homeDetail)),
      http.get('*/api/groups/10/bans', () => HttpResponse.json(
        removed ? [{ userId: 2, nickname: '짝꿍', bannedAt: '2026-10-19T03:00:00Z' }] : [])),
      http.delete('*/api/groups/10/members/2', () => {
        removed = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    expect(screen.queryByRole('button', { name: '나 내보내기' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '짝꿍 내보내기' }))
    expect(removed).toBe(false)
    await user.click(screen.getByRole('button', { name: '짝꿍 내보내기 확인' }))

    const bans = await screen.findByRole('region', { name: '차단 목록' })
    expect(await within(bans).findByText('짝꿍')).toBeInTheDocument()
    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: /^멤버/ })).queryByText('짝꿍')).not.toBeInTheDocument())
  })

  it('creates an invite link and copies it', async () => {
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json(homeDetail)),
      http.get('*/api/groups/10/bans', () => HttpResponse.json([])),
      http.post('*/api/groups/10/invites', () =>
        HttpResponse.json({ token: 'abc123', expiresAt: '2026-10-26T03:00:00Z' }, { status: 201 })),
    )
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    await user.click(await screen.findByRole('button', { name: '초대 링크 만들기' }))

    const link = `${window.location.origin}/invite/abc123`
    expect(await screen.findByLabelText('초대 주소')).toHaveValue(link)
    expect(screen.getByText('10-26 12:00까지')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '링크 복사' }))
    expect(await screen.findByText('링크를 복사했습니다.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(link)
  })

  it('does not offer new invites when the group is full', async () => {
    const members = [me, ...Array.from({ length: 5 }, (_, i) => ({ ...partner, userId: i + 2, nickname: `멤버${i + 2}` }))]
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json({ ...homeDetail, members })),
      http.get('*/api/groups/10/bans', () => HttpResponse.json([])),
    )
    renderPage(<GroupsPage />, { groups: [{ ...home, memberCount: 6 }] })

    expect(await screen.findByRole('button', { name: '초대 링크 만들기' })).toBeDisabled()
    expect(screen.getByText(/정원\(6명\)이 찼습니다/)).toBeInTheDocument()
  })

  it('lifts a ban', async () => {
    let unbanned = false
    server.use(
      http.get('*/api/groups/10', () => HttpResponse.json(homeDetail)),
      http.get('*/api/groups/10/bans', () => HttpResponse.json(
        unbanned ? [] : [{ userId: 5, nickname: '예전멤버', bannedAt: '2026-10-01T03:00:00Z' }])),
      http.delete('*/api/groups/10/bans/5', () => {
        unbanned = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    await user.click(await screen.findByRole('button', { name: '예전멤버 차단 해제' }))

    expect(await screen.findByText('차단한 사람이 없습니다.')).toBeInTheDocument()
    expect(unbanned).toBe(true)
  })

  it('hides admin tools from members', async () => {
    server.use(http.get('*/api/groups/20', () => HttpResponse.json({
      groupId: 20, name: '친구들', myRole: 'MEMBER',
      members: [{ ...partner, userId: 3, nickname: '친구', role: 'ADMIN' }, { ...me, role: 'MEMBER' }],
    })))
    renderPage(<GroupsPage />, { groups: [{ groupId: 20, name: '친구들', myRole: 'MEMBER', memberCount: 2 }] })

    expect(await screen.findByRole('heading', { level: 2, name: '친구들' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '초대 링크 만들기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '차단 목록' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '친구 내보내기' })).not.toBeInTheDocument()
  })
})
