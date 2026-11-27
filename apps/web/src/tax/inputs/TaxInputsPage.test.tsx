import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

beforeEach(() => {
  try { localStorage.clear() } catch { /* storage may be unavailable */ }
})

describe('TaxInputsPage — 기본정보와 연도 기록', () => {
  it('uses the numeric keypad for the child count', async () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    const platform = vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('iPhone')
    try {
      serveTax(null)
      const { user } = renderTaxInputs()
      await user.click(await screen.findByRole('button', { name: '기본정보 입력' }))

      const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
      expect(within(dialog).getByLabelText('자녀등 수')).toHaveAttribute('inputmode', 'numeric')
    } finally {
      userAgent.mockRestore()
      platform.mockRestore()
    }
  })

  it('creates the year record from the empty state in a centered dialog, without any group', async () => {
    mockViewport(true)
    serveTax(null)
    let body: unknown
    server.use(http.put('*/api/tax/years/2026', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({ childCount: 2 }), { status: 201 })
    }))
    const { user } = renderTaxInputs({ groups: [] })

    expect(await screen.findByRole('heading', { name: '2026년 귀속 기록이 없어요' })).toBeInTheDocument()
    expect(screen.getByText('개인 자료 · 그룹과 무관')).toBeInTheDocument()
    expect(screen.queryByText(/세법은 준비 중이에요/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기본정보 입력' }))

    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    expect(dialog.parentElement).toHaveClass('modal', 'pinned')
    await user.type(within(dialog).getByLabelText('예상 총급여'), '50000000')
    await user.clear(within(dialog).getByLabelText('자녀등 수'))
    await user.type(within(dialog).getByLabelText('자녀등 수'), '2')
    expect(within(dialog).getByRole('button', { name: '저장' }).closest('form')).toBeNull()
    expect((within(dialog).getByRole('button', { name: '저장' }) as HTMLButtonElement).form).toBe(within(dialog).getByLabelText('예상 총급여').closest('form'))
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ totalSalary: 50_000_000, workStartMonth: 1, workEndMonth: 12, childCount: 2 })
    const basic = screen.getByRole('region', { name: '기본정보' })
    expect(basic).toHaveTextContent('₩ 50,000,000')
    expect(basic).toHaveTextContent('1월 ~ 12월')
    expect(basic).toHaveTextContent('2명')
  })

  it('explains the child rules in a help popover without closing the dialog or changing the value', async () => {
    serveTax(null)
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '기본정보 입력' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    const help = within(dialog).getByRole('button', { name: '자녀등 수 도움말' })

    expect(screen.queryByText(/직계비속/)).not.toBeInTheDocument()
    await user.click(help)
    expect(await screen.findByRole('dialog', { name: '자녀등 수 도움말' })).toHaveTextContent('20세 이하')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '자녀등 수 도움말' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: '2026년 귀속 기본정보' })).toBeInTheDocument()
    await waitFor(() => expect(help).toHaveFocus(), { timeout: 3000 })
    expect(within(dialog).getByLabelText('자녀등 수')).toHaveValue('0')
  })

  it('hides the child count and says the law is not ready when the year has no applied law', async () => {
    serveTax(null, null)
    const { user } = renderTaxInputs()

    expect(await screen.findByText('2026년 귀속 세법은 준비 중이에요. 자료는 저장되며, 분석은 세법이 등록된 뒤 볼 수 있어요.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기본정보 입력' }))

    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    expect(within(dialog).queryByLabelText('자녀등 수')).not.toBeInTheDocument()
  })

  it('blocks creating a record while the current law request fails and retries it', async () => {
    serveTax(null)
    let fail = true
    server.use(http.get('*/api/tax/law-versions/current', () => fail
      ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
      : HttpResponse.json({ id: 1, taxYear: 2026, versionNo: 1, appliedAt: '2026-01-02T00:00:00Z', childTiersApply: true })))
    const { user } = renderTaxInputs()

    expect(await screen.findByRole('alert')).toHaveTextContent('현재 세법을 불러오지 못했어요. 다시 시도해 주세요.')
    expect(screen.getByRole('button', { name: '기본정보 입력' })).toBeDisabled()
    expect(screen.queryByText(/세법은 준비 중이에요/)).not.toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '기본정보 입력' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '기본정보 입력' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('자녀등 수')).toBeInTheDocument()
  })

  it.each(['create', 'edit'])('hides child count when child tiers do not apply on %s', async (mode) => {
    const lawVersion = { id: 1, versionNo: 1, appliedAt: '2026-01-02T00:00:00Z', childTiersApply: false }
    if (mode === 'create') serveTax(null, { ...lawVersion, taxYear: 2026 })
    else serveTax(yearView({ lawVersion }))
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: mode === 'create' ? '기본정보 입력' : '기본정보 수정' }))
    expect(within(await screen.findByRole('dialog')).queryByLabelText('자녀등 수')).not.toBeInTheDocument()
  })

  it('shows the law pending message when the saved record has no law version', async () => {
    serveTax(yearView({ lawVersion: null }))
    const { user } = renderTaxInputs()
    expect(await screen.findByText(/2026년 귀속 세법은 준비 중이에요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기본정보 수정' }))
    expect(within(await screen.findByRole('dialog')).queryByLabelText('자녀등 수')).not.toBeInTheDocument()
  })

  it('edits the basic info with the row version it received and blocks a start month after the end month', async () => {
    serveTax(yearView({ rowVersion: 9_007_199_254_740_991 }))
    const bodies: unknown[] = []
    server.use(http.put('*/api/tax/years/2026', async ({ request }) => {
      bodies.push(await request.json())
      return HttpResponse.json(yearView({ workStartMonth: 4, rowVersion: 12 }))
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    expect(within(dialog).getByLabelText('예상 총급여')).toHaveValue('50,000,000')
    await user.click(within(dialog).getByRole('button', { name: /종료월/ }))
    await user.click(screen.getByRole('option', { name: '3월' }))
    await user.click(within(dialog).getByRole('button', { name: /시작월/ }))
    await user.click(screen.getByRole('option', { name: '4월' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('시작월이 종료월보다 늦어요.')
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: /종료월/ }))
    await user.click(screen.getByRole('option', { name: '12월' }))
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies).toEqual([{ totalSalary: 50_000_000, workStartMonth: 4, workEndMonth: 12, childCount: 0, rowVersion: 9_007_199_254_740_991 }])
    expect(screen.getByRole('region', { name: '기본정보' })).toHaveTextContent('4월 ~ 12월근로기간 확인 필요')
  })

  it('stops a stale save, keeps the input and reloads on request', async () => {
    serveTax(yearView())
    server.use(http.put('*/api/tax/years/2026', () => HttpResponse.json({ code: 'CONFLICT', message: 'x' }, { status: 409 })))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    const salary = within(dialog).getByLabelText('예상 총급여')
    await user.clear(salary)
    await user.type(salary, '61000000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('다른 곳에서 수정되거나 삭제됐어요. 저장하지 않았어요.')
    expect(salary).toHaveValue('61,000,000')
    serveTax(yearView({ totalSalary: 70_000_000, rowVersion: 900 }))
    await user.click(within(dialog).getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('₩ 70,000,000')).toBeInTheDocument()
  })

  it('treats a missing record on basic info save as stale', async () => {
    serveTax(yearView())
    server.use(http.put('*/api/tax/years/2026', () => HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 })))
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('다른 곳에서 수정되거나 삭제됐어요. 저장하지 않았어요.')
    expect(within(dialog).getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
  })

  it('rejects salary above the limit and accepts child counts at 0 and 99', async () => {
    serveTax(yearView())
    const bodies: unknown[] = []
    server.use(http.put('*/api/tax/years/2026', async ({ request }) => {
      bodies.push(await request.json())
      return HttpResponse.json(yearView({ childCount: bodies.length === 1 ? 0 : 99 }))
    }))
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    let dialog = await screen.findByRole('dialog')
    const salary = within(dialog).getByLabelText('예상 총급여')
    await user.clear(salary)
    await user.type(salary, '10000000000000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    expect(await within(dialog).findByText('금액이 너무 커요')).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
    await user.clear(salary)
    await user.type(salary, '50000000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '기본정보 수정' }))
    dialog = await screen.findByRole('dialog')
    const children = within(dialog).getByLabelText('자녀등 수')
    await user.clear(children)
    await user.type(children, '99')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies).toEqual([expect.objectContaining({ childCount: 0 }), expect.objectContaining({ childCount: 99 })])
  })

  it('keeps the input when the server cannot be reached', async () => {
    serveTax(yearView())
    server.use(http.put('*/api/tax/years/2026', () => HttpResponse.error()))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '기본정보 수정' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 귀속 기본정보' })
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. 입력한 값은 그대로 있어요.')
    expect(within(dialog).getByLabelText('예상 총급여')).toHaveValue('50,000,000')
  })

  it('masks the salary with the income setting but never the field being edited', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ INCOME: true }))
    serveTax(yearView())
    const { user } = renderTaxInputs()

    const basic = await screen.findByRole('region', { name: '기본정보' })
    expect(basic).toHaveTextContent('₩ •••••')
    expect(basic).not.toHaveTextContent('50,000,000')
    await user.click(screen.getByRole('button', { name: '기본정보 수정' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('예상 총급여')).toHaveValue('50,000,000')
  })

  it('shows the salary when only the expense setting is masked', async () => {
    localStorage.setItem('saladbowl.amountMask', JSON.stringify({ EXPENSE: true }))
    serveTax(yearView())
    renderTaxInputs()

    expect(await screen.findByRole('region', { name: '기본정보' })).toHaveTextContent('₩ 50,000,000')
  })

  it('deletes the year only after the exact year is typed, starting empty each time', async () => {
    mockViewport(true)
    serveTax(yearView())
    let url = ''
    server.use(http.delete('*/api/tax/years/2026', ({ request }) => {
      url = request.url
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '2026년 기록 삭제' }))
    let dialog = await screen.findByRole('dialog', { name: '2026년 기록을 삭제할까요?' })
    expect(dialog.parentElement).toHaveClass('modal', 'pinned')
    expect(dialog).toHaveTextContent('기본정보, 신용·체크 자료 0건, 현금영수증 자료, 지출계획이 모두 지워져요')
    const confirm = () => within(dialog).getByRole('button', { name: '삭제' })
    expect(confirm()).toBeDisabled()
    await user.type(within(dialog).getByLabelText('확인을 위해 귀속연도(2026)를 입력하세요'), '2025')
    expect(confirm()).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    serveTax(null)
    await user.click(screen.getByRole('button', { name: '2026년 기록 삭제' }))
    dialog = await screen.findByRole('dialog', { name: '2026년 기록을 삭제할까요?' })
    const input = within(dialog).getByLabelText('확인을 위해 귀속연도(2026)를 입력하세요')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveValue('')
    await user.type(input, '2026')
    await user.click(confirm())

    expect(await screen.findByRole('heading', { name: '2026년 귀속 기록이 없어요' })).toBeInTheDocument()
    expect(new URL(url).search).toBe('?rowVersion=777')
  })

  it('places the delete explanation and button inside a split wrapper', async () => {
    serveTax(yearView())
    renderTaxInputs()

    const section = await screen.findByRole('region', { name: '연도 기록 삭제' })
    const wrapper = section.firstElementChild
    expect(wrapper).toHaveClass('split')
    expect(wrapper?.children).toHaveLength(2)
    expect(wrapper?.firstElementChild).toHaveTextContent('이 연도의 기본정보·입력자료·금액·지출계획을 모두 지워요.')
    expect(wrapper?.lastElementChild).toBe(within(section).getByRole('button', { name: '2026년 기록 삭제' }))
  })

  it.each([409, 404])('reloads the year and explains a %i delete conflict', async (status) => {
    const calls = serveTax(yearView())
    server.use(http.delete('*/api/tax/years/2026', () => HttpResponse.json({ code: 'X', message: 'x' }, { status })))
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '2026년 기록 삭제' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('확인을 위해 귀속연도(2026)를 입력하세요'), '2026')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.')
    await waitFor(() => expect(calls.year).toBeGreaterThan(1))
  })

  it('tells a failed load apart and retries it', async () => {
    let fail = true
    server.use(
      http.get('*/api/tax/years/:year', () => (fail
        ? HttpResponse.json({ code: 'X', message: 'x' }, { status: 500 })
        : HttpResponse.json(yearView()))),
    )
    const { user } = renderTaxInputs()

    expect(await screen.findByRole('alert')).toHaveTextContent('입력자료를 불러오지 못했어요.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('region', { name: '기본정보' })).toBeInTheDocument()
  })
})
