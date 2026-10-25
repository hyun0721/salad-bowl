// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/[[path]]'
import { forward } from './forward'

type FetchCall = [string, RequestInit]
const LIMIT = 1024 * 1024

function streamRequest(path: string, stream: ReadableStream<Uint8Array>, headers?: HeadersInit): Request {
  return new Request(`https://salad.pages.dev${path}`, {
    method: 'POST',
    body: stream,
    headers,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}

afterEach(() => vi.unstubAllGlobals())

describe('forward', () => {
  it('rejects an oversized Content-Length before pulling the body', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const pull = vi.fn()
    const request = streamRequest('/api/imports', new ReadableStream({ pull }, { highWaterMark: 0 }), { 'content-length': String(LIMIT + 1) })

    const response = await forward(request, 'https://api.example.com')

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' })
    expect(pull).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized unterminated stream without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const cancel = vi.fn()
    const request = streamRequest('/api/imports', new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(LIMIT + 1)) },
      cancel,
    }))

    const response = await forward(request, 'https://api.example.com')

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' })
    expect(cancel).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes exactly 1MiB of streamed bytes unchanged', async () => {
    const bytes = new Uint8Array(LIMIT)
    bytes.fill(17)
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const request = streamRequest('/api/imports', new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 300_000))
        controller.enqueue(bytes.subarray(300_000))
        controller.close()
      },
    }))

    expect((await forward(request, 'https://api.example.com')).status).toBe(201)
    expect(new Uint8Array(fetchMock.mock.calls[0][1].body as ArrayBuffer)).toEqual(bytes)
  })

  it('preserves multipart bytes and boundary header', async () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('--abc\r\nContent-Disposition: form-data; name="file"; filename="a.bin"\r\n\r\n'),
      0, 255,
      ...new TextEncoder().encode('\r\n--abc--\r\n'),
    ])
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const request = streamRequest('/api/imports', new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }), { 'content-type': 'multipart/form-data; boundary=abc' })

    await forward(request, 'https://api.example.com')

    const init = fetchMock.mock.calls[0][1]
    expect(new Headers(init.headers).get('content-type')).toBe('multipart/form-data; boundary=abc')
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(bytes)
  })

  it.each([
    ['/api/groups', 'REQUEST_TOO_LARGE'],
    ['/api/imports', 'FILE_TOO_LARGE'],
  ])('uses %s size error code %s', async (path, code) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const request = new Request(`https://salad.pages.dev${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: `{"name":"group"}${' '.repeat(LIMIT)}`,
    })

    const response = await forward(request, 'https://api.example.com')

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ code, message: 'request body must be 1MB or smaller' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 400 BAD_REQUEST when reading the body fails', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const request = streamRequest('/api/groups', new ReadableStream({
      pull() { throw new Error('read failed') },
    }))

    const response = await forward(request, 'https://api.example.com')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'BAD_REQUEST', message: 'request body could not be read' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('answers 413 FILE_TOO_LARGE without calling the API when the body is over 1MB', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const request = new Request('https://salad.pages.dev/api/imports', { method: 'POST', body: new Uint8Array(1024 * 1024 + 1) })

    const response = await forward(request, 'https://api.example.com')

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes a body of exactly 1MB through', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const request = new Request('https://salad.pages.dev/api/imports', { method: 'POST', body: new Uint8Array(1024 * 1024) })

    expect((await forward(request, 'https://api.example.com')).status).toBe(201)
  })

  it('answers 503 SERVER_UNAVAILABLE when API_ORIGIN is not a URL', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await forward(new Request('https://salad.pages.dev/api/me'), 'salad-bowl-api.onrender.com')

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'SERVER_UNAVAILABLE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

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

  it('does not forward the browser Origin header upstream', async () => {
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)

    await forward(new Request('https://salad.pages.dev/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://salad.pages.dev', 'content-type': 'application/json' },
      body: '{}',
    }), 'https://api.example.com')

    const headers = new Headers(fetchMock.mock.calls[0][1].headers)
    expect(headers.has('origin')).toBe(false)
    expect(headers.get('content-type')).toBe('application/json')
  })

  it.each([
    ['https://salad.pages.dev/api', 'https://api.example.com/'],
    ['https://salad.pages.dev/api/', 'https://api.example.com/'],
    ['https://salad.pages.dev/api/x?y=1', 'https://api.example.com/x?y=1'],
    ['https://salad.pages.dev/apix', 'https://api.example.com/apix'],
  ])('maps %s to %s', async (from, to) => {
    const fetchMock = vi.fn(async (..._args: FetchCall) => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)

    await forward(new Request(from), 'https://api.example.com')

    expect(fetchMock.mock.calls[0][0]).toBe(to)
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
