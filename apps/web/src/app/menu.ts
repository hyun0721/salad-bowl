import type { IconName } from '../common/Icon'

/** shortLabel은 좁은 화면의 화면 안 탭 라벨이다(없으면 label). adminOnly는 서비스 관리자에게만 보인다. */
export type SubMenuItem = { to: string; label: string; shortLabel?: string; adminOnly?: boolean }

export type MenuItem = {
  to: string; label: string; shortLabel: string; icon: IconName; end: boolean
  // 사이드바에서만 들여 써서 그린다. 하단 탭은 무시한다.
  children?: SubMenuItem[]
}

// 사이드바는 label, 좁은 화면의 하단 탭은 shortLabel을 쓴다.
export const MENU: MenuItem[] = [
  { to: '/', label: '홈', shortLabel: '홈', icon: 'home', end: true },
  { to: '/tax', label: '소득공제', shortLabel: '소득공제', icon: 'calculator', end: false,
    children: [
      { to: '/tax/inputs', label: '입력자료' },
      { to: '/tax/law', label: '연도별 세법 관리', shortLabel: '세법 관리', adminOnly: true },
    ] },
  { to: '/dashboard', label: '대시보드', shortLabel: '대시보드', icon: 'dashboard', end: false,
    children: [{ to: '/dashboard/major', label: '대분류' }, { to: '/dashboard/minor', label: '소분류' }] },
  { to: '/transactions', label: '거래 목록', shortLabel: '거래', icon: 'receipt', end: false },
  { to: '/groups', label: '그룹 관리', shortLabel: '그룹', icon: 'users', end: false },
]

/** 보이는 하위 메뉴. 관리자 전용 메뉴를 숨기는 것은 편의이고 권한은 서버가 판단한다(TAX-06). */
export function visibleChildren(item: MenuItem, serviceAdmin: boolean): SubMenuItem[] {
  return (item.children ?? []).filter((child) => serviceAdmin || !child.adminOnly)
}

/** 화면 제목은 메뉴 이름과 같게 둔다. 하위 메뉴도 찾는다. */
export function menuLabel(to: string): string {
  const item = MENU.flatMap((m) => [m, ...(m.children ?? [])]).find((m) => m.to === to)
  if (!item) throw new Error(`메뉴에 없는 경로: ${to}`)
  return item.label
}
