import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { Route, Routes, useLocation } from 'react-router'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import HomePage from './HomePage'

const today = new Date(2026, 9, 19) // 2026-10-19

function Search() {
  return <output aria-label="주소 검색어">{useLocation().search}</output>
}

function handlers({ coverage = {}, transactions = [] }: { coverage?: Record<string, unknown[]>; transactions?: unknown[] } = {}) {
  server.use(
    http.get('*/api/me/coverage', ({ request }) =>
      HttpResponse.json(coverage[new URL(request.url).searchParams.get('year') ?? ''] ?? [])),
    http.get('*/api/me/transactions', () => HttpResponse.json(transactions)),
  )
}

describe('HomePage', () => {
  it('shows summary cards and twelve calendar cells while both requests load', async () => {
    server.use(
      http.get('*/api/me/coverage', async () => { await delay(400); return HttpResponse.json([]) }),
      http.get('*/api/me/transactions', async () => { await delay(400); return HttpResponse.json([]) }),
    )
    renderPage(<HomePage today={today} />)
    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    const coverage = screen.getByRole('region', { name: '월별 등록 현황' })
    expect(within(summary).getByRole('status').querySelectorAll('[class*="total"]')).toHaveLength(3)
    expect(within(coverage).getByRole('status').querySelectorAll('li')).toHaveLength(12)
    await within(summary).findByRole('button', { name: '수입 ₩ 0' })
    await within(coverage).findByRole('button', { name: '2026년 9월 미등록, 업로드하기' })
  })

  it('puts the last month summary above the monthly coverage and drops the old cards', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-09', importedCount: 168, manualCount: 2 }] } })

    renderPage(<HomePage today={today} />)

    const coverage = await screen.findByRole('region', { name: '월별 등록 현황' })
    expect(await within(coverage).findByRole('button', { name: '2026년 9월 등록됨 168건, 데이터 관리' })).toBeInTheDocument()
    expect(within(coverage).getByRole('button', { name: '2026년 8월 미등록, 업로드하기' })).toBeInTheDocument()
    expect(within(coverage).getByRole('button', { name: '업로드 이력' })).toBeInTheDocument()
    // 좁은 화면은 문서 순서대로 쌓인다: 지난달 요약이 위, 월별 등록 현황이 아래.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['지난달 내 요약 (2026년 9월)', '월별 등록 현황'])
    expect(screen.queryByRole('region', { name: '지난달 업로드' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '업로드하기' })).not.toBeInTheDocument()
    expect(screen.queryByText('파일 올리기')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(document.title).toBe('홈 · Salad Bowl')
  })

  it('looks up last year in January', async () => {
    handlers({ coverage: { '2025': [{ month: '2025-12', importedCount: 7, manualCount: 0 }] } })

    renderPage(<HomePage today={new Date(2026, 0, 10)} />)

    expect(await screen.findByRole('region', { name: '지난달 내 요약 (2025년 12월)' })).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '2025년 12월 등록됨 7건, 데이터 관리' })).toBeInTheDocument()
  })

  it('opens the upload dialog for a missing month from the address and clears it', async () => {
    handlers()

    renderPage(<><HomePage today={today} /><Search /></>, { path: '/?month=2026-09' })

    expect(await screen.findByRole('dialog', { name: '2026년 9월 데이터 업로드' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어', hidden: true })).toBeEmptyDOMElement())
  })

  it('keeps the requested month after a coverage failure and opens it on retry', async () => {
    server.use(
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/me/coverage', () => new HttpResponse(null, { status: 500 })),
    )

    const { user } = renderPage(<><HomePage today={today} /><Search /></>, { path: '/?month=2026-09' })
    const coverage = await screen.findByRole('region', { name: '월별 등록 현황' })

    await within(coverage).findByRole('alert')
    expect(screen.getByRole('status', { name: '주소 검색어' })).toHaveTextContent('?month=2026-09')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    server.use(http.get('*/api/me/coverage', () => HttpResponse.json([])))
    await user.click(within(coverage).getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('dialog', { name: '2026년 9월 데이터 업로드' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어', hidden: true })).toBeEmptyDOMElement())
  })

  it('opens the month data dialog for a registered month from the address', async () => {
    handlers({ coverage: { '2026': [{ month: '2026-09', importedCount: 168, manualCount: 0 }] } })

    renderPage(<HomePage today={today} />, { path: '/?month=2026-09' })

    const dialog = await screen.findByRole('dialog', { name: '2026년 9월 데이터' })
    expect(within(dialog).getByRole('button', { name: '다시 업로드' })).toBeInTheDocument()
  })

  it('starts the calendar on the requested year', async () => {
    handlers()

    renderPage(<HomePage today={today} />, { path: '/?month=2025-11' })

    expect(await screen.findByRole('dialog', { name: '2025년 11월 데이터 업로드' })).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
  })

  it.each(['2026-12', '2026-13'])('ignores the future or invalid month %s and clears it', async (month) => {
    handlers()

    renderPage(<><HomePage today={today} /><Search /></>, { path: `/?month=${month}` })

    await screen.findByText('12월')
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어' })).toBeEmptyDOMElement())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('summarizes last month', async () => {
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
    expect(within(summary).getByRole('button', { name: '수입 ₩ 3,000,000' })).toBeInTheDocument()
    expect(within(summary).getByRole('button', { name: '지출 ₩ 12,000' })).toBeInTheDocument()
  })

  it('opens my transactions from the summary cards', async () => {
    handlers()
    const { user } = renderPage(
      <Routes>
        <Route path="/" element={<HomePage today={today} />} />
        <Route path="/transactions" element={<p>거래 목록 화면</p>} />
      </Routes>,
    )
    await user.click(await screen.findByRole('button', { name: '지출 ₩ 0' }))
    expect(await screen.findByText('거래 목록 화면')).toBeInTheDocument()
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
