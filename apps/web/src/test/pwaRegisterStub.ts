import { useState } from 'react'
import { vi } from 'vitest'

type Options = { onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void }

/** 테스트에서 virtual:pwa-register/react 대신 쓴다(vite.config.ts test.alias). */
export const stubRegister = {
  needRefresh: false,
  updateServiceWorker: vi.fn(async () => {}),
  lastOptions: undefined as Options | undefined,
}

export function useRegisterSW(options: Options = {}) {
  // oxlint-disable-next-line react/immutability -- 테스트 stub이라 렌더 중 마지막 옵션을 기록해도 된다.
  stubRegister.lastOptions = options
  const needRefresh = useState(stubRegister.needRefresh)
  return { needRefresh, offlineReady: useState(false), updateServiceWorker: stubRegister.updateServiceWorker }
}
