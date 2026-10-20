import { apiFetch } from '../api/client'
import { ApiError } from '../api/errors'
import { errorMessage } from '../common/errorMessage'

export type ImportResult = {
  batchId: number
  totalRows: number
  createdRows: number
  updatedRows: number
  unchangedRows: number
}

export type ImportBatchView = ImportResult & { fileName: string; importedAt: string }

export const MAX_UPLOAD_BYTES = 512 * 1024

/** 서버에 보내기 전에 거를 수 있는 것만 거른다. 내용 검사는 서버가 한다. */
export function validateUploadFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return '.xlsx 파일만 올릴 수 있습니다.'
  if (file.size === 0) return '빈 파일입니다. 다른 파일을 선택해 주세요.'
  if (file.size > MAX_UPLOAD_BYTES) return '파일은 512KB 이하만 올릴 수 있습니다. 한 번에 최대 3개월치까지 올릴 수 있습니다.'
  return null
}

/** 서버의 `row N: 원문`을 행 번호가 보이는 문구로 바꾼다. */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'INVALID_FILE_FORMAT') {
    const match = /^row (\d+): (.*)$/.exec(error.message)
    if (match) return `${match[1]}행의 값을 읽지 못했습니다. (${match[2]})`
  }
  return errorMessage(error)
}

export const importsApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<ImportResult>('/imports', { method: 'POST', body: form })
  },
  history: () => apiFetch<ImportBatchView[]>('/imports'),
}
