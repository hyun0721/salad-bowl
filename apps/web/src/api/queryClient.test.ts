import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { createQueryClient, isGroupScopedKey, shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError(403, 'REMOVED_FROM_GROUP', 'x'))).toBe(false)
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false)
    expect(shouldRetry(0, new ApiError(400, 'VALIDATION_FAILED', 'x'))).toBe(false)
  })

  it('retries server and network errors once', () => {
    expect(shouldRetry(0, new ApiError(503, 'REQUEST_FAILED', 'x'))).toBe(true)
    expect(shouldRetry(0, new ApiError(0, 'NETWORK_ERROR', 'x'))).toBe(true)
    expect(shouldRetry(1, new ApiError(503, 'REQUEST_FAILED', 'x'))).toBe(false)
    expect(shouldRetry(0, new Error('boom'))).toBe(true)
  })
})

describe('isGroupScopedKey', () => {
  it('matches queries that belong to one group', () => {
    expect(isGroupScopedKey(['groups', 10])).toBe(true)
    expect(isGroupScopedKey(['summary', 10, '2026-10'])).toBe(true)
    expect(isGroupScopedKey(['bans', 10])).toBe(true)
    expect(isGroupScopedKey(['transactions', 'group', 10, '2026-10', null])).toBe(true)
    expect(isGroupScopedKey(['groups'])).toBe(false)
    expect(isGroupScopedKey(['transactions', 'mine', '2026-10'])).toBe(false)
  })
})

describe('createQueryClient', () => {
  it('refreshes the group list when a group query answers 404', async () => {
    const client = createQueryClient()
    client.setQueryData(['groups'], [{ groupId: 10, name: '우리집', myRole: 'MEMBER', memberCount: 2 }])

    await client.prefetchQuery({
      queryKey: ['summary', 10, '2026-10'],
      queryFn: () => Promise.reject(new ApiError(404, 'NOT_FOUND', 'group not found')),
    })

    expect(client.getQueryState(['groups'])?.isInvalidated).toBe(true)
  })

  it('leaves the group list alone for other errors', async () => {
    const client = createQueryClient()
    client.setQueryData(['groups'], [])

    await client.prefetchQuery({
      queryKey: ['transactions', 'mine', '2026-10'],
      queryFn: () => Promise.reject(new ApiError(404, 'NOT_FOUND', 'x')),
    })

    expect(client.getQueryState(['groups'])?.isInvalidated).toBe(false)
  })
})
