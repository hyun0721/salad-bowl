import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSlowRequests } from '../api/useSlowRequests'
import { useAuth } from '../auth/AuthProvider'
import SaladBowlLoader from '../common/SaladBowlLoader'
import styles from './Gate.module.css'
import ServerUnavailable from './ServerUnavailable'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  const slow = useSlowRequests()
  // 시작 화면에는 볼이 이미 있으므로 덮개를 겹쳐 띄우지 않는다.
  if (status === 'loading') return <div className={styles.loading}><SaladBowlLoader slow={slow} /></div>
  if (status === 'unavailable') return <ServerUnavailable />
  if (status === 'signedOut') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}
