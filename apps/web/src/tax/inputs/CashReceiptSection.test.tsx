import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockViewport } from '../../test/mockViewport'
import { server } from '../../test/server'
import { cardView, renderTaxInputs, serveTax, yearView } from '../../test/taxFixtures'

const zeros = { general: 0, market: 0, transit: 0, culture: 0 }

describe('현금영수증 자료', () => {
  it('starts as 4 blank cells and saves them as 0 through the centered dialog, with no delete anywhere', async () => {
    mockViewport(true)
    serveTax(yearView({ cards: [cardView({ asOfDate: '2026-09-30' })], hasInputs: true }))
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/cash-receipt', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView({
        cards: [cardView({ asOfDate: '2026-09-30' })], hasInputs: true,
        cashReceipt: { rowVersion: 55, asOfDate: '2026-09-30', memo: null, amounts: zeros, blankCount: 0 },
      }))
    }))
    const { user } = renderTaxInputs()

    const section = await screen.findByRole('region', { name: '현금영수증 자료' })
    expect(section).toHaveTextContent('미완료 · 4칸 빔')
    expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual(['입력'])
    await user.click(within(section).getByRole('button', { name: '현금영수증 자료 입력' }))

    const dialog = await screen.findByRole('dialog', { name: '2026년 현금영수증 자료' })
    expect(dialog.parentElement).toHaveClass('pinned')
    expect(dialog.parentElement).toHaveClass('modal')
    const group = within(dialog).getByRole('group', { name: '현금영수증' })
    expect(['일반', '전통시장', '대중교통', '문화체육'].map((label) => within(group).getByLabelText(label))).toHaveLength(4)
    expect(within(group).getByLabelText('일반')).toHaveValue('')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ asOfDate: '2026-09-30', memo: null, amounts: zeros })
    expect(within(section).getByRole('img', { name: '완료' })).toBeInTheDocument()
    expect(section).not.toHaveTextContent('미완료')
    expect(within(section).getByRole('button', { name: '현금영수증 자료 편집' })).toHaveTextContent('')
    expect(screen.queryByRole('button', { name: /현금영수증.*삭제/ })).not.toBeInTheDocument()
  })

  it('edits the cash receipt with the row version it received', async () => {
    serveTax(yearView({ cashReceipt: { rowVersion: 55, asOfDate: '2026-10-31', memo: '연말정산 대비', amounts: { ...zeros, market: null }, blankCount: 1 }, hasInputs: true }))
    let body: unknown
    server.use(http.put('*/api/tax/years/2026/cash-receipt', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(yearView())
    }))
    const { user } = renderTaxInputs()

    await user.click(await screen.findByRole('button', { name: '현금영수증 자료 편집' }))
    const dialog = await screen.findByRole('dialog', { name: '2026년 현금영수증 자료' })
    await user.clear(within(dialog).getByLabelText('일반'))
    await user.type(within(dialog).getByLabelText('일반'), '500000')
    await user.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(body).toEqual({
      asOfDate: '2026-10-31', memo: '연말정산 대비', amounts: { ...zeros, general: 500_000 }, rowVersion: 55,
    }))
  })
})
