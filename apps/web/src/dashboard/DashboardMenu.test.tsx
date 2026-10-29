import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import DashboardMenu from './DashboardMenu'

describe('DashboardMenu', () => {
  it('links to the two levels and keeps the search', () => {
    render(<MemoryRouter initialEntries={['/dashboard/major/trend?month=2026-08']}><DashboardMenu level="major" /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: '대시보드 메뉴' })
    const levels = within(nav).getByRole('group', { name: '분류' })
    expect(within(nav).queryByRole('group', { name: '보기' })).not.toBeInTheDocument()
    expect(within(nav).getAllByRole('link')).toHaveLength(2)
    expect(within(levels).getByRole('link', { name: '대분류' })).toHaveAttribute('aria-current', 'page')
    expect(within(levels).getByRole('link', { name: '대분류' })).toHaveAttribute('href', '/dashboard/major?month=2026-08')
    expect(within(levels).getByRole('link', { name: '소분류' })).toHaveAttribute('href', '/dashboard/minor?month=2026-08')
    expect(within(levels).getByRole('link', { name: '소분류' })).not.toHaveAttribute('aria-current')
  })
})
