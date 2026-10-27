import { forward } from '../../proxy/forward'

type Env = { API_ORIGIN?: string; PROXY_SECRET?: string }

/** `/api` 와 `/api/*` 를 API 서버(Render)로 넘긴다. API_ORIGIN은 Pages 환경변수로 정한다. */
export async function onRequest({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.API_ORIGIN) {
    return Response.json({ code: 'SERVER_UNAVAILABLE', message: 'API_ORIGIN is not configured' }, { status: 503 })
  }
  return forward(request, env.API_ORIGIN, env.PROXY_SECRET)
}
