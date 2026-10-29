import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import UploadPage from './UploadPage'

const today = new Date(2026, 9, 19) // 2026-10-19

function Search() {
  return <output aria-label="주소 검색어">{useLocation().search}</output>
}

function coverageByYear(coverage: Record<string, unknown[]>) {
  server.use(
    http.get('*/api/imports', () => HttpResponse.json([])),
    http.get('*/api/me/coverage', ({ request }) =>
      HttpResponse.json(coverage[new URL(request.url).searchParams.get('year') ?? ''] ?? [])),
  )
}

describe('UploadPage', () => {
  it('opens the upload dialog for a missing month from the address and clears it', async () => {
    coverageByYear({})

    renderPage(<><UploadPage today={today} /><Search /></>, { path: '/upload?month=2026-09' })

    expect(await screen.findByRole('dialog', { name: '2026년 9월 데이터 업로드' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어', hidden: true })).toBeEmptyDOMElement())
  })

  it('keeps the requested month after a coverage failure and opens it on retry', async () => {
    server.use(
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.get('*/api/me/coverage', () => new HttpResponse(null, { status: 500 })),
    )

    const { user } = renderPage(<><UploadPage today={today} /><Search /></>, { path: '/upload?month=2026-09' })
    const coverage = await screen.findByRole('region', { name: '월별 등록 현황' })

    await within(coverage).findByRole('alert')
    expect(screen.getByRole('status', { name: '주소 검색어' })).toHaveTextContent('?month=2026-09')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    server.use(http.get('*/api/me/coverage', () => HttpResponse.json([])))
    await user.click(within(coverage).getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('dialog', { name: '2026년 9월 데이터 업로드' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어', hidden: true })).toBeEmptyDOMElement())
  })

  it('opens the month dialog for a registered month', async () => {
    coverageByYear({ '2026': [{ month: '2026-09', importedCount: 168, manualCount: 0 }] })

    renderPage(<UploadPage today={today} />, { path: '/upload?month=2026-09' })

    const dialog = await screen.findByRole('dialog', { name: '2026년 9월 데이터' })
    expect(within(dialog).getByRole('button', { name: '다시 업로드' })).toBeInTheDocument()
  })

  it('starts the calendar on the requested year', async () => {
    coverageByYear({})

    renderPage(<UploadPage today={today} />, { path: '/upload?month=2025-11' })

    expect(await screen.findByRole('dialog', { name: '2025년 11월 데이터 업로드' })).toBeInTheDocument()
    expect(screen.getByText('2025년')).toBeInTheDocument()
  })

  it('ignores a malformed or future month and clears it', async () => {
    coverageByYear({})

    renderPage(<><UploadPage today={today} /><Search /></>, { path: '/upload?month=2026-12' })

    await screen.findByText('12월')
    await waitFor(() => expect(screen.getByRole('status', { name: '주소 검색어' })).toBeEmptyDOMElement())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists the upload history newest first and sets the title', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([
        { batchId: 2, fileName: '2026-09.xlsx', totalRows: 168, createdRows: 168, updatedRows: 0, unchangedRows: 0, importedAt: '2026-10-01T00:00:00Z' },
        { batchId: 1, fileName: '2026-08.xlsx', totalRows: 150, createdRows: 0, updatedRows: 2, unchangedRows: 148, importedAt: '2026-09-01T09:00:00+09:00' },
      ])),
    )

    renderPage(<UploadPage />)

    const history = await screen.findByRole('region', { name: '업로드 이력' })
    const rows = await within(history).findAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('2026-09.xlsx')
    expect(rows[0]).toHaveTextContent('신규 168')
    expect(rows[0]).toHaveTextContent('10-01 09:00') // UTC 자정은 서울 오전 9시
    expect(rows[1]).toHaveTextContent('2026-08.xlsx')
    expect(rows[1]).toHaveTextContent('변경 없음 148')
    expect(rows[1]).toHaveTextContent('09-01 09:00')
    expect(document.title).toBe('업로드 · Salad Bowl')
  })

  it('shows an empty history message', async () => {
    server.use(
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
      http.get('*/api/imports', () => HttpResponse.json([])),
    )

    renderPage(<UploadPage />)

    expect(await screen.findByText('아직 올린 파일이 없습니다.')).toBeInTheDocument()
  })

  it('puts the coverage calendar above the upload form and history', async () => {
    server.use(
      http.get('*/api/imports', () => HttpResponse.json([])),
      http.get('*/api/me/coverage', () => HttpResponse.json([])),
    )

    renderPage(<UploadPage today={new Date(2026, 9, 19)} />)

    await screen.findByRole('region', { name: '월별 등록 현황' })
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['월별 등록 현황', '파일 올리기', '업로드 이력'])
  })
})
