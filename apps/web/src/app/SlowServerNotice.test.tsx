import { render, screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiFetch } from '../api/client'
import { server } from '../test/server'
import SlowServerNotice from './SlowServerNotice'

describe('SlowServerNotice', () => {
  it('keeps an empty live region when nothing is slow', () => {
    render(<SlowServerNotice />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows immediately when mounted while a slow request is already running', async () => {
    server.use(http.get('*/api/slow', async () => {
      await delay(3600)
      return HttpResponse.json({})
    }))
    const pending = apiFetch('/slow')
    await delay(3200)

    render(<SlowServerNotice />)

    expect(screen.getByRole('status')).toHaveTextContent('서버를 깨우는 중입니다. 오래 쓰지 않았다면 최대 4분쯤 걸릴 수 있습니다.')
    await pending
  }, 15000)
})
