import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../common/errorMessage'
import { safeNext } from '../common/safeNext'
import Tabs from '../common/Tabs'
import TextField from '../common/TextField'
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

  const target = safeNext(params.get('next'))

  function changeMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
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

  const form = (
    <form className={styles.form} onSubmit={onSubmit}>
      <TextField label="이메일" type="email" autoComplete="email" isRequired
        value={email} onChange={setEmail} className={styles.field} />
      <TextField label={`비밀번호${mode === 'signup' ? ' (8~64자)' : ''}`} type="password" isRequired
        minLength={mode === 'signup' ? 8 : undefined} maxLength={64}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={password} onChange={setPassword} className={styles.field} />
      {mode === 'signup' && (
        <TextField label="닉네임 (그룹에서 보이는 이름)" isRequired maxLength={50}
          value={nickname} onChange={setNickname} className={styles.field} />
      )}
      <button type="submit" className={styles.submit} disabled={busy}>
        {mode === 'login' ? '로그인' : '가입하고 시작하기'}
      </button>
    </form>
  )

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.name}><img src="/logo.svg" alt="" width="36" height="36" />Salad Bowl</span>
          <p className={styles.lead}>뱅크샐러드 가계부를 가족·친구와 함께 봅니다.</p>
        </div>
        <Tabs label="로그인 또는 회원가입" tabs={MODES.map((m) => ({ id: m, label: TAB_LABEL[m] }))}
          selectedKey={mode} onSelectionChange={(id) => changeMode(id as Mode)} className={styles.authTabs}>
          {() => form}
        </Tabs>
        {/* 탭 패널은 선택된 것만 그리므로, 안내·오류는 패널 바깥에 둬서 탭이 바뀌어도 스크린리더가 읽게 한다. */}
        <p role="status" className={notice ? styles.notice : styles.noticeEmpty}>{notice}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <p className={styles.hint}>초대 링크로 들어왔다면 로그인 후 초대 화면으로 돌아갑니다.</p>
      </main>
    </div>
  )
}
