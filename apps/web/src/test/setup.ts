import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { setAccessToken } from '../api/client'
import { server } from './server'

// jsdom의 File·FormData는 Node fetch(undici)가 알아보지 못해 업로드한 파일 이름이 "blob"으로 바뀐다.
// 테스트에서는 Node의 File과 FormData를 쓴다. 브라우저에는 해당 없는 환경 차이다.
const multipart = '--b\r\nContent-Disposition: form-data; name="f"; filename="f.txt"\r\n\r\nx\r\n--b--\r\n'
const nodeForm = await new Response(multipart, { headers: { 'content-type': 'multipart/form-data; boundary=b' } }).formData()
globalThis.File = nodeForm.get('f')!.constructor as typeof File
globalThis.FormData = nodeForm.constructor as typeof FormData

// jsdom에 없는 브라우저 API를 RAC Sheet·SelectionIndicator가 쓸 수 있을 만큼만 채운다(테스트 전용).
// 기본은 넓은 폭이다. 모바일 폭은 test/mockViewport.ts로 바꾼다(vi.stubGlobal이라 테스트마다 원래대로 돌아온다).
// Node 환경의 proxy 테스트에는 DOM이 없어 브라우저 API 보충을 건너뛴다.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
      dispatchEvent: () => false,
    })
  }
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class {
      readonly root = null
      readonly rootMargin = ''
      readonly thresholds = []
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    } as unknown as typeof IntersectionObserver
  }
  if (!Element.prototype.scrollTo) {
    // RAC Sheet가 진입 완료를 기다리지 않도록 scrollend를 보낸다.
    Element.prototype.scrollTo = function scrollTo(this: Element) {
      setTimeout(() => this.dispatchEvent(new Event('scrollend')), 0)
    }
  }
  if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(async () => {
  cleanup()
  // 큐가 모듈 하나라 알림이 테스트 사이에 남는다. Node 환경(proxy)에는 DOM이 없어 건너뛴다.
  if (typeof window !== 'undefined') {
    const { clearToasts } = await import('../common/Toast')
    clearToasts()
  }
  vi.unstubAllGlobals()
  server.resetHandlers()
  setAccessToken(null)
})
afterAll(() => server.close())
