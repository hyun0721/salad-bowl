import { afterEach, expect, it } from 'vitest'
import { applyTheme, readTheme } from './theme'

afterEach(() => { applyTheme('system') })

it('stores an explicit choice and sets data-theme', () => {
  applyTheme('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  expect(readTheme()).toBe('dark')
})

it('system removes data-theme and the stored choice', () => {
  applyTheme('light')
  applyTheme('system')
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  expect(readTheme()).toBe('system')
})
