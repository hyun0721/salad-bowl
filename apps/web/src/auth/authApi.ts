import { apiFetch } from '../api/client'

export type Me = { userId: number; email: string; nickname: string }

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
