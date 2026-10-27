import { useSlowRequests } from '../api/useSlowRequests'
import { useAuth } from '../auth/AuthProvider'
import SaladBowlOverlay from '../common/SaladBowlOverlay'

/**
 * 요청이 3초를 넘으면 화면을 가리고 서버가 깨어나는 동안 기다리게 한다. 앱 전역에 한 번만 둔다.
 * 화면이 바뀌어도 언마운트되지 않아 완료 모션을 끝까지 보여준다.
 * 세션 복원 중에는 시작 화면에 볼이 이미 있으므로 띄우지 않는다.
 */
export default function SlowServerOverlay() {
  const slow = useSlowRequests()
  const { status } = useAuth()
  return <SaladBowlOverlay active={slow && status !== 'loading'} />
}
