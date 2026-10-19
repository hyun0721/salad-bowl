import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { safeNext } from '../common/safeNext'
import styles from './Gate.module.css'
import ServerUnavailable from './ServerUnavailable'
import SlowServerNotice from './SlowServerNotice'

// 로그인 화면용 가드. 세션 복원이 끝나기 전에는 로그인 폼을 보여주지 않는다(복원 응답이
// 방금 한 로그인을 덮어써 로그아웃시키는 경합을 막는다). 이미 로그인했다면 되돌아갈 곳으로 보낸다.
// 콜드스타트 안내는 복원 중과 로그인 화면(로그인 요청이 느릴 때) 모두에서 보여준다.
export default function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [params] = useSearchParams()
  if (status === 'signedIn') {
    return <Navigate to={safeNext(params.get('next'))} replace />
  }
  return (
    <>
      <SlowServerNotice />
      {status === 'loading' && <p className={styles.loading}>불러오는 중입니다.</p>}
      {status === 'unavailable' && <ServerUnavailable />}
      {status === 'signedOut' && children}
    </>
  )
}
