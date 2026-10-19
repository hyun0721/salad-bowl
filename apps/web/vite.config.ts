import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 로컬 개발: 브라우저는 /api/* 를 호출하고, dev server가 API(8080)로 접두어를 떼고 전달한다.
// 배포(Cloudflare Pages Functions)도 같은 규칙이라 쿠키 Path(/api/auth)가 두 환경에서 같다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
