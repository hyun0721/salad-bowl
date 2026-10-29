import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import Dialog from '../common/Dialog'
import ui from '../common/ui.module.css'

type Version = { version: string; commit: string }

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const [server, setServer] = useState<Version | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<unknown>('/version', { signal: controller.signal, trackSlow: false })
      .then((data) => {
        if (controller.signal.aborted) return
        if (typeof data !== 'object' || data === null || !('version' in data) || !('commit' in data)
          || typeof data.version !== 'string' || typeof data.commit !== 'string'
          || !/^(dev|0\.1\.\d+(?:-preview\.[0-9a-f]{7})?)$/.test(data.version)
          || !/^(unknown|[0-9a-f]{40})$/.test(data.commit)) {
          throw new Error('Invalid build metadata')
        }
        setServer({ version: data.version, commit: data.commit })
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [attempt])

  return (
    <Dialog title="도움말" onClose={onClose}>
      <dl>
        <dt>앱 버전</dt>
        <dd>{__APP_VERSION__.version} <small>({__APP_VERSION__.commit.slice(0, 7)})</small></dd>
        <dt>서버 버전</dt>
        <dd aria-live="polite">
          {server ? <>{server.version} <small>({server.commit.slice(0, 7)})</small></> : failed ? (
            <>확인할 수 없음{' '}<button type="button" className={ui.button} onClick={() => { setFailed(false); setAttempt((n) => n + 1) }}>다시 시도</button></>
          ) : '확인 중'}
        </dd>
      </dl>
    </Dialog>
  )
}
