import { useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from './useMediaQuery'
import styles from './SaladBowlLoader.module.css'

// motion은 그 단계에 머무는 동안 반복하는 움직임이다(멈춘 것처럼 보이지 않게).
const STAGES = [
  { at: 0, message: '신선한 재료 찾는 중이에요', motion: 'seek' },
  { at: 8_000, message: '맛있게 섞는 중이에요', motion: 'stir' },
  { at: 30_000, message: '드레싱 넣는 중이에요', motion: 'dress' },
  { at: 90_000, message: '거의 다 됐어요, 조금만요', motion: 'wait' },
] as const
const FILL_STEP_MS = 120
const SETTLE_MS = 350

// 로고(public/logo.svg)의 도형. 배열 순서가 그리는 순서(뒤→앞)이고, step이 담기는 순서다.
// 가운데 잎은 마지막에 담기지만 양옆 잎 뒤에 그려야 로고와 같은 모양이 된다.
const PIECES: { id: string; step: number; pour?: boolean; node: ReactNode }[] = [
  { id: 'center', step: 3, node: <path d="M256 252c-38-36-40-104 0-148 40 44 38 112 0 148z" fill="#2f6b4f" /> },
  { id: 'left', step: 0, node: <path d="M244 256c-52 4-100-34-108-92 58-4 102 34 108 92z" fill="#8fcaa8" /> },
  { id: 'right', step: 1, node: <path d="M268 256c52 4 100-34 108-92-58-4-102 34-108 92z" fill="#5fa57f" /> },
  { id: 'tomato', step: 2, node: <circle cx="330" cy="240" r="30" fill="#ef8a6f" /> },
  { id: 'dressing', step: 2, pour: true, node: <path d="M160 214q30-20 60 0t60 0t60 0t60 0" pathLength={1} fill="none" stroke="#f2c14e" strokeWidth="10" strokeLinecap="round" /> },
]
const LAST = STAGES.length - 1

type Props = { slow?: boolean; done?: boolean; statusId?: string; onFinished?: () => void }

export default function SaladBowlLoader({ slow = false, done = false, statusId, onFinished }: Props) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [stage, setStage] = useState(0)
  // 완료 때 마저 담은 재료 수. 멘트는 시간 단계만 따른다(완료 중 멘트가 빠르게 바뀌지 않게).
  const [extra, setExtra] = useState(0)
  const filled = Math.min(LAST, stage + extra)
  if (!done && extra > 0) {
    // 닫히는 중 다시 켜지면 담긴 볼은 그대로 두고 멘트를 볼에 맞춘다.
    setStage(filled)
    setExtra(0)
  }

  useEffect(() => {
    if (done) return
    const timers = STAGES.slice(1).map(({ at }, index) => setTimeout(() => setStage((current) => Math.max(current, index + 1)), at))
    return () => timers.forEach(clearTimeout)
  }, [done])

  useEffect(() => {
    if (!done) return
    const timer = !reducedMotion && filled < LAST
      ? setTimeout(() => setExtra((current) => current + 1), FILL_STEP_MS)
      : setTimeout(() => onFinished?.(), reducedMotion ? 0 : SETTLE_MS)
    return () => clearTimeout(timer)
  }, [done, filled, reducedMotion, onFinished])

  // 완료 중에는 반복을 멈추고 남은 재료만 담는다.
  const motion = done ? undefined : STAGES[stage].motion
  return (
    <div className={styles.loader}>
      <svg viewBox="80 72 352 344" width="128" height="125" aria-hidden="true" className={styles.svg}>
        <g className={`${styles.scene} ${motion ? styles[motion] : ''}`} data-motion={motion}>
          {/* 이미 담긴 재료가 다시 떨어지지 않도록 key는 재료 id로 고정한다. */}
          {PIECES.filter((piece) => piece.step <= filled).map((piece) => (
            <g key={piece.id} data-piece={piece.pour ? undefined : ''}
              className={piece.pour ? styles.pour : `${styles.drop} ${piece.step === stage ? styles.latest : ''}`}>{piece.node}</g>
          ))}
          <path d="M96 244h320c0 88-72 152-160 152S96 332 96 244z" fill="#ffffff" stroke="var(--line)" strokeWidth="6" />
          <rect x="200" y="384" width="112" height="24" rx="12" fill="#ffffff" stroke="var(--line)" strokeWidth="6" />
        </g>
      </svg>
      <div role="status" id={statusId} className={styles.text}>
        <p className={styles.message}>{STAGES[stage].message}</p>
        {slow && <p className={styles.hint}>오래 쓰지 않았다면 서버가 깨어나는 데 최대 4분쯤 걸려요</p>}
      </div>
    </div>
  )
}
