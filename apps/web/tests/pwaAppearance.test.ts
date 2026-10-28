import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('keeps the PWA sampling surface empty and outside the React application', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  const document = new DOMParser().parseFromString(html, 'text/html')
  const surfaces = document.querySelectorAll('.pwa-status-bar-surface')
  expect(surfaces).toHaveLength(1)
  const surface = surfaces[0]
  expect(surface.parentElement).toBe(document.body)
  expect(surface.childNodes).toHaveLength(0)
  expect(surface.getAttribute('aria-hidden')).toBe('true')
  expect(surface.hasAttribute('tabindex')).toBe(false)
  expect(document.querySelector('#root')?.contains(surface)).toBe(false)
})
