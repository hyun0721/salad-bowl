import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../common/errorMessage'
import { safeNext } from '../common/safeNext'
import { useAuth } from './AuthProvider'
import { SignupLoginError } from './authErrors'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'signup'
const MODES: Mode[] = ['login', 'signup']
const TAB_LABEL: Record<Mode, string> = { login: '로그인', signup: '회원가입' }

export default function LoginPage() {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tabs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({})

  const target = safeNext(params.get('next'))

  function changeMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  // 탭 패턴: 좌우 화살표·Home·End로 탭을 바꾸고 포커스를 옮긴다.
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = MODES.indexOf(mode)
    const next = event.key === 'ArrowRight' ? MODES[(index + 1) % MODES.length]
      : event.key === 'ArrowLeft' ? MODES[(index - 1 + MODES.length) % MODES.length]
        : event.key === 'Home' ? MODES[0]
          : event.key === 'End' ? MODES[MODES.length - 1]
            : null
    if (!next) return
    event.preventDefault()
    changeMode(next)
    tabs.current[next]?.focus()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(email, password, nickname)
      navigate(target, { replace: true })
    } catch (e) {
      if (e instanceof SignupLoginError) {
        // 계정은 만들어졌다. 다시 가입하면 '이미 가입된 이메일'이 나오므로 로그인으로 안내한다.
        setMode('login')
        setNotice('가입은 완료되었습니다. 로그인해 주세요.')
      } else {
        setError(errorMessage(e))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.name}>Salad Bowl</span>
          <p className={styles.lead}>뱅크샐러드 가계부를 가족·친구와 함께 봅니다.</p>
        </div>
        <div role="tablist" aria-label="로그인 또는 회원가입" className={styles.tabs} onKeyDown={onTabKeyDown}>
          {MODES.map((m) => (
            <button key={m} ref={(el) => { tabs.current[m] = el }} type="button" role="tab" id={`auth-tab-${m}`}
              aria-selected={mode === m} aria-controls="auth-panel" tabIndex={mode === m ? 0 : -1}
              className={styles.tab} onClick={() => changeMode(m)}>{TAB_LABEL[m]}</button>
          ))}
        </div>
        <form id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`} className={styles.form}
          onSubmit={onSubmit}>
          <label className={styles.field}>
            <span>이메일</span>
            <input type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>비밀번호{mode === 'signup' ? ' (8~64자)' : ''}</span>
            <input type="password" required minLength={mode === 'signup' ? 8 : undefined} maxLength={64}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          {mode === 'signup' && (
            <label className={styles.field}>
              <span>닉네임 (그룹에서 보이는 이름)</span>
              <input type="text" required maxLength={50} value={nickname}
                onChange={(e) => setNickname(e.target.value)} />
            </label>
          )}
          <button type="submit" className={styles.submit} disabled={busy}>
            {mode === 'login' ? '로그인' : '가입하고 시작하기'}
          </button>
          {notice && <p role="status" className={styles.notice}>{notice}</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
        <p className={styles.hint}>초대 링크로 들어왔다면 로그인 후 초대 화면으로 돌아갑니다.</p>
      </main>
    </div>
  )
}
