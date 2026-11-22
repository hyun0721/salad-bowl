import type { Deduction, LawRates, Reason } from '../taxApi'
import { CATEGORY_LABEL } from './format'

type Context = { deduction: Deduction; rates: LawRates; won: (amount: number) => string }

/** 추천 이유는 응답 코드·금액·세법 수치만으로 쓰고, 금액은 화면의 가림 formatter를 따른다. */
export function reasonText({ code, category, amount }: Reason, { deduction: d, rates, won }: Context): string {
  const name = category ? CATEGORY_LABEL[category] : ''
  const money = amount === null ? '' : won(amount)
  switch (code) {
    case 'CREDIT_OVER_THRESHOLD':
      return `${name}: 현재 계획에서 신용카드로 쓸 금액(${money})을 체크카드·현금영수증으로 옮깁니다. `
        + `최저사용금액(${won(d.threshold)})을 넘는 사용분에는 체크카드·현금영수증 공제율 ${rates.rateDebitCashPct}%가 신용카드 ${rates.rateCreditPct}%보다 높습니다.`
    case 'CREDIT_RATE_HIGHER':
      return `${name}: 현재 계획에서 체크카드·현금영수증으로 쓸 금액(${money})을 신용카드로 옮깁니다. `
        + `이 세법은 신용카드 공제율(${rates.rateCreditPct}%)이 체크카드·현금영수증(${rates.rateDebitCashPct}%)보다 높습니다.`
    case 'NO_FLEXIBLE_AMOUNT':
      return '지출계획에 바꿀 수 있는 금액이 없어 결제수단을 바꿀 곳이 없습니다.'
    case 'BELOW_THRESHOLD':
      return `현재 누계와 지출계획을 더해도 전체 사용액이 최저사용금액(${won(d.threshold)}) 이하라 공제액이 0원입니다. 최저사용금액까지 ${money} 남았습니다.`
    case 'LIMIT_REACHED':
      return '현재 계획으로 이미 공제 한도(기본한도와 추가한도)까지 공제됩니다.'
    case 'METHOD_NEUTRAL':
      return `바꿀 수 있는 금액이 결제수단과 무관하게 공제율이 같은 소비구분(${d.highBracket ? '전통시장·대중교통' : '전통시장·대중교통·문화체육'})에만 있습니다.`
    case 'ALREADY_BEST':
      return '현재 계획보다 연말 예상 소득공제액이 큰 배분이 없습니다.'
  }
}
