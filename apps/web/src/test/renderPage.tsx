import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactElement } from 'react'
import { I18nProvider } from 'react-aria-components'
import { MemoryRouter } from 'react-router'
import RequireAuth from '../app/RequireAuth'
import { AuthProvider } from '../auth/AuthProvider'
import { GroupProvider } from '../groups/GroupProvider'
import { server } from './server'

export const testMe = { userId: 1, email: 'me@test.com', nickname: '나' }

type Options = { groups?: unknown[]; path?: string }

/** 로그인한 회원으로 화면 하나를 렌더한다. 화면이 쓰는 API 핸들러는 테스트에서 server.use로 더한다. */
export function renderPage(ui: ReactElement, { groups = [], path = '/' }: Options = {}) {
  server.use(
    http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'test-token' })),
    http.get('*/api/me', () => HttpResponse.json(testMe)),
    http.get('*/api/groups', () => HttpResponse.json(groups)),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const user = userEvent.setup()
  render(
    <I18nProvider locale="ko-KR">
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <RequireAuth>
              <GroupProvider>{ui}</GroupProvider>
            </RequireAuth>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>,
  )
  return { client, user }
}
