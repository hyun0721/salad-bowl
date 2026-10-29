import { describe, expect, it } from 'vitest'
import { dashboardRedirect, dashboardTitle } from './dashboardRoute'

describe('dashboardRedirect', () => {
  it.each([
    [undefined, undefined, false, '/dashboard/major'],
    [undefined, undefined, true, '/dashboard/major/share'],
    ['major', undefined, false, null],
    ['minor', undefined, true, '/dashboard/minor/share'],
    ['major', 'trend', false, null],
    ['minor', 'share', true, null],
    ['oops', undefined, false, '/dashboard/major'],
    ['major', 'oops', true, '/dashboard/major/share'],
    ['oops', 'trend', false, '/dashboard/major'],
  ] as const)('%s/%s narrow=%s → %s', (level, view, narrow, expected) => {
    expect(dashboardRedirect(level, view, narrow)).toBe(expected)
  })
})

describe('dashboardTitle', () => {
  it('names the sub-screen', () => {
    expect(dashboardTitle('major', 'share', true)).toBe('그룹 대시보드 · 대분류 분포')
    expect(dashboardTitle('minor', 'trend', true)).toBe('그룹 대시보드 · 소분류 추이')
    expect(dashboardTitle('major', 'trend', false)).toBe('그룹 대시보드 · 대분류')
    expect(dashboardTitle('minor', 'share', false)).toBe('그룹 대시보드 · 소분류')
  })
})
