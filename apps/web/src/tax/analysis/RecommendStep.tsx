import { useAmountFormatter } from '../../common/AmountMask'
import HelpButton from '../../common/HelpButton'
import ui from '../../common/ui.module.css'
import inputs from '../inputs/inputs.module.css'
import type { Deduction, LawRates, Recommendation, TaxAnalysisView } from '../taxApi'
import { asOfText, CATEGORY_KEYS, CATEGORY_LABEL } from './format'
import PendingNotice from './PendingNotice'
import { reasonText } from './reasonText'
import styles from './analysis.module.css'

type Props = { analysis: TaxAnalysisView; onPlan: () => void }

/** ③ 추천. 저장된 계획을 기준으로 서버에서 계산한 결과를 그린다. */
export default function RecommendStep({ analysis, onPlan }: Props) {
  const { deduction, lawRates, recommendation } = analysis
  if (analysis.status !== 'READY' || !deduction || !lawRates) return <PendingNotice analysis={analysis} />
  if (!recommendation) {
    return (
      <section className={`${ui.card} ${inputs.empty}`}>
        <h2>지출계획을 저장하면 추천을 계산합니다</h2>
        <p>② 지출계획에 남은 기간의 예상 공제대상액을 적고 [계산하기]를 누르세요.</p>
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={onPlan}>② 지출계획으로 가기</button>
      </section>
    )
  }
  return <Result analysis={analysis} d={deduction} rates={lawRates} r={recommendation} />
}

function Result({ analysis: a, d, rates, r }: { analysis: TaxAnalysisView; d: Deduction; rates: LawRates; r: Recommendation }) {
  const won = useAmountFormatter('expense')
  const signed = useAmountFormatter('expense', true)
  const income = useAmountFormatter('income')
  const share = r.methodShare
  const rows = CATEGORY_KEYS.map(([key, code]) => ({ key, label: CATEGORY_LABEL[code], now: r.current.allocation[key], best: r.recommended.allocation[key] }))
    .filter((row) => row.now.credit + row.now.debit + row.now.cash > 0)
  const asOf = asOfText(a.asOfDateMin, a.asOfDateMax)
  return (
    <section aria-labelledby="tax-reco-title" className={ui.card}>
      <div className={inputs.titleWithHelp}>
        <h2 id="tax-reco-title">추천 결과</h2>
        <HelpButton title="추천 결과">
          체크카드와 현금영수증은 공제율이 같아 추천에서는 한 묶음으로 다룹니다. 어느 쪽으로 써도 연말 예상 소득공제액이 같습니다.
        </HelpButton>
      </div>
      <p>
        {share
          ? `현재 계획: 지금까지의 결제수단 비율(신용 ${share.creditPct.toFixed(1)}% · 체크 ${share.debitPct.toFixed(1)}% · 현금 ${share.cashPct.toFixed(1)}%)`
          : '현재 계획: 지금까지 사용액이 없어 바꿀 수 있는 금액을 모두 신용카드로 둡니다.'}
      </p>
      <p className={ui.muted}>연도 전체 비율입니다. 표의 현재 계획 금액은 소비구분마다 그 소비구분의 지금까지 비율로 나눈 값이라 이 비율과 다를 수 있습니다.</p>
      {r.difference > 0 ? (
        <div className={inputs.tableScroll}>
          <table className={styles.allocation}>
            <caption>남은 기간 바꿀 수 있는 금액의 배분과 연말 예상 소득공제액(현재 누계 + 지출계획)</caption>
            <thead><tr><th scope="col">바꿀 수 있는 금액</th><th scope="col">현재 계획</th><th scope="col">추천 배분</th></tr></thead>
            <tbody>
              {rows.map(({ key, label, now, best }) => (
                <tr key={key}>
                  <th scope="row">{label} {won(now.credit + now.debit + now.cash)}</th>
                  <td>
                    {([['신용카드', now.credit], ['체크카드', now.debit], ['현금영수증', now.cash]] as const)
                      .filter(([, amount]) => amount > 0).map(([method, amount]) => <span key={method} className={styles.line}>{method} {won(amount)}</span>)}
                  </td>
                  <td>
                    {best.credit === now.credit ? '현재 계획 그대로' : <>
                      <span className={styles.line}>신용카드 {won(best.credit)}</span>
                      <span className={styles.line}>체크카드·현금영수증 {won(best.debitCash)}</span>
                    </>}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row">합계</th>
                <td>{won(rows.reduce((n, { now }) => n + now.credit + now.debit + now.cash, 0))}</td>
                <td>{won(rows.reduce((n, { best }) => n + best.credit + best.debitCash, 0))}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr><th scope="row">연말 예상 소득공제액</th><td>{won(r.current.yearEndDeduction)}</td><td>{won(r.recommended.yearEndDeduction)}</td></tr>
              <tr><th scope="row">현재 계획 대비 차이</th><td colSpan={2}>{signed(r.difference)}</td></tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p>
          <span className={styles.badge}>차이 없음</span> 결제수단을 바꿔도 연말 예상 소득공제액({won(r.current.yearEndDeduction)})이 같습니다. 현재 계획을 유지합니다.
        </p>
      )}
      <section aria-labelledby="tax-reco-reasons" className={styles.subsection}>
        <h3 id="tax-reco-reasons">이유</h3>
        <ul>{r.reasons.map((reason) => <li key={`${reason.code}:${reason.category}`}>{reasonText(reason, { deduction: d, rates, won })}</li>)}</ul>
      </section>
      <section aria-labelledby="tax-reco-assumptions" className={styles.subsection}>
        <h3 id="tax-reco-assumptions">가정</h3>
        <ul className={styles.assumptions}>
          <li>{`예상 총급여 ${income(a.totalSalary)} · ${a.taxYear}년 귀속 세법 v${a.law?.versionNo} · 자료 기준일 ${a.estimated ? `${asOf}(서로 다름, 추정)` : asOf}`}</li>
          <li>현재 계획은 바꿀 수 있는 금액을 소비구분마다 지금까지의 결제수단 비율로 나눈 것입니다. 원 미만은 내리고 남는 원은 신용카드에 더합니다.</li>
          <li>남은 기간 총액과 소비구분별 금액은 그대로 두고, 바꿀 수 있는 금액의 결제수단만 비교했습니다.</li>
          <li>카드 포인트·할인·연회비·전월실적은 고려하지 않습니다. 결과는 소득공제액이며 환급액이 아닙니다.</li>
        </ul>
      </section>
    </section>
  )
}
