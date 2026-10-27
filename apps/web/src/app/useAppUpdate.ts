import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_MS = 60 * 60 * 1000

/**
 * 새 버전(대기 중인 서비스워커)이 있는지 알려준다. 1시간마다, 그리고 화면에 다시 돌아올 때 확인한다.
 * 홈 화면 앱은 오래 켜 두는 경우가 많아 열려 있는 동안에도 확인해야 한다.
 */
export function useAppUpdate() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => { void registration.update() }
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
