import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import HomePage from './HomePage'

const today = new Date(2026, 9, 19) // 2026-10-19

function handlers(coverage: { month: string; importedCount: number }[]) {
  server.use(
    http.get('*/api/me/coverage', ({ request }) => {
      const year = new URL(request.url).searchParams.get('year')
      return HttpResponse.json(year === '2026' ? coverage : [])
    }),
    http.get('*/api/me/transactions', () => HttpResponse.json([])),
    http.get('*/api/imports', () => HttpResponse.json([])),
  )
}

describe('HomePage', () => {
  it('shows registered, missing and upcoming months for the year', async () => {
    handlers([{ month: '2026-01', importedCount: 120 }, { month: '2026-09', importedCount: 168 }])

    renderPage(<HomePage today={today} />)

    const calendar = await screen.findByRole('region', { name: '월별 등록 현황' })
    expect(await within(calendar).findByText('등록됨 · 168건')).toBeInTheDocument()
    expect(within(calendar).getByText('등록됨 · 120건')).toBeInTheDocument()
    expect(within(calendar).getByRole('button', { name: '2026년 2월 미등록, 업로드하기' })).toBeInTheDocument()
    expect(within(calendar).getByRole('button', { name: '2026년 10월 미등록, 업로드하기' })).toBeInTheDocument()
    expect(within(calendar).queryByRole('button', { name: /2026년 11월/ })).not.toBeInTheDocument()
    expect(within(calendar).getAllByText('예정')).toHaveLength(2)
    expect(document.title).toBe('내 가계부 · Salad Bowl')
  })

  it('starts in January on last year, where last month is', async () => {
    const years: (string | null)[] = []
    server.use(
      http.get('*/api/me/coverage', ({ request }) => {
        years.push(new URL(request.url).searchParams.get('year'))
        return HttpResponse.json([])
      }),
      http.get('*/api/me/transactions', ({ request }) => {
        expect(new URL(request.url).searchParams.get('month')).toBe('2025-12')
        return HttpResponse.json([])
      }),
      http.get('*/api/imports', () => HttpResponse.json([])),
    )

    renderPage(<HomePage today={new Date(2026, 0, 10)} />)

    expect(await screen.findByRole('region', { name: '지난달 내 요약 (2025년 12월)' })).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
    await waitFor(() => expect(years).toEqual(['2025']))
  })

  it('moves between years', async () => {
    handlers([{ month: '2026-09', importedCount: 168 }])
    const { user } = renderPage(<HomePage today={today} />)

    await screen.findByText('등록됨 · 168건')
    await user.click(screen.getByRole('button', { name: '이전 연도' }))

    expect(await screen.findByText('2025년')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '2025년 9월 미등록, 업로드하기' })).toBeInTheDocument()
  })

  it('opens the upload dialog from a missing month and refreshes the calendar after upload', async () => {
    let uploaded = false
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json(uploaded
        ? [{ month: '2026-02', importedCount: 90 }]
        : [])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.post('*/api/imports', () => {
        uploaded = true
        return HttpResponse.json({ batchId: 1, totalRows: 90, createdRows: 90, updatedRows: 0, unchangedRows: 0 }, { status: 201 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 2월 미등록, 업로드하기' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 2월 데이터 업로드' })
    await user.upload(within(dialog).getByLabelText(/파일을 끌어다 놓거나/),
      new File([new Uint8Array(10)], 'feb.xlsx'))
    await user.click(within(dialog).getByRole('button', { name: '업로드' }))
    expect(await within(dialog).findByRole('status')).toHaveTextContent('신규90건')
    await user.click(within(dialog).getByRole('button', { name: '닫기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('등록됨 · 90건')).toBeInTheDocument()
  })

  it('summarizes last month and lists recent uploads', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', ({ request }) => {
        expect(new URL(request.url).searchParams.get('month')).toBe('2026-09')
        return HttpResponse.json([
          { id: 1, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-01T09:00:00', type: 'INCOME', categoryMajor: '급여', categoryMinor: '', description: '월급', amount: 3000000, currency: 'KRW', paymentMethod: '은행', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
          { id: 2, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-02T12:00:00', type: 'EXPENSE', categoryMajor: '식비', categoryMinor: '', description: '점심', amount: -12000, currency: 'KRW', paymentMethod: '카드', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true },
        ])
      }),
      http.get('*/api/imports', () => HttpResponse.json([
        { batchId: 3, fileName: '2026-10.xlsx', totalRows: 2, createdRows: 2, updatedRows: 0, unchangedRows: 0, importedAt: '2026-10-19T03:12:45Z' },
      ])),
    )

    renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    expect(await within(summary).findByText('₩ 3,000,000')).toBeInTheDocument()
    expect(within(summary).getByText('₩ 12,000')).toBeInTheDocument()
    const recent = screen.getByRole('region', { name: '최근 업로드' })
    expect(await within(recent).findByText('2026-10.xlsx')).toBeInTheDocument()
    expect(within(recent).getByText(/10-19 12:12/)).toBeInTheDocument()
  })

  it('shows an alert with its own retry button when the summary or recent uploads fail', async () => {
    let fail = true
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', () => fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json([])),
      http.get('*/api/imports', () => fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json([])),
    )
    const { user } = renderPage(<HomePage today={today} />)

    const summary = await screen.findByRole('region', { name: '지난달 내 요약 (2026년 9월)' })
    const recent = screen.getByRole('region', { name: '최근 업로드' })
    expect(await within(summary).findByRole('alert')).toHaveTextContent('지난달 거래를 불러오지 못했습니다.')
    expect(await within(recent).findByRole('alert')).toHaveTextContent('업로드 이력을 불러오지 못했습니다.')
    expect(within(recent).queryByText('아직 올린 파일이 없습니다.')).not.toBeInTheDocument()

    fail = false
    await user.click(within(recent).getByRole('button', { name: '업로드 이력 다시 시도' }))
    expect(await within(recent).findByText('아직 올린 파일이 없습니다.')).toBeInTheDocument()
    expect(within(summary).getByRole('alert')).toBeInTheDocument()

    await user.click(within(summary).getByRole('button', { name: '요약 다시 시도' }))
    expect(await within(summary).findByText('수입')).toBeInTheDocument()
    expect(within(summary).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the upload dialog open while the file is uploading', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/me/transactions', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.post('*/api/imports', async () => {
        await delay(200)
        return HttpResponse.json({ batchId: 1, totalRows: 1, createdRows: 1, updatedRows: 0, unchangedRows: 0 }, { status: 201 })
      }),
    )
    const { user } = renderPage(<HomePage today={today} />)

    await user.click(await screen.findByRole('button', { name: '2026년 2월 미등록, 업로드하기' }))
    const dialog = screen.getByRole('dialog', { name: '2026년 2월 데이터 업로드' })
    await user.upload(within(dialog).getByLabelText(/파일을 끌어다 놓거나/), new File([new Uint8Array(10)], 'feb.xlsx'))
    await user.click(within(dialog).getByRole('button', { name: '업로드' }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled())
    expect(await within(dialog).findByRole('status')).toHaveTextContent('신규1건')
    expect(within(dialog).getByRole('button', { name: '닫기' })).toBeEnabled()
  })
})
