import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

/** 4xx는 다시 보내도 같은 결과라 재시도하지 않는다. 서버·네트워크 오류는 한 번만 다시 시도한다. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry, refetchOnWindowFocus: false } },
  })
}
