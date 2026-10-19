/**
 * Cloudflare Pages Functions에서 `/api/*` 요청을 API 서버로 넘긴다.
 * 브라우저는 Pages와 같은 출처만 부르므로 CORS가 없고, refresh 쿠키(Path=/api/auth)도 그대로 오간다.
 */
export async function forward(request: Request, apiOrigin: string): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(apiOrigin)
  target.pathname = incoming.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
  target.search = incoming.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  // 브라우저는 같은 출처 POST에도 Origin을 보낸다. 그대로 넘기면 API 서버가 교차 출처 요청으로 보고 CORS 403을 낸다.
  headers.delete('origin')
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  try {
    return await fetch(target.toString(), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    })
  } catch {
    return Response.json({ code: 'SERVER_UNAVAILABLE', message: 'API server is unreachable' }, { status: 502 })
  }
}
