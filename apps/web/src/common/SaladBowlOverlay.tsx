import { useCallback, useId, useState } from 'react'
import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import SaladBowlLoader from './SaladBowlLoader'
import styles from './SaladBowlOverlay.module.css'

/**
 * active인 동안 화면을 가리고 샐러드볼을 보여준다. 바깥 클릭·Esc로 닫히지 않는다.
 * active가 꺼지면 남은 재료를 마저 담은 뒤 닫는다. 그 사이 다시 켜지면 그대로 이어 간다.
 */
export default function SaladBowlOverlay({ active }: { active: boolean }) {
  const statusId = useId()
  const [open, setOpen] = useState(active)
  if (active && !open) setOpen(true)
  const close = useCallback(() => setOpen(false), [])
  return (
    <ModalOverlay isOpen={open} isDismissable={false} isKeyboardDismissDisabled className={styles.backdrop}>
      <Modal className={styles.card}>
        <Dialog aria-label="서버 준비 중" aria-describedby={statusId} className={styles.dialog}>
          <SaladBowlLoader slow statusId={statusId} done={!active} onFinished={close} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
