import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../common/errorMessage'
import { safeNext } from '../common/safeNext'
import { useAuth } from './AuthProvider'
import styles from './LoginPage.module.css'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const target = safeNext(params.get('next'))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(email, password, nickname)
      navigate(target, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
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
        <div role="tablist" aria-label="로그인 또는 회원가입" className={styles.tabs}>
          <button type="button" role="tab" aria-selected={mode === 'login'} className={styles.tab}
            onClick={() => setMode('login')}>로그인</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={styles.tab}
            onClick={() => setMode('signup')}>회원가입</button>
        </div>
        <form className={styles.form} onSubmit={onSubmit}>
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
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
        <p className={styles.hint}>초대 링크로 들어왔다면 로그인 후 초대 화면으로 돌아갑니다.</p>
      </main>
    </div>
  )
}
