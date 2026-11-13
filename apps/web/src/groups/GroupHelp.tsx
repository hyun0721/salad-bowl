import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components'
import ui from '../common/ui.module.css'
import styles from './GroupsPage.module.css'

export default function GroupHelp({ title, children }: { title: string; children: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    // RAC의 비모달 팝오버는 포커스를 받지 않는 바깥 영역을 눌러도 닫히지 않는다.
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !popover.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button ref={trigger} aria-label={`${title} 도움말`} className={`${ui.button} ${ui.iconButton} ${ui.ghost} ${styles.helpButton}`}>
        <span aria-hidden="true">?</span>
      </Button>
      <Popover ref={popover} isNonModal placement="bottom start" offset={4} className={styles.helpPopover}
        shouldCloseOnInteractOutside={(element) => !trigger.current?.contains(element)}>
        <Dialog aria-label={`${title} 도움말`} className={styles.helpContent}>
          <p>{children}</p>
          <Button slot="close" className={ui.button}>닫기</Button>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
