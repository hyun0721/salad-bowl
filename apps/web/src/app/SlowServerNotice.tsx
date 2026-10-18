import { useEffect, useState } from 'react'
import { onSlowRequests } from '../api/client'

export default function SlowServerNotice() {
  const [slow, setSlow] = useState(false)
  useEffect(() => onSlowRequests(setSlow), [])
  if (!slow) return null
  return (
    <p role="status" style={{
      margin: 0, padding: 'var(--space-3) var(--space-8)', background: 'var(--pending-tint)', color: 'var(--pending)',
    }}>
      서버를 깨우는 중입니다. 처음 접속하면 30초쯤 걸릴 수 있습니다.
    </p>
  )
}
