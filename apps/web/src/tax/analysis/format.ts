import type { Category } from '../taxApi'

/** 소비구분 이름. 응답의 category 값과 같은 순서(일반 → 전통시장 → 대중교통 → 문화체육)다. */
export const CATEGORY_LABEL: Record<Category, string> = { GENERAL: '일반', MARKET: '전통시장', TRANSIT: '대중교통', CULTURE: '문화체육' }
/** 응답의 ByCategory 키와 소비구분. */
export const CATEGORY_KEYS = [['general', 'GENERAL'], ['market', 'MARKET'], ['transit', 'TRANSIT'], ['culture', 'CULTURE']] as const

/**
 * 표시용 비율(part ÷ whole × 100), 소수 첫째 자리 반올림(HALF_UP). 서버 methodShare와 같은 규칙이다.
 * 금액은 최대 약 10^14원이라 Number 곱셈이 안전 정수를 넘을 수 있어 BigInt로 셈한다. whole이 0이면 null.
 */
export function percent(part: number, whole: number): string | null {
  if (whole <= 0) return null
  const tenths = (BigInt(part) * 2000n + BigInt(whole)) / (2n * BigInt(whole))
  return `${tenths / 10n}.${tenths % 10n}%`
}

/** 자료 기준일. 서로 다르면 범위로 쓴다(TAX-27). */
export function asOfText(min: string | null, max: string | null): string {
  if (!min || !max) return '자료 없음'
  return min === max ? min : `${min} ~ ${max}`
}

const seoulDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

/** 세법 적용 시각(UTC ISO) → 서울 기준 `YYYY-MM-DD`. */
export function seoulDate(iso: string): string {
  return seoulDay.format(new Date(iso))
}
