import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './test/server'
import App from './App'

describe('App', () => {
  it('starts at the login page when signed out', async () => {
    server.use(http.post('*/api/auth/refresh', () =>
      HttpResponse.json({ code: 'INVALID_TOKEN', message: 'x' }, { status: 401 })))

    render(<App />)

    expect(await screen.findByText('Salad Bowl')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
  })
})
