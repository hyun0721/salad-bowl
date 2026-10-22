import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from 'react-aria-components'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* React Aria 컴포넌트의 기본 문구와 날짜·숫자 형식을 브라우저 언어와 상관없이 한국어로 맞춘다. */}
    <I18nProvider locale="ko-KR">
      <App />
    </I18nProvider>
  </StrictMode>,
)
