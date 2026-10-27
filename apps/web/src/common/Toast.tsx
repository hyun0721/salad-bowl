import {
  Button, Text, UNSTABLE_Toast as AriaToast, UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue, UNSTABLE_ToastRegion as AriaToastRegion,
} from 'react-aria-components'
import Icon from './Icon'
import styles from './Toast.module.css'

// 앱 전체에서 하나의 큐를 쓴다. RAC Toast는 1.22.1에서 UNSTABLE API라 이 파일 밖에서는 쓰지 않는다.
const queue = new ToastQueue<string>({ maxVisibleToasts: 3 })

/** 성공 알림. 오류는 놓치지 않게 인라인으로 두고 여기로 보내지 않는다. */
// oxlint-disable-next-line react/only-export-components
export function toast(message: string) {
  queue.add(message, { timeout: 4000 })
}

/** 테스트 전용: 테스트 사이에 남은 알림을 지운다. */
// oxlint-disable-next-line react/only-export-components
export function clearToasts() {
  queue.clear()
}

export default function ToastRegion() {
  return (
    <AriaToastRegion queue={queue} aria-label="알림" className={styles.region}>
      {({ toast: item }) => (
        <AriaToast toast={item} className={styles.toast}>
          <ToastContent className={styles.content}>
            <Text slot="title">{item.content}</Text>
          </ToastContent>
          <Button slot="close" aria-label="알림 닫기" className={styles.close}><Icon name="x" size={18} /></Button>
        </AriaToast>
      )}
    </AriaToastRegion>
  )
}
