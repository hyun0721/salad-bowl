import { apiFetch } from '../api/client'

/** serviceAdmin은 메뉴를 보일지 정하는 데만 쓴다. 세법 관리 권한은 서버가 요청마다 DB로 확인한다. */
export type Me = { userId: number; email: string; nickname: string; serviceAdmin: boolean }

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string }>('/auth/login', { method: 'POST', json: { email, password }, auth: false }),
  google: (idToken: string) =>
    apiFetch<{ accessToken: string }>('/auth/google', { method: 'POST', json: { idToken }, auth: false }),
  signup: (email: string, password: string, nickname: string) =>
    apiFetch<{ userId: number }>('/auth/signup', { method: 'POST', json: { email, password, nickname }, auth: false }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST', auth: false }),
  me: () => apiFetch<Me>('/me'),
}
