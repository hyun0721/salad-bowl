import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { menuLabel } from '../app/menu'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  it('renders the page heading and an optional action in one row', () => {
    render(<PageHeader title="거래 목록" action={<button type="button">추가</button>} />)
    const heading = screen.getByRole('heading', { level: 1, name: '거래 목록' })
    const action = screen.getByRole('button', { name: '추가' })
    expect(heading.parentElement).toBe(action.parentElement)
  })

  it('renders only the heading without an action', () => {
    render(<PageHeader title="홈" />)
    expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('menuLabel', () => {
  it('returns the sidebar label for a menu path', () => {
    expect(menuLabel('/')).toBe('홈')
    expect(menuLabel('/dashboard')).toBe('대시보드')
    expect(menuLabel('/upload')).toBe('업로드')
  })

  it('throws for a path outside the menu', () => {
    expect(() => menuLabel('/nope')).toThrow()
  })
})
