import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import styles from './Gate.module.css'
import ServerUnavailable from './ServerUnavailable'
import SlowServerNotice from './SlowServerNotice'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading' || status === 'unavailable') {
    return (
      <>
        <SlowServerNotice />
        {status === 'loading' ? <p className={styles.loading}>불러오는 중입니다.</p> : <ServerUnavailable />}
      </>
    )
  }
  if (status === 'signedOut') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}
