// API의 max-request-size(1MB)와 같다. 더 큰 본문은 API(Tomcat)가 읽다가 연결을 끊어 502가 되므로 여기서 413으로 답한다.
const MAX_BODY_BYTES = 1024 * 1024

/**
 * Cloudflare Pages Functions에서 `/api/*` 요청을 API 서버로 넘긴다.
 * 브라우저는 Pages와 같은 출처만 부르므로 CORS가 없고, refresh 쿠키(Path=/api/auth)도 그대로 오간다.
 */
export async function forward(request: Request, apiOrigin: string): Promise<Response> {
  const incoming = new URL(request.url)
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
  // 브라우저는 같은 출처 POST에도 Origin을 보낸다. 그대로 넘기면 API 서버가 교차 출처 요청으로 보고 CORS 403을 낸다.
  headers.delete('origin')
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  try {
    const body = hasBody ? await request.arrayBuffer() : undefined
    if (body && body.byteLength > MAX_BODY_BYTES) {
      return Response.json({ code: 'FILE_TOO_LARGE', message: 'request body must be 1MB or smaller' }, { status: 413 })
    }
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
