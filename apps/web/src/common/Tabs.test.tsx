import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import Tabs from './Tabs'

function Harness() {
  const [mode, setMode] = useState('login')
  return (
    <Tabs label="로그인 또는 회원가입" tabs={[{ id: 'login', label: '로그인' }, { id: 'signup', label: '회원가입' }]}
      selectedKey={mode} onSelectionChange={setMode}>
      {(id) => <p>{id} 패널</p>}
    </Tabs>
  )
}

describe('Tabs', () => {
  it('switches tabs with arrow keys and shows the matching named panel', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: '로그인 또는 회원가입' })).toBeInTheDocument()
    const loginTab = screen.getByRole('tab', { name: '로그인' })
    expect(screen.getByRole('tabpanel', { name: '로그인' })).toHaveTextContent('login 패널')

    await user.click(loginTab)
    await user.keyboard('{ArrowRight}')

    const signupTab = screen.getByRole('tab', { name: '회원가입' })
    expect(signupTab).toHaveAttribute('aria-selected', 'true')
    expect(signupTab).toHaveFocus()
    expect(loginTab).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: '회원가입' })).toHaveTextContent('signup 패널')
  })
})
