import { afterEach, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderPage } from '../test/renderPage'
import { mockViewport } from '../test/mockViewport'
import { AmountMaskProvider } from '../common/AmountMask'
import AppLayout from './AppLayout'

afterEach(() => localStorage.clear())
it.each([true, false])('opens settings and persists all three switches (narrow=%s)', async (narrow) => {
  mockViewport(narrow)
  const { user } = renderPage(<AmountMaskProvider><AppLayout /></AmountMaskProvider>, {
    groups: [{ groupId: 1, name: '아주 긴 가상 그룹 이름으로 말줄임 확인', role: 'ADMIN', sharing: true }],
  })
  await user.click(await screen.findByRole('button', { name: '설정' }))
  const dialog = screen.getByRole('dialog', { name: '설정' })
  expect(within(dialog).getByRole('heading', { name: '금액 숨기기' })).toBeInTheDocument()
  for (const name of ['수입 금액 숨기기', '지출 금액 숨기기', '이체 금액 숨기기']) {
    const toggle = within(dialog).getByRole('switch', { name })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(toggle).toBeChecked()
  }
  expect(JSON.parse(localStorage.getItem('saladbowl.amountMask')!)).toEqual({ INCOME: true, EXPENSE: true, TRANSFER: true })
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: '설정' }))
  expect(screen.getByRole('switch', { name: '지출 금액 숨기기' })).toBeChecked()
})
