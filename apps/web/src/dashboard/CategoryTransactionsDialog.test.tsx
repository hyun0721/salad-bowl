import { screen, waitFor, within } from '@testing-library/react'
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
  it('sorts the category transactions through the API', async () => {
    const requestedUrls: string[] = []
    server.use(http.get('*/api/groups/10/summary/transactions', ({ request }) => {
      requestedUrls.push(request.url)
      return HttpResponse.json([tx(1, -10000)])
    }))
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    await screen.findByText('1건 · 합계 ₩ 10,000')
    await user.click(screen.getByRole('button', { name: '정렬, 최신순' }))
    await user.click(screen.getByRole('radio', { name: '금액 큰 순' }))
    await user.click(screen.getByRole('button', { name: '적용' }))
    await waitFor(() => expect(requestedUrls.at(-1)).toContain('sort=AMOUNT_DESC'))
  })

  it.each([false, true])('keeps the category dialog open while using sort (narrow: %s)', async (narrow) => {
    mockViewport(narrow)
    const onClose = vi.fn()
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])))
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={onClose} />)
    const categoryDialog = await screen.findByRole('dialog', { name: '식비' })
    await user.click(await within(categoryDialog).findByRole('button', { name: '정렬, 최신순' }))
    await user.click(screen.getByRole('radio', { name: '금액 큰 순' }))
    expect(categoryDialog).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('radio', { name: '금액 큰 순' })).not.toBeInTheDocument())
    expect(categoryDialog).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows icon buttons for the minor screen and closing', async () => {
    const onClose = vi.fn()
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])))
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={onClose} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    const minors = within(dialog).getByRole('button', { name: '식비 소분류 보기' })
    const close = within(dialog).getByRole('button', { name: '닫기' })
    expect(minors).toHaveAttribute('title', '소분류 보기')
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
    const summary = await within(dialog).findByText('3건 · 합계 ₩ 27,000')
    const grid = within(dialog).getByRole('grid', { name: '거래 목록' })
    expect(within(grid).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['일시', '멤버', '소분류', '내용', '결제수단', '금액'])
    // 창 제목이 대분류라 행에는 대분류를 다시 쓰지 않는다.
    expect(within(grid).getAllByRole('row')[1]).toHaveTextContent('외식')
    expect(within(grid).getAllByRole('row')[1]).not.toHaveTextContent('식비')
    // 요약 줄은 목록 스크롤 영역 밖(위)에 있어 목록을 내려도 남는다.
    expect(summary.contains(grid)).toBe(false)
    expect(grid.closest('[data-dialog-list]')).not.toBeNull()
    expect(summary.closest('[data-dialog-list]')).toBeNull()
    expect(dialog.parentElement).toHaveClass('wide')
    expect(dialog.parentElement).toHaveClass('pinned')
  })

  it('shows a card list on a narrow screen', async () => {
    mockViewport(true)
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([{ ...tx(1, -10000), memo: '회사 앞' }])))
    server.use(http.get('*/api/me/categories', () => HttpResponse.json([])), http.get('*/api/transactions/1/audits', () => HttpResponse.json([])))
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    const card = within(await within(dialog).findByRole('grid', { name: '거래 목록' })).getByRole('row', { name: /점심 1/ })
    expect(card).toHaveTextContent(/점심 1.*-₩ 10,000외식 · 나 \| 회사 앞.*10-19 12:30/)
    expect(within(dialog).queryByRole('columnheader')).not.toBeInTheDocument()
    await user.click(card)
    expect(within(dialog).getByRole('heading', { name: '점심 1' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '거래 목록으로 돌아가기' }))
    await waitFor(() => expect(within(dialog).getByRole('row', { name: /점심 1/ })).toHaveFocus())
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

  it('keeps the minor title and contents during the closing animation', async () => {
    mockViewport(true)
    server.use(http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])))
    function Harness() {
      const [open, setOpen] = useState(true)
      return <CategoryTransactionsDialog groupId={10} month="2026-10" category={open ? '식비' : null}
        minor={open ? '외식' : undefined} onClose={() => setOpen(false)} />
    }
    const { user } = renderPage(<Harness />)
    expect(await screen.findByText('1건 · 합계 ₩ 10,000')).toBeInTheDocument()
    const animations = vi.spyOn(Element.prototype, 'getAnimations').mockReturnValue([{ playState: 'running', finished: new Promise(() => {}) } as unknown as Animation])
    await user.click(screen.getByRole('button', { name: '닫기' }))
    const dialog = screen.getByRole('dialog', { name: '식비 · 외식' })
    expect(dialog).toHaveTextContent('1건 · 합계 ₩ 10,000')
    expect(within(dialog).queryByRole('button', { name: /소분류 보기/ })).not.toBeInTheDocument()
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

  it('edits a row in the same dialog, refreshes the summary list, and restores focus', async () => {
    let requests = 0
    let changed = false
    server.use(
      http.get('*/api/groups/10/summary/transactions', () => {
        requests++
        return HttpResponse.json(changed ? [] : [{ ...tx(1, -10000), editable: true }])
      }),
      http.get('*/api/me/categories', () => HttpResponse.json([{ type: 'EXPENSE', major: '외식', count: 1, minors: [{ minor: '저녁', count: 1 }] }])),
      http.get('*/api/transactions/1/audits', () => HttpResponse.json([])),
      http.patch('*/api/transactions/1', async ({ request }) => {
        expect(await request.json()).toEqual({ categoryMajor: '외식', categoryMinor: '저녁' })
        changed = true
        return HttpResponse.json({ ...tx(1, -10000), editable: true, categoryMajor: '외식', categoryMinor: '저녁' })
      }),
    )
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    await user.click(await within(dialog).findByRole('row', { name: /점심 1/ }))
    expect(within(dialog).getByRole('heading', { name: '점심 1' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('대분류')).toBeInTheDocument()
    expect(within(dialog).queryByRole('grid', { name: '거래 목록' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '거래 목록으로 돌아가기' }))
    await waitFor(() => expect(within(dialog).getByRole('row', { name: /점심 1/ })).toHaveFocus())
    await user.click(within(dialog).getByRole('row', { name: /점심 1/ }))
    await user.click(within(dialog).getByRole('button', { name: /대분류/ }))
    await user.click(screen.getByRole('option', { name: '외식' }))
    await user.click(within(dialog).getByRole('button', { name: /소분류/ }))
    await user.click(screen.getByRole('option', { name: '저녁' }))
    await user.click(within(dialog).getByRole('button', { name: '저장' }))
    await waitFor(() => expect(within(dialog).getByText('거래가 없습니다.')).toBeInTheDocument())
    await waitFor(() => expect(requests).toBeGreaterThan(1))
    await waitFor(() => expect(within(dialog).getByText('거래가 없습니다.')).toBeInTheDocument())
    await waitFor(() => expect(within(dialog).getByText('0건 · 합계 ₩ 0')).toHaveFocus())
  })

  it('returns to the list after deleting an owned manual transaction', async () => {
    let deleted = false
    server.use(
      http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json(deleted ? [] : [{ ...tx(1, -10000), editable: true, source: 'MANUAL' }])),
      http.get('*/api/me/categories', () => HttpResponse.json([])),
      http.get('*/api/transactions/1/audits', () => HttpResponse.json([])),
      http.delete('*/api/transactions/1', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    await user.click(await within(dialog).findByRole('row', { name: /점심 1/ }))
    await user.click(within(dialog).getByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))
    await waitFor(() => expect(within(dialog).getByText('거래가 없습니다.')).toBeInTheDocument())
    await waitFor(() => expect(within(dialog).getByText('0건 · 합계 ₩ 0')).toHaveFocus())
  })

  it('requests the selected minor and hides the minor navigation button', async () => {
    let selected: string | null = null
    server.use(http.get('*/api/groups/10/summary/transactions', ({ request }) => {
      selected = new URL(request.url).searchParams.get('minor')
      return HttpResponse.json([])
    }))
    renderPage(<CategoryTransactionsDialog groupId={10} month="2026-10" category="식비" minor="외식" onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: '식비 · 외식' })
    await within(dialog).findByText('거래가 없습니다.')
    expect(selected).toBe('외식')
    expect(within(dialog).queryByRole('button', { name: /소분류 보기/ })).not.toBeInTheDocument()
  })

  it('starts from the list when a category is reopened', async () => {
    server.use(
      http.get('*/api/groups/10/summary/transactions', () => HttpResponse.json([tx(1, -10000)])),
      http.get('*/api/me/categories', () => HttpResponse.json([])),
      http.get('*/api/transactions/1/audits', () => HttpResponse.json([])),
    )
    function Harness() {
      const [category, setCategory] = useState<string | null>('식비')
      return <><button onClick={() => setCategory('식비')}>다시 열기</button>
        <CategoryTransactionsDialog groupId={10} month="2026-10" category={category} onClose={() => setCategory(null)} /></>
    }
    const { user } = renderPage(<Harness />)
    const dialog = await screen.findByRole('dialog', { name: '식비' })
    await user.click(await within(dialog).findByRole('row', { name: /점심 1/ }))
    await user.click(within(dialog).getByRole('button', { name: '닫기' }))
    await user.click(screen.getByRole('button', { name: '다시 열기' }))
    expect(await screen.findByRole('grid', { name: '거래 목록' })).toBeInTheDocument()
    expect(screen.queryByLabelText('대분류')).not.toBeInTheDocument()
  })
})
