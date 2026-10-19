import { useEffect, useId, useRef, type ReactNode } from 'react'
import ui from './ui.module.css'
import styles from './Modal.module.css'

type Props = { title: string; onClose: () => void; children: ReactNode }

export default function Modal({ title, onClose, children }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className={styles.overlay}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={styles.dialog}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={ui.button} onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  )
}
