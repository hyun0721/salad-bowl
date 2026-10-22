import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import BottomTabBar from './BottomTabBar'

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>,
  )
  return screen.getByRole('navigation', { name: '주 메뉴' })
}

describe('BottomTabBar', () => {
  it('shows five short-named links', () => {
    const nav = renderAt('/')
    const names = within(nav).getAllByRole('link').map((link) => link.textContent)
    expect(names).toEqual(['홈', '대시보드', '거래', '업로드', '그룹'])
  })

  it('marks only the current screen', () => {
    const nav = renderAt('/transactions')
    expect(within(nav).getByRole('link', { name: '거래' })).toHaveAttribute('aria-current', 'page')
    for (const name of ['홈', '대시보드', '업로드', '그룹']) {
      expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('moves the current mark and the indicator to the tab the user picks', async () => {
    const user = userEvent.setup()
    const nav = renderAt('/')
    const indicatorOwners = () => within(nav).getAllByRole('link')
      .filter((link) => link.querySelector('[data-indicator]'))
      .map((link) => link.textContent)
    expect(indicatorOwners()).toEqual(['홈'])

    await user.click(within(nav).getByRole('link', { name: '업로드' }))

    expect(within(nav).getByRole('link', { name: '업로드' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current')
    expect(indicatorOwners()).toEqual(['업로드'])
  })

  it('keeps home current only on the home path', () => {
    const nav = renderAt('/groups')
    expect(within(nav).getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('link', { name: '그룹' })).toHaveAttribute('aria-current', 'page')
  })
})
