/**
 * 로그인 후 돌아갈 경로(`next`)를 검증한다. 접두어만 보면 `/\evil.example`, `/%09/evil.example` 같은
 * 값이 통과해 react-router가 외부 이동 오류를 던지므로, 브라우저와 같은 규칙으로 파싱해
 * 같은 출처일 때만 경로를 돌려주고 아니면 홈(`/`)으로 보낸다.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return '/'
  try {
    const url = new URL(next, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
