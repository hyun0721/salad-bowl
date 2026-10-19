import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

type Props = { children: ReactNode }
type State = { failed: boolean }

// 렌더링 중 예외가 나면 화면 전체가 사라지는 대신 안내와 새로고침 버튼을 보여준다.
// 라우터 안쪽에 두어도 되고(링크 등 라우터 훅을 쓰지 않는다) 바깥에 두어도 동작한다.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('화면 렌더링 중 오류가 발생했습니다.', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={styles.page} role="alert">
        <h1 className={styles.title}>문제가 생겼습니다</h1>
        <p className={styles.text}>화면을 표시하지 못했습니다.</p>
        <button type="button" className={styles.button} onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
      </div>
    )
  }
}
