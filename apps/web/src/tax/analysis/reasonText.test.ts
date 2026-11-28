import { describe, expect, it } from 'vitest'
import { formatWon } from '../../common/format'
import { analysisView } from '../../test/taxFixtures'
import { reasonText } from './reasonText'

const { deduction, lawRates } = analysisView()
const context = { deduction: deduction!, rates: lawRates!, won: formatWon }
const high = { ...context, deduction: { ...deduction!, highBracket: true } }

describe('reasonText', () => {
  it('writes each reason only from the response codes and numbers', () => {
    expect(reasonText({ code: 'CREDIT_OVER_THRESHOLD', category: 'GENERAL', amount: 1_018_183 }, context))
      .toBe('일반: 현재 계획에서 신용카드로 쓸 금액(₩ 1,018,183)을 체크카드·현금영수증으로 옮겨요. 최저사용금액(₩ 12,500,000)을 넘는 사용분에는 체크카드·현금영수증 공제율 30%가 신용카드 15%보다 높아요.')
    expect(reasonText({ code: 'CREDIT_RATE_HIGHER', category: 'CULTURE', amount: 50_000 }, { ...context, rates: { ...lawRates!, rateCreditPct: 35 } }))
      .toBe('문화체육: 현재 계획에서 체크카드·현금영수증으로 쓸 금액(₩ 50,000)을 신용카드로 옮겨요. 이 세법은 신용카드 공제율(35%)이 체크카드·현금영수증(30%)보다 높아요.')
    expect(reasonText({ code: 'NO_FLEXIBLE_AMOUNT', category: null, amount: null }, context))
      .toBe('지출계획에 바꿀 수 있는 금액이 없어 결제수단을 바꿀 곳이 없어요.')
    expect(reasonText({ code: 'BELOW_THRESHOLD', category: null, amount: 700_001 }, context))
      .toBe('현재 누계와 지출계획을 더해도 전체 사용액이 최저사용금액(₩ 12,500,000) 이하라 공제액이 0원이에요. 최저사용금액까지 ₩ 700,001 남았어요.')
    expect(reasonText({ code: 'LIMIT_REACHED', category: null, amount: null }, context))
      .toBe('현재 계획으로 이미 공제 한도(기본한도와 추가한도)까지 공제돼요.')
    expect(reasonText({ code: 'METHOD_NEUTRAL', category: null, amount: null }, context))
      .toBe('바꿀 수 있는 금액이 결제수단과 무관하게 공제율이 같은 소비구분(전통시장·대중교통·문화체육)에만 있어요.')
    expect(reasonText({ code: 'METHOD_NEUTRAL', category: null, amount: null }, high))
      .toBe('바꿀 수 있는 금액이 결제수단과 무관하게 공제율이 같은 소비구분(전통시장·대중교통)에만 있어요.')
    expect(reasonText({ code: 'ALREADY_BEST', category: null, amount: null }, context))
      .toBe('현재 계획보다 연말 예상 소득공제액이 큰 배분이 없어요.')
  })

  it('follows the amount mask through the formatter it is given', () => {
    expect(reasonText({ code: 'BELOW_THRESHOLD', category: null, amount: 700_001 }, { ...context, won: () => '₩ •••••' }))
      .not.toMatch(/\d{3},\d{3}/)
  })
})
