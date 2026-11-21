import { NavLink } from 'react-router'
import { MENU, visibleChildren } from '../app/menu'
import { useAuth } from '../auth/AuthProvider'
import { NARROW, useMediaQuery } from '../common/useMediaQuery'
// 대시보드 화면 안 메뉴와 같은 모양을 쓴다.
import styles from '../dashboard/DashboardMenu.module.css'

const TAX = MENU.find((item) => item.to === '/tax')!

/**
 * 좁은 화면의 소득공제 하위 화면 이동(TAX-19). 사이드바가 없는 폭에서, 보이는 하위 화면이 둘 이상일 때만 그린다.
 * 화면을 바꾸는 형제 링크이므로 대시보드 메뉴처럼 replace로 이동한다.
 */
export default function TaxTabs() {
  const { me } = useAuth()
  const narrow = useMediaQuery(NARROW)
  const links = visibleChildren(TAX, me?.serviceAdmin ?? false)
  if (!narrow || links.length < 2) return null
  return (
    <nav aria-label="소득공제 메뉴" className={styles.menu}>
      <div className={styles.group}>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} replace className={styles.link}>{link.shortLabel ?? link.label}</NavLink>
        ))}
      </div>
    </nav>
  )
}
