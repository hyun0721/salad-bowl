import { Link, useLocation } from 'react-router'
import type { Level, View } from './dashboardRoute'
import styles from './DashboardMenu.module.css'

const LEVELS: [Level, string][] = [['major', '대분류'], ['minor', '소분류']]
const VIEWS: [View, string][] = [['share', '분포'], ['trend', '추이']]

/** 화면을 바꾸는 형제 링크이므로 replace로 이동한다. */
export default function DashboardMenu({ level, view }: { level: Level; view: View }) {
  const { search } = useLocation()
  const row = <T extends string>(label: string, items: [T, string][], current: T, to: (id: T) => string) => (
    <div role="group" aria-label={label} className={styles.group}>
      {items.map(([id, text]) => (
        <Link key={id} to={to(id) + search} replace aria-current={id === current ? 'page' : undefined} className={styles.link}>
          {text}
        </Link>
      ))}
    </div>
  )
  return (
    <nav aria-label="대시보드 메뉴" className={styles.menu}>
      {row('분류', LEVELS, level, (l) => `/dashboard/${l}/${view}`)}
      {row('보기', VIEWS, view, (v) => `/dashboard/${level}/${v}`)}
    </nav>
  )
}
