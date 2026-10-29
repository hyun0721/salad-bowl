import type { ReactNode } from 'react'
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { useNarrowWhileOpen } from './useMediaQuery'
import styles from './Overlay.module.css'
import ui from './ui.module.css'

type FrameProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  closeDisabled?: boolean
  closeOnOutsideClick?: boolean
  fullHeight?: boolean
  wide?: boolean
  headerAction?: ReactNode
  children: (opts: { close: () => void }) => ReactNode
}

/** 넓은 화면은 가운데 모달, 좁은 화면은 아래에서 올라오는 시트. 포커스 가두기·Esc·복귀는 RAC가 맡는다. */
export function DialogFrame(props: FrameProps) {
  const { isOpen, onOpenChange, title, closeDisabled = false, closeOnOutsideClick = false, fullHeight = false, wide = false, headerAction, children } = props
  const narrow = useNarrowWhileOpen(isOpen)

  const body = (close: () => void) => (
    <>
      <div className={styles.header}>
        <Heading slot="title" level={2} className={styles.dialogTitle}>{title}</Heading>
        {headerAction}
      </div>
      {children({ close })}
    </>
  )
  // RAC Sheet는 닫힘을 IntersectionObserver로만 기다려, 안드로이드에서 시트가 화면 끝에 걸치면 배경이 남아 탭을 막는다.
  // 좁은 화면도 같은 ModalOverlay에 CSS 애니메이션을 달아 애니메이션이 끝나면 닫히게 한다.
  const sheetClass = fullHeight ? `${styles.modalSheet} ${styles.fullSheet}` : styles.modalSheet
  const modalClass = wide ? `${styles.modal} ${styles.wide}` : styles.modal
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={closeOnOutsideClick && !closeDisabled}
      isKeyboardDismissDisabled={closeDisabled} className={narrow ? styles.sheetBackdrop : styles.backdrop}>
      <Modal className={narrow ? sheetClass : modalClass}>
        <AriaDialog className={styles.content}>{({ close }) => body(close)}</AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

type Props = { title: string; onClose: () => void; closeDisabled?: boolean; children: ReactNode }

/** 화면이 조건부로 그려서 여닫는 대화상자. 기존 Modal과 사용법이 같다. */
export default function Dialog({ title, onClose, closeDisabled = false, children }: Props) {
  return (
    <DialogFrame isOpen onOpenChange={(open) => { if (!open && !closeDisabled) onClose() }}
      title={title} closeDisabled={closeDisabled}
      headerAction={<button type="button" className={ui.button} disabled={closeDisabled} onClick={onClose}>닫기</button>}>
      {() => children}
    </DialogFrame>
  )
}
