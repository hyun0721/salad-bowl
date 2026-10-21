/// <reference types="node" />
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(fileURLToPath(new URL(`../public/${name}`, import.meta.url)), 'utf8')

describe('Cloudflare Pages config', () => {
  it('runs the Function only for /api', () => {
    expect(JSON.parse(read('_routes.json'))).toEqual({ version: 1, include: ['/api', '/api/*'], exclude: [] })
  })

  it('never caches the service worker files and sends basic security headers', () => {
    const headers = read('_headers')
    for (const path of ['/sw.js', '/registerSW.js', '/manifest.webmanifest']) {
      expect(headers).toMatch(new RegExp(`^${path.replace(/[.*]/g, '\\$&')}\\n\\s+Cache-Control: no-cache`, 'm'))
    }
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('X-Frame-Options: DENY')
  })
})
