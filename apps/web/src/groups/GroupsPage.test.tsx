import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import GroupsPage from './GroupsPage'

const home = { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 2 }
const friends = { groupId: 20, name: '친구들', myRole: 'MEMBER', memberCount: 2 }
const homeDetail = {
  groupId: 10, name: '우리집', myRole: 'ADMIN',
  members: [
    { userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-01T00:00:00Z' },
    { userId: 2, nickname: '짝꿍', role: 'MEMBER', shareEnabled: true, joinedAt: '2026-09-02T00:00:00Z' },
  ],
}
const friendsDetail = {
  groupId: 20, name: '친구들', myRole: 'MEMBER',
  members: [
    { userId: 3, nickname: '친구', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-09-03T00:00:00Z' },
    { userId: 1, nickname: '나', role: 'MEMBER', shareEnabled: false, joinedAt: '2026-09-04T00:00:00Z' },
  ],
}

/** 그룹 상세와, 관리자 화면이 부르는 차단 목록. */
function detailHandlers() {
  server.use(
    http.get('*/api/groups/10', () => HttpResponse.json(homeDetail)),
    http.get('*/api/groups/20', () => HttpResponse.json(friendsDetail)),
    http.get('*/api/groups/10/bans', () => HttpResponse.json([])),
  )
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('GroupsPage', () => {
  it('lists my groups and shows the selected group', async () => {
    detailHandlers()
    const { user } = renderPage(<GroupsPage />, { groups: [home, friends] })

    const list = await screen.findByRole('region', { name: '내 그룹' })
    expect(await within(list).findByRole('button', { name: /우리집/ })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { level: 2, name: '우리집' })).toBeInTheDocument()
    expect(screen.getByText('짝꿍')).toBeInTheDocument()

    await user.click(within(list).getByRole('button', { name: /친구들/ }))

    expect(await screen.findByRole('heading', { level: 2, name: '친구들' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /친구들/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('creates a group and selects it', async () => {
    let created = false
    let body: unknown
    const newGroup = { groupId: 30, name: '새 그룹', myRole: 'ADMIN', memberCount: 1 }
    const { user } = renderPage(<GroupsPage />, { groups: [] })
    server.use(
      http.get('*/api/groups', () => HttpResponse.json(created ? [newGroup] : [])),
      http.post('*/api/groups', async ({ request }) => {
        body = await request.json()
        created = true
        return HttpResponse.json(newGroup, { status: 201 })
      }),
      http.get('*/api/groups/30', () => HttpResponse.json({
        groupId: 30, name: '새 그룹', myRole: 'ADMIN',
        members: [{ userId: 1, nickname: '나', role: 'ADMIN', shareEnabled: true, joinedAt: '2026-10-19T00:00:00Z' }],
      })),
      http.get('*/api/groups/30/bans', () => HttpResponse.json([])),
    )

    expect(await screen.findByText(/아직 속한 그룹이 없습니다/)).toBeInTheDocument()
    expect(screen.queryByLabelText('그룹 이름')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '그룹 만들기' }))
    const dialog = screen.getByRole('dialog', { name: '새 그룹 만들기' })
    await user.type(within(dialog).getByLabelText('그룹 이름'), '새 그룹')
    await user.click(within(dialog).getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('heading', { level: 2, name: '새 그룹' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(body).toEqual({ name: '새 그룹' })
  })

  it('lets the admin rename the group', async () => {
    detailHandlers()
    let body: unknown
    server.use(http.patch('*/api/groups/10', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...homeDetail, name: '우리 가족' })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    const input = await screen.findByLabelText('새 이름')
    await user.clear(input)
    await user.type(input, '우리 가족')
    await user.click(screen.getByRole('button', { name: '이름 바꾸기' }))

    expect(await screen.findByText('이름을 바꿨습니다.')).toBeInTheDocument()
    expect(body).toEqual({ name: '우리 가족' })
  })

  it('turns my sharing off for the group', async () => {
    detailHandlers()
    let body: unknown
    server.use(http.put('*/api/groups/10/share', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ shareEnabled: false })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    const toggle = await screen.findByRole('switch', { name: '내 거래를 이 그룹에 공개' })
    expect(toggle).toBeChecked()
    await user.click(toggle)

    await waitFor(() => expect(body).toEqual({ enabled: false }))
  })

  it('lets a member leave only after confirming', async () => {
    detailHandlers()
    let left = false
    server.use(http.delete('*/api/groups/20/members/me', () => {
      left = true
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [friends] })

    expect(await screen.findByRole('heading', { level: 2, name: '친구들' })).toBeInTheDocument()
    expect(screen.queryByLabelText('새 이름')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '그룹 나가기' }))
    expect(left).toBe(false)
    await user.click(screen.getByRole('button', { name: '나가기 확인' }))

    await waitFor(() => expect(left).toBe(true))
  })

  it('moves focus to cancel when the leave confirmation opens and back to the trigger on cancel', async () => {
    detailHandlers()
    const { user } = renderPage(<GroupsPage />, { groups: [friends] })

    await user.click(await screen.findByRole('button', { name: '그룹 나가기' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '취소' })).toHaveFocus())
    await user.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '그룹 나가기' })).toHaveFocus())
  })
})
