import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { renderPage } from '../test/renderPage'
import ManualTransactionForm, { toSignedAmount } from './ManualTransactionForm'

describe('toSignedAmount', () => {
  it('makes expenses and transfers negative and income positive', () => {
    expect(toSignedAmount('EXPENSE', 6500)).toBe(-6500)
    expect(toSignedAmount('TRANSFER', 1000)).toBe(-1000)
    expect(toSignedAmount('INCOME', 3000)).toBe(3000)
  })
})

describe('ManualTransactionForm', () => {
  it('posts a manual expense with a negative amount', async () => {
    let body: Record<string, unknown> | undefined
    server.use(http.post('*/api/me/transactions', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 99, ...body, ownerId: 1, ownerNickname: '나', currency: 'KRW', hidden: false, source: 'MANUAL', edited: false, editable: true, categoryMinor: '', paymentMethod: '현금', memo: null }, { status: 201 })
    }))
    const onDone = vi.fn()
    const { user } = renderPage(<ManualTransactionForm onDone={onDone} onCancel={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText('일시'), { target: { value: '2026-10-05T13:30' } })
    await user.type(screen.getByLabelText('대분류'), '식비')
    await user.type(screen.getByLabelText('내용'), '현금 점심')
    await user.type(screen.getByLabelText('금액 (원)'), '6500')
    await user.type(screen.getByLabelText('결제수단'), '현금')
    await user.click(screen.getByRole('button', { name: '추가' }))

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 99 })))
    expect(body).toMatchObject({
      occurredAt: '2026-10-05T13:30', type: 'EXPENSE', categoryMajor: '식비',
      description: '현금 점심', amount: -6500, paymentMethod: '현금',
    })
  })

  it('shows server validation errors', async () => {
    server.use(http.post('*/api/me/transactions', () =>
      HttpResponse.json({ code: 'VALIDATION_FAILED', message: 'x' }, { status: 400 })))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText('일시'), { target: { value: '2026-10-05T13:30' } })
    await user.type(screen.getByLabelText('대분류'), '식비')
    await user.type(screen.getByLabelText('내용'), 'x')
    await user.type(screen.getByLabelText('금액 (원)'), '1')
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('입력한 값을 다시 확인해 주세요.')
  })
})
