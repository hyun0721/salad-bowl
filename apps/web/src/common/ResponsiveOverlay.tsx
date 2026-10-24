import { useState, type ReactNode } from 'react'
import { Dialog, Heading, Popover } from 'react-aria-components'
import { useMediaQuery } from './useMediaQuery'
import styles from './Select.module.css'

/**
 * 넓은 화면은 트리거 아래 팝오버, 좁은 화면은 하단 시트로 띄운다.
 * 열린 동안 폭이 바뀌어도(회전 등) 모양을 바꾸지 않는다. 바꾸면 포커스와 위치가 깨진다.
 * 부모(Select, DatePicker)의 onOpenChange에 onOpenChange를 넘긴다.
 */
export function useOverlayMode() {
  const narrow = useMediaQuery('(max-width: 820px)')
  const [openedNarrow, setOpenedNarrow] = useState<boolean | null>(null)
  return {
    mobile: openedNarrow ?? narrow,
    onOpenChange: (open: boolean) => setOpenedNarrow(open ? narrow : null),
  }
}

// Modal은 닫힌 상태에서 Select가 컬렉션을 수집하지 못하므로 모바일도 Popover를 쓴다.
export function ResponsiveOverlay({ mobile, title, children }: { mobile: boolean; title: string; children: ReactNode }) {
  return mobile ? (
    <Popover placement="bottom start" className={styles.sheet}>
      <Dialog className={styles.dialog}>
        <Heading slot="title" className={styles.title}>{title}</Heading>
        {children}
      </Dialog>
    </Popover>
  ) : (
    <Popover placement="bottom start" offset={4} className={styles.popover}>
      <Dialog aria-label={title} className={styles.dialog}>{children}</Dialog>
    </Popover>
  )
}
