import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { transactionsApi } from '../transactions/transactionsApi'
import { importsApi } from './importsApi'
import { useDeleteMonth } from './useDeleteMonth'
import { useUpload } from './useUpload'

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const spy = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { spy, wrapper }
}
it('invalidates tag suggestions after an upload', async () => {
  vi.spyOn(importsApi, 'upload').mockResolvedValue({} as never)
  const { spy, wrapper } = setup()
  const { result } = renderHook(() => useUpload(), { wrapper })
  act(() => result.current.mutate(new File([''], 'a.xlsx')))
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['tags'] }))
})
it('invalidates tag suggestions after deleting a month', async () => {
  vi.spyOn(transactionsApi, 'deleteMonth').mockResolvedValue({} as never)
  const { spy, wrapper } = setup()
  const { result } = renderHook(() => useDeleteMonth(), { wrapper })
  act(() => result.current.mutate({ month: '2026-10', includeManual: false }))
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['tags'] }))
})
