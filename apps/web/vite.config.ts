import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import optimizeLocales from '@react-aria/optimize-locales-plugin'

// PWA: 설치만 지원한다(오프라인 기능 없음). 앱 셸만 precache하고 /api/* 는 캐시하지 않는다.
// 새 버전은 앱 안의 알림(UpdatePrompt)으로 사용자가 새로 고친다.
const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
  manifest: {
    name: 'Salad Bowl',
    short_name: 'Salad Bowl',
    description: '뱅크샐러드 가계부를 가족·친구와 함께 봅니다.',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f4f0',
    theme_color: '#2f6b4f',
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api(\/|$)/],
    runtimeCaching: [],
  },
})

// 로컬 개발: 브라우저는 /api/* 를 호출하고, dev server가 API(8080)로 접두어를 떼고 전달한다.
// 배포(Cloudflare Pages Functions)도 같은 규칙이라 쿠키 Path(/api/auth)가 두 환경에서 같다.
export default defineConfig({
  // 테스트에서는 서비스 워커를 만들 필요가 없다.
  // React Aria는 30여 개 언어의 문구를 함께 싣는다. 앱은 한국어만 쓰므로(main.tsx의 I18nProvider) 나머지는 뺀다.
  plugins: process.env.VITEST ? [react()] : [react(), pwa, { ...optimizeLocales.vite({ locales: ['ko-KR'] }), enforce: 'pre' }],
  // 번들에 포함된 의존성의 Apache-2.0/MIT 라이선스 고지 의무를 지킨다.
  build: {
    license: { fileName: 'third-party-licenses.md' },
    // ECharts와 그리기 엔진 zrender는 대시보드만 쓰는 큰 덩어리라 각각 떼어 둔다(합치면 500 kB 경고를 넘는다).
    // 대시보드 코드만 바뀔 때 이 청크들의 캐시가 유지된다.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'zrender', test: /node_modules[\\/]zrender[\\/]/ }, { name: 'echarts', test: /node_modules[\\/]echarts[\\/]/ }],
        },
      },
    },
  },
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
    alias: { 'virtual:pwa-register/react': new URL('./src/test/pwaRegisterStub.ts', import.meta.url).pathname },
  },
})
