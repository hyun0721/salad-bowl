import { render, screen, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiFetch } from '../api/client'
import { server } from '../test/server'
import SlowServerOverlay from './SlowServerOverlay'

describe('SlowServerOverlay', () => {
  it('shows nothing when nothing is slow', () => {
    render(<SlowServerOverlay />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens when mounted during a slow request and closes after it finishes', async () => {
    server.use(http.get('*/api/slow', async () => {
      await delay(3600)
      return HttpResponse.json({})
    }))
    const pending = apiFetch('/slow')
    await delay(3200)

    render(<SlowServerOverlay />)

    expect(screen.getByRole('dialog', { name: '서버 준비 중' })).toHaveTextContent('최대 4분쯤 걸려요')
    await pending
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 2000 })
  }, 15000)
})
