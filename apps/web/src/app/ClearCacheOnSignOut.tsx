import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider'

/** 로그아웃·세션 만료로 로그인 상태가 풀리면 쿼리 캐시를 비운다(다음 사용자에게 이전 데이터가 보이지 않게). */
export default function ClearCacheOnSignOut() {
  const { status } = useAuth()
  const queryClient = useQueryClient()
  const previous = useRef(status)
  useEffect(() => {
    if (previous.current === 'signedIn' && status === 'signedOut') queryClient.clear()
    previous.current = status
  }, [status, queryClient])
  return null
}
