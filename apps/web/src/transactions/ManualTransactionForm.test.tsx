import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { typeDateTime } from '../test/typeDateTime'
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
  beforeEach(() => {
    server.use(http.get('*/api/me/categories', () => HttpResponse.json([{ major: '식비', count: 3, minors: [{ minor: '점심', count: 2 }] }])))
  })

  it('posts a manual expense with a negative amount', async () => {
    let body: Record<string, unknown> | undefined
    server.use(http.post('*/api/me/transactions', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 99, ...body, ownerId: 1, ownerNickname: '나', currency: 'KRW', hidden: false, source: 'MANUAL', edited: false, editable: true, categoryMinor: '', paymentMethod: '현금', memo: null }, { status: 201 })
    }))
    const onDone = vi.fn()
    const { user } = renderPage(<ManualTransactionForm onDone={onDone} onCancel={vi.fn()} />)

    await typeDateTime(user, '202610051330')
    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')
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

    await typeDateTime(user, '202610051330')
    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')
    await user.type(screen.getByLabelText('내용'), 'x')
    await user.type(screen.getByLabelText('금액 (원)'), '1')
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('입력한 값을 다시 확인해 주세요.')
  })

  it('suggests my categories for major and minor', async () => {
    server.use(http.get('*/api/me/categories', () => HttpResponse.json([{ major: '식비', count: 3, minors: [{ minor: '점심', count: 2 }] }])))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} onCancel={vi.fn()} />)

    await user.type(await screen.findByRole('combobox', { name: '대분류' }), '식')
    await user.click(await screen.findByRole('option', { name: '식비' }))
    await user.click(screen.getByRole('combobox', { name: '소분류' }))

    expect(await screen.findByRole('option', { name: '점심' })).toBeInTheDocument()
  })

  it('still accepts a typed category when the suggestions fail to load', async () => {
    server.use(http.get('*/api/me/categories', () => HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 })))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} onCancel={vi.fn()} />)
    const major = await screen.findByRole('combobox', { name: '대분류' })

    await user.type(major, '새 분류')

    expect(major).toHaveValue('새 분류')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reloads suggestions after adding a transaction', async () => {
    let calls = 0
    server.use(
      http.get('*/api/me/categories', () => { calls += 1; return HttpResponse.json([]) }),
      http.post('*/api/me/transactions', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 1, ...body, ownerId: 1, ownerNickname: '나', currency: 'KRW', hidden: false, source: 'MANUAL', edited: false, editable: true, categoryMinor: '', paymentMethod: '', memo: null }, { status: 201 })
      }),
    )
    const onDone = vi.fn()
    const { user } = renderPage(<ManualTransactionForm onDone={onDone} onCancel={vi.fn()} />)
    await vi.waitFor(() => expect(calls).toBe(1))

    await typeDateTime(user, '202610051330')
    await user.type(screen.getByRole('combobox', { name: '대분류' }), '식비')
    await user.type(screen.getByLabelText('내용'), '점심')
    await user.type(screen.getByLabelText('금액 (원)'), '6500')
    await user.click(screen.getByRole('button', { name: '추가' }))

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
    await vi.waitFor(() => expect(calls).toBe(2))
  })
})
