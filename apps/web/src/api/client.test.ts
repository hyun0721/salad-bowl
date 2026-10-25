import { http, HttpResponse, delay } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { apiFetch, getAccessToken, onAuthLost, onSlowRequests, refreshAccessToken, setAccessToken } from './client'
import { ApiError } from './errors'

afterEach(() => {
  setAccessToken(null)
  vi.useRealTimers()
})

describe('apiFetch', () => {
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
