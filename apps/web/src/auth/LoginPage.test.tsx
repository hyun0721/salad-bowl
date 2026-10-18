import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { setAccessToken } from '../api/client'
import { server } from '../test/server'
import { AuthProvider } from './AuthProvider'
import LoginPage from './LoginPage'

function renderAt(path: string) {
  server.use(http.post('*/api/auth/refresh', () =>
    HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>홈 화면</p>} />
          <Route path="/invite/:token" element={<p>초대 화면</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const me = { userId: 1, email: 'me@test.com', nickname: '나' }

afterEach(() => setAccessToken(null))

describe('LoginPage', () => {
  it('logs in and goes home', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
    )
    renderAt('/login')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('홈 화면')).toBeInTheDocument()
  })

  it('returns to the next path after login', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
    )
    renderAt('/login?next=%2Finvite%2Fabc')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('초대 화면')).toBeInTheDocument()
  })

  it('shows a readable error for wrong credentials', async () => {
    server.use(http.post('*/api/auth/login', () =>
      HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'invalid email or password' }, { status: 401 })))
    renderAt('/login')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 맞지 않습니다.')
  })

  it('signs up then logs in', async () => {
    let signupBody: unknown
    server.use(
      http.post('*/api/auth/signup', async ({ request }) => {
        signupBody = await request.json()
        return HttpResponse.json({ userId: 1 }, { status: 201 })
      }),
      http.post('*/api/auth/login', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json(me)),
    )
    renderAt('/login')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: '회원가입' }))
    await user.type(screen.getByLabelText('이메일'), 'me@test.com')
    await user.type(screen.getByLabelText(/비밀번호/), 'password123')
    await user.type(screen.getByLabelText(/닉네임/), '나')
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }))

    expect(await screen.findByText('홈 화면')).toBeInTheDocument()
    await waitFor(() => expect(signupBody).toEqual({ email: 'me@test.com', password: 'password123', nickname: '나' }))
  })
})
