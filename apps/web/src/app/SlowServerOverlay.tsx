import { useSlowRequests } from '../api/useSlowRequests'
import SaladBowlOverlay from '../common/SaladBowlOverlay'

/** 요청이 3초를 넘으면 화면을 가리고 서버가 깨어나는 동안 기다리게 한다. */
export default function SlowServerOverlay() {
  return <SaladBowlOverlay active={useSlowRequests()} />
}
