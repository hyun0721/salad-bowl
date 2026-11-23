import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import { analysisView, readyYearView, renderTaxAnalysis, serveAnalysis } from '../../test/taxFixtures'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

const v2 = { id: 2, versionNo: 2, appliedAt: '2026-03-02T01:00:00Z', childTiersApply: true }

describe('TaxAnalysisPage — 단계 틀과 상태 알림', () => {
  it('shows one step at a time, starting at ①, and moves with the step tabs and 이전/다음', async () => {
    serveAnalysis(analysisView())
    const { user } = renderTaxAnalysis()

    const steps = await screen.findByRole('tablist', { name: '분석 단계' })
    expect(within(steps).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['① 현황', '② 지출계획', '③ 추천'])
    expect(screen.getByRole('tab', { name: '① 현황' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel', { name: '① 현황' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByRole('tab', { name: '② 지출계획' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '② 지출계획' })).toHaveFocus()
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)

    await user.click(screen.getByRole('tab', { name: '③ 추천' }))
    expect(screen.getByRole('tabpanel', { name: '③ 추천' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '이전' }))
    expect(screen.getByRole('tab', { name: '② 지출계획' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the applied law, data date and salary in one line under the personal-data note', async () => {
    serveAnalysis(analysisView())
    renderTaxAnalysis()

    expect(await screen.findByText(/^적용 세법/))
      .toHaveTextContent('적용 세법 2026년 귀속 v1 · 적용일 2026-01-15 · 자료 기준일 2026-06-30 · 예상 총급여 ₩ 50,000,000')
    expect(screen.getByText('개인 자료 · 그룹과 무관')).toBeInTheDocument()
    expect(screen.queryByText(/자료의 기준일이 서로 다릅니다/)).not.toBeInTheDocument()
    expect(screen.queryByText(/근로기간이/)).not.toBeInTheDocument()
    expect(screen.queryByText(/새 세법 버전이 적용됐습니다/)).not.toBeInTheDocument()
  })

  it('marks an estimate with its reason and asks to check the work months', async () => {
    serveAnalysis(analysisView({ estimated: true, asOfDateMin: '2026-05-31', partialYear: true }), readyYearView({ workStartMonth: 4 }))
    renderTaxAnalysis()

    expect(await screen.findByText(/^적용 세법/)).toHaveTextContent('자료 기준일 2026-05-31 ~ 2026-06-30')
    expect(screen.getByText(/자료의 기준일이 서로 다릅니다/))
      .toHaveTextContent('추정 자료의 기준일이 서로 다릅니다(2026-05-31 ~ 2026-06-30). 서로 다른 시점의 누계를 더한 추정입니다.')
    expect(screen.getByText(/근로기간이/))
      .toHaveTextContent('근로기간 확인 필요 근로기간이 4월~12월입니다. 근로기간에 쓴 금액만 입력했는지 확인하세요. 계산은 입력한 금액 그대로 합니다.')
  })

  it('says the law is not ready instead of a version', async () => {
    serveAnalysis(analysisView({ status: 'LAW_PENDING', law: null, lawRates: null, deduction: null, recommendation: null }), readyYearView({ lawVersion: null }))
    renderTaxAnalysis()

    expect(await screen.findByText(/^적용 세법/)).toHaveTextContent('적용 세법 2026년 귀속 세법 준비 중 · 자료 기준일 2026-06-30')
  })

  it('keeps the old result until the member asks to recalculate with the newer law', async () => {
    serveAnalysis(analysisView({ newerLawVersion: true }))
    let refreshed = 0
    server.use(http.post('*/api/tax/years/2026/law-version/refresh', () => {
      refreshed++
      serveAnalysis(analysisView({ law: v2 }), readyYearView({ lawVersion: v2 }))
      return HttpResponse.json(readyYearView({ lawVersion: v2 }))
    }))
    const { user } = renderTaxAnalysis()

    expect(await screen.findByText(/새 세법 버전이 적용됐습니다/)).toHaveTextContent('지금 결과는 v1 기준이며, 누르기 전에는 그대로입니다.')
    expect(screen.getByText(/^적용 세법/)).toHaveTextContent('v1 · 적용일 2026-01-15')
    expect(refreshed).toBe(0)
    await user.click(screen.getByRole('button', { name: '새 버전으로 다시 계산' }))

    await waitFor(() => expect(screen.getByText(/^적용 세법/)).toHaveTextContent('v2 · 적용일 2026-03-02'))
    expect(refreshed).toBe(1)
    expect(screen.queryByText(/새 세법 버전이 적용됐습니다/)).not.toBeInTheDocument()
  })

  it('guides a year without a record to the inputs page and shows no steps', async () => {
    serveAnalysis(null)
    renderTaxAnalysis()

    expect(await screen.findByRole('heading', { name: '2026년 귀속 기록이 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '입력자료로 가기' })).toHaveAttribute('href', '/tax/inputs')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('shows a retry when the analysis fails to load', async () => {
    let fail = true
    serveAnalysis(analysisView())
    server.use(http.get('*/api/tax/years/:year/analysis', () => (fail
      ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
      : HttpResponse.json(analysisView()))))
    const { user } = renderTaxAnalysis()

    expect(await screen.findByRole('alert')).toHaveTextContent('분석을 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('tablist', { name: '분석 단계' })).toBeInTheDocument()
  })
})
