import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { mockViewport } from '../test/mockViewport'
import { renderPage } from '../test/renderPage'
import { server } from '../test/server'
import CategoryTransactionsDialog from './CategoryTransactionsDialog'
import type { TransactionView } from '../transactions/transactionsApi'

const tx = (id: number, amount: number): TransactionView => ({
  id, ownerId: 1, ownerNickname: '나', occurredAt: '2026-10-19T12:30:00',
  type: 'EXPENSE', categoryMajor: '식비', categoryMinor: '외식', description: `점심 ${id}`,
  amount, currency: 'KRW', paymentMethod: '카드', memo: null, hidden: false,
  source: 'IMPORT', edited: false, editable: false,
})

describe('CategoryTransactionsDialog', () => {
  it('shows icon buttons for the minor screen and closing', async () => {
    const onClose = vi.fn()
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])))
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={onClose} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    const minors = within(dialog).getByRole('button', { name: '식비 소분류 보기' })
    const close = within(dialog).getByRole('button', { name: '닫기' })
    expect(minors).toHaveTextContent(/^$/)
    expect(close).toHaveTextContent(/^$/)
    expect(minors.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(close.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(minors.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a desktop grid and the refund-adjusted total', async () => {
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000), tx(2, -20000), tx(3, 3000)])))
    renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    expect(await within(dialog).findByText('3건 · 합계 ₩ 27,000')).toBeInTheDocument()
    expect(within(dialog).getByRole('grid', { name: '거래 목록' })).toBeInTheDocument()
    expect(within(dialog).getByText('점심 1')).toBeInTheDocument()
    expect(dialog.parentElement).toHaveClass('wide')
  })

  it('shows a card list on a narrow screen', async () => {
    mockViewport(true)
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])))
    renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    expect(await within(dialog).findByRole('grid', { name: '거래 목록' })).toHaveTextContent('점심 1')
    expect(within(dialog).queryByRole('columnheader')).not.toBeInTheDocument()
    expect(within(dialog).getByText('10-19 12:30 · 외식 · 나')).toBeInTheDocument()
  })

  it('keeps the title and loaded content while a narrow sheet closes', async () => {
    mockViewport(true)
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])))
    function Harness() {
      const [category, setCategory] = useState<string | null>('식비')
      return <CategoryTransactionsDialog groupId={10} month="2026-10" category={category} onClose={() => setCategory(null)} />
    }
    const { user } = renderPage(<Harness />)
    expect(await screen.findByText('1건 · 합계 ₩ 10,000')).toBeInTheDocument()
    // 닫힘 애니메이션이 끝나지 않은 상태를 만든다. jsdom에는 CSS 애니메이션이 없다.
    const animations = vi.spyOn(Element.prototype, 'getAnimations').mockReturnValue([{ playState: 'running', finished: new Promise(() => {}) } as unknown as Animation])
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.getByRole('dialog', { name: '식비' })).toHaveTextContent('1건 · 합계 ₩ 10,000')
    expect(screen.queryByText('불러오는 중입니다.')).not.toBeInTheDocument()
    animations.mockRestore()
  })

  it('retries a failed request', async () => {
    let fail = true
    server.use(http.get('*/api/groups/10/summary/transactions', () => fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json([tx(1, -10000)])))
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('거래를 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('1건 · 합계 ₩ 10,000')).toBeInTheDocument()
  })

  it('shows an empty state and calls onClose', async () => {
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([])))
    const onClose = vi.fn()
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={onClose} />)
    expect(await screen.findByText('거래가 없습니다.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
