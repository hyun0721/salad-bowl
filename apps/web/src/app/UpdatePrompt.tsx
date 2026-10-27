import ui from '../common/ui.module.css'
import styles from './UpdatePrompt.module.css'
import { useAppUpdate } from './useAppUpdate'

/** 새 버전이 감지될 때만 보인다. 작성 중인 입력을 잃지 않도록 사용자가 누를 때만 새로 고친다. */
export default function UpdatePrompt() {
  const { needRefresh, update, dismiss } = useAppUpdate()
  if (!needRefresh) return null
  return (
    <div role="status" className={styles.prompt}>
      <span className={styles.text}>새 버전이 있어요</span>
      <button type="button" className={ui.button} onClick={dismiss}>나중에</button>
      <button type="button" className={`${ui.button} ${ui.primary}`} onClick={update}>새로고침</button>
    </div>
  )
}
