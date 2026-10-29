import type { IconName } from '../common/Icon'

export type MenuItem = {
  to: string; label: string; shortLabel: string; icon: IconName; end: boolean
  // 사이드바에서만 들여 써서 그린다. 하단 탭은 무시한다.
  children?: { to: string; label: string }[]
}

// 사이드바는 label, 좁은 화면의 하단 탭은 shortLabel을 쓴다.
export const MENU: MenuItem[] = [
  { to: '/', label: '홈', shortLabel: '홈', icon: 'home', end: true },
  { to: '/dashboard', label: '그룹 대시보드', shortLabel: '대시보드', icon: 'dashboard', end: false,
    children: [{ to: '/dashboard/major', label: '대분류' }, { to: '/dashboard/minor', label: '소분류' }] },
  { to: '/transactions', label: '거래 목록', shortLabel: '거래', icon: 'receipt', end: false },
  { to: '/upload', label: '업로드', shortLabel: '업로드', icon: 'sheet-upload', end: false },
  { to: '/groups', label: '그룹 관리', shortLabel: '그룹', icon: 'users', end: false },
]
