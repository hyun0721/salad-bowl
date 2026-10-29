export type Level = 'major' | 'minor'
export type View = 'share' | 'trend'

const LEVELS: readonly string[] = ['major', 'minor']
const VIEWS: readonly string[] = ['share', 'trend']
const LEVEL_LABEL: Record<Level, string> = { major: '대분류', minor: '소분류' }
const VIEW_LABEL: Record<View, string> = { share: '분포', trend: '추이' }

/** 설계 3장 주소 표. 그대로 그릴 주소면 null, 아니면 바꿀 경로(search 제외). */
export function dashboardRedirect(level: string | undefined, view: string | undefined, narrow: boolean): string | null {
  const validLevel = level !== undefined && LEVELS.includes(level)
  const validView = view === undefined || VIEWS.includes(view)
  if (!validLevel || !validView) return narrow ? '/dashboard/major/share' : '/dashboard/major'
  if (narrow && view === undefined) return `/dashboard/${level}/share`
  return null
}

export function dashboardTitle(level: Level, view: View, narrow: boolean): string {
  return narrow ? `그룹 대시보드 · ${LEVEL_LABEL[level]} ${VIEW_LABEL[view]}` : `그룹 대시보드 · ${LEVEL_LABEL[level]}`
}
