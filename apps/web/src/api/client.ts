import { ApiError } from './errors'

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const SLOW_MS = 3000

let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null
const authLostListeners = new Set<() => void>()
const slowListeners = new Set<(slow: boolean) => void>()
let slowCount = 0

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function onAuthLost(listener: () => void): () => void {
  authLostListeners.add(listener)
  return () => authLostListeners.delete(listener)
}

export function onSlowRequests(listener: (slow: boolean) => void): () => void {
  slowListeners.add(listener)
  return () => slowListeners.delete(listener)
}

export function apiUrl(path: string): string {
  return new URL(BASE + path, window.location.origin).toString()
}

type ApiInit = RequestInit & { json?: unknown; auth?: boolean }

/**
 * refresh 쿠키로 새 access 토큰을 받는다. 동시에 불려도 요청은 하나만 보낸다.
 * - 서버가 거절(401·403)하면 토큰을 지우고 null을 돌려준다. 로그인 중이었다면 onAuthLost를 한 번 알린다.
 * - 일시적인 실패(5xx, 네트워크 오류, 잘못된 응답)는 ApiError로 reject한다. 이때 토큰은 그대로 둔다.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = rawFetch('/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          const hadSession = accessToken !== null
          setAccessToken(null)
          if (hadSession) authLostListeners.forEach((listener) => listener())
          return null
        }
        if (!res.ok) throw await toError(res)
        const body = (await res.json()) as { accessToken?: unknown }
        if (typeof body.accessToken !== 'string') {
          throw new ApiError(res.status, 'REQUEST_FAILED', '요청을 처리하지 못했습니다.')
        }
        setAccessToken(body.accessToken)
        return body.accessToken
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, auth = true, ...rest } = init
  const send = () => {
    const headers = new Headers(rest.headers)
    if (json !== undefined) headers.set('Content-Type', 'application/json')
    if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    return rawFetch(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body })
  }

  let res = await send()
  if (res.status === 401 && auth) {
    // 일시적인 refresh 실패는 여기서 그대로 throw된다(세션 유지).
    const token = await refreshAccessToken()
    if (!token) throw await toError(res)
    res = await send()
  }
  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** 요청 하나. 3초가 지나도 끝나지 않으면 느린 요청으로 세고, 끝나면 뺀다. */
async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  let slow = false
  const timer = setTimeout(() => {
    slow = true
    markSlow(1)
  }, SLOW_MS)
  try {
    return await fetch(apiUrl(path), { ...init, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다.')
  } finally {
    clearTimeout(timer)
    if (slow) markSlow(-1)
  }
}

function markSlow(delta: number) {
  const before = slowCount > 0
  slowCount += delta
  const after = slowCount > 0
  if (before !== after) slowListeners.forEach((listener) => listener(after))
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { code?: string; message?: string }
    return new ApiError(res.status, body.code ?? 'REQUEST_FAILED', body.message ?? '요청을 처리하지 못했습니다.')
  } catch {
    return new ApiError(res.status, 'REQUEST_FAILED', '요청을 처리하지 못했습니다.')
  }
}
