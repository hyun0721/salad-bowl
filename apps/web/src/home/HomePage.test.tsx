import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import HomePage from './HomePage'

const today = new Date(2026, 9, 19) // 2026-10-19

describe('HomePage', () => {
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

})
