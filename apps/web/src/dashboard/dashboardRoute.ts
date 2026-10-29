export type Level = 'major' | 'minor'
export type View = 'share' | 'trend'

const LEVELS: readonly string[] = ['major', 'minor']
const VIEWS: readonly string[] = ['share', 'trend']
const LEVEL_LABEL: Record<Level, string> = { major: '대분류', minor: '소분류' }

/** 2탭 설계 2장 주소 표(두 폭 공통). 그대로 그릴 주소면 null, 아니면 바꿀 경로(search 제외). */
export function dashboardRedirect(level: string | undefined, view: string | undefined): string | null {
  const validLevel = level !== undefined && LEVELS.includes(level)
  const validView = view === undefined || VIEWS.includes(view)
  return validLevel && validView ? null : '/dashboard/major'
}

export function dashboardTitle(level: Level): string {
  return `그룹 대시보드 · ${LEVEL_LABEL[level]}`
}
