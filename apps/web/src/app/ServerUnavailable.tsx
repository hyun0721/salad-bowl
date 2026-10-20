import { useAuth } from '../auth/AuthProvider'
import ui from '../common/ui.module.css'
import styles from './Gate.module.css'

/** 세션 복원이 서버 문제로 끝나지 못했을 때. 로그인 화면으로 보내지 않고 다시 시도하게 한다. */
export default function ServerUnavailable() {
  const { retryRestore } = useAuth()
  return (
    <div className={styles.unavailable}>
      <p role="alert" className={ui.alert}>서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <button type="button" className={`${ui.button} ${ui.primary}`} onClick={retryRestore}>다시 시도</button>
    </div>
  )
}
