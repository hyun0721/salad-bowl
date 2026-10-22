import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useGroups } from '../groups/GroupProvider'
import Icon, { type IconName } from '../common/Icon'
import SlowServerNotice from './SlowServerNotice'
import styles from './AppLayout.module.css'

const MENU: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/dashboard', label: '그룹 대시보드', icon: 'dashboard', end: false },
  { to: '/transactions', label: '거래 목록', icon: 'receipt', end: false },
  { to: '/upload', label: '업로드', icon: 'sheet-upload', end: false },
  { to: '/groups', label: '그룹 관리', icon: 'users', end: false },
]

export default function AppLayout() {
  const { me, logout } = useAuth()
  const { groups, selectedGroupId, selectGroup, isLoading, isError, retry } = useGroups()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const lastPath = useRef(location.pathname)
  useEffect(() => {
    // 메뉴로 화면을 바꾸면 새 화면 제목으로 포커스를 옮긴다(스크린리더가 바뀐 화면을 읽도록). 처음 들어올 때는 옮기지 않는다.
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    const heading = mainRef.current?.querySelector('h1')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus()
    }
  }, [location.pathname])

  const [logoutError, setLogoutError] = useState(false)

  async function onLogout() {
    setLogoutError(false)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError(true)
    }
  }

  return (
    <div className={styles.shell}>
      <nav aria-label="주 메뉴" className={styles.nav}>
        <span className={styles.logo}><img src="/logo.svg" alt="" width="28" height="28" />Salad Bowl</span>
        {MENU.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
            <Icon name={item.icon} />{item.label}
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
            <Link to="/groups" className={styles.noGroup}>그룹 없음 · 만들기 또는 초대받기</Link>
          )}
          <div className={styles.user}>
            <span>{me?.nickname}</span>
            <button type="button" className={styles.logout} onClick={onLogout}><Icon name="log-out" size={18} />로그아웃</button>
          </div>
        </header>
        {logoutError && (
          <p role="alert" className={styles.logoutError}>로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        )}
        <SlowServerNotice />
        <main ref={mainRef} className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
