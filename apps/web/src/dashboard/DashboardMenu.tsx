import { Link, useLocation } from 'react-router'
import type { Level } from './dashboardRoute'
import styles from './DashboardMenu.module.css'

const LEVELS: [Level, string][] = [['major', '대분류'], ['minor', '소분류']]

/** 화면을 바꾸는 형제 링크이므로 replace로 이동한다. */
export default function DashboardMenu({ level }: { level: Level }) {
  const { search } = useLocation()
  return (
    <nav aria-label="대시보드 메뉴" className={styles.menu}>
      <div role="group" aria-label="분류" className={styles.group}>
        {LEVELS.map(([id, text]) => (
          <Link key={id} to={`/dashboard/${id}${search}`} replace aria-current={id === level ? 'page' : undefined} className={styles.link}>
            {text}
          </Link>
        ))}
      </div>
    </nav>
  )
}
