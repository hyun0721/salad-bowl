import { useEffect, useState } from 'react'

export type ChartTheme = {
  chart: string[]
  surface: string
  ink: string
  inkMuted: string
  line: string
  font: string
}

export function readChartTheme(root: HTMLElement = document.documentElement): ChartTheme {
  const style = getComputedStyle(root)
  const read = (token: string) => style.getPropertyValue(token).trim()
  return {
    chart: Array.from({ length: 8 }, (_, index) => read(`--chart-${index + 1}`)),
    surface: read('--surface-000'),
    ink: read('--ink'),
    inkMuted: read('--ink-muted'),
    line: read('--line'),
    font: read('--font-sans'),
  }
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(() => readChartTheme())
  useEffect(() => {
    const update = () => setTheme(readChartTheme())
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [])
  return theme
}
