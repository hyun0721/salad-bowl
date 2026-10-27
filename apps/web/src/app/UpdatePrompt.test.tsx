import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { stubRegister } from '../test/pwaRegisterStub'
import UpdatePrompt from './UpdatePrompt'

afterEach(() => { stubRegister.needRefresh = false; stubRegister.updateServiceWorker.mockClear() })

it('shows nothing without a new version', () => {
  render(<UpdatePrompt />)
  expect(screen.queryByText('새 버전이 있어요')).not.toBeInTheDocument()
})

it('offers a reload when a new version is waiting', async () => {
  stubRegister.needRefresh = true
  render(<UpdatePrompt />)
  expect(screen.getByRole('status')).toHaveTextContent('새 버전이 있어요')
  await userEvent.click(screen.getByRole('button', { name: '새로고침' }))
  expect(stubRegister.updateServiceWorker).toHaveBeenCalledWith(true)
})

it('hides until the next version when dismissed', async () => {
  stubRegister.needRefresh = true
  render(<UpdatePrompt />)
  await userEvent.click(screen.getByRole('button', { name: '나중에' }))
  expect(screen.queryByText('새 버전이 있어요')).not.toBeInTheDocument()
})
