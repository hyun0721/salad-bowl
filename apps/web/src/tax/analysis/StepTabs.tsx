import { useEffect, useRef, type ReactNode } from 'react'
import Tabs from '../../common/Tabs'
import ui from '../../common/ui.module.css'
import styles from './analysis.module.css'

export type Step = 'status' | 'plan' | 'recommend'
const STEPS: { id: Step; label: string }[] = [
  { id: 'status', label: '① 현황' }, { id: 'plan', label: '② 지출계획' }, { id: 'recommend', label: '③ 추천' },
]

type Props = { step: Step; onStepChange: (step: Step) => void; children: (step: Step) => ReactNode }

/**
 * 분석·지출계획의 단계(TAX-73). 모든 폭에서 고른 단계 하나만 그리고, 단계 탭이나 [이전]·[다음]으로 옮긴다.
 * 단계가 바뀌면 고른 단계 탭으로 포커스를 옮겨 아래쪽 버튼을 누른 뒤에도 새 단계의 처음부터 읽게 한다.
 */
export default function StepTabs({ step, onStepChange, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const shown = useRef(step)
  useEffect(() => {
    if (shown.current === step) return
    shown.current = step
    box.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
  }, [step])
  const index = STEPS.findIndex((s) => s.id === step)
  const prev = STEPS[index - 1]
  const next = STEPS[index + 1]
  return (
    <div ref={box}>
      <Tabs label="분석 단계" tabs={STEPS} selectedKey={step} onSelectionChange={(id) => onStepChange(id as Step)} className={styles.steps}>
        {(id) => (
          <div className={styles.panel}>
            {children(id as Step)}
            <div className={styles.stepNav}>
              {prev && <button type="button" className={ui.button} onClick={() => onStepChange(prev.id)}>이전</button>}
              {next && <button type="button" className={`${ui.button} ${styles.next}`} onClick={() => onStepChange(next.id)}>다음</button>}
            </div>
          </div>
        )}
      </Tabs>
    </div>
  )
}
