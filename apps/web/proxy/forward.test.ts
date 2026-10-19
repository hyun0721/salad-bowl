// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/[[path]]'
import { forward } from './forward'

type FetchCall = [string, RequestInit]

afterEach(() => vi.unstubAllGlobals())

describe('forward', () => {
  it('strips /api and passes method, query, cookies and body through', async () => {
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json', 'set-cookie': 'refresh=new; Path=/api/auth; HttpOnly' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const request = new Request('https://salad.pages.dev/api/me/transactions?month=2026-10', {
      method: 'POST',
      headers: { cookie: 'refresh=old', 'content-type': 'application/json' },
      body: '{"a":1}',
    })

    const response = await forward(request, 'https://api.example.com')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/me/transactions?month=2026-10')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
    expect(new Headers(init.headers).get('cookie')).toBe('refresh=old')
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"a":1}')
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toContain('Path=/api/auth')
  })

  it('sends GET requests without a body', async () => {
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)

    await forward(new Request('https://salad.pages.dev/api/groups'), 'https://api.example.com')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/groups')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
  })

  it('answers 502 SERVER_UNAVAILABLE when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connection refused') }))

    const response = await forward(new Request('https://salad.pages.dev/api/me'), 'https://api.example.com')

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'SERVER_UNAVAILABLE' })
  })
})

describe('Pages Function', () => {
  it('answers 503 when API_ORIGIN is not configured', async () => {
    const response = await onRequest({ request: new Request('https://salad.pages.dev/api/me'), env: {} })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'SERVER_UNAVAILABLE' })
  })
})
