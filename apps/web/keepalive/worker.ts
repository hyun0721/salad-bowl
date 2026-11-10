interface Env {
  HEALTH_URL?: string
}

export async function checkHealth(env: Env): Promise<void> {
  if (!env.HEALTH_URL) throw new Error('HEALTH_URL is not set')

  const response = await fetch(env.HEALTH_URL, { method: 'GET' })
  if (response.status !== 200 || !(await response.text()).includes('"status":"UP"')) {
    throw new Error(`Health check failed: HTTP ${response.status}`)
  }
}

export default {
  scheduled(_event: unknown, env: Env): Promise<void> {
    return checkHealth(env)
  },
}
