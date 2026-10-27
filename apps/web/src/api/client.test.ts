import { http, HttpResponse, delay } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { apiFetch, clearSession, getAccessToken, onAuthLost, onSlowRequests, refreshAccessToken, setAccessToken, startSession } from './client'
import { ApiError } from './errors'

function jwtFor(sub: string, version = 'one'): string {
  const payload = btoa(JSON.stringify({ sub, version })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  return `header.${payload}.signature`
}

afterEach(() => {
  setAccessToken(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('apiFetch', () => {
  it('does not refresh-and-replay a tokenless mutation', async () => {
    clearSession()
    const token = jwtFor('account-b')
    let deletes = 0
    let refreshes = 0
    server.use(
      http.delete('*/api/me/transactions', () => {
        deletes += 1
        return HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
      }),
      http.post('*/api/auth/refresh', () => {
        refreshes += 1
        return HttpResponse.json({ accessToken: token })
      }),
    )

    await expect(apiFetch('/me/transactions?month=2026-10', { method: 'DELETE' })).rejects.toMatchObject({ status: 401 })
    expect(deletes).toBe(1)
    expect(refreshes).toBe(0)
  })

  it('does not replay an old account mutation with another tabs cookie', async () => {
    vi.resetModules()
    const tab1 = await import('./client')
    vi.resetModules()
    const tab2 = await import('./client')
    const tokenA = jwtFor('account-a')
    const tokenB = jwtFor('account-b')
    let sharedCookieOwner = 'account-a'
    let releaseOld!: () => void
    const oldResponse = new Promise<Response>((resolve) => {
      releaseOld = () => resolve(Response.json({ code: 'UNAUTHORIZED' }, { status: 401 }))
    })
    let mutationCalls = 0
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Response.json({ accessToken: sharedCookieOwner === 'account-b' ? tokenB : tokenA })
      }
      if (init.method === 'DELETE') {
        mutationCalls++
        return mutationCalls === 1 ? oldResponse : Response.json({ done: true })
      }
      throw new Error(`unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    tab1.startSession(tokenA)
    const lost = vi.fn(() => tab1.clearSession())
    const off = tab1.onAuthLost(lost)

    const oldMutation = tab1.apiFetch('/me/transactions?month=2026-10', { method: 'DELETE' })
    tab2.clearSession()
    sharedCookieOwner = 'account-b'
    tab2.startSession(tokenB)
    releaseOld()

    await expect(oldMutation).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(mutationCalls).toBe(1)
    expect(lost).toHaveBeenCalledTimes(1)
    expect(tab1.getAccessToken()).toBeNull()
    expect(tab2.getAccessToken()).toBe(tokenB)
    off()
  })

  it('does not adopt a different account on a direct refresh', async () => {
    setAccessToken(jwtFor('account-a'))
    const lost = vi.fn()
    const off = onAuthLost(lost)
    server.use(http.post('*/api/auth/refresh', () =>
      HttpResponse.json({ accessToken: jwtFor('account-b') })))

    await expect(refreshAccessToken()).resolves.toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(lost).toHaveBeenCalledTimes(1)
    off()
  })

  it('retries a 401 for the same subject', async () => {
    const oldToken = jwtFor('account-a', 'old')
    const newToken = jwtFor('account-a', 'new')
    setAccessToken(oldToken)
    server.use(
      http.get('*/api/me', ({ request }) =>
        request.headers.get('authorization') === `Bearer ${newToken}`
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: newToken })),
    )

    await expect(apiFetch('/me')).resolves.toEqual({ ok: true })
    expect(getAccessToken()).toBe(newToken)
  })

  it('retries a tokenless authenticated request after refresh', async () => {
    clearSession()
    const token = jwtFor('account-b')
    server.use(
      http.get('*/api/me', ({ request }) =>
        request.headers.get('authorization') === `Bearer ${token}`
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: token })),
    )

    await expect(apiFetch('/me')).resolves.toEqual({ ok: true })
    expect(getAccessToken()).toBe(token)
  })

  it('does not refresh or resend an old account request after another account logs in', async () => {
    startSession('account-a')
    let releaseOld!: () => void
    const oldResponse = new Promise<Response>((resolve) => {
      releaseOld = () => resolve(Response.json({ code: 'UNAUTHORIZED', message: 'expired' }, { status: 401 }))
    })
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => oldResponse)
      .mockImplementation(async () => Response.json({ accessToken: 'wrong-refresh' }))
    vi.stubGlobal('fetch', fetchMock)

    const oldRequest = apiFetch('/me/transactions?month=2026-10', { method: 'DELETE' })
    clearSession()
    startSession('account-b')
    releaseOld()

    await expect(oldRequest).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe('account-b')
  })

  it('does not clear a new login token when an old refresh returns 401', async () => {
    startSession('account-a')
    let releaseRefresh!: () => void
    const pending = new Promise<Response>((resolve) => {
      releaseRefresh = () => resolve(Response.json({ code: 'INVALID_TOKEN' }, { status: 401 }))
    })
    vi.stubGlobal('fetch', vi.fn(() => pending))

    const oldRefresh = refreshAccessToken()
    startSession('account-b')
    releaseRefresh()

    await expect(oldRefresh).resolves.toBeNull()
    expect(getAccessToken()).toBe('account-b')
  })

  it('does not return a successful old account response after a session switch', async () => {
    startSession('account-a')
    let releaseOld!: () => void
    const pending = new Promise<Response>((resolve) => {
      releaseOld = () => resolve(Response.json({ ok: true }))
    })
    vi.stubGlobal('fetch', vi.fn(() => pending))

    const oldRequest = apiFetch('/me')
    startSession('account-b')
    releaseOld()

    await expect(oldRequest).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(getAccessToken()).toBe('account-b')
  })

  it('does not resend an old request after its refresh finishes in a new session', async () => {
    startSession('account-a')
    let releaseRefresh!: () => void
    const pendingRefresh = new Promise<Response>((resolve) => {
      releaseRefresh = () => resolve(Response.json({ accessToken: 'late' }))
    })
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => Response.json({ code: 'UNAUTHORIZED' }, { status: 401 }))
      .mockImplementationOnce(() => pendingRefresh)
      .mockImplementation(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const oldRequest = apiFetch('/me')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    startSession('account-b')
    releaseRefresh()

    await expect(oldRequest).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getAccessToken()).toBe('account-b')
  })

  it('discards an old response when JSON parsing finishes after a new login', async () => {
    startSession('account-a')
    let releaseJson!: () => void
    const pendingJson = new Promise<void>((resolve) => { releaseJson = resolve })
    const response = Response.json({ ok: true })
    const json = vi.spyOn(response, 'json').mockImplementation(async () => {
      await pendingJson
      return { ok: true }
    })
    vi.stubGlobal('fetch', vi.fn(async () => response))

    const oldRequest = apiFetch('/me')
    await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1))
    startSession('account-b')
    releaseJson()

    await expect(oldRequest).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
  })

  it('discards a refresh response that arrives after local logout', async () => {
    setAccessToken('old')
    const lost = vi.fn()
    const off = onAuthLost(lost)
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    let started = false
    server.use(http.post('*/api/auth/refresh', async () => {
      started = true
      await pending
      return HttpResponse.json({ accessToken: 'late' })
    }))

    const refresh = refreshAccessToken()
    await vi.waitFor(() => expect(started).toBe(true))
    clearSession()
    release()

    await expect(refresh).resolves.toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(lost).not.toHaveBeenCalled()
    off()
  })

  it('discards a refresh result when logout happens while parsing JSON', async () => {
    setAccessToken('old')
    let release!: () => void
    const parsing = new Promise<void>((resolve) => { release = resolve })
    const response = new Response('{}')
    const json = vi.spyOn(response, 'json').mockImplementation(async () => {
      await parsing
      return { accessToken: 'late' }
    })
    vi.stubGlobal('fetch', vi.fn(async () => response))

    const refresh = refreshAccessToken()
    await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1))
    clearSession()
    release()

    await expect(refresh).resolves.toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('refreshes a new login after logout when its API request returns 401', async () => {
    clearSession()
    setAccessToken('new-login')
    let refreshCalls = 0
    server.use(
      http.get('*/api/me', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer renewed'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () => {
        refreshCalls++
        return HttpResponse.json({ accessToken: 'renewed' })
      }),
    )

    await expect(apiFetch('/me')).resolves.toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('renewed')
  })

  it('starts a new refresh after logout and keeps it shared when the old one finishes', async () => {
    setAccessToken('old')
    let releaseOld!: () => void
    let releaseNew!: () => void
    const oldResponse = new Promise<Response>((resolve) => {
      releaseOld = () => resolve(Response.json({ accessToken: 'stale' }))
    })
    const newResponse = new Promise<Response>((resolve) => {
      releaseNew = () => resolve(Response.json({ accessToken: 'renewed' }))
    })
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => oldResponse)
      .mockImplementationOnce(() => newResponse)
    vi.stubGlobal('fetch', fetchMock)

    const oldRefresh = refreshAccessToken()
    clearSession()
    setAccessToken('new-login')
    const newRefresh = refreshAccessToken()
    const callsAfterNewRefresh = fetchMock.mock.calls.length

    releaseOld()
    await expect(oldRefresh).resolves.toBeNull()
    const joinedRefresh = refreshAccessToken()
    const callsAfterJoin = fetchMock.mock.calls.length

    releaseNew()
    expect(callsAfterNewRefresh).toBe(2)
    expect(callsAfterJoin).toBe(2)
    await expect(newRefresh).resolves.toBe('renewed')
    await expect(joinedRefresh).resolves.toBe('renewed')
    expect(getAccessToken()).toBe('renewed')
  })

  it('reports an HTML 5xx from the proxy as SERVER_UNAVAILABLE', async () => {
    server.use(http.get('*/api/me', () =>
      new HttpResponse('<html>502 Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } })))

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 502, code: 'SERVER_UNAVAILABLE' })
  })

  it('keeps the JSON error code of a 5xx from the API', async () => {
    server.use(http.get('*/api/me', () =>
      HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'boom' }, { status: 500 })))

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 500, code: 'INTERNAL_ERROR' })
  })

  it('turns a non-JSON success (SPA fallback) into an ApiError', async () => {
    server.use(http.get('*/api/me', () =>
      new HttpResponse('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })))

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 200, code: 'REQUEST_FAILED' })
  })

  it('rejects a non-JSON refresh success as a transient error and keeps the token', async () => {
    setAccessToken('old')
    server.use(http.post('*/api/auth/refresh', () =>
      new HttpResponse('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })))

    await expect(refreshAccessToken()).rejects.toMatchObject({ code: 'REQUEST_FAILED' })
    expect(getAccessToken()).toBe('old')
  })

  it('sends the bearer token and parses JSON', async () => {
    setAccessToken('t1')
    server.use(http.get('*/api/me', ({ request }) =>
      HttpResponse.json({ auth: request.headers.get('Authorization') })))

    await expect(apiFetch('/me')).resolves.toEqual({ auth: 'Bearer t1' })
  })

  it('sends JSON bodies and returns undefined for 204', async () => {
    let received: unknown
    server.use(http.post('*/api/things', async ({ request }) => {
      received = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))

    await expect(apiFetch('/things', { method: 'POST', json: { a: 1 } })).resolves.toBeUndefined()
    expect(received).toEqual({ a: 1 })
  })

  it('throws ApiError with the server code and message', async () => {
    server.use(http.get('*/api/groups/1', () =>
      HttpResponse.json({ code: 'NOT_FOUND', message: 'group not found' }, { status: 404 })))

    const error = await apiFetch('/groups/1').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'group not found' })
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    setAccessToken('old')
    let refreshCalls = 0
    server.use(
      http.get('*/api/me', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () => {
        refreshCalls++
        return HttpResponse.json({ accessToken: 'new' })
      }),
    )

    const [a, b] = await Promise.all([apiFetch('/me'), apiFetch('/me')])

    expect(a).toEqual({ ok: true })
    expect(b).toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('new')
  })

  it('clears the token and notifies when refresh fails', async () => {
    setAccessToken('old')
    const lost = vi.fn()
    const off = onAuthLost(lost)
    server.use(
      http.get('*/api/me', () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })),
    )

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 })
    expect(getAccessToken()).toBeNull()
    expect(lost).toHaveBeenCalledTimes(1)
    off()
  })

  it('keeps the session when refresh fails transiently', async () => {
    setAccessToken('old')
    const lost = vi.fn()
    const off = onAuthLost(lost)
    server.use(
      http.get('*/api/me', () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () => new HttpResponse('bad gateway', { status: 503 })),
    )

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 503 })
    expect(getAccessToken()).toBe('old')
    expect(lost).not.toHaveBeenCalled()
    off()
  })

  it('notifies auth loss once for concurrent requests', async () => {
    setAccessToken('old')
    const lost = vi.fn()
    const off = onAuthLost(lost)
    server.use(
      http.get('*/api/me', () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })),
    )

    await Promise.allSettled([apiFetch('/me'), apiFetch('/me')])

    expect(lost).toHaveBeenCalledTimes(1)
    off()
  })

  it('reports slow requests after 3 seconds', async () => {
    const states: boolean[] = []
    const off = onSlowRequests((slow) => states.push(slow))
    server.use(http.get('*/api/slow', async () => {
      await delay(3300)
      return HttpResponse.json({ ok: true })
    }))

    await apiFetch('/slow', { auth: false })

    expect(states).toEqual([true, false])
    off()
  }, 10000)

  it('does not report a slow request when trackSlow is false', async () => {
    const states: boolean[] = []
    const off = onSlowRequests((slow) => states.push(slow))
    server.use(http.get('*/api/slow', async () => {
      await delay(3300)
      return HttpResponse.json({ ok: true })
    }))

    await apiFetch('/slow', { auth: false, trackSlow: false })

    expect(states).toEqual([])
    off()
  }, 10000)
})
