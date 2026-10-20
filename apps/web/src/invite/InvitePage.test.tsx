import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import InvitePage from './InvitePage'

const preview = { groupName: '우리집', memberCount: 3, maxMembers: 6, expiresAt: '2026-10-26T03:00:00Z', alreadyMember: false }

function renderInvite() {
  return renderPage(
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/dashboard" element={<p>대시보드 화면</p>} />
    </Routes>,
    { path: '/invite/abc' },
  )
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('InvitePage', () => {
  it('shows the invite and joins the group', async () => {
    let accepted = false
    server.use(
      http.get('*/api/invites/abc', () => HttpResponse.json(preview)),
      http.post('*/api/invites/abc/accept', () => {
        accepted = true
        return HttpResponse.json({ groupId: 30 })
      }),
    )
    const { user } = renderInvite()

    expect(await screen.findByText('우리집')).toBeInTheDocument()
    expect(screen.getByText('3/6명')).toBeInTheDocument()
    expect(screen.getByText('10-26 12:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '그룹에 합류하기' }))

    expect(await screen.findByText('대시보드 화면')).toBeInTheDocument()
    expect(accepted).toBe(true)
    expect(window.localStorage.getItem('saladbowl.selectedGroupId')).toBe('30')
  })

  it('tells an existing member and links to the dashboard', async () => {
    server.use(http.get('*/api/invites/abc', () => HttpResponse.json({ ...preview, alreadyMember: true })))
    renderInvite()

    expect(await screen.findByText('이미 이 그룹의 멤버입니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '대시보드로 가기' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('button', { name: '그룹에 합류하기' })).not.toBeInTheDocument()
  })

  it('does not offer to join a full group', async () => {
    server.use(http.get('*/api/invites/abc', () => HttpResponse.json({ ...preview, memberCount: 6 })))
    renderInvite()

    expect(await screen.findByText('그룹 정원이 찼습니다. 관리자에게 문의해 주세요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '그룹에 합류하기' })).not.toBeInTheDocument()
  })

  it('explains an expired link without a retry button', async () => {
    server.use(http.get('*/api/invites/abc', () =>
      HttpResponse.json({ code: 'INVITE_EXPIRED', message: 'invite expired' }, { status: 410 })))
    renderInvite()

    expect(await screen.findByRole('alert')).toHaveTextContent('초대 링크가 만료되었습니다. 관리자에게 새 링크를 요청해 주세요.')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '내 가계부로' })).toHaveAttribute('href', '/')
  })

  it('explains that a removed member cannot rejoin', async () => {
    server.use(http.get('*/api/invites/abc', () =>
      HttpResponse.json({ code: 'REMOVED_FROM_GROUP', message: 'removed' }, { status: 403 })))
    renderInvite()

    expect(await screen.findByRole('alert')).toHaveTextContent('이 그룹에서 내보내져 다시 합류할 수 없습니다.')
  })

  it('offers a retry when the server fails', async () => {
    let fail = true
    server.use(http.get('*/api/invites/abc', () => (fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json(preview))))
    const { user } = renderInvite()

    await screen.findByRole('alert')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('우리집')).toBeInTheDocument()
  })

  it('shows why joining failed', async () => {
    server.use(
      http.get('*/api/invites/abc', () => HttpResponse.json(preview)),
      http.post('*/api/invites/abc/accept', () =>
        HttpResponse.json({ code: 'GROUP_FULL', message: 'group is full' }, { status: 409 })),
    )
    const { user } = renderInvite()

    await user.click(await screen.findByRole('button', { name: '그룹에 합류하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('그룹 정원(6명)이 찼습니다.')
  })
})
