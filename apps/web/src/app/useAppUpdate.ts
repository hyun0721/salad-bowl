import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_MS = 60 * 60 * 1000

/**
 * 새 버전(대기 중인 서비스워커)이 있는지 알려준다. 1시간마다, 그리고 화면에 다시 돌아올 때 확인한다.
 * 홈 화면 앱은 오래 켜 두는 경우가 많아 열려 있는 동안에도 확인해야 한다.
 */
export function useAppUpdate() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    // shortcut: 등록 콜백의 타이머와 리스너는 앱 수명 동안 하나뿐이라 해제하지 않는다. 등록이 여러 번 일어나면 해제를 넣는다.
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // 오프라인이면 확인이 실패한다. 다음 확인 때 다시 시도하면 되므로 무시한다.
      const check = () => { registration.update().catch(() => {}) }
      setInterval(check, CHECK_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })
  return {
    needRefresh,
    update: () => { void updateServiceWorker(true) },
    dismiss: () => setNeedRefresh(false),
  }
}
