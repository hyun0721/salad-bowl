import { describe, expect, it } from 'vitest'
import { dashboardRedirect, dashboardTitle } from './dashboardRoute'

describe('dashboardRedirect', () => {
  it.each([
    [undefined, undefined, '/dashboard/major'],
    ['major', undefined, null],
    ['minor', undefined, null],
    ['major', 'trend', null],
    ['minor', 'share', null],
    ['oops', undefined, '/dashboard/major'],
    ['major', 'oops', '/dashboard/major'],
    ['oops', 'trend', '/dashboard/major'],
  ] as const)('%s/%s → %s', (level, view, expected) => {
    expect(dashboardRedirect(level, view)).toBe(expected)
  })
})

describe('dashboardTitle', () => {
  it('names the level', () => {
    expect(dashboardTitle('major')).toBe('대시보드 · 대분류')
    expect(dashboardTitle('minor')).toBe('대시보드 · 소분류')
  })
})
