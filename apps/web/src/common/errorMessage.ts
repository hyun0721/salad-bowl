import { ApiError } from '../api/errors'

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 맞지 않습니다.',
  EMAIL_ALREADY_EXISTS: '이미 가입된 이메일입니다.',
  VALIDATION_FAILED: '입력한 값을 다시 확인해 주세요.',
  NETWORK_ERROR: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  UNAUTHORIZED: '다시 로그인해 주세요.',
  FORBIDDEN: '이 작업을 할 권한이 없습니다.',
  FORBIDDEN_ORIGIN: '요청을 처리할 수 없습니다. 페이지를 새로고침해 주세요.',
  TOO_MANY_ATTEMPTS: '로그인 시도가 너무 많습니다. 15분쯤 뒤 다시 시도해 주세요.',
  NOT_FOUND: '찾을 수 없습니다.',
  INVALID_TOKEN: '다시 로그인해 주세요.',
  GOOGLE_LOGIN_UNAVAILABLE: 'Google 로그인을 사용할 수 없습니다. 이메일로 로그인해 주세요.',
  CONFLICT: '다른 요청과 겹쳤습니다. 잠시 후 다시 시도해 주세요.',
  REQUEST_FAILED: '요청을 처리하지 못했습니다.',
  INVALID_FILE_FORMAT: '뱅크샐러드에서 내려받은 .xlsx 파일인지 확인해 주세요.',
  FILE_TOO_LARGE: '파일은 512KB 이하만 올릴 수 있습니다. 한 번에 최대 3개월치까지 올릴 수 있습니다.',
  REQUEST_TOO_LARGE: '요청이 너무 큽니다.',
  IMPORT_PERIOD_TOO_LONG: '한 번에 최대 3개월치까지 올릴 수 있습니다. 뱅크샐러드에서 기간을 3개월 이하로 나눠 내려받아 주세요.',
  IMPORT_BUSY: '다른 업로드를 처리하고 있습니다. 1~2분 뒤 다시 시도해 주세요.',
  CANNOT_DELETE_IMPORTED: '엑셀로 가져온 거래는 삭제할 수 없습니다. 숨기기를 사용해 주세요.',
  SERVER_UNAVAILABLE: '서버를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  INVITE_NOT_FOUND: '초대 링크를 찾을 수 없습니다. 주소를 다시 확인해 주세요.',
  INVITE_EXPIRED: '초대 링크가 만료되었습니다. 관리자에게 새 링크를 요청해 주세요.',
  ALREADY_MEMBER: '이미 이 그룹의 멤버입니다.',
  GROUP_FULL: '그룹 정원(6명)이 찼습니다.',
  REMOVED_FROM_GROUP: '이 그룹에서 내보내져 다시 합류할 수 없습니다. 관리자에게 문의해 주세요.',
  CANNOT_REMOVE_ADMIN: '관리자는 내보낼 수 없습니다.',
  ADMIN_CANNOT_LEAVE: '관리자는 그룹을 나갈 수 없습니다.',
  INTERNAL_ERROR: '서버에서 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
}

/** API 오류 코드를 화면 문구로 바꾼다. 화면별 문구가 따로 있으면 overrides로 덮어쓴다. */
export function errorMessage(error: unknown, overrides: Record<string, string> = {}): string {
  if (error instanceof ApiError) {
    return overrides[error.code] ?? MESSAGES[error.code] ?? '요청을 처리하지 못했습니다.'
  }
  return '요청을 처리하지 못했습니다.'
}
