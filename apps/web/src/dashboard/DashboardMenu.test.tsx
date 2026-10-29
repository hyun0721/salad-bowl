import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import DashboardMenu from './DashboardMenu'

describe('DashboardMenu', () => {
  it('links to sibling screens and keeps the search', () => {
    render(<MemoryRouter initialEntries={['/dashboard/major/trend?month=2026-08']}><DashboardMenu level="major" view="trend" /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: '대시보드 메뉴' })
    const levels = within(nav).getByRole('group', { name: '분류' })
    const views = within(nav).getByRole('group', { name: '보기' })
    expect(within(levels).getByRole('link', { name: '대분류' })).toHaveAttribute('aria-current', 'page')
    expect(within(levels).getByRole('link', { name: '소분류' })).toHaveAttribute('href', '/dashboard/minor/trend?month=2026-08')
    expect(within(views).getByRole('link', { name: '추이' })).toHaveAttribute('aria-current', 'page')
    expect(within(views).getByRole('link', { name: '분포' })).toHaveAttribute('href', '/dashboard/major/share?month=2026-08')
    expect(within(views).getByRole('link', { name: '분포' })).not.toHaveAttribute('aria-current')
  })
})
