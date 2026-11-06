import { screen, waitFor } from '@testing-library/react'
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
    const { user } = renderPage(<ManualTransactionForm onDone={onDone} />)

    await typeDateTime(user, '202610051330')
    await user.click(screen.getByRole('button', { name: /대분류/ }))
    await user.click(await screen.findByRole('option', { name: '식비' }))
    await user.type(screen.getByLabelText('내용'), '현금 점심')
    await user.type(screen.getByLabelText('금액 (원)'), '6500')
    await user.type(screen.getByLabelText('결제수단'), '현금')
    await user.click(screen.getByRole('button', { name: '추가' }))

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 99 })))
    expect(body).not.toHaveProperty('categoryMinor')
    expect(body).toMatchObject({
      occurredAt: '2026-10-05T13:30', type: 'EXPENSE', categoryMajor: '식비',
      description: '현금 점심', amount: -6500, paymentMethod: '현금',
    })
  })

  it('shows server validation errors', async () => {
    server.use(http.post('*/api/me/transactions', () =>
      HttpResponse.json({ code: 'VALIDATION_FAILED', message: 'x' }, { status: 400 })))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} />)

    await typeDateTime(user, '202610051330')
    await user.click(screen.getByRole('button', { name: /대분류/ }))
    await user.click(await screen.findByRole('option', { name: '식비' }))
    await user.type(screen.getByLabelText('내용'), 'x')
    await user.type(screen.getByLabelText('금액 (원)'), '1')
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('입력한 값을 다시 확인해 주세요.')
  })

  it('requires an existing major and resets minor to none when major changes', async () => {
    server.use(http.get('*/api/me/categories', () => HttpResponse.json([
      { major: '식비', count: 3, minors: [{ minor: '점심', count: 2 }] },
      { major: '생활', count: 1, minors: [] },
    ])))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} />)
    const major = await screen.findByRole('button', { name: /대분류/ })
    expect(major).toHaveTextContent('선택')
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /소분류/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /소분류/ })).toHaveTextContent('소분류 없음')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await waitFor(() => expect(major).toBeEnabled())
    await user.click(major)
    expect(screen.getAllByRole('option').map((item) => item.textContent)).toEqual(['식비', '생활'])
    await user.click(screen.getByRole('option', { name: '식비' }))
    expect(screen.getByRole('button', { name: '추가' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /소분류/ }))
    expect(screen.getAllByRole('option').map((item) => item.textContent)).toEqual(['소분류 없음', '점심'])
    await user.click(screen.getByRole('option', { name: '점심' }))
    await user.click(major)
    await user.click(screen.getByRole('option', { name: '생활' }))
    expect(screen.getByRole('button', { name: /소분류/ })).toHaveTextContent('소분류 없음')
  })

  it('disables major while loading and explains an empty category list', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    server.use(http.get('*/api/me/categories', async () => { await pending; return HttpResponse.json([]) }))
    renderPage(<ManualTransactionForm onDone={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /대분류/ })).toBeDisabled()
    expect(screen.queryByText('엑셀을 먼저 업로드하면 분류를 고를 수 있습니다.')).not.toBeInTheDocument()
    release()
    expect(await screen.findByText('엑셀을 먼저 업로드하면 분류를 고를 수 있습니다.')).toHaveClass('muted')
    expect(screen.getByRole('button', { name: /대분류/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
  })

  it('shows a category error and retries without allowing custom input', async () => {
    let fail = true
    server.use(http.get('*/api/me/categories', () => fail
      ? HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 })
      : HttpResponse.json([{ major: '식비', count: 1, minors: [] }])))
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('분류를 불러오지 못했습니다.')
    expect(screen.getByRole('button', { name: /대분류/ })).toBeDisabled()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('엑셀을 먼저 업로드하면 분류를 고를 수 있습니다.')).not.toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '분류 다시 시도' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /대분류/ })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps a saved draft major selected even when absent from the list', async () => {
    const onDraftChange = vi.fn()
    const { user } = renderPage(<ManualTransactionForm onDone={vi.fn()} onDraftChange={onDraftChange}
      loadDraft={() => ({ occurredAt: '', type: 'EXPENSE', major: '보관 분류', minor: '', description: '', amount: null, payment: '', memo: '' })} />)
    const major = await screen.findByRole('button', { name: /대분류/ })
    expect(major).toHaveTextContent('보관 분류')
    await waitFor(() => expect(major).toBeEnabled())
    await user.click(major)
    expect(screen.getByRole('option', { name: '보관 분류' })).toHaveAttribute('aria-selected', 'true')
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ major: '보관 분류' }))
  })

  it('reloads suggestions after adding a transaction', async () => {
    let calls = 0
    server.use(
      http.get('*/api/me/categories', () => { calls += 1; return HttpResponse.json([{ major: '식비', count: 1, minors: [] }]) }),
      http.post('*/api/me/transactions', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 1, ...body, ownerId: 1, ownerNickname: '나', currency: 'KRW', hidden: false, source: 'MANUAL', edited: false, editable: true, categoryMinor: '', paymentMethod: '', memo: null }, { status: 201 })
      }),
    )
    const onDone = vi.fn()
    const { user } = renderPage(<ManualTransactionForm onDone={onDone} />)
    await vi.waitFor(() => expect(calls).toBe(1))

    await typeDateTime(user, '202610051330')
    await user.click(screen.getByRole('button', { name: /대분류/ }))
    await user.click(await screen.findByRole('option', { name: '식비' }))
    await user.type(screen.getByLabelText('내용'), '점심')
    await user.type(screen.getByLabelText('금액 (원)'), '6500')
    await user.click(screen.getByRole('button', { name: '추가' }))

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
    await vi.waitFor(() => expect(calls).toBe(2))
  })
})
