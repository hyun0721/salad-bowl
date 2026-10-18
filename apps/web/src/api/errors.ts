/** API 오류. 서버 응답 {code, message}를 그대로 담는다. 네트워크 오류는 status 0, code NETWORK_ERROR. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
