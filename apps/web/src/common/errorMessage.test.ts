import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('maps upload and transaction codes', () => {
    expect(errorMessage(new ApiError(413, 'FILE_TOO_LARGE', 'x'))).toBe('파일은 5MB 이하만 올릴 수 있습니다.')
    expect(errorMessage(new ApiError(400, 'INVALID_FILE_FORMAT', 'x'))).toBe('뱅크샐러드에서 내려받은 .xlsx 파일인지 확인해 주세요.')
    expect(errorMessage(new ApiError(409, 'CANNOT_DELETE_IMPORTED', 'x'))).toBe('엑셀로 가져온 거래는 삭제할 수 없습니다. 숨기기를 사용해 주세요.')
    expect(errorMessage(new ApiError(409, 'CONFLICT', 'x'))).toBe('다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('prefers overrides and falls back for unknown codes', () => {
    expect(errorMessage(new ApiError(404, 'NOT_FOUND', 'x'), { NOT_FOUND: '거래를 찾을 수 없습니다.' })).toBe('거래를 찾을 수 없습니다.')
    expect(errorMessage(new ApiError(418, 'TEAPOT', 'x'))).toBe('요청을 처리하지 못했습니다.')
    expect(errorMessage(new Error('x'))).toBe('요청을 처리하지 못했습니다.')
  })
})
