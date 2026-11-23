import { useState } from 'react'
import { useAmountFormatter } from '../../common/AmountMask'
import { formatWon } from '../../common/format'
import ui from '../../common/ui.module.css'
import { CATEGORIES } from '../inputs/amounts'
import inputs from '../inputs/inputs.module.css'
import type { Deduction, LawRates, SpendingTotals, TaxAnalysisView } from '../taxApi'
import { percent } from './format'
import PendingNotice from './PendingNotice'
import styles from './analysis.module.css'

/**
 * ① 현황(TAX-32~35, 43, 55, 71). 숫자는 서버 계산 결과이고, 비율·남은 여유만 화면이 그 값으로 나눈다·뺀다(표시용).
 * 자료가 미완료이거나 세법이 없으면 숫자 대신 안내를 보인다(TAX-38).
 */
export default function StatusStep({ analysis }: { analysis: TaxAnalysisView }) {
  const { deduction, lawRates } = analysis
  if (analysis.status !== 'READY' || !deduction || !lawRates) return <PendingNotice analysis={analysis} />
  return <Status analysis={analysis} d={deduction} rates={lawRates} />
}

function Status({ analysis: a, d, rates }: { analysis: TaxAnalysisView; d: Deduction; rates: LawRates }) {
  const won = useAmountFormatter('expense')
  const [open, setOpen] = useState(false)
  const reached = percent(d.total, d.threshold)
  return (
    <>
      <section aria-label="현재 요약" className={ui.card}>
        <dl className={styles.summary}>
          <div>
            <dt>소득공제액{a.estimated && <span className={`${styles.badge} ${styles.inlineBadge}`}>추정</span>}</dt>
            <dd className={styles.big}>{won(d.amount)}</dd>
            <dd className={styles.sub}>과세표준에서 빼는 금액 · 환급액 아님</dd>
          </div>
          <div>
            <dt>최저사용금액</dt>
            <dd className={styles.big}>{d.thresholdReached ? '달성' : '미달'}{reached && ` · ${reached}`}</dd>
            <dd className={styles.sub}>{won(d.total)} / {won(d.threshold)} (총급여의 {rates.minSpendRatePct}%)</dd>
          </div>
          <div>
            <dt>기본한도 사용</dt>
            <dd className={styles.big}>{percent(d.basicUsed, d.basicLimit) ?? '—'}</dd>
            <dd className={styles.sub}>{won(d.basicUsed)} / {won(d.basicLimit)} (공제액 기준)</dd>
          </div>
          <div>
            <dt>추가한도 사용</dt>
            <dd className={styles.big}>{percent(d.extraUsed, d.extraCap) ?? '—'}</dd>
            <dd className={styles.sub}>{won(d.extraUsed)} / {won(d.extraCap)} (전통시장·대중교통·문화체육)</dd>
          </div>
        </dl>
        {!d.thresholdReached && (
          <p className={ui.status}>최저사용금액까지 {won(d.remainingToThreshold)} 남았습니다. 전체 사용액이 최저사용금액을 넘어야 공제가 시작됩니다.</p>
        )}
      </section>
      <Shares year={a.taxYear} totals={a.totals} total={d.total} />
      <section aria-labelledby="tax-calc-title" className={ui.card}>
        <div className={inputs.split}>
          <h2 id="tax-calc-title">계산 과정</h2>
          <button type="button" className={ui.button} aria-expanded={open} aria-controls="tax-calc-steps" onClick={() => setOpen(!open)}>
            계산 과정 보기
          </button>
        </div>
        <div id="tax-calc-steps" hidden={!open}>
          <CalcSteps analysis={a} d={d} rates={rates} />
        </div>
      </section>
      <p className={ui.muted}>참고: 기본한도까지 남은 공제 여유 {won(d.basicLimit - d.basicUsed)}</p>
    </>
  )
}

/** 사용 비율(TAX-32~34). 분모는 연도 합계표 12칸의 합이고, 공제율·한도 사용률과 다른 숫자임을 적는다. */
function Shares({ year, totals: t, total }: { year: number; totals: SpendingTotals; total: number }) {
  const won = useAmountFormatter('expense')
  const byCategory = CATEGORIES.map(([key, label]) => [label, t[`credit${key}`] + t[`debit${key}`] + t[`cash${key}`]] as const)
  const sum = (method: 'credit' | 'debit' | 'cash') => CATEGORIES.reduce((n, [key]) => n + t[`${method}${key}`], 0)
  const byMethod = [['신용카드', sum('credit')], ['체크카드', sum('debit')], ['현금영수증', sum('cash')]] as const
  return (
    <section aria-labelledby="tax-share-title" className={ui.card}>
      <h2 id="tax-share-title">사용 비율</h2>
      <p className={ui.muted}>분모: {year}년 전체 입력 공제대상액 {won(total)}(연도 합계표 12칸의 합). 공제율·한도 사용률과 다른 숫자입니다.</p>
      {total === 0 ? <p className={ui.status}>입력 합계가 0원이라 비율을 계산하지 않습니다.</p> : (
        <>
          <ShareTable caption="소비구분별" rows={byCategory} total={total} />
          <ShareTable caption="결제수단별" rows={byMethod} total={total} />
          <p className={ui.muted}>소수 첫째 자리에서 반올림해 합이 100.0%가 아닐 수 있습니다.</p>
        </>
      )}
    </section>
  )
}

function ShareTable({ caption, rows, total }: { caption: string; rows: readonly (readonly [string, number])[]; total: number }) {
  return (
    <table className={styles.shares}>
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([label, amount]) => {
          const share = percent(amount, total) ?? '0.0%'
          return (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td aria-hidden="true"><span className={styles.bar}><span style={{ width: share }} /></span></td>
              <td>{share}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** [계산 과정 보기](TAX-71, D20). 최저사용금액 차감 → 공제율 적용 → 한도 순이고 마지막 금액은 소득공제액이다. 화면이 다시 계산하지 않는다. */
function CalcSteps({ analysis: a, d, rates }: { analysis: TaxAnalysisView; d: Deduction; rates: LawRates }) {
  const won = useAmountFormatter('expense')
  const income = useAmountFormatter('income')
  const parts: [string, number, number][] = [
    ['신용카드', d.credit, rates.rateCreditPct],
    ['체크카드·현금영수증', d.debitCash, rates.rateDebitCashPct],
    ...(d.highBracket ? [] : [['문화체육', d.culture, rates.rateCulturePct] as [string, number, number]]),
    ['전통시장', d.market, rates.rateMarketPct],
    ['대중교통', d.transit, rates.rateTransitPct],
  ]
  return (
    <div className={styles.calc}>
      <ol>
        <li>
          <h3>1. 최저사용금액 차감</h3>
          <dl>
            <dt>최저사용금액 = 총급여 {income(a.totalSalary)} × {rates.minSpendRatePct}%</dt><dd>{won(d.threshold)}</dd>
            <dt>전체 사용액(연도 합계표 12칸의 합)</dt><dd>{won(d.total)}</dd>
            {d.thresholdReached && <>
              <dt>차감액: 최저사용금액을 공제율이 낮은 사용분(신용카드 → 체크카드·현금영수증 → 문화체육 → 전통시장 → 대중교통)부터 채운 금액 × 공제율</dt>
              <dd>− {won(d.thresholdCut)}</dd>
            </>}
          </dl>
          {!d.thresholdReached && <p>전체 사용액이 최저사용금액 이하라 여기서 끝납니다. 소득공제액은 0원입니다.</p>}
        </li>
        {d.thresholdReached && <>
          <li>
            <h3>2. 공제율 적용</h3>
            <ul>{parts.map(([label, amount, rate]) => <li key={label}>{label} {won(amount)} × {rate}%</li>)}</ul>
            {d.highBracket && <p className={ui.muted}>총급여가 {formatWon(rates.bracketBoundary)}를 넘어 문화체육은 원래 결제수단의 일반으로 계산합니다.</p>}
            <dl>
              <dt>공제율을 곱한 합계</dt><dd>{won(d.beforeThresholdCut)}</dd>
              <dt>공제 가능 금액 = 합계 − 차감액</dt><dd>{won(d.deductible)}</dd>
            </dl>
          </li>
          <li>
            <h3>3. 한도</h3>
            <dl>
              <dt>기본한도</dt><dd>{won(d.basicLimit)}</dd>
              <dt>기본한도 안에서 인정</dt><dd>{won(d.basicUsed)}</dd>
              <dt>추가 인정액(전통시장·대중교통·문화체육 공제액 {won(d.extraEligible)}, 상한 {won(d.extraCap)})</dt><dd>{won(d.extraUsed)}</dd>
            </dl>
          </li>
        </>}
      </ol>
      <dl className={styles.calcTotal}>
        <dt>소득공제액 = 기본한도 안에서 인정 + 추가 인정액</dt><dd>{won(d.amount)}</dd>
      </dl>
    </div>
  )
}
