import { useRef, type ReactNode, type RefObject } from 'react'
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from 'react-aria-components'
import Icon, { type IconName } from './Icon'
import styles from './BottomSheet.module.css'

type Props = {
  title: string
  triggerLabel: string
  triggerIcon: IconName
  triggerClassName?: string
  onOpen?: () => void
  buttonRef?: RefObject<HTMLButtonElement | null>
  children: (opts: { close: () => void }) => ReactNode
}

/** 아이콘 버튼으로 여는 하단 시트. Esc·바깥을 누르면 닫힌다.
 *  RAC Sheet는 안드로이드에서 닫힘이 끝나지 않아 배경이 남으므로 쓸어 닫기 대신 ModalOverlay와 CSS 애니메이션을 쓴다. */
export default function BottomSheet({ title, triggerLabel, triggerIcon, triggerClassName, onOpen, buttonRef, children }: Props) {
  const internalRef = useRef<HTMLButtonElement>(null)
  const triggerRef = buttonRef ?? internalRef
  // RAC는 시트가 열릴 때 포커스가 있던 요소로 닫힌 뒤 포커스를 돌려준다. 스크린 리더처럼 포커스 없이
  // 누르는 경우(가상 클릭)에는 그 요소가 body라 돌아갈 곳이 없으므로, 열기 직전에 트리거에 포커스를 둔다.
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) return
    triggerRef.current?.focus()
    onOpen?.()
  }
  return (
    <DialogTrigger onOpenChange={onOpenChange}>
      <Button ref={triggerRef} aria-label={triggerLabel} className={triggerClassName ?? styles.trigger}>
        <Icon name={triggerIcon} />
      </Button>
      <ModalOverlay isDismissable className={styles.backdrop}>
        <Modal className={styles.sheet}>
          <Dialog className={styles.content}>
            {({ close }) => (
              <>
                <span className={styles.handle} aria-hidden="true" />
                <Heading slot="title" className={styles.title}>{title}</Heading>
                {children({ close })}
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}
