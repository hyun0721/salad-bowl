import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { cardView, renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

const CATEGORIES = ['일반', '전통시장', '대중교통', '문화체육']

function cell(dialog: HTMLElement, category: string, method: string) {
  return within(within(dialog).getByRole('group', { name: category })).getByLabelText(method)
}

async function typeDate(user: UserEvent, dialog: HTMLElement, digits: string) {
  const group = within(dialog).getByRole('group', { name: '기준일' })
  await user.click(within(group).getAllByRole('spinbutton')[0])
  await user.keyboard(digits)
}

describe('신용·체크 자료', () => {
  it('adds a card in a centered dialog with 4 categories × credit/debit and saves blank amounts as 0', async () => {
    mockViewport(true)
    serveTax(yearView())
    let body: unknown
    server.use(http.post('*/api/tax/years/2026/cards', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({ cards: [cardView({ blankCount: 0 })], hasInputs: true }), { status: 201 })
    }))
    const { user } = renderTaxInputs()

    const section = await screen.findByRole('region', { name: '신용·체크 자료' })
    expect(section).toHaveTextContent('등록한 신용·체크 자료가 없습니다.')
    await user.click(within(section).getByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })
    expect(dialog.parentElement).toHaveClass('pinned')
    expect(dialog.parentElement).toHaveClass('modal')
    expect(within(dialog).getAllByRole('group').map((g) => g.getAttribute('aria-label') ?? g.querySelector('legend')?.textContent))
      .toEqual(expect.arrayContaining(CATEGORIES))
    expect(dialog).toHaveTextContent('"일반"은 전통시장·대중교통·문화체육을 뺀 금액입니다.')
    expect(dialog).not.toHaveTextContent('직불')

    await user.type(within(dialog).getByLabelText('카드사명'), '  A카드  ')
    await typeDate(user, dialog, '20261031')
    await user.type(within(dialog).getByLabelText('메모 (선택)'), '주 사용 카드')
    await user.type(cell(dialog, '일반', '신용카드'), '9000000')
    await user.type(cell(dialog, '일반', '체크카드'), '0')
    await user.tab()
    expect(dialog).toHaveTextContent('비워 두면 0원으로 저장됩니다')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({
      issuerName: 'A카드', asOfDate: '2026-10-31', memo: '주 사용 카드',
      amounts: {
        creditGeneral: 9_000_000, creditMarket: 0, creditTransit: 0, creditCulture: 0,
        debitGeneral: 0, debitMarket: 0, debitTransit: 0, debitCulture: 0,
      },
    })
    const row = within(section).getByRole('listitem')
    expect(row).toHaveTextContent('A카드')
    expect(row).toHaveTextContent('완료')
    expect(row).toHaveTextContent('기준일 2026-10-31 · 합계 ₩ 9,600,000 · 주 사용 카드')
  })

  it('keeps blank inputs empty without a fill button', async () => {
    serveTax(yearView())
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })

    for (const category of CATEGORIES) {
      expect(cell(dialog, category, '신용카드')).toHaveValue('')
      expect(cell(dialog, category, '체크카드')).toHaveValue('')
    }
    expect(within(dialog).queryByRole('button', { name: '빈 칸 0원으로 채우기' })).not.toBeInTheDocument()
  })

  it('saves a second card with the same issuer name without a warning', async () => {
    serveTax(yearView({ cards: [cardView()], hasInputs: true }))
    let posted = 0
    server.use(http.post('*/api/tax/years/2026/cards', () => {
      posted++
      return HttpResponse.json(yearView({ cards: [cardView(), cardView({ id: 8 })], hasInputs: true }), { status: 201 })
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })
    expect(within(dialog).getByRole('group', { name: '기준일' })).toHaveTextContent('2026')
    expect(within(dialog).getByRole('group', { name: '기준일' })).toHaveTextContent('10')
    expect(within(dialog).getByRole('group', { name: '기준일' })).toHaveTextContent('31')
    await user.type(within(dialog).getByLabelText('카드사명'), 'A카드')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posted).toBe(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText(/중복|이미 있/)).not.toBeInTheDocument()
  })

  it('does not save a negative amount', async () => {
    serveTax(yearView())
    let posted = 0
    server.use(http.post('*/api/tax/years/2026/cards', () => { posted++; return HttpResponse.json(yearView(), { status: 201 }) }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog', { name: '신용·체크 자료 추가' })
    await user.type(within(dialog).getByLabelText('카드사명'), 'B카드')
    await typeDate(user, dialog, '20261031')
    await user.type(cell(dialog, '일반', '신용카드'), '-5')
    await user.tab()
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByText('0원 이상 입력하세요')).toBeInTheDocument()
    expect(posted).toBe(0)
  })

  it('does not save a date outside the year', async () => {
    serveTax(yearView())
    let posted = 0
    server.use(http.post('*/api/tax/years/2026/cards', () => { posted++; return HttpResponse.json(yearView(), { status: 201 }) }))
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('카드사명'), 'B카드')
    await typeDate(user, dialog, '20251231')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    expect(within(dialog).getByRole('group', { name: '기준일' }).closest('[data-invalid]')).not.toBeNull()
    expect(posted).toBe(0)
  })

  it('does not save an amount above the limit', async () => {
    serveTax(yearView())
    let posted = 0
    server.use(http.post('*/api/tax/years/2026/cards', () => { posted++; return HttpResponse.json(yearView(), { status: 201 }) }))
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('카드사명'), 'B카드')
    await typeDate(user, dialog, '20261031')
    await user.type(cell(dialog, '일반', '신용카드'), '10000000000000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    expect(await within(dialog).findByText('금액이 너무 큽니다')).toBeInTheDocument()
    expect(posted).toBe(0)
  })

  it('rejects a whitespace-only issuer name before submitting', async () => {
    serveTax(yearView())
    let posted = 0
    server.use(http.post('*/api/tax/years/2026/cards', () => { posted++; return HttpResponse.json(yearView(), { status: 201 }) }))
    const { user } = renderTaxInputs()
    await user.click(await screen.findByRole('button', { name: '신용·체크 자료 추가' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('카드사명'), '   ')
    await typeDate(user, dialog, '20261031')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('카드사명을 입력하세요.')
    expect(posted).toBe(0)
  })

  it('shows an incomplete card with its blank count and saves the blanks as 0 through editing', async () => {
    const incomplete = cardView({
      rowVersion: 41,
      amounts: { ...cardView().amounts, debitMarket: null, debitTransit: null, debitCulture: null },
      blankCount: 3,
    })
    serveTax(yearView({ cards: [incomplete], hasInputs: true }))
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/cards/7', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({ cards: [cardView()], hasInputs: true }))
    }))
    const { user } = renderTaxInputs()

    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('미완료 · 빈 칸 3개')
    expect(within(row).queryByRole('button', { name: '빈 칸 0원으로 채우기' })).not.toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'A카드 자료 편집' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.getByRole('listitem')).toHaveTextContent('완료'))
    expect(screen.getByRole('listitem')).not.toHaveTextContent('미완료')
    expect(body).toEqual({
      issuerName: 'A카드', asOfDate: '2026-10-31', memo: '주 사용 카드',
      amounts: { ...cardView().amounts, debitMarket: 0, debitTransit: 0, debitCulture: 0 },
      rowVersion: 41,
    })
  })

  it('keeps edit and delete in the row action area even with a long issuer name', async () => {
    const longName = '아주긴카드사이름'.repeat(5)
    serveTax(yearView({ cards: [cardView({ issuerName: longName })], hasInputs: true }))
    renderTaxInputs()

    const row = await screen.findByRole('listitem')
    const actions = row.lastElementChild as HTMLElement
    expect(actions).toHaveClass('actions')
    expect(within(actions).getByRole('button', { name: `${longName} 자료 편집` })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: `${longName} 자료 삭제` })).toBeInTheDocument()
    expect(within(row.firstElementChild as HTMLElement).getByText(longName)).toBeInTheDocument()
  })

  it('deletes a card after one confirmation and reloads the year', async () => {
    mockViewport(true)
    serveTax(yearView({ cards: [cardView({ rowVersion: 5 })], hasInputs: true }))
    let url = ''
    server.use(http.delete('*/api/tax/years/2026/cards/7', ({ request }) => {
      url = request.url
      serveTax(yearView())
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: 'A카드 자료 삭제' }))
    const dialog = await screen.findByRole('dialog', { name: 'A카드 자료를 삭제할까요?' })
    expect(dialog.parentElement).toHaveClass('modal')
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(await screen.findByText('등록한 신용·체크 자료가 없습니다.')).toBeInTheDocument()
    expect(new URL(url).search).toBe('?rowVersion=5')
  })

  it.each([409, 404])('reloads and explains a %i card delete conflict', async (status) => {
    const calls = serveTax(yearView({ cards: [cardView()], hasInputs: true }))
    server.use(http.delete('*/api/tax/years/2026/cards/7', () => HttpResponse.json({ code: 'X', message: 'x' }, { status })))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: 'A카드 자료 삭제' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('새로 불러온 내용을 확인한 뒤 다시 시도해 주세요.')
    await waitFor(() => expect(calls.year).toBeGreaterThan(1))
  })

  it.each([409, 404])('reloads and explains a %i incomplete card edit conflict', async (status) => {
    const incomplete = cardView({ blankCount: 1, amounts: { ...cardView().amounts, debitMarket: null } })
    const calls = serveTax(yearView({ cards: [incomplete], hasInputs: true }))
    server.use(http.put('*/api/tax/years/2026/cards/7', () => HttpResponse.json({ code: 'X', message: 'x' }, { status })))
    const { user } = renderTaxInputs()

    const row = await screen.findByRole('listitem')
    expect(within(row).queryByRole('button', { name: '빈 칸 0원으로 채우기' })).not.toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'A카드 자료 편집' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('저장하지 않았습니다.')
    await user.click(within(dialog).getByRole('button', { name: '다시 불러오기' }))
    await waitFor(() => expect(calls.year).toBeGreaterThan(1))
  })

  it('stops a stale card save and keeps the input', async () => {
    serveTax(yearView({ cards: [cardView()], hasInputs: true }))
    server.use(http.put('*/api/tax/years/2026/cards/7', () => HttpResponse.json({ code: 'CONFLICT', message: 'x' }, { status: 409 })))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: 'A카드 자료 편집' }))
    const dialog = await screen.findByRole('dialog', { name: 'A카드 자료 편집' })
    await user.clear(cell(dialog, '일반', '신용카드'))
    await user.type(cell(dialog, '일반', '신용카드'), '9500000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('다른 곳에서 수정되거나 삭제됐습니다. 저장하지 않았습니다.')
    expect(cell(dialog, '일반', '신용카드')).toHaveValue('9,500,000')
    expect(within(dialog).getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
  })

  it('stops adding at 50 cards and says why', async () => {
    serveTax(yearView({ cards: Array.from({ length: 50 }, (_, i) => cardView({ id: i + 1, issuerName: `카드${i + 1}` })), hasInputs: true }))
    renderTaxInputs()

    expect(await screen.findByRole('button', { name: '신용·체크 자료 추가' })).toBeDisabled()
    expect(screen.getByText('신용·체크 자료는 연도마다 50건까지 등록할 수 있습니다.')).toBeInTheDocument()
  })
})
