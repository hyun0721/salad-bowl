import type { ReactNode } from 'react'
import {
  Dialog as AriaDialog, Heading, Modal, ModalOverlay, Sheet, SheetBackdrop, SheetContent, SheetOverlay,
} from 'react-aria-components'
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
  if (narrow) {
    return (
      <SheetOverlay isOpen={isOpen} onOpenChange={onOpenChange} preventDismissal={closeDisabled}
        // 입력이 있는 대화상자는 바깥을 실수로 눌러 입력을 잃지 않게 한다(넓은 화면 모달과 같은 규칙).
        shouldCloseOnInteractOutside={() => closeOnOutsideClick}
        className={styles.sheetOverlay}>
        <SheetBackdrop className={styles.sheetBackdrop} />
        <Sheet className={fullHeight ? `${styles.modalSheet} ${styles.fullSheet}` : styles.modalSheet}>
          <SheetContent className={styles.content}>{({ close }) => body(close)}</SheetContent>
        </Sheet>
      </SheetOverlay>
    )
  }
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={closeOnOutsideClick && !closeDisabled}
      isKeyboardDismissDisabled={closeDisabled} className={styles.backdrop}>
      <Modal className={wide ? `${styles.modal} ${styles.wide}` : styles.modal}>
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
