import type { ReactNode } from 'react'
import { Button, Heading, Sheet, SheetBackdrop, SheetContent, SheetOverlay, SheetTrigger } from 'react-aria-components'
import Icon, { type IconName } from './Icon'
import styles from './BottomSheet.module.css'

type Props = {
  title: string
  triggerLabel: string
  triggerIcon: IconName
  triggerClassName?: string
  children: (opts: { close: () => void }) => ReactNode
}

/** 아이콘 버튼으로 여는 하단 시트. 아래로 쓸거나 Esc·바깥을 누르면 닫힌다. */
export default function BottomSheet({ title, triggerLabel, triggerIcon, triggerClassName, children }: Props) {
  return (
    <SheetTrigger>
      <Button aria-label={triggerLabel} className={triggerClassName ?? styles.trigger}>
        <Icon name={triggerIcon} />
      </Button>
      <SheetOverlay className={styles.overlay}>
        <SheetBackdrop className={styles.backdrop} />
        <Sheet className={styles.sheet}>
          <SheetContent className={styles.content}>
            {({ close }) => (
              <>
                <span className={styles.handle} aria-hidden="true" />
                <Heading slot="title" className={styles.title}>{title}</Heading>
                {children({ close })}
              </>
            )}
          </SheetContent>
        </Sheet>
      </SheetOverlay>
    </SheetTrigger>
  )
}
