import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import HomePage from './HomePage'

const today = new Date(2026, 9, 19) // 2026-10-19

function handlers({ coverage = {}, transactions = [] }: { coverage?: Record<string, unknown[]>; transactions?: unknown[] } = {}) {
  server.use(
    http.get('*/api/me/coverage', ({ request }) =>
      HttpResponse.json(coverage[new URL(request.url).searchParams.get('year') ?? ''] ?? [])),
    http.get('*/api/me/transactions', () => HttpResponse.json(transactions)),
  )
}

describe('HomePage', () => {
  it('says last month is registered with its upload count', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-09', importedCount: 168, manualCount: 2 }] } })

    renderPage(<HomePage today={today} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByText('2026년 9월 데이터 등록됨 · 168건')).toBeInTheDocument()
    expect(within(card).queryByRole('link', { name: '업로드하기' })).not.toBeInTheDocument()
    expect(document.title).toBe('내 가계부 · Salad Bowl')
  })

  it('links to the upload menu with last month when it is missing', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-08', importedCount: 10, manualCount: 0 }] } })

    renderPage(<HomePage today={today} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByText('2026년 9월 데이터가 아직 없습니다.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '업로드하기' })).toHaveAttribute('href', '/upload?month=2026-09')
  })

  it('treats a month with only manual transactions as not uploaded', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-09', importedCount: 0, manualCount: 3 }] } })

    renderPage(<HomePage today={today} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByText('2026년 9월 데이터가 아직 없습니다.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '업로드하기' })).toHaveAttribute('href', '/upload?month=2026-09')
  })

  it('looks up last year in January', async () => {
    handlers({ coverage: { '2025': [{ month: '2025-12', importedCount: 7, manualCount: 0 }] } })

    renderPage(<HomePage today={new Date(2026, 0, 10)} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByText('2025년 12월 데이터 등록됨 · 7건')).toBeInTheDocument()
  })

  it('shows its own alert and retry when coverage fails', async () => {
    let fail = true
    server.use(
      http.get('*/api/me/coverage', () => fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json([{ month: '2026-09', importedCount: 3, manualCount: 0 }])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
    )
    const { user } = renderPage(<HomePage today={today} />)

    const card = await screen.findByRole('region', { name: '지난달 업로드' })
    expect(await within(card).findByRole('alert')).toHaveTextContent('업로드 현황을 불러오지 못했습니다.')

    fail = false
    await user.click(within(card).getByRole('button', { name: '업로드 현황 다시 시도' }))
    expect(await within(card).findByText('2026년 9월 데이터 등록됨 · 3건')).toBeInTheDocument()
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('summarizes last month and no longer shows the calendar or recent uploads', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', ({ request }) => {
        expect(new URL(request.url).searchParams.get('month')).toBe('2026-09')
        return HttpResponse.json([
          { id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-01T09:00:00', type: 'INCOME', categoryMajor: '급여', categoryMinor: '', description: '월급', amount: 3000000, currency: 'KRW', paymentMethod: '은행', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
          { id: 2, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-02T12:00:00', type: 'EXPENSE', categoryMajor: '식비', categoryMinor: '', description: '점심', amount: -12000, currency: 'KRW', paymentMethod: '카드', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
        ])
      }),
    )

    renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    expect(await within(summary).findByText('₩ 3,000,000')).toBeInTheDocument()
    expect(within(summary).getByText('₩ 12,000')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '월별 등록 현황' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '최근 업로드' })).not.toBeInTheDocument()
  })

  it('retries the summary on its own', async () => {
    let fail = true
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', () => fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json([])),
    )
    const { user } = renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    expect(await within(summary).findByRole('alert')).toHaveTextContent('지난달 거래를 불러오지 못했습니다.')

    fail = false
    await user.click(within(summary).getByRole('button', { name: '요약 다시 시도' }))
    expect(await within(summary).findByText('수입')).toBeInTheDocument()
    expect(within(summary).queryByRole('alert')).not.toBeInTheDocument()
  })
})
