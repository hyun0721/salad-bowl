import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import UploadForm from './UploadForm'

const xlsx = (name = '2026-09.xlsx', size = 10) =>
  new File([new Uint8Array(size)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

// FileTrigger의 숨겨진 입력으로 브라우저 파일 선택 결과를 전달한다.
async function fileInput() {
  await waitFor(() => expect(document.querySelector('input[type="file"]')).toBeInTheDocument())
  return document.querySelector<HTMLInputElement>('input[type="file"]')!
}

afterEach(() => vi.unstubAllGlobals())

describe('UploadForm', () => {
  it('shows mobile guidance without drag instructions', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 820px)', media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(),
    })))
    renderPage(<UploadForm />)
    expect(await screen.findByText('파일 선택 버튼을 눌러 엑셀 파일을 고르세요')).toBeVisible()
    expect(screen.queryByText(/파일을 끌어다/)).not.toBeInTheDocument()
  })

  it('accepts extension and MIME and clears the chip and upload result', async () => {
    server.use(http.post('*/api/imports', () => HttpResponse.json({ batchId: 1, totalRows: 1, createdRows: 1, updatedRows: 0, unchangedRows: 0 })))
    const { user } = renderPage(<UploadForm />)
    expect(await screen.findByRole('button', { name: '파일 선택' })).toBeVisible()
    expect(await fileInput()).toHaveAttribute('accept', '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(await fileInput()).not.toBeVisible()
    await user.upload(await fileInput(), xlsx('example.xlsx', 2048))
    expect(screen.getByText('example.xlsx')).toBeVisible()
    expect(screen.getByText('2 KB')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '업로드' }))
    await screen.findByRole('status')
    await user.click(screen.getByRole('button', { name: '선택 취소' }))
    expect(screen.queryByText('example.xlsx')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '업로드' })).toBeDisabled()
  })

  it('disables clearing the selected file until the upload completes', async () => {
    let finishUpload!: () => void
    const pending = new Promise<void>((resolve) => { finishUpload = resolve })
    server.use(http.post('*/api/imports', async () => {
      await pending
      return HttpResponse.json({ batchId: 1, totalRows: 1, createdRows: 1, updatedRows: 0, unchangedRows: 0 })
    }))
    const { user } = renderPage(<UploadForm />)
    await user.upload(await fileInput(), xlsx())
    // 보이는 문구가 그대로 접근 이름이 되어야 한다.
    const clear = screen.getByRole('button', { name: '선택 취소' })
    expect(clear).not.toHaveAttribute('aria-label')
    expect(clear).toBeEnabled()
    try {
      await user.click(screen.getByRole('button', { name: '업로드' }))
      // 비활성 버튼은 브라우저가 누르기를 막는다. jsdom에서 눌러 보면 React Aria의 누르기 상태가 남아 이후 테스트가 틀어진다.
      expect(clear).toBeDisabled()
      expect(screen.getByText('2026-09.xlsx')).toBeVisible()
      expect(screen.getByRole('button', { name: '올리는 중' })).toBeDisabled()
    } finally {
      finishUpload()
    }
    await screen.findByRole('status')
    expect(clear).toBeEnabled()
    await user.click(clear)
    expect(screen.queryByText('2026-09.xlsx')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('uploads the chosen file and shows the result', async () => {
    let receivedName: string | null = null
    server.use(http.post('*/api/imports', async ({ request }) => {
      const form = await request.formData()
      receivedName = (form.get('file') as File).name
      return HttpResponse.json({ batchId: 1, totalRows: 168, createdRows: 160, updatedRows: 3, unchangedRows: 5 }, { status: 201 })
    }))
    const onDone = vi.fn()
    const { user } = renderPage(<UploadForm onDone={onDone} />)

    await user.upload(await fileInput(), xlsx())
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
    const input = await fileInput()

    await user.upload(input, new File(['a'], 'ledger.csv', { type: 'text/csv' }))
    expect(screen.getByRole('alert')).toHaveTextContent('.xlsx 파일만 올릴 수 있습니다.')
    expect(screen.getByRole('button', { name: '업로드' })).toBeDisabled()

    await user.upload(input, xlsx('big.xlsx', 512 * 1024 + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('파일은 512KB 이하만 올릴 수 있습니다. 한 번에 최대 3개월치까지 올릴 수 있습니다.')
    expect(screen.getByRole('button', { name: '업로드' })).toBeDisabled()
  })

  it('accepts a file exactly at the size limit', async () => {
    const { user } = renderPage(<UploadForm />)

    await user.upload(await fileInput(), xlsx('limit.xlsx', 512 * 1024))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '업로드' })).toBeEnabled()
  })

  it('explains the three-month limit when the server rejects a long period', async () => {
    server.use(http.post('*/api/imports', () =>
      HttpResponse.json({ code: 'IMPORT_PERIOD_TOO_LONG', message: 'transactions span 2026-01-01 to 2026-06-30' }, { status: 400 })))
    const { user } = renderPage(<UploadForm />)

    await user.upload(await fileInput(), xlsx('half-year.xlsx', 2048))
    await user.click(screen.getByRole('button', { name: '업로드' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('한 번에 최대 3개월치까지 올릴 수 있습니다.')
  })

  it('shows the failing row from the server', async () => {
    server.use(http.post('*/api/imports', () =>
      HttpResponse.json({ code: 'INVALID_FILE_FORMAT', message: "row 3: unknown type '환전'" }, { status: 400 })))
    const { user } = renderPage(<UploadForm />)

    await user.upload(await fileInput(), xlsx())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("3행의 값을 읽지 못했습니다. (unknown type '환전')")
  })
})
