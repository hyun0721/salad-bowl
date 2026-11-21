import { apiFetch } from '../../api/client'

// PR 2 응답(TaxLawDtos.VersionResponse)과 같은 모양. 초안의 빈 칸은 null이다.
// rowVersion은 서버가 주는 불투명한 값이다. 받은 값을 그대로 돌려보내고 계산하지 않는다.
export type LawValues = {
  minSpendRatePct: number | null; bracketBoundary: number | null
  rateCreditPct: number | null; rateDebitCashPct: number | null; rateCulturePct: number | null
  rateMarketPct: number | null; rateTransitPct: number | null
  /** 자녀등 0명 / 1명 / 2명 이상 순서의 3칸. low는 급여구간 경계 이하, high는 초과. */
  basicLimitLow: (number | null)[]; basicLimitHigh: (number | null)[]
  extraLimitLow: number | null; extraLimitHigh: number | null
  basisLawName: string | null; basisArticle: string | null; basisUrl: string | null
  periodStart: string | null; periodEnd: string | null; memo: string | null
}
export type LawVersion = LawValues & {
  id: number; taxYear: number; versionNo: number; status: 'DRAFT' | 'APPLIED'; algorithmVersion: number; childTiersApply: boolean
  createdByNickname: string | null; appliedByNickname: string | null; createdAt: string; appliedAt: string | null; rowVersion: number
}

const BASE = '/tax/admin/law-versions'

export const taxLawApi = {
  list: (year: number) => apiFetch<LawVersion[]>(`${BASE}?year=${year}`),
  create: (taxYear: number) => apiFetch<LawVersion>(BASE, { method: 'POST', json: { taxYear } }),
}

/** 관리자 세법 목록 키. 머리말 `tax`라 그룹 범위 키가 아니고, 로그아웃 때 queryClient.clear()로 지워진다. */
export const taxLawKeys = {
  list: (year: number) => ['tax', 'admin', 'law', year] as const,
}

type LawField = { field: string; label: string; kind: 'pct' | 'won' | 'text' | 'url'; get: (v: LawValues) => number | string | null }

const TIERS = ['0명', '1명', '2명 이상']
const tiers = (key: 'basicLimitLow' | 'basicLimitHigh', side: string): LawField[] =>
  TIERS.map((tier, i) => ({ field: `${key}[${i}]`, label: `기본한도 · 경계 ${side} · 자녀등 ${tier}`, kind: 'won', get: (v) => v[key][i] }))

/** 화면에 보이는 설정값 순서와 이름. field는 서버 검증 오류(FieldError.field)의 이름과 같다. */
export const LAW_FIELDS: LawField[] = [
  { field: 'minSpendRatePct', label: '최저사용금액 비율', kind: 'pct', get: (v) => v.minSpendRatePct },
  { field: 'rateCreditPct', label: '신용카드 공제율', kind: 'pct', get: (v) => v.rateCreditPct },
  { field: 'rateDebitCashPct', label: '체크카드·현금영수증 공제율', kind: 'pct', get: (v) => v.rateDebitCashPct },
  { field: 'rateCulturePct', label: '문화체육 공제율', kind: 'pct', get: (v) => v.rateCulturePct },
  { field: 'rateMarketPct', label: '전통시장 공제율', kind: 'pct', get: (v) => v.rateMarketPct },
  { field: 'rateTransitPct', label: '대중교통 공제율', kind: 'pct', get: (v) => v.rateTransitPct },
  { field: 'bracketBoundary', label: '급여구간 경계 금액', kind: 'won', get: (v) => v.bracketBoundary },
  ...tiers('basicLimitLow', '이하'),
  ...tiers('basicLimitHigh', '초과'),
  { field: 'extraLimitLow', label: '추가한도 상한 · 경계 이하', kind: 'won', get: (v) => v.extraLimitLow },
  { field: 'extraLimitHigh', label: '추가한도 상한 · 경계 초과', kind: 'won', get: (v) => v.extraLimitHigh },
  { field: 'basisLawName', label: '법령명', kind: 'text', get: (v) => v.basisLawName },
  { field: 'basisArticle', label: '조문', kind: 'text', get: (v) => v.basisArticle },
  { field: 'basisUrl', label: '근거 URL', kind: 'url', get: (v) => v.basisUrl },
  { field: 'periodStart', label: '적용 대상 기간 시작', kind: 'text', get: (v) => v.periodStart },
  { field: 'periodEnd', label: '적용 대상 기간 끝', kind: 'text', get: (v) => v.periodEnd },
  { field: 'memo', label: '메모', kind: 'text', get: (v) => v.memo },
]

const seoulTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** 작성·적용 시각(오프셋 포함 ISO) → 서울 시간 `YYYY-MM-DD HH:mm`. 귀속연도와 다른 해에 만든 버전도 있어 연도를 남긴다. */
export function lawTime(iso: string): string {
  return seoulTime.format(new Date(iso))
}

/** 버전의 작성·적용 기록(TAX-67). 작성자·적용자 계정이 없어지면(FK `ON DELETE SET NULL`) 닉네임 자리에 `—`. */
export function lawHistory(v: LawVersion): string {
  const created = `작성 ${v.createdByNickname ?? '—'} · ${lawTime(v.createdAt)}`
  return v.appliedAt ? `${created} · 적용 ${v.appliedByNickname ?? '—'} · ${lawTime(v.appliedAt)}` : created
}
