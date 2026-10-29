import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { mockViewport } from '../test/mockViewport'
import AccountSheet from './AccountSheet'
import AppLayout from './AppLayout'

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ me: { nickname: '테스터' }, logout: vi.fn() }) }))
vi.mock('../groups/GroupProvider', () => ({ useGroups: () => ({ groups: [], isLoading: false, isError: false }) }))

it('does not show or fetch versions until desktop help is opened, and restores focus', async () => {
  const lookup = vi.fn(() => HttpResponse.json({ version: '0.1.9', commit: 'c'.repeat(40) }))
  server.use(http.get('/api/version', lookup))
  render(<MemoryRouter><AppLayout /></MemoryRouter>)
  expect(screen.queryByText('앱 버전')).not.toBeInTheDocument()
  expect(lookup).not.toHaveBeenCalled()
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: '도움말' })
  await user.click(trigger)
  expect(await screen.findByText('0.1.9')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByText('앱 버전')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(lookup).toHaveBeenCalledTimes(1)
  await user.click(trigger)
  expect(await screen.findByText('0.1.9')).toBeInTheDocument()
  expect(lookup).toHaveBeenCalledTimes(2)
})

it('opens mobile help after closing the account sheet and returns focus to the account button', async () => {
  mockViewport(true)
  const lookup = vi.fn(() => HttpResponse.json({ version: '0.1.9', commit: 'c'.repeat(40) }))
  server.use(http.get('/api/version', lookup))
  render(<AccountSheet nickname="테스터" onLogout={vi.fn()} logoutFailed={false} onOpen={vi.fn()} />)
  const user = userEvent.setup()
  const account = screen.getByRole('button', { name: '계정' })
  await user.click(account)
  expect(screen.getByRole('dialog', { name: '계정' })).toBeInTheDocument()
  expect(lookup).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '도움말' }))
  expect(await screen.findByRole('dialog', { name: '도움말' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '계정' })).not.toBeInTheDocument()
  expect(await screen.findByText('0.1.9')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByText('앱 버전')).not.toBeInTheDocument())
  await waitFor(() => expect(account).toHaveFocus())
})
