import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import { useTags } from './tagsApi'
import { useTransactionMutations } from './useTransactionMutations'

function Tags({ groupId }: { groupId: number | null }) {
  const tags = useTags(groupId)
  const { bulkUpdate } = useTransactionMutations()
  return <><p>{tags.data?.map(({ tag }) => tag).join(',')}</p>
    <button onClick={() => bulkUpdate.mutate({ ids: [1], patch: { addTags: ['새태그'] } })}>태그 저장</button></>
}
it.each([null, 10])('loads all-period tags with scoped cache and invalidates after mutation: %s', async (groupId) => {
  let calls = 0
  server.use(
    http.get(groupId === null ? '*/api/me/tags' : '*/api/groups/10/tags', ({ request }) => {
      expect(new URL(request.url).search).toBe('')
      calls++
      return HttpResponse.json([{ tag: calls === 1 ? '기존태그' : '새태그', count: 1 }])
    }),
    http.patch('*/api/transactions/bulk', () => HttpResponse.json({ updated: 1 })),
  )
  const { user, client } = renderPage(<Tags groupId={groupId} />)
  await screen.findByText('기존태그')
  const key = groupId === null ? ['tags'] : ['tags', 'group', groupId]
  expect(client.getQueryData(key)).toEqual([{ tag: '기존태그', count: 1 }])
  expect(client.getQueryCache().find({ queryKey: key, exact: true })?.isStale()).toBe(false)
  client.setQueryData(['tags', 'group', 20], [{ tag: '다른그룹', count: 1 }])
  await user.click(screen.getByRole('button', { name: '태그 저장' }))
  await screen.findByText('새태그')
  await waitFor(() => expect(client.getQueryState(['tags', 'group', 20])?.isInvalidated).toBe(true))
})
