export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'theme'

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch { return 'system' }
}

/** 'system'이면 data-theme을 지워 tokens.css의 prefers-color-scheme 규칙을 따른다. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch { /* 저장 실패해도 이번 방문에는 적용된다 */ }
}
