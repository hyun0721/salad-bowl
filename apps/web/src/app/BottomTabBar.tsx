import { NavLink } from 'react-router'
import Icon from '../common/Icon'
import { Indicator, IndicatorGroup } from '../common/SelectionIndicator'
import { MENU } from './menu'
import styles from './BottomTabBar.module.css'

/** 좁은 화면의 주 메뉴. 화면 이동 링크이므로 탭(tablist)이 아니라 nav 안의 링크다. */
export default function BottomTabBar() {
  return (
    <nav aria-label="주 메뉴" className={styles.bar}>
      <IndicatorGroup>
        {MENU.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}>
            {({ isActive }) => (
              <>
                <Indicator isSelected={isActive} className={styles.indicator} />
                <Icon name={item.icon} size={22} />
                <span>{item.shortLabel}</span>
              </>
            )}
          </NavLink>
        ))}
      </IndicatorGroup>
    </nav>
  )
}
