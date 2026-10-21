import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import UploadForm from './UploadForm'

const xlsx = (name = '2026-09.xlsx', size = 10) =>
  new File([new Uint8Array(size)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

describe('UploadForm', () => {
  it('uploads the chosen file and shows the result', async () => {
    let receivedName: string | null = null
    server.use(http.post('*/api/imports', async ({ request }) => {
      const form = await request.formData()
      receivedName = (form.get('file') as File).name
      return HttpResponse.json({ batchId: 1, totalRows: 168, createdRows: 160, updatedRows: 3, unchangedRows: 5 }, { status: 201 })
    }))
    const onDone = vi.fn()
    const { user } = renderPage(<UploadForm onDone={onDone} />)

    await user.upload(await screen.findByLabelText(/파일을 끌어다 놓거나/), xlsx())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('전체168건')
    expect(result).toHaveTextContent('신규160건')
    expect(result).toHaveTextContent('갱신3건')
    expect(result).toHaveTextContent('변경 없음5건')
    expect(receivedName).toBe('2026-09.xlsx')
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ createdRows: 160 }))
  })

  it('rejects non-xlsx and oversized files before uploading', async () => {
    renderPage(<UploadForm />)
    const user = userEvent.setup({ applyAccept: false })
    const input = await screen.findByLabelText(/파일을 끌어다 놓거나/)

    await user.upload(input, new File(['a'], 'ledger.csv', { type: 'text/csv' }))
    expect(screen.getByRole('alert')).toHaveTextContent('.xlsx 파일만 올릴 수 있습니다.')
    expect(screen.getByRole('button', { name: '업로드' })).toBeDisabled()

    await user.upload(input, xlsx('big.xlsx', 512 * 1024 + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('파일은 512KB 이하만 올릴 수 있습니다. 한 번에 최대 3개월치까지 올릴 수 있습니다.')
    expect(screen.getByRole('button', { name: '업로드' })).toBeDisabled()
  })

  it('accepts a file exactly at the size limit', async () => {
    const { user } = renderPage(<UploadForm />)

    await user.upload(await screen.findByLabelText(/파일을 끌어다 놓거나/), xlsx('limit.xlsx', 512 * 1024))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '업로드' })).toBeEnabled()
  })

  it('explains the three-month limit when the server rejects a long period', async () => {
    server.use(http.post('*/api/imports', () =>
      HttpResponse.json({ code: 'IMPORT_PERIOD_TOO_LONG', message: 'transactions span 2026-01-01 to 2026-06-30' }, { status: 400 })))
    const { user } = renderPage(<UploadForm />)

    await user.upload(await screen.findByLabelText(/파일을 끌어다 놓거나/), xlsx('half-year.xlsx', 2048))
    await user.click(screen.getByRole('button', { name: '업로드' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('한 번에 최대 3개월치까지 올릴 수 있습니다.')
  })

  it('shows the failing row from the server', async () => {
    server.use(http.post('*/api/imports', () =>
      HttpResponse.json({ code: 'INVALID_FILE_FORMAT', message: "row 3: unknown type '환전'" }, { status: 400 })))
    const { user } = renderPage(<UploadForm />)

    await user.upload(await screen.findByLabelText(/파일을 끌어다 놓거나/), xlsx())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("3행의 값을 읽지 못했습니다. (unknown type '환전')")
  })
})
