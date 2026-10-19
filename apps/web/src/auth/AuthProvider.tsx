import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthLost, refreshAccessToken, setAccessToken } from '../api/client'
import { authApi, type Me } from './authApi'

type Status = 'loading' | 'signedOut' | 'signedIn'

type AuthValue = {
  status: Status
  me: Me | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, nickname: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const RESTORE_RETRIES = 2
const RESTORE_RETRY_MS = 1000

/** 시작할 때 세션 복원. 서버가 깨어나는 중(일시적 실패)이면 잠깐 기다렸다 다시 시도한다. */
async function restoreSession(): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await refreshAccessToken()
    } catch (error) {
      if (attempt >= RESTORE_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, RESTORE_RETRY_MS))
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMe] = useState<Me | null>(null)

  const signOutLocally = useCallback(() => {
    setAccessToken(null)
    setMe(null)
    setStatus('signedOut')
  }, [])

  useEffect(() => {
    let cancelled = false
    restoreSession()
      .then((token) => (token ? authApi.me() : null))
      .then((profile) => {
        if (cancelled) return
        setMe(profile)
        setStatus(profile ? 'signedIn' : 'signedOut')
      })
      .catch(() => {
        if (!cancelled) signOutLocally()
      })
    const off = onAuthLost(signOutLocally)
    return () => {
      cancelled = true
      off()
    }
  }, [signOutLocally])

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password)
    setAccessToken(accessToken)
    setMe(await authApi.me())
    setStatus('signedIn')
  }, [])

  const signup = useCallback(async (email: string, password: string, nickname: string) => {
    await authApi.signup(email, password, nickname)
    await login(email, password)
  }, [login])

  const logout = useCallback(async () => {
    // 서버 로그아웃이 성공했을 때만 로컬에서 로그아웃한다. 실패하면 HttpOnly 쿠키가 남아
    // 새로고침 시 세션이 복원되므로, 로그인 상태를 유지한 채 호출한 쪽에 오류를 알린다.
    await authApi.logout()
    signOutLocally()
  }, [signOutLocally])

  const value = useMemo(() => ({ status, me, login, signup, logout }), [status, me, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// 훅은 Provider와 같은 파일에 둔다(컨텍스트를 밖으로 내보내지 않기 위해).
// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
