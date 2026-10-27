import { Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useGroups } from '../groups/GroupProvider'
import Icon from '../common/Icon'
import Select from '../common/Select'
import { useMediaQuery } from '../common/useMediaQuery'
import AccountSheet from './AccountSheet'
import BottomTabBar from './BottomTabBar'
import PageLoading from './PageLoading'
import SlowServerOverlay from './SlowServerOverlay'
import styles from './AppLayout.module.css'
import { MENU } from './menu'

function FocusHeadingOnRouteChange({ mainRef }: { mainRef: RefObject<HTMLElement | null> }) {
  const location = useLocation()
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
  }, [location.pathname, mainRef])
  return null
}

export default function AppLayout() {
  const { me, logout } = useAuth()
  const narrow = useMediaQuery('(max-width: 820px)')
  const { groups, selectedGroupId, selectGroup, isLoading, isError, retry } = useGroups()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)

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

  const groupArea = isLoading ? (
    <span className={styles.groupState}>그룹 불러오는 중</span>
  ) : isError ? (
    <span className={styles.groupState}>
      그룹을 불러오지 못했습니다{' '}
      <button type="button" className={styles.logout} onClick={retry}>다시 시도</button>
    </span>
  ) : groups.length > 0 ? (
    <Select label="그룹" items={groups.map((g) => ({ id: g.groupId, label: g.name }))}
      selectedKey={selectedGroupId} onSelectionChange={(key) => { if (key != null) selectGroup(Number(key)) }} />
  ) : (
    <Link to="/groups" className={styles.noGroup}>그룹 없음 · 만들기 또는 초대받기</Link>
  )

  return (
    <div className={styles.shell}>
      {!narrow && (
        <nav aria-label="주 메뉴" className={styles.nav}>
          <span className={styles.logo}><img src="/logo.svg" alt="" width="28" height="28" />Salad Bowl</span>
          {MENU.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
              <Icon name={item.icon} />{item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <div className={styles.main}>
        <header className={styles.header}>
          {narrow && <img src="/logo.svg" alt="Salad Bowl" width="28" height="28" className={styles.headerLogo} />}
          {narrow ? <div className={styles.groupSlot}>{groupArea}</div> : groupArea}
          {narrow ? (
            <AccountSheet nickname={me?.nickname ?? ''} onLogout={onLogout} logoutFailed={logoutError} onOpen={() => setLogoutError(false)} />
          ) : (
            <div className={styles.user}>
              <span>{me?.nickname}</span>
              <button type="button" className={styles.logout} onClick={onLogout}><Icon name="log-out" size={18} />로그아웃</button>
            </div>
          )}
        </header>
        {logoutError && !narrow && (
          <p role="alert" className={styles.logoutError}>로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        )}
        <SlowServerOverlay />
        <main ref={mainRef} className={narrow ? `${styles.content} ${styles.withTabBar}` : styles.content}>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
            <FocusHeadingOnRouteChange mainRef={mainRef} />
          </Suspense>
        </main>
      </div>
      {narrow && <BottomTabBar />}
    </div>
  )
}
