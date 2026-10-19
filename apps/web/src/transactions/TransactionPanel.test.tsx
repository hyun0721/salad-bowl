import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderPage, testMe } from '../test/renderPage'
import TransactionPanel from './TransactionPanel'
import type { TransactionView } from './transactionsApi'

const mine: TransactionView = {
  id: 7, ownerId: testMe.userId, ownerNickname: '나', occurredAt: '2026-10-05T12:30:00', type: 'EXPENSE',
  categoryMajor: '식비', categoryMinor: '점심', description: '김밥', amount: -4000, currency: 'KRW',
  paymentMethod: '현금', memo: null, hidden: false, source: 'IMPORT', edited: false, editable: true,
}

function auditsHandler(rows: unknown[] = []) {
  server.use(http.get('*/api/transactions/:id/audits', () => HttpResponse.json(rows)))
}

describe('TransactionPanel', () => {
  it('sends only the fields that changed', async () => {
    auditsHandler()
    let body: unknown
    server.use(http.patch('*/api/transactions/7', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ ...mine, categoryMajor: '외식', edited: true })
    }))
    const { user } = renderPage(<TransactionPanel tx={mine} onClose={vi.fn()} />)

    const major = await screen.findByLabelText('대분류')
    await user.clear(major)
    await user.type(major, '외식')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다.')
    expect(body).toEqual({ categoryMajor: '외식' })
  })

  it('clears an override by saving an empty field', async () => {
    auditsHandler()
    let body: unknown
    server.use(http.patch('*/api/transactions/7', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(mine)
    }))
    const { user } = renderPage(<TransactionPanel tx={{ ...mine, memo: '내 메모', edited: true }} onClose={vi.fn()} />)

    await user.clear(await screen.findByLabelText('메모'))
    await user.click(screen.getByRole('button', { name: '저장' }))

    await screen.findByRole('status')
    expect(body).toEqual({ memo: '' })
  })

  it('lets only the owner hide, and only a manual one be deleted after confirming', async () => {
    auditsHandler()
    let deleted = false
    server.use(http.delete('*/api/transactions/7', () => {
      deleted = true
      return new HttpResponse(null, { status: 204 })
    }))
    const onClose = vi.fn()
    const { user } = renderPage(<TransactionPanel tx={{ ...mine, source: 'MANUAL' }} onClose={onClose} />)

    expect(await screen.findByLabelText('그룹 화면에서 숨기기 (본인만)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(deleted).toBe(false)
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(deleted).toBe(true)
  })

  it('hides owner-only controls for another member and shows read-only when not editable', async () => {
    auditsHandler()
    renderPage(<TransactionPanel tx={{ ...mine, ownerId: 2, ownerNickname: '멤버', editable: false }} onClose={vi.fn()} />)

    expect(await screen.findByText('다른 멤버의 거래는 볼 수만 있습니다. 관리자만 수정할 수 있습니다.')).toBeInTheDocument()
    expect(screen.queryByLabelText('그룹 화면에서 숨기기 (본인만)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('lists the audit trail', async () => {
    auditsHandler([
      { actorId: 2, actorNickname: '관리자', field: 'categoryMajor', before: null, after: '외식', changedAt: '2026-10-06T09:00:00+09:00' },
      { actorId: 1, actorNickname: '나', field: 'hidden', before: 'false', after: 'true', changedAt: '2026-10-07T10:00:00+09:00' },
    ])

    renderPage(<TransactionPanel tx={mine} onClose={vi.fn()} />)

    const history = await screen.findByRole('region', { name: '수정 이력' })
    const items = await within(history).findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('관리자 · 대분류: (원본) → 외식')
    expect(items[1]).toHaveTextContent('나 · 숨김: 아니오 → 예')
  })

  it('shows a readable error when delete is refused', async () => {
    auditsHandler()
    server.use(http.delete('*/api/transactions/7', () =>
      HttpResponse.json({ code: 'CANNOT_DELETE_IMPORTED', message: 'x' }, { status: 409 })))
    const { user } = renderPage(<TransactionPanel tx={{ ...mine, source: 'MANUAL' }} onClose={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제 확인' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('엑셀로 가져온 거래는 삭제할 수 없습니다.')
  })

  it('offers a retry when the audit trail fails to load', async () => {
    let fail = true
    server.use(http.get('*/api/transactions/:id/audits', () => fail
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 })
      : HttpResponse.json([
        { actorId: 1, actorNickname: '나', field: 'memo', before: null, after: '메모', changedAt: '2026-10-07T10:00:00+09:00' },
      ])))
    const { user } = renderPage(<TransactionPanel tx={mine} onClose={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('수정 이력을 불러오지 못했습니다.')
    fail = false
    await user.click(screen.getByRole('button', { name: '수정 이력 다시 시도' }))

    const history = screen.getByRole('region', { name: '수정 이력' })
    expect(await within(history).findByRole('listitem')).toHaveTextContent('나 · 메모: (원본) → 메모')
  })
})
