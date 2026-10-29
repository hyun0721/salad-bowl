import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import HelpDialog from './HelpDialog'

describe('HelpDialog', () => {
  it('keeps the running app version when the server has a different version', async () => {
    server.use(http.get('/api/version', () => HttpResponse.json({ version: '0.1.99', commit: 'a'.repeat(40) })))
    render(<HelpDialog onClose={vi.fn()} />)
    expect(screen.getByText('앱 버전')).toBeInTheDocument()
    expect(screen.getByText('dev')).toBeInTheDocument()
    expect(await screen.findByText('0.1.99')).toBeInTheDocument()
    expect(screen.getByText('dev')).toBeInTheDocument()
    expect(screen.getByText('(aaaaaaa)')).toBeInTheDocument()
  })

  it('shows local loading, failure and retry without hiding the app version', async () => {
    let succeed = false
    server.use(http.get('/api/version', () => succeed
      ? HttpResponse.json({ version: '0.1.2', commit: 'b'.repeat(40) })
      : new HttpResponse(null, { status: 503 })))
    render(<HelpDialog onClose={vi.fn()} />)
    expect(screen.getByText('확인 중')).toBeInTheDocument()
    expect(await screen.findByText('확인할 수 없음')).toBeInTheDocument()
    expect(screen.getByText('dev')).toBeInTheDocument()
    succeed = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('0.1.2')).toBeInTheDocument()
  })

  it('treats malformed metadata as a failed lookup', async () => {
    server.use(http.get('/api/version', () => HttpResponse.json({ version: 2, commit: null })))
    render(<HelpDialog onClose={vi.fn()} />)
    expect(await screen.findByText('확인할 수 없음')).toBeInTheDocument()
  })

  it('aborts the lookup when closed', async () => {
    let signal: AbortSignal | undefined
    server.use(http.get('/api/version', async ({ request }) => {
      signal = request.signal
      await new Promise<void>((resolve) => request.signal.addEventListener('abort', () => resolve(), { once: true }))
      return HttpResponse.json({ version: '0.1.2', commit: 'b'.repeat(40) })
    }))
    const view = render(<HelpDialog onClose={vi.fn()} />)
    await waitFor(() => expect(signal).toBeDefined())
    view.unmount()
    await waitFor(() => expect(signal?.aborted).toBe(true))
  })
})
