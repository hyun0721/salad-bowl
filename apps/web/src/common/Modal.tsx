import { useEffect, useId, useRef, type ReactNode } from 'react'
import ui from './ui.module.css'
import styles from './Modal.module.css'

type Props = { title: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, onClose, closeDisabled = false, children }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef({ onClose, closeDisabled })
  useEffect(() => {
    latest.current = { onClose, closeDisabled }
  })

  // 열리면 대화상자로 포커스를 옮기고, 닫히면 열기 전 위치로 돌려준다.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.focus()
    return () => opener?.focus()
  }, [])

  // Esc는 포커스가 어디 있든 닫는다. Tab은 대화상자 안에서만 돈다.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!latest.current.closeDisabled) latest.current.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = ref.current
      if (!dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={styles.overlay}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.dialog}>
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={ui.button} disabled={closeDisabled} onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  )
}
