import { describe, expect, it } from 'vitest'
import { safeNext } from './safeNext'

describe('safeNext', () => {
  it('falls back to home for empty values', () => {
    expect(safeNext(null)).toBe('/')
    expect(safeNext(undefined)).toBe('/')
    expect(safeNext('')).toBe('/')
  })

  it('keeps same-origin paths with query and hash', () => {
    expect(safeNext('/invite/abc?x=1')).toBe('/invite/abc?x=1')
    expect(safeNext('/a?b=1#c')).toBe('/a?b=1#c')
  })

  it('rejects protocol-relative and backslash tricks', () => {
    expect(safeNext('//evil.example')).toBe('/')
    expect(safeNext('/\\evil.example')).toBe('/')
    expect(safeNext('/\t/evil.example')).toBe('/')
    expect(safeNext('/%09/evil.example')).not.toMatch(/^\/\//)
  })

  it('rejects absolute and script URLs', () => {
    expect(safeNext('https://evil.example/x')).toBe('/')
    expect(safeNext('javascript:alert(1)')).toBe('/')
  })
})
