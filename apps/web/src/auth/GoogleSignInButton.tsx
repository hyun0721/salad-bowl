import { useEffect, useRef } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

type GoogleId = {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

let scriptPromise: Promise<void> | null = null

/** Google Identity Services 스크립트를 한 번만 불러온다. 실패하면 다음에 다시 시도할 수 있게 비운다. */
function loadScript(): Promise<void> {
  if (window.google) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      reject(new Error('google script failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** 구글 로그인 버튼. 클라이언트 ID가 설정되지 않았으면 아무것도 그리지 않는다. */
export default function GoogleSignInButton({ onCredential, onError }: {
  onCredential: (idToken: string) => void
  onError: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onCredential, onError })
  useEffect(() => {
    callbacks.current = { onCredential, onError }
  })

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadScript().then(() => {
      if (cancelled || !host.current || !window.google) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => callbacks.current.onCredential(response.credential),
      })
      window.google.accounts.id.renderButton(host.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'ko', width: 320,
      })
    }).catch(() => {
      if (!cancelled) callbacks.current.onError()
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!CLIENT_ID) return null
  return <div ref={host} aria-label="Google로 계속하기" style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
}
