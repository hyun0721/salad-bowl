interface Env {
  HEALTH_URL?: string
}

export async function checkHealth(env: Env, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<void> {
  if (!env.HEALTH_URL) throw new Error('HEALTH_URL is not set')

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(env.HEALTH_URL, { method: 'GET' })
      if (response.status !== 200) throw new Error(`Health check failed: HTTP ${response.status}`)
      const body: unknown = await response.json()
      if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'UP') {
        throw new Error(`Health check failed: HTTP ${response.status}`)
      }
      return
    } catch (error) {
      if (attempt === 2) throw error
      await wait(20_000)
    }
  }
}

export default {
  scheduled(_event: unknown, env: Env): Promise<void> {
    return checkHealth(env)
  },
}
