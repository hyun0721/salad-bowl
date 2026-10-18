import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

// 로그인 화면용 가드. 세션 복원이 끝나기 전에는 로그인 폼을 보여주지 않는다(복원 응답이
// 방금 한 로그인을 덮어써 로그아웃시키는 경합을 막는다). 이미 로그인했다면 되돌아갈 곳으로 보낸다.
export default function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [params] = useSearchParams()
  if (status === 'loading') return <p role="status" style={{ padding: 'var(--space-8)' }}>불러오는 중입니다.</p>
  if (status === 'signedIn') {
    const next = params.get('next')
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    return <Navigate to={target} replace />
  }
  return <>{children}</>
}
