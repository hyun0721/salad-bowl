// PWA 아이콘 생성 설정. 로고를 바꾸면 apps/web에서 다시 실행한다.
//   npx --yes @vite-pwa/assets-generator@2.0.0
// minimal-2023 프리셋과 같고, maskable·apple 아이콘의 여백만 흰색 대신 브랜드 색으로 채운다.
// 흰 여백이 남으면 안드로이드 원형 마스크와 iOS 둥근 모서리에서 테두리가 보인다.
const brand = { resizeOptions: { background: '#2f6b4f' } }

export default {
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [512], ...brand },
    apple: { sizes: [180], ...brand },
  },
  images: ['public/logo.svg'],
}
