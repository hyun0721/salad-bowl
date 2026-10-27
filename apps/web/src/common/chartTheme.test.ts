import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { readChartTheme, useChartTheme } from './chartTheme'

const root = document.documentElement
const originalStyle = root.getAttribute('style')
const originalTheme = root.getAttribute('data-theme')

afterEach(() => {
  for (const [name, value] of [['style', originalStyle], ['data-theme', originalTheme]]) {
    if (value === null) root.removeAttribute(name!)
    else root.setAttribute(name!, value!)
  }
})

it('reads and trims all theme tokens from the root or a supplied element', () => {
  root.style.setProperty('--chart-1', ' #123456 ')
  expect(readChartTheme().chart[0]).toBe('#123456')
  const element = document.createElement('div')
  document.body.append(element)
  const chart = Array.from({ length: 8 }, (_, i) => `color-${i + 1}`)
  chart.forEach((value, i) => element.style.setProperty(`--chart-${i + 1}`, ` ${value} `))
  for (const token of ['surface-000', 'ink', 'ink-muted', 'line', 'font-sans']) {
    element.style.setProperty(`--${token}`, ` ${token} `)
  }
  expect(readChartTheme(element)).toEqual({ chart, surface: 'surface-000', ink: 'ink', inkMuted: 'ink-muted', line: 'line', font: 'font-sans' })
  element.remove()
})

it('rereads tokens when the html data-theme changes', async () => {
  root.style.setProperty('--chart-1', '#123456')
  const { result, unmount } = renderHook(() => useChartTheme())
  expect(result.current.chart[0]).toBe('#123456')
  root.style.setProperty('--chart-1', '#654321')
  root.setAttribute('data-theme', 'dark')
  await waitFor(() => expect(result.current.chart[0]).toBe('#654321'))
  unmount()
})

it('rereads on color scheme changes and removes subscriptions on unmount', () => {
  const listeners = new Set<() => void>()
  const removeEventListener = vi.fn((_event: string, listener: () => void) => listeners.delete(listener))
  const matchMedia = vi.fn(() => ({ matches: false, addEventListener: (_event: string, listener: () => void) => listeners.add(listener), removeEventListener }))
  vi.stubGlobal('matchMedia', matchMedia)
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
  const { result, unmount } = renderHook(() => useChartTheme())
  expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
  act(() => {
    root.style.setProperty('--chart-1', '#abcdef')
    listeners.forEach((listener) => listener())
  })
  expect(result.current.chart[0]).toBe('#abcdef')
  unmount()
  expect(listeners.size).toBe(0)
  expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  expect(disconnect).toHaveBeenCalledOnce()
  disconnect.mockRestore()
})
