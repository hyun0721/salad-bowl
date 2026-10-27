import { useSyncExternalStore } from 'react'
import { isSlow, onSlowRequests } from './client'

/** 지금 3초 넘게 걸리는 요청이 있는지. 마운트할 때 이미 느리면 바로 참이다. */
export function useSlowRequests(): boolean {
  return useSyncExternalStore(onSlowRequests, isSlow)
}
