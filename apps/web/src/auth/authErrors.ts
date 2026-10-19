/** 가입은 됐지만 이어진 로그인이 실패했다. 다시 가입하면 EMAIL_ALREADY_EXISTS가 나므로 로그인으로 안내한다. */
export class SignupLoginError extends Error {
  constructor(cause: unknown) {
    super('signed up but could not log in', { cause })
    this.name = 'SignupLoginError'
  }
}
