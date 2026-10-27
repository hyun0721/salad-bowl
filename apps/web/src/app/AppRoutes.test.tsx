import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { I18nProvider } from 'react-aria-components'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setAccessToken } from '../api/client'
import { AuthProvider } from '../auth/AuthProvider'
import { mockViewport } from '../test/mockViewport'
import { server } from '../test/server'
import AppRoutes from './AppRoutes'

const me = { userId: 1, email: 'me@test.com', nickname: '나' }

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider locale="ko-KR">
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>,
  )
  return client
}

// 홈 화면이 부르는 API. 홈을 렌더하는 테스트가 직접 핸들러를 쓸 때도 같이 넣는다.
const homeHandlers = [
  http.get('*/api/me/coverage', () => HttpResponse.json([])),
  http.get('*/api/me/transactions', () => HttpResponse.json([])),
  http.get('*/api/imports', () => HttpResponse.json([])),
]

function signedIn(groups: unknown[]) {
  server.use(
    http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
    http.get('*/api/me', () => HttpResponse.json(me)),
    http.get('*/api/groups', () => HttpResponse.json(groups)),
    ...homeHandlers,
  )
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* storage may be unavailable */ }
})
afterEach(() => setAccessToken(null))

describe('AppRoutes', () => {
  it('sends signed-out visitors to login with the return path', async () => {
    server.use(http.post('*/api/auth/refresh', () =>
      HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))

    renderApp('/transactions')

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('shows the layout with the menu, nickname and first group selected', async () => {
    signedIn([
      { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 },
      { groupId: 20, name: '커플 가계부', myRole: 'MEMBER', memberCount: 2 },
    ])

    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
    expect(within(nav).getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: '거래 목록' })).toBeInTheDocument()
    expect(screen.getByText('나')).toBeInTheDocument()
    const select = await screen.findByRole('button', { name: /그룹/ })
    expect(select).toHaveTextContent('우리집')
  })

  it('remembers the selected group', async () => {
    signedIn([
      { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 },
      { groupId: 20, name: '커플 가계부', myRole: 'MEMBER', memberCount: 2 },
    ])
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /그룹/ }))
    await user.click(screen.getByRole('option', { name: '커플 가계부' }))

    expect(window.localStorage.getItem('saladbowl.selectedGroupId')).toBe('20')
  })

  it('offers a link to group management when there is no group', async () => {
    signedIn([])

    renderApp('/')

    expect(await screen.findByRole('link', { name: '그룹 없음 · 만들기 또는 초대받기' })).toHaveAttribute('href', '/groups')
  })

  it('navigates between menu pages', async () => {
    signedIn([])
    server.use(http.get('*/api/imports', () => HttpResponse.json([])))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('link', { name: '업로드' }))

    expect(await screen.findByRole('heading', { level: 1, name: '뱅크샐러드 엑셀 업로드' })).toBeInTheDocument()
  })

  it('logs out and returns to login', async () => {
    signedIn([])
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('redirects a signed-in visitor from login to the home page', async () => {
    signedIn([])

    renderApp('/login')

    expect(await screen.findByRole('heading', { name: '내 가계부' })).toBeInTheDocument()
  })

  it('does not crash on a crafted next value and lands on home', async () => {
    signedIn([])

    renderApp('/login?next=%2F%5Cevil.example')

    expect(await screen.findByRole('heading', { name: '내 가계부' })).toBeInTheDocument()
  })

  it('keeps the user signed in and shows an alert when logout fails', async () => {
    signedIn([])
    server.use(http.post('*/api/auth/logout', () =>
      HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(screen.getByText('나')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument()
  })

  it('shows the cold-start notice while the session is being restored', async () => {
    server.use(
      http.post('*/api/auth/refresh', async () => {
        await delay(3300)
        return HttpResponse.json({ accessToken: 'a1' })
      }),
      http.get('*/api/me', () => HttpResponse.json(me)),
      http.get('*/api/groups', () => HttpResponse.json([])),
      ...homeHandlers,
    )

    renderApp('/')

    expect(await screen.findByText('오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // 요청이 끝날 때까지 기다려 느린 요청 상태가 다른 테스트로 새지 않게 한다.
    expect(await screen.findByRole('heading', { name: '내 가계부' }, { timeout: 5000 })).toBeInTheDocument()
  }, 15000)

  it('tells loading, failed and empty groups apart and can retry', async () => {
    let fail = true
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
      http.get('*/api/groups', async () => {
        if (fail) return HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        return HttpResponse.json([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
      }),
      ...homeHandlers,
    )
    renderApp('/')
    const user = userEvent.setup()

    expect(await screen.findByText('그룹을 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.queryByText(/그룹 없음/)).not.toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('button', { name: /그룹/ })).toHaveTextContent('우리집')
  })

  it('shows a loading label while groups are loading', async () => {
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
      http.get('*/api/groups', async () => {
        await delay(300)
        return HttpResponse.json([])
      }),
      ...homeHandlers,
    )

    renderApp('/')

    expect(await screen.findByText('그룹 불러오는 중')).toBeInTheDocument()
    expect(screen.queryByText(/그룹 없음/)).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /그룹 없음/ })).toBeInTheDocument()
  })

  it('clears cached data on logout so the next user never sees it', async () => {
    signedIn([{ groupId: 10, name: 'A의 그룹', myRole: 'ADMIN', memberCount: 1 }])
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
    const client = renderApp('/')
    const user = userEvent.setup()
    expect(await screen.findByRole('button', { name: /그룹/ })).toHaveTextContent('A의 그룹')

    await user.click(screen.getByRole('button', { name: '로그아웃' }))
    await screen.findByRole('button', { name: '로그인' })
    expect(client.getQueryData(['groups'])).toBeUndefined()

    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'b1' })),
      http.get('*/api/me', () => HttpResponse.json({ userId: 2, email: 'b@test.com', nickname: '비' })),
      http.get('*/api/groups', async () => {
        await delay(500)
        return HttpResponse.json([{ groupId: 30, name: 'B의 그룹', myRole: 'ADMIN', memberCount: 1 }])
      }),
    )
    await user.type(screen.getByLabelText('이메일'), 'b@test.com')
    await user.type(screen.getByLabelText('비밀번호'), 'password1')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('그룹 불러오는 중')).toBeInTheDocument()
    expect(screen.queryByText('A의 그룹')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /그룹/ })).toHaveTextContent('B의 그룹')
  })

  it('returns to the invite page after logging in', async () => {
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
      http.get('*/api/invites/abc', () => HttpResponse.json(
        { groupName: '우리집', memberCount: 2, maxMembers: 6, expiresAt: '2026-10-26T03:00:00Z', alreadyMember: false })),
    )
    renderApp('/invite/abc')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('heading', { level: 1, name: '그룹 초대' })).toBeInTheDocument()
    expect(await screen.findByText('우리집')).toBeInTheDocument()
  })

  it('clears cached data when the session is lost while using the app', async () => {
    let refreshes = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        refreshes++
        return refreshes === 1
          ? HttpResponse.json({ accessToken: 'a1' })
          : HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })
      }),
      http.get('*/api/me', () => HttpResponse.json(me)),
      http.get('*/api/groups', () => HttpResponse.json([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 1 }])),
      ...homeHandlers,
    )
    const client = renderApp('/')
    const user = userEvent.setup()
    await screen.findByRole('button', { name: /그룹/ })
    server.use(http.get('*/api/imports', () =>
      HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })))

    await user.click(screen.getByRole('link', { name: '업로드' }))

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(client.getQueryData(['groups'])).toBeUndefined()
  })

  it('shows a retry screen when the server cannot be reached on startup', async () => {
    server.use(http.post('*/api/auth/refresh', () => new HttpResponse('down', { status: 503 })))
    renderApp('/')

    expect(await screen.findByText('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', {}, { timeout: 4000 }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument()
  })

  it('moves focus to the new page heading after navigating', async () => {
    signedIn([])
    renderApp('/')
    const user = userEvent.setup()

    await screen.findByRole('heading', { level: 1, name: '내 가계부' })
    await user.click(screen.getByRole('link', { name: '거래 목록' }))

    const heading = await screen.findByRole('heading', { level: 1, name: '거래 목록' })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('keeps the menu visible through a lazy page transition', async () => {
    signedIn([])
    server.use(http.get('*/api/me/categories', () => HttpResponse.json([])))
    renderApp('/')
    const user = userEvent.setup()

    await screen.findByRole('heading', { level: 1, name: '내 가계부' })
    await user.click(screen.getByRole('link', { name: '거래 목록' }))

    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: '거래 목록' })).toHaveFocus()
  })

  it('shows groups as loading, not missing, while offline', async () => {
    signedIn([])
    onlineManager.setOnline(false)
    try {
      renderApp('/')

      expect(await screen.findByText('그룹 불러오는 중')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /그룹 없음/ })).not.toBeInTheDocument()
    } finally {
      onlineManager.setOnline(true)
    }
  })
})

describe('AppRoutes on a narrow screen', () => {
  beforeEach(() => { mockViewport(true) })

  it('shows the bottom tab bar instead of the sidebar', async () => {
    signedIn([{ groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 }])
    renderApp('/')

    const navs = await screen.findAllByRole('navigation', { name: '주 메뉴' })
    expect(navs).toHaveLength(1)
    const names = within(navs[0]).getAllByRole('link').map((link) => link.textContent)
    expect(names).toEqual(['홈', '대시보드', '거래', '업로드', '그룹'])
    expect(within(navs[0]).getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page')
    // 닉네임과 로그아웃은 상단 바에 없고 계정 시트 안에 있다.
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계정' })).toBeInTheDocument()
  })

  it('moves focus to the new screen title after switching tabs', async () => {
    signedIn([])
    renderApp('/')
    const user = userEvent.setup()

    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
    await user.click(within(nav).getByRole('link', { name: '그룹' }))

    expect(await screen.findByRole('heading', { level: 1, name: '그룹 관리' })).toHaveFocus()
  })

  it('signs out from the account sheet', async () => {
    signedIn([])
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '계정' }))
    const sheet = await screen.findByRole('dialog', { name: '계정' })
    expect(sheet).toHaveTextContent('나')
    await user.click(within(sheet).getByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('keeps the sheet open with an alert when logout fails', async () => {
    signedIn([])
    server.use(http.post('*/api/auth/logout', () =>
      HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 })))
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '계정' }))
    const sheet = await screen.findByRole('dialog', { name: '계정' })
    await user.click(within(sheet).getByRole('button', { name: '로그아웃' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.')

    // 닫았다 다시 열면 지난 실패 문구는 사라진다.
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '계정' }))
    const reopened = screen.getAllByRole('dialog', { name: '계정' }).at(-1)!
    await waitFor(() => expect(within(reopened).queryByRole('alert')).not.toBeInTheDocument())
  })
})
