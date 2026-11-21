import { http, HttpResponse } from 'msw'
import type { Me } from '../auth/authApi'
import TaxLawPage from '../tax/law/TaxLawPage'
import type { LawVersion } from '../tax/law/taxLawApi'
import type { CurrentLaw } from '../tax/taxApi'
import { TaxYearProvider } from '../tax/TaxYearProvider'
import { renderPage, testMe } from './renderPage'
import { server } from './server'
import { law2026, taxToday } from './taxFixtures'

// 세법 관리 화면 테스트용. 수치는 PRD 8.1절의 공개 법령 값, 닉네임·메모는 합성값이다.
export const adminMe: Me = { ...testMe, serviceAdmin: true }

/** 적용본 v1. 시각은 서울 기준 작성 2026-01-10 09:00, 적용 2026-01-15 10:00이다. */
export function lawVersion(overrides: Partial<LawVersion> = {}): LawVersion {
  return {
    id: 1, taxYear: 2026, versionNo: 1, status: 'APPLIED', algorithmVersion: 1,
    minSpendRatePct: 25, bracketBoundary: 70_000_000,
    rateCreditPct: 15, rateDebitCashPct: 30, rateCulturePct: 30, rateMarketPct: 40, rateTransitPct: 40,
    basicLimitLow: [3_000_000, 3_500_000, 4_000_000], basicLimitHigh: [2_500_000, 2_750_000, 3_000_000],
    extraLimitLow: 3_000_000, extraLimitHigh: 2_000_000, childTiersApply: true,
    basisLawName: '조세특례제한법', basisArticle: '제126조의2', basisUrl: 'https://www.law.go.kr/',
    periodStart: '2026-01-01', periodEnd: '2026-12-31', memo: '합성 메모',
    createdByNickname: '관리자가', appliedByNickname: '관리자나', createdAt: '2026-01-10T00:00:00Z', appliedAt: '2026-01-15T01:00:00Z',
    rowVersion: 11,
    ...overrides,
  }
}

/** 초안. 적용자·적용 시각이 없다. */
export function lawDraft(overrides: Partial<LawVersion> = {}): LawVersion {
  return lawVersion({ status: 'DRAFT', appliedByNickname: null, appliedAt: null, ...overrides })
}

const notFound = () => HttpResponse.json({ code: 'NOT_FOUND', message: 'not found' }, { status: 404 })

/** 관리자 버전 목록(요청한 연도의 것만)과 회원용 현재 적용 세법. 요청 횟수를 센다. */
export function serveLaw(versions: LawVersion[], current: CurrentLaw | null = law2026) {
  const calls = { list: 0, current: 0, years: [] as number[] }
  server.use(
    http.get('*/api/tax/admin/law-versions', ({ request }) => {
      calls.list++
      const year = Number(new URL(request.url).searchParams.get('year'))
      calls.years.push(year)
      return HttpResponse.json(versions.filter((version) => version.taxYear === year))
    }),
    http.get('*/api/tax/law-versions/current', () => {
      calls.current++
      return current ? HttpResponse.json(current) : notFound()
    }),
  )
  return calls
}

export function renderTaxLaw({ admin = true }: { admin?: boolean } = {}) {
  return renderPage(<TaxYearProvider today={taxToday}><TaxLawPage /></TaxYearProvider>, { me: admin ? adminMe : testMe, path: '/tax/law' })
}
