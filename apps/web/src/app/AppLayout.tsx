import { NavLink, Outlet, Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useGroups } from '../groups/GroupProvider'
import SlowServerNotice from './SlowServerNotice'
import styles from './AppLayout.module.css'

const MENU = [
  { to: '/', label: '홈', end: true },
  { to: '/dashboard', label: '그룹 대시보드', end: false },
  { to: '/transactions', label: '거래 목록', end: false },
  { to: '/upload', label: '업로드', end: false },
  { to: '/groups', label: '그룹 관리', end: false },
]

export default function AppLayout() {
  const { me, logout } = useAuth()
  const { groups, selectedGroupId, selectGroup, isLoading, isError, retry } = useGroups()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <nav aria-label="주 메뉴" className={styles.nav}>
        <span className={styles.logo}>Salad Bowl</span>
        {MENU.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.main}>
        <header className={styles.header}>
          {isLoading ? (
            <span className={styles.groupState}>그룹 불러오는 중</span>
          ) : isError ? (
            <span className={styles.groupState}>
              그룹을 불러오지 못했습니다{' '}
              <button type="button" className={styles.logout} onClick={retry}>다시 시도</button>
            </span>
          ) : groups.length > 0 ? (
            <label className={styles.group}>
              <span>그룹</span>
              <select aria-label="그룹" value={selectedGroupId ?? ''}
                onChange={(e) => selectGroup(Number(e.target.value))}>
                {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.name}</option>)}
              </select>
            </label>
          ) : (
            <Link to="/groups">그룹 없음 · 만들기 또는 초대받기</Link>
          )}
          <div className={styles.user}>
            <span>{me?.nickname}</span>
            <button type="button" className={styles.logout} onClick={onLogout}>로그아웃</button>
          </div>
        </header>
        <SlowServerNotice />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
