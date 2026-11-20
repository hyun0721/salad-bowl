import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { taxApi } from './taxApi'

describe('taxApi', () => {
  it('reads a missing year record or law version as null', async () => {
    server.use(
      http.get('*/api/tax/years/2026', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })),
      http.get('*/api/tax/law-versions/current', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })),
    )

    expect(await taxApi.year(2026)).toBeNull()
    expect(await taxApi.currentLaw(2026)).toBeNull()
  })

  it('still throws other errors', async () => {
    server.use(http.get('*/api/tax/years/2026', () => HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })))

    await expect(taxApi.year(2026)).rejects.toMatchObject({ status: 500 })
  })

  it('sends the row version it was given unchanged when deleting', async () => {
    const urls: string[] = []
    server.use(
      http.delete('*/api/tax/years/2026', ({ request }) => { urls.push(request.url); return new HttpResponse(null, { status: 204 }) }),
      http.delete('*/api/tax/years/2026/cards/7', ({ request }) => { urls.push(request.url); return new HttpResponse(null, { status: 204 }) }),
    )

    await taxApi.deleteYear(2026, 9007199254740991)
    await taxApi.deleteCard(2026, 7, 41)

    expect(urls.map((url) => new URL(url).search)).toEqual(['?rowVersion=9007199254740991', '?rowVersion=41'])
  })
})
