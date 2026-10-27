// API multipart 한도(max-request-size 1MB)와 같은 값을 모든 요청의 상한으로 쓴다.
const MAX_BODY_BYTES = 1024 * 1024

/**
 * Cloudflare Pages Functions에서 `/api/*` 요청을 API 서버로 넘긴다.
 * 브라우저는 Pages와 같은 출처만 부르므로 CORS가 없고, refresh 쿠키(Path=/api/auth)도 그대로 오간다.
 */
export async function forward(request: Request, apiOrigin: string, proxySecret?: string): Promise<Response> {
  const incoming = new URL(request.url)
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    const origin = request.headers.get('origin')
    if (origin !== incoming.origin && !(origin === null && request.headers.get('sec-fetch-site') === 'same-origin')) {
      return Response.json({ code: 'FORBIDDEN_ORIGIN', message: 'cross-origin request is not allowed' }, { status: 403 })
    }
  }
  // API_ORIGIN은 경로 없는 origin이어야 한다(예: https://salad-bowl-api.onrender.com). 경로가 있어도 무시된다.
  let target: URL
  try {
    target = new URL(apiOrigin)
  } catch {
    return Response.json({ code: 'SERVER_UNAVAILABLE', message: 'API_ORIGIN is not a valid URL' }, { status: 503 })
  }
  target.pathname = incoming.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
  target.search = incoming.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('x-proxy-secret')
  // API가 앞뒤 공백을 다듬어 비교하므로 같은 값으로 맞춘다.
  const secret = proxySecret?.trim()
  if (secret) headers.set('x-proxy-secret', secret)
  headers.delete('x-client-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) headers.set('x-client-ip', cfConnectingIp)
  // 브라우저는 같은 출처 POST에도 Origin을 보낸다. 그대로 넘기면 API 서버가 교차 출처 요청으로 보고 CORS 403을 낸다.
  headers.delete('origin')
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const tooLarge = () => Response.json({
    code: incoming.pathname === '/api/imports' ? 'FILE_TOO_LARGE' : 'REQUEST_TOO_LARGE',
    message: 'request body must be 1MB or smaller',
  }, { status: 413 })

  if (hasBody && Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    return tooLarge()
  }

  let body: ArrayBuffer | undefined
  if (hasBody) {
    const chunks: Uint8Array[] = []
    let size = 0
    // shortcut: 읽기 시간 제한 없음, 끝나지 않는 스트림이 문제가 되면 추가
    try {
      const reader = request.body?.getReader()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > MAX_BODY_BYTES) {
            void reader.cancel().catch(() => {})
            return tooLarge()
          }
          chunks.push(value)
        }
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      body = bytes.buffer
    } catch {
      return Response.json({ code: 'BAD_REQUEST', message: 'request body could not be read' }, { status: 400 })
    }
  }

  try {
    return await fetch(target.toString(), {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    })
  } catch {
    return Response.json({ code: 'SERVER_UNAVAILABLE', message: 'API server is unreachable' }, { status: 502 })
  }
}
