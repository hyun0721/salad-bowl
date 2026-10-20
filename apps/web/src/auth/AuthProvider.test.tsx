import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { setAccessToken } from '../api/client'
import { server } from '../test/server'
import { AuthProvider, useAuth } from './AuthProvider'

function Status() {
  const { status, me } = useAuth()
  return <p>{status}:{me?.nickname ?? '-'}</p>
}

function RetryButton() {
  const { retryRestore } = useAuth()
  return <button type="button" onClick={retryRestore}>retry</button>
}

afterEach(() => setAccessToken(null))

describe('AuthProvider', () => {
  it('restores the session from the refresh cookie', async () => {
    server.use(
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'a1' })),
      http.get('*/api/me', () => HttpResponse.json({ userId: 1, email: 'me@test.com', nickname: '나' })),
    )

    render(<AuthProvider><Status /></AuthProvider>)

    expect(screen.getByText('loading:-')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('signedIn:나')).toBeInTheDocument())
  })

  it('retries a transient refresh failure on startup', async () => {
    let calls = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        calls++
        return calls === 1
          ? new HttpResponse('waking up', { status: 503 })
          : HttpResponse.json({ accessToken: 'a1' })
      }),
      http.get('*/api/me', () => HttpResponse.json({ userId: 1, email: 'me@test.com', nickname: '나' })),
    )

    render(<AuthProvider><Status /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('signedIn:나')).toBeInTheDocument(), { timeout: 3000 })
    expect(calls).toBe(2)
  })

  it('is signed out when there is no refresh cookie', async () => {
    server.use(http.post('*/api/auth/refresh', () =>
      HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))

    render(<AuthProvider><Status /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('signedOut:-')).toBeInTheDocument())
  })

  it('offers a retry instead of signing out when the server stays unreachable', async () => {
    let calls = 0
    server.use(
      http.post('*/api/auth/refresh', () => {
        calls++
        return calls <= 3 ? new HttpResponse('down', { status: 503 }) : HttpResponse.json({ accessToken: 'a1' })
      }),
      http.get('*/api/me', () => HttpResponse.json({ userId: 1, email: 'me@test.com', nickname: '나' })),
    )
    render(<AuthProvider><Status /><RetryButton /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('unavailable:-')).toBeInTheDocument(), { timeout: 4000 })
    expect(calls).toBe(3)
    await userEvent.setup().click(screen.getByRole('button', { name: 'retry' }))

    await waitFor(() => expect(screen.getByText('signedIn:나')).toBeInTheDocument())
  })
})
