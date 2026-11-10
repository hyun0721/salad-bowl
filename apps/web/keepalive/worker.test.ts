// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { checkHealth } from './worker'

afterEach(() => vi.unstubAllGlobals())

describe('keepalive Worker', () => {
  it('accepts a 200 UP response', async () => {
    const fetchMock = vi.fn(async () => new Response('{"status":"UP"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(worker.scheduled({}, { HEALTH_URL: 'https://api.example.com/actuator/health' })).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/actuator/health', { method: 'GET' })
  })

  it.each([
    [200, '<html>not health</html>'],
    [429, '{"status":"UP"}'],
  ])('rejects status %i without UP', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))

    await expect(checkHealth({ HEALTH_URL: 'https://api.example.com/actuator/health' })).rejects.toThrow(String(status))
  })

  it('propagates fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network failed') }))

    await expect(worker.scheduled({}, { HEALTH_URL: 'https://api.example.com/actuator/health' })).rejects.toThrow('network failed')
  })

  it('rejects a missing HEALTH_URL without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkHealth({})).rejects.toThrow('HEALTH_URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
