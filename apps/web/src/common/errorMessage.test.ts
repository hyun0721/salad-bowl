import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('maps upload and transaction codes', () => {
    expect(errorMessage(new ApiError(413, 'FILE_TOO_LARGE', 'x'))).toBe('파일은 512KB 이하만 올릴 수 있습니다. 한 번에 최대 3개월치까지 올릴 수 있습니다.')
    expect(errorMessage(new ApiError(400, 'IMPORT_PERIOD_TOO_LONG', 'x'))).toBe('한 번에 최대 3개월치까지 올릴 수 있습니다. 뱅크샐러드에서 기간을 3개월 이하로 나눠 내려받아 주세요.')
    expect(errorMessage(new ApiError(503, 'IMPORT_BUSY', 'x'))).toBe('다른 업로드를 처리하고 있습니다. 잠시 후 다시 시도해 주세요.')
    expect(errorMessage(new ApiError(400, 'INVALID_FILE_FORMAT', 'x'))).toBe('뱅크샐러드에서 내려받은 .xlsx 파일인지 확인해 주세요.')
    expect(errorMessage(new ApiError(409, 'CANNOT_DELETE_IMPORTED', 'x'))).toBe('엑셀로 가져온 거래는 삭제할 수 없습니다. 숨기기를 사용해 주세요.')
    expect(errorMessage(new ApiError(409, 'CONFLICT', 'x'))).toBe('다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('maps group and invite codes', () => {
    expect(errorMessage(new ApiError(410, 'INVITE_EXPIRED', 'x'))).toBe('초대 링크가 만료되었습니다. 관리자에게 새 링크를 요청해 주세요.')
    expect(errorMessage(new ApiError(409, 'GROUP_FULL', 'x'))).toBe('그룹 정원(6명)이 찼습니다.')
    expect(errorMessage(new ApiError(502, 'SERVER_UNAVAILABLE', 'x'))).toBe('서버를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('prefers overrides and falls back for unknown codes', () => {
    expect(errorMessage(new ApiError(404, 'NOT_FOUND', 'x'), { NOT_FOUND: '거래를 찾을 수 없습니다.' })).toBe('거래를 찾을 수 없습니다.')
    expect(errorMessage(new ApiError(418, 'TEAPOT', 'x'))).toBe('요청을 처리하지 못했습니다.')
    expect(errorMessage(new Error('x'))).toBe('요청을 처리하지 못했습니다.')
  })
})
