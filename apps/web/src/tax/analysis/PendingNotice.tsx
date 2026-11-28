import { Link } from 'react-router'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import type { TaxAnalysisView } from '../taxApi'

/**
 * 계산 결과 대신 보이는 안내(TAX-38·65·75). ① 현황과 ③ 추천이 같이 쓴다.
 * 자료가 없거나 미완료면 빈 칸 수와 [입력자료로 가기], 자료는 완료됐고 세법이 없으면 "세법 준비 중"만 보인다.
 */
export default function PendingNotice({ analysis }: { analysis: TaxAnalysisView }) {
  if (analysis.status === 'LAW_PENDING') {
    return (
      <section className={`${ui.card} ${inputs.empty}`}>
        <h2>세법 준비 중</h2>
        <p>{analysis.taxYear}년 귀속 세법이 등록되면 계산해요. 저장한 지출계획은 남아요.</p>
      </section>
    )
  }
  return (
    <section className={`${ui.card} ${inputs.empty}`}>
      <h2>자료를 완료하면 계산해요</h2>
      <p>
        빈 칸 {analysis.blankCount}개 · {analysis.status === 'NO_INPUT'
          ? '신용·체크 자료나 현금영수증 자료를 먼저 입력하세요.'
          : '저장하면 사용액이 없는 칸은 0원으로 채워져요.'}
      </p>
      <Link to="/tax/inputs" className={`${ui.button} ${ui.primary} ${ui.linkButton}`}>입력자료로 가기</Link>
    </section>
  )
}
