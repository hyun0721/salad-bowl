import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { setAccessToken } from '../api/client'
import { server } from './server'

// jsdom의 File·FormData는 Node fetch(undici)가 알아보지 못해 업로드한 파일 이름이 "blob"으로 바뀐다.
// 테스트에서는 Node의 File과 FormData를 쓴다. 브라우저에는 해당 없는 환경 차이다.
const multipart = '--b\r\nContent-Disposition: form-data; name="f"; filename="f.txt"\r\n\r\nx\r\n--b--\r\n'
const nodeForm = await new Response(multipart, { headers: { 'content-type': 'multipart/form-data; boundary=b' } }).formData()
globalThis.File = nodeForm.get('f')!.constructor as typeof File
globalThis.FormData = nodeForm.constructor as typeof FormData

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  setAccessToken(null)
})
afterAll(() => server.close())
