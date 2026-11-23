import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import { analysisView, readyYearView, renderTaxAnalysis, samplePlan, serveAnalysis } from '../../test/taxFixtures'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

const savedBody = {
  general: { creditFixed: 500_000, debitFixed: 300_000, flexible: 900_000 },
  market: { creditFixed: 0, debitFixed: 100_000, flexible: 100_000 },
  transit: { creditFixed: 100_000, debitFixed: 0, flexible: 0 },
  culture: { creditFixed: 0, debitFixed: 0, flexible: 100_000 },
}

async function openPlan() {
  const page = renderTaxAnalysis()
  await page.user.click(await screen.findByRole('tab', { name: '② 지출계획' }))
  const step = within(screen.getByRole('tabpanel', { name: '② 지출계획' }))
  const field = (group: string, label: string) => within(within(screen.getByRole('tabpanel', { name: '② 지출계획' })).getByRole('group', { name: group })).getByLabelText(label)
  return { ...page, step, field }
}

async function chooseYear(user: ReturnType<typeof renderTaxAnalysis>['user'], year: number) {
  const current = Number(within(screen.getByRole('group', { name: '귀속연도' })).getByText(/^\d{4}년$/).textContent?.slice(0, 4))
  await user.click(screen.getByRole('button', { name: year > current ? '다음 연도' : '이전 연도' }))
}

describe('PlanStep — ② 지출계획', () => {
  it('shows the saved plan as 4 category groups × 3 amounts with automatic sums', async () => {
    serveAnalysis(analysisView())
    const { step, field } = await openPlan()

    // 금액 칸(RAC NumberField)도 group이라 fieldset만 고른다.
    const groups = step.getAllByRole('group').filter((group) => group.tagName === 'FIELDSET')
    expect(groups.map((group) => group.querySelector('legend')?.textContent)).toEqual(['일반', '전통시장', '대중교통', '문화체육'])
    expect(within(step.getByRole('group', { name: '일반' })).getAllByRole('textbox')).toHaveLength(3)
    expect(field('일반', '신용카드 고정')).toHaveValue('500,000')
    expect(field('일반', '체크카드·현금영수증 고정')).toHaveValue('300,000')
    expect(field('일반', '바꿀 수 있음')).toHaveValue('1,200,000')
    expect(step.getByRole('group', { name: '일반' })).toHaveTextContent('합계 ₩ 2,000,000')
    expect(step.getByText(/^총액/)).toHaveTextContent('총액 ₩ 2,400,000 (신용카드 고정 ₩ 600,000 · 체크카드·현금영수증 고정 ₩ 400,000 · 바꿀 수 있음 ₩ 1,400,000)')
  })

  it('does not save while editing and keeps the edits across steps', async () => {
    const calls = serveAnalysis(analysisView())
    let puts = 0
    server.use(http.put('*/api/tax/years/2026/plan', () => { puts++; return HttpResponse.json(readyYearView()) }))
    const { user, step, field } = await openPlan()

    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.tab()
    expect(step.getByText('저장하지 않은 변경이 있습니다. ③ 추천은 마지막으로 저장한 계획 기준입니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '③ 추천' }))
    await user.click(screen.getByRole('tab', { name: '② 지출계획' }))

    const plan = within(screen.getByRole('tabpanel', { name: '② 지출계획' }))
    expect(within(plan.getByRole('group', { name: '일반' })).getByLabelText('바꿀 수 있음')).toHaveValue('900,000')
    expect(puts).toBe(0)
    expect(calls.analysis).toBe(1)
  })

  it('saves on 계산하기 with the opened version, recalculates and moves to ③', async () => {
    serveAnalysis(analysisView())
    let body: unknown
    let after: { analysis: number } | undefined
    server.use(http.put('*/api/tax/years/2026/plan', async ({ request }) => {
      body = await request.json()
      const saved = readyYearView({ plan: { ...samplePlan, ...savedBody, rowVersion: 56 } })
      after = serveAnalysis(analysisView(), saved)
      return HttpResponse.json(saved)
    }))
    const { user, field } = await openPlan()

    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.click(screen.getByRole('button', { name: '계산하기' }))

    await waitFor(() => expect(screen.getByRole('tab', { name: '③ 추천' })).toHaveAttribute('aria-selected', 'true'))
    expect(body).toEqual({ ...savedBody, rowVersion: 55 })
    expect(after?.analysis).toBe(1)
    expect(await screen.findByText('지출계획을 저장했습니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '② 지출계획' }))
    const plan = within(screen.getByRole('tabpanel', { name: '② 지출계획' }))
    expect(within(plan.getByRole('group', { name: '일반' })).getByLabelText('바꿀 수 있음')).toHaveValue('900,000')
    expect(plan.queryByText(/저장하지 않은 변경/)).not.toBeInTheDocument()
  })

  it('starts a first plan at 0원 and creates it without a version', async () => {
    serveAnalysis(analysisView({ planSaved: false, recommendation: null }), readyYearView({ plan: null }))
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/plan', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(readyYearView())
    }))
    const { user, field } = await openPlan()

    expect(field('문화체육', '바꿀 수 있음')).toHaveValue('0')
    await user.click(screen.getByRole('button', { name: '계산하기' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({
      general: { creditFixed: 0, debitFixed: 0, flexible: 0 }, market: { creditFixed: 0, debitFixed: 0, flexible: 0 },
      transit: { creditFixed: 0, debitFixed: 0, flexible: 0 }, culture: { creditFixed: 0, debitFixed: 0, flexible: 0 },
    })
  })

  it('keeps the plan open while the data is incomplete and only saves it', async () => {
    serveAnalysis(analysisView({ status: 'INCOMPLETE', blankCount: 3, lawRates: null, deduction: null, recommendation: null }), readyYearView({ blankCount: 3 }))
    let puts = 0
    server.use(http.put('*/api/tax/years/2026/plan', () => { puts++; return HttpResponse.json(readyYearView({ blankCount: 3 })) }))
    const { user, step } = await openPlan()

    expect(step.getByText('자료가 완료되지 않았거나 세법이 준비 중이라 [계산하기]는 지출계획을 저장만 합니다.')).toBeInTheDocument()
    await user.click(step.getByRole('button', { name: '계산하기' }))

    await waitFor(() => expect(screen.getByRole('tab', { name: '③ 추천' })).toHaveAttribute('aria-selected', 'true'))
    expect(puts).toBe(1)
  })

  it('saves blank plan cells as 0 while preserving other amounts', async () => {
    serveAnalysis(analysisView())
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/plan', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(readyYearView())
    }))
    const { user, step, field } = await openPlan()
    await user.clear(field('일반', '신용카드 고정'))
    await user.clear(field('전통시장', '신용카드 고정'))
    await user.clear(field('대중교통', '바꿀 수 있음'))
    await user.clear(field('문화체육', '바꿀 수 있음'))
    await user.tab()

    expect(step.getByRole('button', { name: '계산하기' })).toBeEnabled()
    expect(step.getByText('비운 칸은 0원으로 저장됩니다.')).toBeInTheDocument()
    await user.click(step.getByRole('button', { name: '계산하기' }))
    await waitFor(() => expect(body).toEqual({
      general: { creditFixed: 0, debitFixed: 300_000, flexible: 1_200_000 },
      market: { creditFixed: 0, debitFixed: 100_000, flexible: 100_000 },
      transit: { creditFixed: 100_000, debitFixed: 0, flexible: 0 },
      culture: { creditFixed: 0, debitFixed: 0, flexible: 0 },
      rowVersion: 55,
    }))
  })

  it('keeps the edits on a conflict and reloads the newer plan on request', async () => {
    serveAnalysis(analysisView())
    server.use(http.put('*/api/tax/years/2026/plan', () => {
      serveAnalysis(analysisView(), readyYearView({ plan: { ...samplePlan, general: { creditFixed: 700_000, debitFixed: 0, flexible: 0 }, rowVersion: 60 } }))
      return HttpResponse.json({ code: 'CONFLICT', message: 'x' }, { status: 409 })
    }))
    const { user, step, field } = await openPlan()

    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.click(step.getByRole('button', { name: '계산하기' }))

    expect(await step.findByRole('alert')).toHaveTextContent('다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다.')
    expect(field('일반', '바꿀 수 있음')).toHaveValue('900,000')
    expect(screen.getByRole('tab', { name: '② 지출계획' })).toHaveAttribute('aria-selected', 'true')
    await user.click(step.getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => expect(field('일반', '신용카드 고정')).toHaveValue('700,000'))
    expect(field('일반', '바꿀 수 있음')).toHaveValue('0')
    expect(step.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the edits and says so when saving fails for another reason', async () => {
    serveAnalysis(analysisView())
    server.use(http.put('*/api/tax/years/2026/plan', () => HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })))
    const { user, step, field } = await openPlan()

    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.click(step.getByRole('button', { name: '계산하기' }))

    expect(await step.findByRole('alert')).toHaveTextContent('입력한 값은 그대로 있습니다.')
    expect(field('일반', '바꿀 수 있음')).toHaveValue('900,000')
  })

  it('does not carry an unsaved edit into another year', async () => {
    serveAnalysis(analysisView())
    server.use(
      http.get('*/api/tax/years/2025', () => HttpResponse.json(readyYearView({ taxYear: 2025, plan: { ...samplePlan, general: { ...samplePlan.general, flexible: 300_000 } } }))),
      http.get('*/api/tax/years/2025/analysis', () => HttpResponse.json(analysisView({ taxYear: 2025 }))),
    )
    const { user, field } = await openPlan()
    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')

    await chooseYear(user, 2025)
    await waitFor(() => expect(field('일반', '바꿀 수 있음')).toHaveValue('300,000'))
  })

  it('keeps the edit and offers reload when saving returns 404', async () => {
    serveAnalysis(analysisView())
    server.use(http.put('*/api/tax/years/2026/plan', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })))
    const { user, step, field } = await openPlan()
    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.click(step.getByRole('button', { name: '계산하기' }))

    expect(await step.findByRole('alert')).toHaveTextContent('저장하지 않았습니다.')
    expect(step.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
    expect(field('일반', '바꿀 수 있음')).toHaveValue('900,000')
  })

  it('saves with the version from the first edit after the year record is reread', async () => {
    serveAnalysis(analysisView())
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/plan', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(readyYearView())
    }))
    const { client, user, field } = await openPlan()
    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.tab()
    server.use(http.get('*/api/tax/years/2026', () => HttpResponse.json(readyYearView({ plan: { ...samplePlan, rowVersion: 60 } }))))
    await act(async () => { await client.invalidateQueries({ queryKey: ['tax', 'year', 2026] }) })
    await user.click(screen.getByRole('button', { name: '계산하기' }))

    await waitFor(() => expect(body).toMatchObject({ rowVersion: 55 }))
  })

  it('does not clear the current year edit or move to ③ when an earlier year save finishes', async () => {
    serveAnalysis(analysisView())
    server.use(
      http.get('*/api/tax/years/2025', () => HttpResponse.json(readyYearView({ taxYear: 2025, plan: { ...samplePlan, general: { ...samplePlan.general, flexible: 300_000 } } }))),
      http.get('*/api/tax/years/2025/analysis', () => HttpResponse.json(analysisView({ taxYear: 2025 }))),
    )
    let release!: () => void
    let requested!: () => void
    const started = new Promise<void>((resolve) => { requested = resolve })
    server.use(http.put('*/api/tax/years/2026/plan', async () => {
      requested()
      await new Promise<void>((resolve) => { release = resolve })
      return HttpResponse.json(readyYearView({ plan: { ...samplePlan, ...savedBody, rowVersion: 56 } }))
    }))
    const { client, user, field } = await openPlan()
    await user.click(screen.getByRole('button', { name: '계산하기' }))
    await started
    await chooseYear(user, 2025)
    await waitFor(() => expect(field('일반', '바꿀 수 있음')).toHaveValue('300,000'))
    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '200000')
    await user.tab()

    await act(async () => { release() })
    await waitFor(() => expect(client.getQueryData(['tax', 'year', 2026])).toMatchObject({ plan: { rowVersion: 56 } }))
    expect(client.getQueryData(['tax', 'year', 2025])).toMatchObject({ taxYear: 2025 })
    expect(field('일반', '바꿀 수 있음')).toHaveValue('200,000')
    expect(screen.getByRole('tab', { name: '② 지출계획' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('지출계획을 저장했습니다.')).not.toBeInTheDocument()
  })

  it('uses the refreshed version when editing the saved year again', async () => {
    serveAnalysis(analysisView())
    let version = 55
    server.use(
      http.get('*/api/tax/years/2026', () => HttpResponse.json(readyYearView({ plan: { ...samplePlan, rowVersion: version } }))),
      http.get('*/api/tax/years/2025', () => HttpResponse.json(readyYearView({ taxYear: 2025 }))),
      http.get('*/api/tax/years/2025/analysis', () => HttpResponse.json(analysisView({ taxYear: 2025 }))),
    )
    let release!: () => void
    let requested!: () => void
    const started = new Promise<void>((resolve) => { requested = resolve })
    const bodies: unknown[] = []
    server.use(http.put('*/api/tax/years/2026/plan', async ({ request }) => {
      bodies.push(await request.json())
      if (bodies.length === 1) {
        requested()
        await new Promise<void>((resolve) => { release = resolve })
      }
      version++
      return HttpResponse.json(readyYearView({ plan: { ...samplePlan, rowVersion: version } }))
    }))
    const { client, user, field } = await openPlan()
    await user.click(screen.getByRole('button', { name: '계산하기' }))
    await started
    await chooseYear(user, 2025)
    await act(async () => { release() })
    await waitFor(() => expect(client.isMutating()).toBe(0))
    expect(client.getQueryData(['tax', 'year', 2026])).toMatchObject({ plan: { rowVersion: 56 } })
    await chooseYear(user, 2026)
    await waitFor(() => expect(field('일반', '바꿀 수 있음')).toHaveValue('1,200,000'))
    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.click(screen.getByRole('button', { name: '계산하기' }))

    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toMatchObject({ rowVersion: 56 })
  })

  it('keeps the edit and save error when reload fails', async () => {
    serveAnalysis(analysisView())
    server.use(http.put('*/api/tax/years/2026/plan', () => HttpResponse.json({ code: 'CONFLICT', message: 'x' }, { status: 409 })))
    const { user, step, field } = await openPlan()
    await user.clear(field('일반', '바꿀 수 있음'))
    await user.type(field('일반', '바꿀 수 있음'), '900000')
    await user.click(step.getByRole('button', { name: '계산하기' }))
    await step.findByRole('alert')
    server.use(http.get('*/api/tax/years/2026', () => HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })))
    await user.click(step.getByRole('button', { name: '다시 불러오기' }))
    expect(await screen.findByText('분석을 불러오지 못했습니다.')).toBeInTheDocument()
    server.use(http.get('*/api/tax/years/2026', () => HttpResponse.json(readyYearView())))
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(field('일반', '바꿀 수 있음')).toHaveValue('900,000'))
    expect(step.getByRole('alert')).toHaveTextContent('저장하지 않았습니다.')
  })
})
