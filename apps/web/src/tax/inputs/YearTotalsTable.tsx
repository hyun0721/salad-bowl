import { useAmountFormatter } from '../../common/AmountMask'
import ui from '../../common/ui.module.css'
import type { TaxYearView } from '../taxApi'
import { CATEGORIES } from './amounts'
import styles from './inputs.module.css'

const METHODS = [['credit', '신용카드'], ['debit', '체크카드'], ['cash', '현금영수증']] as const
type Method = (typeof METHODS)[number][0]
type Category = (typeof CATEGORIES)[number][0]

/**
 * 연도 합계표(결제수단 3 × 소비구분 4). 12칸은 서버 totals 그대로 쓰고 자료에서 다시 더하지 않는다.
 * 행·열 합계는 그 12칸을 더한 표시용 값이다. 좁은 화면은 합계 열 대신 소비구분 이름 아래 "계"를 둔다.
 */
export default function YearTotalsTable({ view }: { view: TaxYearView }) {
  const format = useAmountFormatter('expense')
  // 세 결제수단 열이 375px에 들어가도록 표 안에서는 ₩ 기호를 뺀다(단위는 표 제목에 적는다). 가린 값도 같다.
  const amount = (value: number) => (view.hasInputs ? format(value).replace('₩ ', '') : '—')
  const cell = (method: Method, category: Category) => view.totals[`${method}${category}`]
  const categoryTotal = (category: Category) => METHODS.reduce((sum, [method]) => sum + cell(method, category), 0)
  const methodTotal = (method: Method) => CATEGORIES.reduce((sum, [category]) => sum + cell(method, category), 0)
  const cashBlanks = view.cashReceipt ? view.cashReceipt.blankCount : 4
  const blanks = [
    ...view.cards.filter((card) => card.blankCount > 0).map((card) => `${card.issuerName} ${card.blankCount}칸`),
    ...(cashBlanks > 0 ? [`현금영수증 ${cashBlanks}칸`] : []),
  ]
  const dates = [
    ...view.cards.map((card) => `${card.issuerName} ${card.asOfDate}`),
    ...(view.cashReceipt ? [`현금영수증 ${view.cashReceipt.asOfDate}`] : []),
  ]

  return (
    <section aria-labelledby="tax-totals-title" className={ui.card}>
      <h2 id="tax-totals-title">연도 합계표</h2>
      {view.blankCount > 0 && (
        <p role="status" className={styles.warning}>
          미입력 칸이 있습니다({blanks.join(', ')}). 아래 합계는 입력한 칸만 더한 값이며 분석은 확정값으로 보여 주지 않습니다.
        </p>
      )}
      {view.asOfDateMismatch && (
        <p role="status" className={styles.warning}>
          자료의 기준일이 서로 다릅니다({dates.join(', ')}). 합계는 서로 다른 시점의 누계를 더한 값이며 분석에 "추정"이 붙습니다.
        </p>
      )}
      <div className={styles.tableScroll}>
        <table className={styles.totals}>
          <caption>{view.taxYear}년 귀속 자료의 합 · 단위 원</caption>
          <thead>
            <tr>
              <th scope="col">소비구분</th>
              {METHODS.map(([method, label]) => <th key={method} scope="col">{label}</th>)}
              <th scope="col" className={styles.wideOnly}>합계</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(([category, label]) => (
              <tr key={category}>
                <th scope="row">{label}<span className={styles.narrowOnly}>계 {amount(categoryTotal(category))}</span></th>
                {METHODS.map(([method]) => <td key={method}>{amount(cell(method, category))}</td>)}
                <td className={styles.wideOnly}>{amount(categoryTotal(category))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">합계</th>
              {METHODS.map(([method]) => <td key={method}>{amount(methodTotal(method))}</td>)}
              <td className={styles.wideOnly}>{amount(METHODS.reduce((sum, [method]) => sum + methodTotal(method), 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
