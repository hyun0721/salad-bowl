import type { CardAmounts, CashAmounts } from '../taxApi'

export type AmountGroup<K extends string> = { legend: string; fields: { key: K; label: string }[] }

/** 소비구분. 응답 칸 이름의 뒷부분(creditGeneral, cashGeneral …)과 화면 이름. */
export const CATEGORIES = [['General', '일반'], ['Market', '전통시장'], ['Transit', '대중교통'], ['Culture', '문화체육']] as const

/** 신용·체크 자료 8칸: 소비구분 4묶음 × (신용카드, 체크카드). */
export const CARD_GROUPS: AmountGroup<keyof CardAmounts>[] = CATEGORIES.map(([key, label]) => ({
  legend: label,
  fields: [{ key: `credit${key}`, label: '신용카드' }, { key: `debit${key}`, label: '체크카드' }],
}))

/** 현금영수증 자료 4칸: 한 묶음 안의 소비구분 4칸. */
export const CASH_GROUPS: AmountGroup<keyof CashAmounts>[] = [{
  legend: '현금영수증',
  fields: [{ key: 'general', label: '일반' }, { key: 'market', label: '전통시장' }, { key: 'transit', label: '대중교통' }, { key: 'culture', label: '문화체육' }],
}]

export const EMPTY_CARD: CardAmounts = {
  creditGeneral: null, creditMarket: null, creditTransit: null, creditCulture: null,
  debitGeneral: null, debitMarket: null, debitTransit: null, debitCulture: null,
}
export const EMPTY_CASH: CashAmounts = { general: null, market: null, transit: null, culture: null }

/** 저장할 때 빈 칸만 0으로 바꾼다. 입력한 값은 그대로 둔다. */
export function fillBlanks<T extends Record<string, number | null>>(values: T): T {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? 0])) as T
}

/** 자료 한 건의 표시용 합계. 빈 칸은 0으로 더한다(서버 연도 합계표와 같은 규칙). */
export function sumAmounts(values: Record<string, number | null>): number {
  return Object.values(values).reduce<number>((sum, value) => sum + (value ?? 0), 0)
}
