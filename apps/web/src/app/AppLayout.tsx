import { Fragment, Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useGroups } from '../groups/GroupProvider'
import Icon from '../common/Icon'
import Select from '../common/Select'
import { useMediaQuery } from '../common/useMediaQuery'
import AccountSheet from './AccountSheet'
import BottomTabBar from './BottomTabBar'
import PageLoading from './PageLoading'
import styles from './AppLayout.module.css'
import { MENU } from './menu'

const firstSegment = (pathname: string) => pathname.split('/')[1] ?? ''

function FocusHeadingOnRouteChange({ mainRef }: { mainRef: RefObject<HTMLElement | null> }) {
  const location = useLocation()
  const lastSegment = useRef(firstSegment(location.pathname))
  useEffect(() => {
    // 주 메뉴가 바뀔 때만 새 화면 제목으로 포커스를 옮긴다(스크린리더가 바뀐 화면을 읽도록). 하위 메뉴 이동은 링크에 포커스를 남긴다.
    const segment = firstSegment(location.pathname)
    if (lastSegment.current === segment) return
    const heading = mainRef.current?.querySelector('h1')
    if (!heading) return // /dashboard → /dashboard/major 같은 리다이렉트 중에는 제목이 없다.
    lastSegment.current = segment
    heading.setAttribute('tabindex', '-1')
    heading.focus()
  }, [location.pathname, mainRef])
  return null
}

export default function AppLayout() {
  const location = useLocation()
  const inDashboard = firstSegment(location.pathname) === 'dashboard'
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
            <Fragment key={item.to}>
              <NavLink to={item.to} end={item.end} aria-current={item.children ? 'true' : undefined}
                className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
                <Icon name={item.icon} />{item.label}
              </NavLink>
              {item.children?.map((child) => (
                <NavLink key={child.to} to={inDashboard ? child.to + location.search : child.to} replace={inDashboard}
                  className={({ isActive }) => `${styles.link} ${styles.subLink}${isActive ? ` ${styles.active}` : ''}`}>
                  {child.label}
                </NavLink>
              ))}
            </Fragment>
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
