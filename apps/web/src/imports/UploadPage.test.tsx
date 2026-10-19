import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import UploadPage from './UploadPage'

describe('UploadPage', () => {
  it('lists the upload history newest first and sets the title', async () => {
    server.use(http.get('*/api/imports', () => HttpResponse.json([
      { batchId: 2, fileName: '2026-09.xlsx', totalRows: 168, createdRows: 168, updatedRows: 0, unchangedRows: 0, importedAt: '2026-10-01T09:00:00+09:00' },
      { batchId: 1, fileName: '2026-08.xlsx', totalRows: 150, createdRows: 0, updatedRows: 2, unchangedRows: 148, importedAt: '2026-09-01T09:00:00+09:00' },
    ])))

    renderPage(<UploadPage />)

    const history = await screen.findByRole('region', { name: '업로드 이력' })
    const rows = await within(history).findAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('2026-09.xlsx')
    expect(rows[0]).toHaveTextContent('신규 168')
    expect(rows[1]).toHaveTextContent('2026-08.xlsx')
    expect(rows[1]).toHaveTextContent('변경 없음 148')
    expect(document.title).toBe('업로드 · Salad Bowl')
  })

  it('shows an empty history message', async () => {
    server.use(http.get('*/api/imports', () => HttpResponse.json([])))

    renderPage(<UploadPage />)

    expect(await screen.findByText('아직 올린 파일이 없습니다.')).toBeInTheDocument()
  })
})
