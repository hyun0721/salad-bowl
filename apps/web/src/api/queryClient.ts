import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

/** 4xx는 다시 보내도 같은 결과라 재시도하지 않는다. 서버·네트워크 오류는 한 번만 다시 시도한다. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

/** 그룹 하나에 속한 쿼리인지. 이런 쿼리의 404는 "더 이상 그 그룹의 멤버가 아님"이다. */
export function isGroupScopedKey(key: readonly unknown[]): boolean {
  const [head, second] = key
  if (head === 'groups') return key.length > 1
  if (head === 'transactions') return second === 'group'
  return head === 'summary' || head === 'bans'
}

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 추방·탈퇴로 그룹에서 빠지면 목록을 다시 받아 헤더와 선택 그룹을 바로잡는다.
        if (error instanceof ApiError && error.status === 404 && isGroupScopedKey(query.queryKey)) {
          void client.invalidateQueries({ queryKey: ['groups'], exact: true })
        }
      },
    }),
    defaultOptions: { queries: { retry: shouldRetry, refetchOnWindowFocus: false } },
  })
  return client
}
