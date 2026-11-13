import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import GroupsPage from './GroupsPage'
import { mockViewport } from '../test/mockViewport'

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
    const info = await screen.findByRole('region', { name: '그룹 정보' })
    expect(await within(info).findByRole('textbox', { name: '그룹 이름' })).toHaveValue('우리집')
    const members = screen.getByRole('region', { name: '멤버 관리' })
    expect(within(members).getByText('짝꿍')).toBeInTheDocument()
    expect(within(info).queryByText('짝꿍')).not.toBeInTheDocument()
    expect(within(members).getByRole('button', { name: '초대 링크 만들기' })).toBeInTheDocument()
    expect(within(info).getByRole('switch', { name: '내 거래 그룹 공개' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '우리집' })).not.toBeInTheDocument()

    await user.click(within(list).getByRole('button', { name: /친구들/ }))

    const friendInfo = await screen.findByRole('region', { name: '그룹 정보' })
    expect(await within(friendInfo).findByText('친구들')).toBeInTheDocument()
    expect(within(friendInfo).queryByRole('textbox', { name: '그룹 이름' })).not.toBeInTheDocument()
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
    const add = screen.getByRole('button', { name: '그룹 추가' })
    expect(add).toHaveTextContent(/^추가$/)
    expect(add.parentElement).toBe(screen.getByRole('heading', { level: 1, name: '그룹 관리' }).parentElement)
    await user.click(add)
    const dialog = screen.getByRole('dialog', { name: '새 그룹 만들기' })
    await user.type(within(dialog).getByLabelText('그룹 이름'), '새 그룹')
    await user.click(within(dialog).getByRole('button', { name: '만들기' }))

    const info = await screen.findByRole('region', { name: '그룹 정보' })
    expect(await within(info).findByRole('textbox', { name: '그룹 이름' })).toHaveValue('새 그룹')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(body).toEqual({ name: '새 그룹' })
  })

  it('keeps the group info title on failure and restores both cards after retry', async () => {
    detailHandlers()
    let failed = true
    server.use(http.get('*/api/groups/10', () => failed
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json(homeDetail)))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    expect(await screen.findByRole('alert')).toHaveTextContent('그룹 정보를 불러오지 못했습니다.')
    const info = screen.getByRole('region', { name: '그룹 정보' })
    expect(within(info).getByRole('heading', { name: '그룹 정보' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '멤버 관리' })).not.toBeInTheDocument()
    failed = false
    await user.click(within(info).getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('textbox', { name: '그룹 이름' })).toHaveValue('우리집')
    expect(screen.getByRole('region', { name: '멤버 관리' })).toBeInTheDocument()
  })

  it('lets the admin rename the group', async () => {
    detailHandlers()
    let body: unknown
    server.use(http.patch('*/api/groups/10', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...homeDetail, name: '우리 가족' })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    const input = await screen.findByLabelText('그룹 이름')
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

    const toggle = await screen.findByRole('switch', { name: '내 거래 그룹 공개' })
    expect(toggle).toBeChecked()
    await user.click(screen.getByText('내 거래 그룹 공개'))

    await waitFor(() => expect(body).toEqual({ enabled: false }))
  })

  it('opens sharing help without changing sharing and restores focus when dismissed', async () => {
    detailHandlers()
    let saves = 0
    server.use(http.put('*/api/groups/10/share', () => {
      saves++
      return HttpResponse.json({ shareEnabled: false })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })
    const help = await screen.findByRole('button', { name: '내 거래 그룹 공개 도움말' })
    const description = '끄면 그룹 대시보드와 그룹 거래에서 내 거래가 제외됩니다. 숨긴 거래는 공개해도 보이지 않습니다.'

    expect(screen.queryByText(description)).not.toBeInTheDocument()
    await user.click(help)
    const dialog = await screen.findByRole('dialog', { name: '내 거래 그룹 공개 도움말' })
    expect(within(dialog).getByText(description)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(help).toHaveFocus())
    expect(screen.getByRole('switch', { name: '내 거래 그룹 공개' })).toBeChecked()
    expect(saves).toBe(0)

    await user.click(help)
    await user.click(await screen.findByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(help)
    await user.click(help)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(help)
    await user.click(screen.getByRole('heading', { level: 2, name: '그룹 정보' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('disables the share switch while saving', async () => {
    detailHandlers()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    server.use(http.put('*/api/groups/10/share', async () => {
      await gate
      return HttpResponse.json({ shareEnabled: false })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [home] })

    const toggle = await screen.findByRole('switch', { name: '내 거래 그룹 공개' })
    await user.click(toggle)
    await waitFor(() => expect(screen.getByRole('switch', { name: '내 거래 그룹 공개' })).toBeDisabled())

    release()
    await waitFor(() => expect(screen.getByRole('switch', { name: '내 거래 그룹 공개' })).toBeEnabled())
  })

  it('lets a member leave only after confirming', async () => {
    detailHandlers()
    let left = false
    server.use(http.delete('*/api/groups/20/members/me', () => {
      left = true
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderPage(<GroupsPage />, { groups: [friends] })

    const info = await screen.findByRole('region', { name: '그룹 정보' })
    expect(await within(info).findByText('친구들')).toBeInTheDocument()
    expect(within(info).queryByRole('textbox', { name: '그룹 이름' })).not.toBeInTheDocument()
    const members = screen.getByRole('region', { name: '멤버 관리' })
    await user.click(within(members).getByRole('button', { name: '그룹 나가기' }))
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

it('places the narrow add button beside the my groups heading', async () => {
  mockViewport(true)
  const { user } = renderPage(<GroupsPage />, { groups: [] })
  const card = await screen.findByRole('region', { name: '내 그룹' })
  const add = within(card).getByRole('button', { name: '그룹 추가' })
  expect(add.parentElement).toBe(within(card).getByRole('heading', { name: '내 그룹' }).parentElement)
  await user.click(add)
  expect(screen.getByRole('dialog', { name: '새 그룹 만들기' })).toBeInTheDocument()
})
