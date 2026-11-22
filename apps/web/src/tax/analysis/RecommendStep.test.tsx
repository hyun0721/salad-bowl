import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import { analysisView, readyYearView, renderTaxAnalysis, serveAnalysis } from '../../test/taxFixtures'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

const base = analysisView().recommendation!

async function openRecommend() {
  const page = renderTaxAnalysis()
  await page.user.click(await screen.findByRole('tab', { name: '③ 추천' }))
  return { ...page, step: within(screen.getByRole('tabpanel', { name: '③ 추천' })) }
}

const rowOf = (table: HTMLElement, header: string) => within(table).getByRole('rowheader', { name: header }).closest('tr')

describe('RecommendStep — ③ 추천', () => {
  it('compares the current plan with the recommendation, with the difference, reason and assumptions', async () => {
    serveAnalysis(analysisView())
    const { step } = await openRecommend()

    expect(step.getByText(/^현재 계획:/)).toHaveTextContent('현재 계획: 지금까지의 결제수단 비율(신용 82.0% · 체크 14.6% · 현금 3.4%)')
    const table = step.getByRole('table')
    expect(rowOf(table, '일반 ₩ 1,200,000'))
      .toHaveTextContent(/신용카드 ₩ 1,018,183\s*체크카드 ₩ 145,454\s*현금영수증 ₩ 36,363\s*신용카드 ₩ 0\s*체크카드·현금영수증 ₩ 1,200,000/)
    expect(rowOf(table, '전통시장 ₩ 100,000')).toHaveTextContent(/신용카드 ₩ 50,001\s*체크카드 ₩ 33,333\s*현금영수증 ₩ 16,666\s*현재 계획 그대로/)
    expect(rowOf(table, '문화체육 ₩ 100,000')).toHaveTextContent(/신용카드 ₩ 50,000\s*체크카드 ₩ 50,000\s*현재 계획 그대로/)
    expect(within(table).queryByRole('rowheader', { name: /^대중교통/ })).not.toBeInTheDocument()
    expect(rowOf(table, '합계')).toHaveTextContent(/합계\s*₩ 1,400,000\s*₩ 1,400,000/)
    expect(rowOf(table, '연말 예상 소득공제액')).toHaveTextContent(/₩ 1,997,272\s*₩ 2,150,000/)
    expect(rowOf(table, '현재 계획 대비 차이')).toHaveTextContent('+₩ 152,728')
    expect(within(step.getByRole('region', { name: '이유' })).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['일반: 현재 계획에서 신용카드로 쓸 금액(₩ 1,018,183)을 체크카드·현금영수증으로 옮깁니다. 최저사용금액(₩ 12,500,000)을 넘는 사용분에는 체크카드·현금영수증 공제율 30%가 신용카드 15%보다 높습니다.'])
    const assumptions = within(step.getByRole('region', { name: '가정' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(assumptions[0]).toBe('예상 총급여 ₩ 50,000,000 · 2026년 귀속 세법 v1 · 자료 기준일 2026-06-30')
    expect(assumptions).toContain('카드 포인트·할인·연회비·전월실적은 고려하지 않습니다. 결과는 소득공제액이며 환급액이 아닙니다.')
  })

  it('says there is no difference and why, without the comparison table', async () => {
    serveAnalysis(analysisView({ recommendation: {
      ...base, recommended: { ...base.recommended, yearEndDeduction: 1_997_272 }, difference: 0,
      reasons: [{ code: 'METHOD_NEUTRAL', category: null, amount: null }],
    } }))
    const { step } = await openRecommend()

    expect(step.getByText(/결제수단을 바꿔도/)).toHaveTextContent('차이 없음 결제수단을 바꿔도 연말 예상 소득공제액(₩ 1,997,272)이 같습니다. 현재 계획을 유지합니다.')
    expect(step.queryByRole('table')).not.toBeInTheDocument()
    expect(within(step.getByRole('region', { name: '이유' })).getByRole('listitem'))
      .toHaveTextContent('바꿀 수 있는 금액이 결제수단과 무관하게 공제율이 같은 소비구분(전통시장·대중교통·문화체육)에만 있습니다.')
  })

  it('explains the current plan when there is no spending yet', async () => {
    serveAnalysis(analysisView({ recommendation: { ...base, methodShare: null } }))
    const { step } = await openRecommend()

    expect(step.getByText(/^현재 계획:/)).toHaveTextContent('현재 계획: 지금까지 사용액이 없어 바꿀 수 있는 금액을 모두 신용카드로 둡니다.')
  })

  it('explains why 체크카드 and 현금영수증 are one group in a help popover', async () => {
    serveAnalysis(analysisView())
    const { user, step } = await openRecommend()

    await user.click(step.getByRole('button', { name: '추천 결과 도움말' }))
    expect(await screen.findByRole('dialog', { name: '추천 결과 도움말' })).toHaveTextContent('공제율이 같아')
  })

  it('shows the blank count and a way to the inputs while the data is incomplete', async () => {
    serveAnalysis(analysisView({ status: 'INCOMPLETE', blankCount: 3, lawRates: null, deduction: null, recommendation: null }), readyYearView({ blankCount: 3 }))
    const { step } = await openRecommend()

    expect(step.getByRole('heading', { name: '자료를 완료하면 계산합니다' })).toBeInTheDocument()
    expect(step.getByText(/^빈 칸 3개/)).toBeInTheDocument()
    expect(step.getByRole('link', { name: '입력자료로 가기' })).toHaveAttribute('href', '/tax/inputs')
  })

  it('shows only 세법 준비 중 when the law is not ready', async () => {
    serveAnalysis(analysisView({ status: 'LAW_PENDING', law: null, lawRates: null, deduction: null, recommendation: null }), readyYearView({ lawVersion: null }))
    const { step } = await openRecommend()

    expect(step.getByRole('heading', { name: '세법 준비 중' })).toBeInTheDocument()
    expect(step.queryByText(/빈 칸/)).not.toBeInTheDocument()
    expect(step.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sends a year without a saved plan to ②', async () => {
    serveAnalysis(analysisView({ planSaved: false, recommendation: null }), readyYearView({ plan: null }))
    const { user, step } = await openRecommend()

    expect(step.getByRole('heading', { name: '지출계획을 저장하면 추천을 계산합니다' })).toBeInTheDocument()
    await user.click(step.getByRole('button', { name: '② 지출계획으로 가기' }))
    expect(screen.getByRole('tab', { name: '② 지출계획' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the recommendation of the saved plan until 계산하기, then shows the new one', async () => {
    serveAnalysis(analysisView())
    server.use(http.put('*/api/tax/years/2026/plan', () => {
      serveAnalysis(analysisView({ recommendation: { ...base, recommended: { ...base.recommended, yearEndDeduction: 2_100_000 }, difference: 102_728 } }))
      return HttpResponse.json(readyYearView())
    }))
    const { user, step } = await openRecommend()
    expect(rowOf(step.getByRole('table'), '현재 계획 대비 차이')).toHaveTextContent('+₩ 152,728')

    await user.click(screen.getByRole('tab', { name: '② 지출계획' }))
    const plan = within(screen.getByRole('tabpanel', { name: '② 지출계획' }))
    const flexible = within(plan.getByRole('group', { name: '일반' })).getByLabelText('바꿀 수 있음')
    await user.clear(flexible)
    await user.type(flexible, '1000000')
    await user.click(screen.getByRole('tab', { name: '③ 추천' }))
    const after = within(screen.getByRole('tabpanel', { name: '③ 추천' }))
    expect(rowOf(after.getByRole('table'), '현재 계획 대비 차이')).toHaveTextContent('+₩ 152,728')

    await user.click(screen.getByRole('tab', { name: '② 지출계획' }))
    await user.click(screen.getByRole('button', { name: '계산하기' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: '③ 추천' })).toHaveAttribute('aria-selected', 'true'))
    const updated = within(screen.getByRole('tabpanel', { name: '③ 추천' }))
    expect(rowOf(updated.getByRole('table'), '현재 계획 대비 차이')).toHaveTextContent('+₩ 102,728')
  })

  it('hides the amounts and the difference under the 지출 mask', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: true }))
    serveAnalysis(analysisView())
    const { step } = await openRecommend()

    expect(rowOf(step.getByRole('table'), '현재 계획 대비 차이')).toHaveTextContent('+₩ •••••')
    expect(step.getByRole('table')).not.toHaveTextContent('2,150,000')
    expect(step.getByText(/^현재 계획:/)).toHaveTextContent('신용 82.0%')
  })
})
