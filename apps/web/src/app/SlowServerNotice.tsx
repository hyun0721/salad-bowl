import { useSyncExternalStore } from 'react'
import { isSlow, onSlowRequests } from '../api/client'

/**
 * 안내 영역은 항상 마운트해 두고 내용만 바꾼다(스크린리더가 변화를 읽도록).
 * 마운트할 때 이미 느린 요청이 있으면 바로 보여준다.
 */
export default function SlowServerNotice() {
  const slow = useSyncExternalStore(onSlowRequests, isSlow)
  return (
    <p role="status" style={slow ? {
      margin: 0, padding: 'var(--space-3) var(--space-8)', background: 'var(--pending-tint)', color: 'var(--pending)',
    } : { margin: 0 }}>
      {slow ? '서버를 깨우는 중입니다. 처음 접속하면 30초쯤 걸릴 수 있습니다.' : null}
    </p>
  )
}
