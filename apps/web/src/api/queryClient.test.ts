import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { shouldRetry } from './queryClient'

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
