import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setAccessToken } from '../api/client'
import { AuthProvider } from '../auth/AuthProvider'
import { server } from '../test/server'
import AppRoutes from './AppRoutes'

const me = { userId: 1, email: 'me@test.com', nickname: '나' }

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

function signedIn(groups: unknown[]) {
  server.use(
    http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
    http.get('*/api/me', () => HttpResponse.json(me)),
    http.get('*/api/groups', () => HttpResponse.json(groups)),
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
    const select = await screen.findByRole('combobox', { name: '그룹' })
    expect(select).toHaveValue('10')
  })

  it('remembers the selected group', async () => {
    signedIn([
      { groupId: 10, name: '우리집', myRole: 'ADMIN', memberCount: 3 },
      { groupId: 20, name: '커플 가계부', myRole: 'MEMBER', memberCount: 2 },
    ])
    renderApp('/')
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByRole('combobox', { name: '그룹' }), '20')

    expect(window.localStorage.getItem('saladbowl.selectedGroupId')).toBe('20')
  })

  it('offers a link to group management when there is no group', async () => {
    signedIn([])

    renderApp('/')

    expect(await screen.findByRole('link', { name: '그룹 없음 · 만들기 또는 초대받기' })).toHaveAttribute('href', '/groups')
  })

  it('navigates between menu pages', async () => {
    signedIn([])
    renderApp('/')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('link', { name: '업로드' }))

    expect(await screen.findByRole('heading', { level: 1, name: '업로드' })).toBeInTheDocument()
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
})
