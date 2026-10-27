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
  stubRegister.lastOptions = options
  const needRefresh = useState(stubRegister.needRefresh)
  return { needRefresh, offlineReady: useState(false), updateServiceWorker: stubRegister.updateServiceWorker }
}
