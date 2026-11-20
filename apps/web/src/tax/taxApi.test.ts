import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { taxApi } from './taxApi'
import { yearView } from '../test/taxFixtures'

describe('taxApi', () => {
  it('reads a missing year record or law version as null', async () => {
    server.use(
      http.get('*/api/tax/years/2026', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })),
      http.get('*/api/tax/law-versions/current', ({ request }) => {
        expect(new URL(request.url).search).toBe('?year=2026')
        return HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })
      }),
    )

    expect(await taxApi.year(2026)).toBeNull()
    expect(await taxApi.currentLaw(2026)).toBeNull()
  })

  it('sends basic info, card and cash writes to their paths with unchanged bodies', async () => {
    const calls: { method: string; path: string; body: unknown }[] = []
    const capture = async ({ request }: { request: Request }) => {
      calls.push({ method: request.method, path: new URL(request.url).pathname, body: await request.json() })
      return HttpResponse.json(yearView())
    }
    server.use(
      http.put('*/api/tax/years/2026', capture),
      http.post('*/api/tax/years/2026/cards', capture),
      http.put('*/api/tax/years/2026/cards/7', capture),
      http.put('*/api/tax/years/2026/cash-receipt', capture),
    )
    const basic = { totalSalary: 50_000_000, workStartMonth: 1, workEndMonth: 12, childCount: 0, rowVersion: 777 }
    const card = { issuerName: 'A카드', asOfDate: '2026-06-30', memo: null, amounts: {
      creditGeneral: 1, creditMarket: null, creditTransit: null, creditCulture: null,
      debitGeneral: null, debitMarket: null, debitTransit: null, debitCulture: null,
    } }
    const cash = { asOfDate: '2026-06-30', memo: null, amounts: { general: 0, market: null, transit: null, culture: null }, rowVersion: 3 }
    await taxApi.saveBasicInfo(2026, basic)
    await taxApi.addCard(2026, card)
    await taxApi.saveCard(2026, 7, { ...card, rowVersion: 3 })
    await taxApi.saveCashReceipt(2026, cash)
    expect(calls).toEqual([
      { method: 'PUT', path: '/api/tax/years/2026', body: basic },
      { method: 'POST', path: '/api/tax/years/2026/cards', body: card },
      { method: 'PUT', path: '/api/tax/years/2026/cards/7', body: { ...card, rowVersion: 3 } },
      { method: 'PUT', path: '/api/tax/years/2026/cash-receipt', body: cash },
    ])
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
