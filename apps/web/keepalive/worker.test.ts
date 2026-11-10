// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { checkHealth } from './worker'

afterEach(() => vi.unstubAllGlobals())

describe('keepalive Worker', () => {
  it.each(['{"status":"UP"}', '{"status": "UP"}'])('accepts a 200 UP response: %s', async (body) => {
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(worker.scheduled({}, { HEALTH_URL: 'https://api.example.com/actuator/health' })).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/actuator/health', { method: 'GET' })
  })

  it.each([
    [200, '<html>not health</html>'],
    [429, '{"status":"UP"}'],
  ])('rejects status %i without UP', async (status, body) => {
    const fetchMock = vi.fn(async () => new Response(body, { status }))
    vi.stubGlobal('fetch', fetchMock)
    const wait = vi.fn(async () => {})

    await expect(checkHealth({ HEALTH_URL: 'https://api.example.com/actuator/health' }, wait)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenCalledTimes(2)
  })

  it('retries once after failure and succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('challenge', { status: 429 }))
      .mockResolvedValueOnce(new Response('{"status":"UP"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wait = vi.fn(async () => {})

    await expect(checkHealth({ HEALTH_URL: 'https://api.example.com/actuator/health' }, wait)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledExactlyOnceWith(20_000)
  })

  it('throws the last fetch error after three attempts', async () => {
    const lastError = new Error('third failure')
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockRejectedValueOnce(lastError)
    vi.stubGlobal('fetch', fetchMock)
    const wait = vi.fn(async () => {})

    await expect(checkHealth({ HEALTH_URL: 'https://api.example.com/actuator/health' }, wait)).rejects.toBe(lastError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenNthCalledWith(1, 20_000)
    expect(wait).toHaveBeenNthCalledWith(2, 20_000)
  })

  it.each([
    '<html>"status":"UP"</html>',
    '{"status":"DOWN"}',
    '{"nested":{"status":"UP"}}',
  ])('rejects a body without top-level UP: %s', async (body) => {
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wait = vi.fn(async () => {})

    await expect(checkHealth({ HEALTH_URL: 'https://api.example.com/actuator/health' }, wait)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rejects a missing HEALTH_URL without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkHealth({})).rejects.toThrow('HEALTH_URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
