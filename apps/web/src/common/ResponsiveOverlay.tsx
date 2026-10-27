import { useId, type ReactNode } from 'react'
import { Dialog, Heading, Popover } from 'react-aria-components'
import styles from './Overlay.module.css'

/**
 * 넓은 화면은 트리거 아래 팝오버, 좁은 화면은 하단 시트로 띄운다.
 * 모양은 부모가 useNarrowWhileOpen으로 정한다.
 */
// Modal은 닫힌 상태에서 Select가 컬렉션을 수집하지 못하므로 모바일도 Popover를 쓴다.
export function ResponsiveOverlay({ mobile, title, children, dialog = true }: { mobile: boolean; title: string; children: ReactNode; dialog?: boolean }) {
  const titleId = useId()
  return mobile ? (
    <Popover placement="bottom start" className={styles.sheet}>
      <Dialog aria-labelledby={titleId} className={styles.dialog}>
        <Heading id={titleId} slot="title" className={styles.title}>{title}</Heading>
        {children}
      </Dialog>
    </Popover>
  ) : !dialog ? (
    // 단순 목록(Select)은 대화상자가 아니다. Dialog를 빼도 모달 Popover가 스스로 role=dialog를 단다(isNonModal이면 underlay가 사라져 바깥 클릭이 뚫린다). 이름만 붙인다. DatePicker만 Dialog가 필요하다.
    <Popover placement="bottom start" offset={4} aria-label={title} className={styles.popover}>{children}</Popover>
  ) : (
    <Popover placement="bottom start" offset={4} className={styles.popover}>
      <Dialog aria-label={title} className={styles.dialog}>{children}</Dialog>
    </Popover>
  )
}
